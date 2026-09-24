# Audit ledger end-to-end acceptance and closeout

This runbook is the authoritative procedure for proving the structured audit
ledger in development and production, ending the temporary legacy dual-write,
and eventually removing the legacy `Log` table. Follow every applicable phase
and retain the evidence described here. The audit-ledger project is complete
only when the final checklist is fully signed off.

An audit timestamp proves when Track processed an admission or action. It does
not prove when a participant physically arrived, when they left, or how long
they remained at the event.

## Definition of done

All of the following must be true:

1. focused, MySQL-backed, browser, and production-image tests pass;
2. a designated production test organizer and participant complete the scanner
   matrix while Cloudflare Access remains enabled;
3. every expected database event is reconciled to the matching Azure JSON line;
4. successful admissions are distinguishable from duplicate, capped, stale,
   and rejected attempts;
5. the daily database purge and 90-day Azure table retention are verified;
6. sensitive-data queries return zero results;
7. the legacy backfill is reconciled against the recorded migration execution
   window, including its boundary rows;
8. legacy writes are removed in a reviewed release and their stop time is recorded;
9. at least 90 complete days after that stop time, a reviewed migration removes
   the legacy `Log` table after backup and retention checks; and
10. the closeout record contains no skipped check without an owner and due date.

## Roles and evidence record

Use four roles, even if one person fills several of them:

- **Release operator:** deploys reviewed application revisions.
- **Infrastructure operator:** reviews and applies the saved Terraform plan.
- **Test organizer:** performs scans and manual corrections.
- **Verifier:** compares API/UI, MySQL, and Azure evidence and signs off.

Create a private closeout record before testing. Do not put participant names,
emails, capabilities, cookies, claim links, or database credentials in it. Record:

```text
Application SHA:
Migration execution:
Container App revision:
Infrastructure SHA and apply run:
Test window in UTC:
Organizer User.id:
Test Hacker.id:
Event ids and scanner workflows:
Expected maximum for each event:
Audit event ids and correlation ids:
Retention execution:
Legacy migration execution name, start, and end in UTC:
Legacy-write stop time in UTC:
Earliest legacy-table removal time:
Cleanup completed by:
Verifier and verification time:
Exceptions, owner, and due date:
```

Store opaque IDs only in this record. Resolve a current organizer display name
only in an authorized database view when an investigation requires it.

## Current production baseline and open closeout work

Read-only checks on 2026-09-24 UTC verified that:

- `ContainerAppConsoleLogs_CL` has 90-day interactive and total retention;
- the automatic `track-the-hack-audit-retention-29837280` execution started at
  08:00 UTC and succeeded using migration image `ddb69b5`; and
- `tracker.hackthehill.com` still returned the Cloudflare Access `302` gate.

At the same check, the live application and migration job used image `d1c7686`,
while the retention job template still used `ddb69b5`. The schedule and database
path are proven, but current-image parity is still open. Resolve it through the
reviewed application deployment workflow and verify the resulting job template
before closing Phase 6. Unless a private closeout record proves otherwise, the
controlled scanner matrix, MySQL/Azure reconciliation, legacy-backfill
reconciliation, dual-write shutdown, 90-day wait, and final `Log` removal also
remain open. Never mark those complete from the existence of this runbook alone.

## Safety rules

- Keep Cloudflare Access enabled for the entire production acceptance.
- Use only an explicitly designated production test participant. Never scan or
  mutate a real attendee merely to create evidence.
- Use test events whose scanner configuration is reviewed before the first scan.
- Record baseline `Presence.value` values before testing. Prefer a participant
  with no existing `Presence` for the first-admission case.
- Do not edit or delete `AuditEvent` rows. Test events are retained normally and
  expire through the 90-day retention job.
- Restore mutable `Presence` counters through the authorized scanner correction
  UI, not direct SQL. A zero-valued `Presence` row may remain.
