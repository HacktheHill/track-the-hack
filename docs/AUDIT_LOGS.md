# Structured audit and attendance ledger

`AuditEvent` is the authoritative, append-only operational ledger. `Presence`
remains the current participant/event counter. A scanner event records the
server-observed processing time; it does not prove how long someone stayed.

Events use opaque Track identifiers only. Do not add names, email addresses,
Tally identifiers, application answers, cookies, capabilities, signed URLs, or
free-form request/error content. Times are UTC and the application may convert
them to `America/Toronto` for display.

The app mirrors committed events to standard output as one-line JSON with
`kind == "track.audit"`. Azure Container Apps forwards this stream to
`ContainerAppConsoleLogs_CL`. Azure is a searchable mirror, not the system of
record. Its ingestion can lag or lose a line after the database commits.

## Log Analytics queries

All examples begin with the same parser:

```kusto
let AuditEvents = ContainerAppConsoleLogs_CL
| extend audit = parse_json(Log_s)
| where tostring(audit.kind) == "track.audit"
| where toint(audit.schemaVersion) == 1;
```

Successful admissions by event and organizer:

```kusto
AuditEvents
| where tostring(audit.name) == "scanner.scan"
| where tostring(audit.outcome) in ("recorded", "incremented")
| project Time=todatetime(audit.occurredAt), EventId=tostring(audit.resource.id),
          OrganizerId=tostring(audit.actor.id), HackerId=tostring(audit.subject.id),
          Workflow=tostring(audit.data.workflow), Count=toint(audit.data.afterCount)
| order by Time desc
```

One participant's scanner history:

```kusto
AuditEvents
| where tostring(audit.name) startswith "scanner."
| where tostring(audit.subject.id) == "<hacker-id>"
| project Time=todatetime(audit.occurredAt), Name=tostring(audit.name),
          Outcome=tostring(audit.outcome), EventId=tostring(audit.resource.id),
          OrganizerId=tostring(audit.actor.id), Data=audit.data
| order by Time desc
```

One organizer's actions:

```kusto
AuditEvents
| where tostring(audit.actor.type) == "organizer"
| where tostring(audit.actor.id) == "<organizer-user-id>"
| project Time=todatetime(audit.occurredAt), Name=tostring(audit.name),
          Outcome=tostring(audit.outcome), Subject=audit.subject, Resource=audit.resource
| order by Time desc
```

No-op and reconciliation outcomes:

```kusto
AuditEvents
| where tostring(audit.name) startswith "scanner."
| where tostring(audit.outcome) in ("duplicate", "limit", "stale", "out_of_bounds")
| summarize Count=count() by Name=tostring(audit.name), Outcome=tostring(audit.outcome),
                            Workflow=tostring(audit.data.workflow)
```

Counts by workflow and outcome:

```kusto
AuditEvents
| where tostring(audit.name) startswith "scanner."
| summarize Count=count() by Workflow=tostring(audit.data.workflow), Outcome=tostring(audit.outcome)
| order by Workflow asc, Outcome asc
```

Malformed or unsupported audit lines:

```kusto
ContainerAppConsoleLogs_CL
| where Log_s has '"kind":"track.audit"'
| extend audit = parse_json(Log_s)
| where isempty(tostring(audit.id)) or toint(audit.schemaVersion) != 1
| project TimeGenerated, RevisionName_s, Log_s
```

## Retention

Both the database ledger and Azure console table retain identifiable audit data
for 90 days. The daily `audit:purge` job deletes database rows where
`occurredAt < now UTC - 90 days` in 1,000-row batches. A row exactly at the
cutoff remains until a later run. The job never changes `Presence` or other
domain state, and Azure expiration need not occur at the same second.

## Deployment and migration checks

The additive migration backfills only the preceding 90 days of `Log`. Before
ending the dual-write release, compare:

```sql
SELECT COUNT(*) AS legacy_source
FROM `Log`
WHERE `timestamp` >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 90 DAY);

SELECT COUNT(*) AS legacy_backfilled
FROM `AuditEvent`
WHERE `id` LIKE 'legacy-%';

SELECT `name`, `outcome`, COUNT(*) AS records
FROM `AuditEvent`
WHERE `id` LIKE 'legacy-%'
GROUP BY `name`, `outcome`
ORDER BY `name`, `outcome`;
```

The first two counts must match. Review `legacy.migrated` separately; it means
the old row was retained without assigning semantics that the old fields could
not prove. Do not export backfilled `legacyDetails` to Azure.

Roll out in this order:

1. deploy the application migration and dual-write release behind Cloudflare Access;
2. apply the reviewed infrastructure plan to create the scheduled purge job and
   set `ContainerAppConsoleLogs_CL` retention;
3. redeploy the application once after the job exists so the release workflow
   pins the purge job to the current migration image;
4. start the purge job once on demand, verify its structured summary, and run
   the database and KQL acceptance queries;
5. leave `Log` read-only until a separately reviewed removal migration after
   the 90-day compatibility period.
