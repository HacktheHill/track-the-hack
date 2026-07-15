#!/usr/bin/env bash
set -euo pipefail

: "${AZURE_RESOURCE_GROUP:?Set AZURE_RESOURCE_GROUP}"
app_name="${AZURE_CONTAINERAPP_NAME:-track-the-hack}"
app_id="$(az containerapp show --resource-group "$AZURE_RESOURCE_GROUP" --name "$app_name" --query id --output tsv)"
template="$(mktemp)"
trap 'shred --remove "$template"' EXIT

az containerapp show --resource-group "$AZURE_RESOURCE_GROUP" --name "$app_name" --output json \
  | jq '{properties:{template:.properties.template}}
    | .properties.template.containers[0].probes=[
      {type:"Liveness",httpGet:{path:"/api/healthz",port:3000,scheme:"HTTP"},initialDelaySeconds:10,periodSeconds:30,timeoutSeconds:5,failureThreshold:3,successThreshold:1},
      {type:"Readiness",httpGet:{path:"/api/readyz",port:3000,scheme:"HTTP"},initialDelaySeconds:10,periodSeconds:10,timeoutSeconds:5,failureThreshold:6,successThreshold:1}
    ]' > "$template"

az rest \
  --method patch \
  --url "https://management.azure.com${app_id}?api-version=2025-07-01" \
  --body "@${template}" \
  --output none