- Run SQL only through the approved private administrative path. Never copy the
  production `DATABASE_URL` into a shell transcript, issue, or closeout record.
- Use a database identity limited to `SELECT` for reconciliation. Prisma Studio
  is not the acceptance query runner because it permits edits; do not expose the
  private MySQL endpoint or create an ad hoc public firewall rule for testing.
- Do not replay legacy `details` into Azure.
- Stop if any expected successful mutation lacks its database audit event, if a
  database event has the wrong actor/subject/resource, or if sensitive data is
  found in Azure. Treat those as release failures, not documentation exceptions.

## Phase 1: automated development gate

Use Node 24, Docker, the repository's loopback MySQL database, and Chromium.

```sh
npm ci --include=dev
npm run verify:dev
npx prisma validate
npx prisma generate
git diff --check
```

The full gate must prove real MySQL migrations and transactions, local organizer
authentication, browser scanner input, all four scanner response allowlists,
aggregate metrics, and production-build PWA behavior. In the focused audit suite,
confirm coverage for:

- strict schema validation and one-line serialization;
- sensitive key/value rejection;
- first scan, increment, duplicate, cap, applied adjustment, stale adjustment,
  and out-of-bounds adjustment;
- every scanner workflow;
- database mutation rollback when the ledger insert fails;
- no successful-admission event when the mutation fails;
- concurrency at the configured cap;
- retention cutoff and bounded batches; and
- representative legacy migration fixtures, including `legacy.migrated`.

Hosted CI must run a clean MySQL migration. If local Docker is unavailable,
record the local skip and link the successful hosted MySQL job; do not describe
the skipped local integration as passed.

## Phase 2: production preflight

Deploy only reviewed `main` commits. Record the output of these read-only checks:

```sh
gh run list --workflow container.yml --branch main --limit 5

az containerapp show \
  --resource-group track-the-hack \
  --name track-the-hack \
  --query '{revision:properties.latestRevisionName,status:properties.runningStatus,image:properties.template.containers[0].image,traffic:properties.configuration.ingress.traffic}' \
  --output json

az containerapp job execution list \
  --resource-group track-the-hack \
  --name track-the-hack-migrate \
  --query '[0:5].{name:name,status:properties.status,start:properties.startTime,end:properties.endTime}' \
  --output table

curl --silent --show-error --output /dev/null --write-out '%{http_code} %{redirect_url}\n' \
  https://tracker.hackthehill.com/
```

Require a running revision on the intended immutable SHA, 100% traffic to the
latest revision, a successful migration execution, and a `302` redirect to the
Cloudflare Access login host. A `523`, public `200`, unexpected revision, failed
migration, or split traffic blocks acceptance.

Before scanning, capture these database baselines through the approved private
read-only administrative session:

```sql
SET @start_utc = UTC_TIMESTAMP(3);
SET @hacker_id = '<designated-hacker-id>';

SELECT `id`, `eventId`, `value`, `updatedAt`
FROM `Presence`
WHERE `hackerId` = @hacker_id
ORDER BY `eventId`;

SELECT COUNT(*) AS preexisting_audit_events
FROM `AuditEvent`
WHERE `subjectType` = 'hacker' AND `subjectId` = @hacker_id;
```

Record `@start_utc`. Do not infer a baseline from Azure because ingestion is
asynchronous.

## Phase 3: controlled scanner matrix

Use the participant's normal QR and the normal protected scanner UI. Record the
UI/API result, count before and after, organizer ID, hacker ID, event ID, and UTC
time for each action.

