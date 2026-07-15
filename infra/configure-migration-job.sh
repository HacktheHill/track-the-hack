#!/usr/bin/env bash
set -euo pipefail

: "${AZURE_RESOURCE_GROUP:?Set AZURE_RESOURCE_GROUP}"
: "${AZURE_CONTAINERAPPS_ENVIRONMENT:?Set AZURE_CONTAINERAPPS_ENVIRONMENT}"
: "${AZURE_ACR_LOGIN_SERVER:?Set AZURE_ACR_LOGIN_SERVER}"
: "${MIGRATOR_IDENTITY_ID:?Set MIGRATOR_IDENTITY_ID}"
: "${MIGRATOR_VAULT_NAME:?Set MIGRATOR_VAULT_NAME}"

job_name="${MIGRATION_JOB_NAME:-track-the-hack-migrate}"
bootstrap_image="${MIGRATION_IMAGE:-${AZURE_ACR_LOGIN_SERVER}/track-the-hack-migrate:bootstrap}"
registry_id="$(az acr show --name "${AZURE_ACR_LOGIN_SERVER%%.*}" --query id --output tsv)"
vault_id="$(az keyvault show --name "$MIGRATOR_VAULT_NAME" --query id --output tsv)"
principal_id="$(az identity show --ids "$MIGRATOR_IDENTITY_ID" --query principalId --output tsv)"

az role assignment create \
  --assignee-object-id "$principal_id" \
  --assignee-principal-type ServicePrincipal \
  --role acdd72a7-3385-48ef-bd42-f606fba81ae7 \
  --scope "$registry_id" \
  --output none 2>/dev/null || true

az role assignment create \
  --assignee-object-id "$principal_id" \
  --assignee-principal-type ServicePrincipal \
  --role "Key Vault Secrets User" \
  --scope "$vault_id" \
  --output none 2>/dev/null || true

if az containerapp job show --resource-group "$AZURE_RESOURCE_GROUP" --name "$job_name" >/dev/null 2>&1; then
  az containerapp job update \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$job_name" \
    --image "$bootstrap_image" \
    --output none
else
  az containerapp job create \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$job_name" \
    --environment "$AZURE_CONTAINERAPPS_ENVIRONMENT" \
    --trigger-type Manual \
    --replica-timeout 1800 \
    --replica-retry-limit 1 \
    --parallelism 1 \
    --replica-completion-count 1 \
    --image "$bootstrap_image" \
    --cpu 0.5 \
    --memory 1Gi \
    --mi-user-assigned "$MIGRATOR_IDENTITY_ID" \
    --registry-server "$AZURE_ACR_LOGIN_SERVER" \
    --registry-identity "$MIGRATOR_IDENTITY_ID" \
    --secrets "database-url=keyvaultref:https://${MIGRATOR_VAULT_NAME}.vault.azure.net/secrets/app-database-url,identityref:${MIGRATOR_IDENTITY_ID}" \
    --env-vars DATABASE_URL=secretref:database-url \
    --output none
fi

az containerapp job show \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$job_name" \
  --query '{name:name,trigger:properties.configuration.triggerType,identity:identity.type,image:properties.template.containers[0].image}'
