# Structured audit and attendance ledger

This document defines the ledger, investigation queries, retention, and the temporary
legacy-log retirement path.

Use [`AUDIT_ACCEPTANCE.md`](./AUDIT_ACCEPTANCE.md) for the complete development,
production, cross-store reconciliation, retention, dual-write shutdown, and final
legacy-table removal procedure. The rollout is not complete until that runbook's final
checklist is signed off.

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

The registered V1 event names are:

- scanner: `scanner.scan`, `scanner.adjust`;
- organizer security: `organizer.roles.updated`, `organizer.access.added`,
  `organizer.access.removed`;
- participant lifecycle: `participant.claim.issued`,
  `participant.claim.redeemed`, `participant.rsvp.updated`,
  `participant.rsvp.cancelled`, `participant.notifications.updated`;
- Event Services: `hardware.loan.checked_out`, `hardware.loan.returned`,
  `hardware.item.availability_changed`, `latte.order.placed`,
  `latte.order.cancelled`, `latte.order.transitioned`,
  `latte.lab.open_changed`, `latte.ingredient.availability_changed`;
- notifications: `notification.campaign.created`,
  `notification.campaign.regenerated`, `notification.announcement.queued`,
  `notification.announcement.completed`, `notification.delivery.retried`; and
- migration: `legacy.migrated`.

Adding a name or outcome requires a schema/test change, a privacy review of its
typed `data`, and updated query documentation. Human-readable messages never
belong in the canonical event.

Notification events deliberately separate the exact announcement from the general
audit stream:

| Event                                 | Safe audit data                                                     |
| ------------------------------------- | ------------------------------------------------------------------- |
| `participant.notifications.updated`   | `channel` and `enabled`                                             |
| `notification.campaign.created`       | `snapshotCount` and `maximumCohortSize`                             |
| `notification.campaign.regenerated`   | `snapshotCount` and `maximumCohortSize`                             |
| `notification.announcement.queued`    | `participantCount`, fixed `channelCount`, and SHA-256 `contentHash` |
| `notification.announcement.completed` | `contentHash`, `sentCount`, `failedCount`, and `skippedCount`       |
| `notification.delivery.retried`       | `deliveryCount`                                                     |

For campaign events, a null `maximumCohortSize` is the safe, intentional marker for
the all-participants-in-one-cohort mode. It contains no participant data.

The message body belongs only in `NotificationAnnouncement`; push endpoints and keys
belong only in `ParticipantPushSubscription`; Discord identifiers and provider receipt
details belong only in the bot. Do not join or export those values into audit logs.
See [`NOTIFICATIONS.md`](./NOTIFICATIONS.md) for delivery-state handling and acceptance.

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

Notification campaign lifecycle and aggregate outcome:

```kusto
AuditEvents
| where tostring(audit.name) startswith "notification."
| project Time=todatetime(audit.occurredAt), Name=tostring(audit.name),
          Outcome=tostring(audit.outcome), ResourceId=tostring(audit.resource.id),
          ActorType=tostring(audit.actor.type), Data=audit.data
| order by Time asc
```

The query must show hashes and aggregate counts only. Do not add message bodies,
participant IDs, Discord identities, or push endpoints to a release evidence export.

Event Services records `hardware.item.availability_changed`,
`hardware.loan.checked_out`, `hardware.loan.returned`, `latte.order.placed`,
`latte.order.cancelled`, `latte.order.transitioned`, `latte.lab.open_changed`, and
`latte.ingredient.availability_changed`. These events use only opaque participant,
item, loan, order, and organiser identifiers plus fixed enums and counts. A hardware
return may record aggregate `goodUnits`, `damagedUnits`, `missingUnits`, and
`consumedUnits`; it must not copy line descriptions into the audit record. Pickup names
and physical-ID details must never be added to either structured events or their legacy
human-readable companion entries.

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

## Legacy `Log` retirement

The structured-ledger migration backfilled the preceding 90 days and temporarily kept
legacy writes for comparison. Close that compatibility path without maintaining a
second release ceremony:

1. Compare `Log` rows from the recorded migration window with `AuditEvent` rows named
   `legacy-<Log.id>`. Investigate missing, orphaned, and boundary rows.
2. Confirm current scanner actions appear in both MySQL and the Azure mirror without
   sensitive fields.
3. Remove legacy writes in a focused release and record the final legacy-write time.
4. Keep `Log` read-only for 90 complete days so its last records age out of the normal
   retention window.
5. After a current backup and dependency search, remove the model, helper, and table in
   one reviewed migration.

`legacy.migrated` means the old record was retained without inventing semantics. Never
export its free-form `legacyDetails` to Azure.

The exact migration execution window, boundary-row queries, V1 name/outcome validation,
and final definition of done are in [`AUDIT_ACCEPTANCE.md`](./AUDIT_ACCEPTANCE.md).