| Case              | Configuration and action                                                                         | Required result                                                  | Admission? |
| ----------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ---------- |
| First admission   | No existing positive presence; scan once                                                         | `scanner.scan` / `recorded`; `0 -> 1`                            | Yes        |
| Deliberate repeat | `maxCheckIns > 1`; remove QR, then scan again                                                    | `scanner.scan` / `incremented`; count increases by one           | Yes        |
| Duplicate         | `maxCheckIns` blank or `1`; scan again                                                           | `scanner.scan` / `duplicate`; count unchanged                    | No         |
| Cap               | Reach a finite maximum, then scan once more                                                      | `scanner.scan` / `limit`; count unchanged                        | No         |
| Correction        | Use `+` or `-` within bounds                                                                     | `scanner.adjust` / `applied`; requested and applied deltas agree | No         |
| Stale correction  | Open two organizer sessions; let one change the count, then submit the other's older expectation | `scanner.adjust` / `stale`; server count wins                    | No         |
| Lower bound       | At zero, request another decrement                                                               | `scanner.adjust` / `out_of_bounds`; count remains zero           | No         |
| Upper bound       | At a finite cap, request another increment                                                       | `scanner.adjust` / `out_of_bounds`; count remains at the cap     | No         |

Cover `ATTENDANCE`, `CHECK_IN`, `MERCHANDISE`, and `FOOD` at least once across
the matrix. Confirm each workflow returns only its existing allowlisted response
fields. Do not change the QR format or use a direct API call as a substitute for
the primary UI journey.

For each scanner event, the canonical fields must be:

- `actor.type = organizer` and `actor.id = User.id`;
- `subject.type = hacker` and `subject.id = Hacker.id`;
- `resource.type = event` and `resource.id = Event.id`;
- `data.workflow` equal to the selected station workflow;
- `data.presenceId` equal to the affected aggregate row;
- correct `beforeCount`, `afterCount`, `requestedDelta`, and `appliedDelta` for
  the action; and
- a UTC `occurredAt`, UUID event ID, and UUID correlation ID.

Only `recorded` and `incremented` are successful admissions. Never include
`duplicate`, `limit`, `stale`, or `out_of_bounds` in attendance totals.

## Phase 4: MySQL reconciliation

Immediately after the scanner matrix, use the same authorized read-only database
session. Set the recorded window and opaque IDs:

```sql
SET @start_utc = '<recorded-start-utc>';
SET @end_utc = UTC_TIMESTAMP(3);
SET @organizer_id = '<organizer-user-id>';
SET @hacker_id = '<designated-hacker-id>';

SELECT
  `id`, `occurredAt`, `name`, `outcome`, `correlationId`,
  `actorType`, `actorId`, `subjectType`, `subjectId`,
  `resourceType`, `resourceId`, `data`
FROM `AuditEvent`
WHERE `occurredAt` BETWEEN @start_utc AND @end_utc
  AND (`actorId` = @organizer_id OR `subjectId` = @hacker_id)
ORDER BY `occurredAt`, `createdAt`, `id`;

SELECT `eventId`, `value`, `updatedAt`
FROM `Presence`
WHERE `hackerId` = @hacker_id
ORDER BY `eventId`;
```

Require one immutable database event for every completed request in the matrix,
including no-op/rejected attempts. Counts must form a coherent sequence for each
event. Request completion order, not client clock time, is authoritative during
races. Confirm that cleanup changed only `Presence`; the `AuditEvent` history
must remain intact.

Also exercise one state-changing non-scanner path appropriate to the release,
such as a designated test participant RSVP transition. Confirm its canonical
event uses the same envelope. Do not generate claim links or role changes solely
for audit testing unless those workflows are independently under acceptance.

## Phase 5: Azure reconciliation and privacy

Azure ingestion is asynchronous. Poll the query during the recorded window for
up to 15 minutes before opening an ingestion incident. Start with:

```kusto
let StartUtc = datetime(<recorded-start-utc>);
let EndUtc = datetime(<recorded-end-utc>);
let AuditEvents = ContainerAppConsoleLogs_CL
| where TimeGenerated between (StartUtc .. EndUtc + 15m)
| extend audit = parse_json(Log_s)
| where tostring(audit.kind) == "track.audit"
| where toint(audit.schemaVersion) == 1;
AuditEvents
| where tostring(audit.actor.id) == "<organizer-user-id>"
   or tostring(audit.subject.id) == "<designated-hacker-id>"
| project IngestedAt=TimeGenerated,
          OccurredAt=todatetime(audit.occurredAt),
          Id=tostring(audit.id), CorrelationId=tostring(audit.correlationId),
          Name=tostring(audit.name), Outcome=tostring(audit.outcome),
          ActorId=tostring(audit.actor.id), SubjectId=tostring(audit.subject.id),
          EventId=tostring(audit.resource.id), Data=audit.data
| order by OccurredAt asc
```

Match Azure to MySQL by audit `id`, then compare every canonical field. Azure may
ingest later, but it must not change the event. Record missing, duplicate, or
malformed lines as failures.

Run the privacy query over the test window and require zero results:

```kusto
ContainerAppConsoleLogs_CL
| where TimeGenerated between (datetime(<recorded-start-utc>) .. datetime(<recorded-end-utc>) + 15m)
| where Log_s has '"kind":"track.audit"'
| where Log_s matches regex @"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"
   or Log_s has_any ('"email"', '"cookie"', '"token"', '"capability"',
                     '"claimUrl"', '"requestBody"', '"tallyId"',
                     'CF-Access-Client-Secret', 'Bearer ')
| project TimeGenerated, Log_s
```

Use the investigation queries in `AUDIT_LOGS.md` for organizer, participant,
event, outcome, malformed-line, and unsupported-version checks.

## Phase 6: retention acceptance

Verify the managed Azure table policy:

```sh
az monitor log-analytics workspace table show \
  --resource-group hack-the-hill-platform \
  --workspace-name hack-the-hill-logs \
  --name ContainerAppConsoleLogs_CL \
  --query '{retentionInDays:retentionInDays,totalRetentionInDays:totalRetentionInDays}' \
  --output json
```

Both values must be `90`.

Verify the scheduled database job:

```sh
az containerapp job show \
  --resource-group track-the-hack \
  --name track-the-hack-audit-retention \
  --query '{state:properties.provisioningState,trigger:properties.configuration.triggerType,cron:properties.configuration.scheduleTriggerConfig.cronExpression,image:properties.template.containers[0].image}' \
  --output json

az containerapp job execution list \
  --resource-group track-the-hack \
  --name track-the-hack-audit-retention \
  --query '[0:10].{name:name,status:properties.status,start:properties.startTime,end:properties.endTime,image:properties.template.containers[0].image}' \
  --output table
```

Require `Schedule`, `0 8 * * *`, `Succeeded`, and the current migration-image
SHA. Observe at least one automatic 08:00 UTC execution. A manual success proves
the executable and database path, but does not replace observing the schedule.
If the job template lags the production migration job, inspect the application
deployment run, correct the reviewed resource-detection/update path, and redeploy
from `main`; do not conceal drift with an undocumented manual image change.

Before a reviewed manual execution, use the read-only database session to record
the expected candidate count, then obtain action-time approval for that bounded
retention deletion:

```sql
SELECT COUNT(*) AS rows_older_than_90_days
FROM `AuditEvent`
WHERE `occurredAt` < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 90 DAY);
```

Start the job only after the target and count have been reviewed:

```sh
az containerapp job start \
  --resource-group track-the-hack \
  --name track-the-hack-audit-retention \
  --query name --output tsv
```

Wait for that exact execution to reach `Succeeded`, then inspect its console
line. It must contain `kind = track.audit.retention`, a UTC cutoff, and a numeric
deleted count. Confirm rows exactly at or newer than the cutoff remain and that
`Presence` totals are unchanged. Never insert fabricated production rows older
than 90 days merely to test deletion.

## Phase 7: reconcile the legacy backfill

The migration evaluates `UTC_TIMESTAMP(3) - 90 days` inside its `INSERT`, but
the original migration did not persist that evaluation timestamp. Therefore,
use the execution start and end as a bounded window and inspect both boundary
bands instead of claiming a more precise cutoff. For the initial production
rollout, `track-the-hack-migrate-rrj4xkc` ran from
`2026-09-24 04:47:19.000` through `2026-09-24 04:47:54.000` UTC. Replace these
values for another environment.

```sql
SET @migration_start = '2026-09-24 04:47:19.000';
SET @migration_end = '2026-09-24 04:47:54.000';
SET @certain_backfill_start = DATE_SUB(@migration_end, INTERVAL 90 DAY);
SET @possible_backfill_start = DATE_SUB(@migration_start, INTERVAL 90 DAY);

SELECT COUNT(*) AS source_rows
FROM `Log`
WHERE `timestamp` >= @certain_backfill_start
  AND `timestamp` < @migration_start;

SELECT COUNT(*) AS joined_backfill_rows
FROM `Log` AS l
JOIN `AuditEvent` AS a ON a.`id` = CONCAT('legacy-', l.`id`)
WHERE l.`timestamp` >= @certain_backfill_start
  AND l.`timestamp` < @migration_start;

SELECT l.`id`, l.`timestamp`, l.`route`, l.`action`, l.`sourceType`
FROM `Log` AS l
LEFT JOIN `AuditEvent` AS a ON a.`id` = CONCAT('legacy-', l.`id`)
WHERE l.`timestamp` >= @certain_backfill_start
  AND l.`timestamp` < @migration_start
  AND a.`id` IS NULL
ORDER BY l.`id`;

SELECT a.`id`, a.`occurredAt`, a.`name`, a.`outcome`
FROM `AuditEvent` AS a
LEFT JOIN `Log` AS l ON a.`id` = CONCAT('legacy-', l.`id`)
WHERE a.`id` LIKE 'legacy-%' AND l.`id` IS NULL
ORDER BY a.`id`;

SELECT
  l.`id`, l.`timestamp`,
  CASE WHEN a.`id` IS NULL THEN 'not_backfilled' ELSE 'backfilled' END AS `status`
FROM `Log` AS l
LEFT JOIN `AuditEvent` AS a ON a.`id` = CONCAT('legacy-', l.`id`)
WHERE (l.`timestamp` >= @possible_backfill_start
       AND l.`timestamp` < @certain_backfill_start)
   OR (l.`timestamp` >= @migration_start
       AND l.`timestamp` <= @migration_end)
ORDER BY l.`timestamp`, l.`id`;

SELECT `name`, `outcome`, COUNT(*) AS records
FROM `AuditEvent`
WHERE `id` LIKE 'legacy-%'
GROUP BY `name`, `outcome`
ORDER BY `name`, `outcome`;

SELECT `id`, `name`, `outcome`
FROM `AuditEvent`
WHERE `id` LIKE 'legacy-%'
  AND NOT (
    (`name` = 'scanner.scan' AND `outcome` IN ('recorded', 'incremented', 'duplicate', 'limit'))
    OR (`name` = 'scanner.adjust' AND `outcome` IN ('applied', 'stale', 'out_of_bounds'))
    OR (`name` = 'organizer.roles.updated' AND `outcome` = 'applied')
    OR (`name` = 'participant.claim.issued' AND `outcome` = 'issued')
    OR (`name` = 'participant.claim.redeemed' AND `outcome` = 'redeemed')
    OR (`name` = 'participant.rsvp.updated' AND `outcome` IN ('attending', 'declined'))
    OR (`name` = 'participant.rsvp.cancelled' AND `outcome` = 'cancelled')
    OR (`name` = 'legacy.migrated' AND `outcome` = 'migrated')
  )
ORDER BY `id`;
```

Require equal certain-source/joined counts, zero missing rows, and zero orphaned
legacy events. Classify every lower-bound or concurrent-write boundary row from
the boundary query; do not silently omit it from the closeout record. The final
query must return zero rows: a mapped legacy record must still use a registered
V1 name/outcome pair. If it does not, stop closeout and review an additive,
append-only correction strategy; never update or delete the historical row in
place. Review every mapped action/route grouping, including `legacy.migrated`,
without inventing meaning. For legacy scanner rows, verify a sample resolves
`subjectId` to the expected `Hacker.id` and `resourceId` to the expected
`Event.id` through the historical `Presence`. Keep `legacyDetails` in MySQL only.

## Phase 8: end dual-writing

Do this only after Phases 1–7 pass and at least one normal production release has
operated with the structured ledger.

1. Open a focused application PR that removes production calls to the legacy
   `log()` helper while preserving all canonical `AuditEvent` writes.
2. Use `rg -n '\blog\(' src` and a code review to prove no state-changing path
   still relies on `Log`. Do not remove the model or table in this PR.
3. Run the complete automated gate and repeat one controlled production scanner
   mutation plus one non-scanner mutation after deployment.
4. Record the deployment completion as `legacyWriteStoppedAt` in UTC.
5. Verify new canonical events appear in MySQL and Azure while this query remains
   unchanged across the controlled mutations:

    ```sql
    SELECT MAX(`timestamp`) AS final_legacy_write, COUNT(*) AS final_legacy_rows
    FROM `Log`;
    ```

6. Confirm no code, dashboard, alert, migration helper, or operational query reads
   `Log` as authoritative. Update references in the same PR.

The earliest table-removal time is `legacyWriteStoppedAt + 90 complete days`.
Record the calculated UTC timestamp; do not use the original ledger deployment
date if legacy writes continued after it.

## Phase 9: remove the legacy table

After the earliest removal time, and only after a successful scheduled purge has
run beyond that cutoff:

1. verify the latest production backup and documented restore procedure;
2. confirm `Log.MAX(timestamp)` is not later than `legacyWriteStoppedAt`;
3. confirm all retained investigations use `AuditEvent` or Azure;
4. create a separately reviewed Prisma migration that drops `Log` and remove the
   Prisma model and unused helper;
5. run empty-schema and production-equivalent migration tests;
6. review the production migration plan and deploy through the normal migration-first
   workflow;
7. verify the application, scanner matrix sample, Azure mirror, scheduled purge,
   and Cloudflare Access again; and
8. remove the temporary legacy/backfill instructions from active operations docs,
   retaining the closeout evidence in the private deployment record.

Do not delete `Presence`, `AuditEvent`, participant, organizer, or event records as
part of the legacy-table migration.

## Final sign-off checklist

- [ ] Automated development and hosted MySQL gates passed.
- [ ] Production SHA, revision, migration, health, and traffic recorded.
- [ ] Cloudflare Access remained enabled.
- [ ] Every scanner outcome and all four workflows were exercised safely.
- [ ] MySQL event envelopes and `Presence` counts reconciled.
- [ ] Azure matched MySQL by event ID and correlation ID.
- [ ] Sensitive-data and malformed/schema-version queries returned zero findings.
- [ ] Azure table retention is 90/90 days.
- [ ] Retention-job template matched the production migration image.
- [ ] Manual retention execution succeeded without changing `Presence`.
- [ ] At least one scheduled 08:00 UTC retention execution succeeded.
- [ ] Legacy backfill counts, joins, mappings, boundary rows, V1 pairs, and unknowns were reviewed.
- [ ] Legacy writes were removed and `legacyWriteStoppedAt` was recorded.
- [ ] Ninety complete days elapsed after the final legacy write.
- [ ] Backup and restore evidence was reviewed before table removal.
- [ ] The legacy `Log` table and helper were removed by a separate migration.
- [ ] Final production smoke, scanner sample, Azure query, and Access check passed.
- [ ] Test `Presence` counters were restored and retained audit test IDs recorded.
- [ ] No exception remains without an owner and due date.

When every box is checked, no audit-ledger rollout, validation, retention, or
legacy-migration work remains.
