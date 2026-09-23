# Schedule import

`scripts/import-events.mts` validates and imports an explicitly supplied private event-schedule CSV. The real event schedule is operational data and must not be committed to this public repository.

## Run the import

Validate a private file without changing the database:

```sh
npm run schedule:import -- /absolute/private/path/events.csv
```

Apply a validated file only after reviewing the dry-run result and database target:

```sh
npm run schedule:import -- /absolute/private/path/events.csv --apply
```

The production database is privately networked. A future production import therefore needs a separately reviewed one-off Azure Container Apps job that receives the private CSV through an approved private input mechanism and uses the existing database secret. The ordinary migration image deliberately does not contain the real schedule. This repository does not provide a production schedule-import workflow. Record the application image SHA, private input SHA-256, job execution, and operator in the deployment log without publishing the CSV.

After applying, verify the event count, hidden-event count, scanner-workflow counts, and `maxCheckIns` values against the CSV. Open the public schedule and organizer event list in both languages before treating the import as complete.

## CSV contract

The importer requires every column below and rejects unknown columns.

| Column                         | Rule                                                                                                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `importKey`                    | Unique, stable event identity. A later import updates the row with this key.                                                                                                      |
| `seriesKey`                    | Stable grouping key for related event occurrences. It does not control upsert identity.                                                                                           |
| `start`, `end`                 | `M/D/YYYY h:mm AM` in `America/Toronto`. The hour must be 1–12. The importer applies the date's actual Eastern offset and rejects nonexistent or ambiguous daylight-saving times. |
| `hidden`                       | `TRUE` or `FALSE`. Hidden events do not appear on the public schedule.                                                                                                            |
| `name`, `nameFr`               | Required English and French names.                                                                                                                                                |
| `type`                         | A Prisma `EventType` value.                                                                                                                                                       |
| `scannerWorkflow`              | `ATTENDANCE`, `CHECK_IN`, `MERCHANDISE`, or `FOOD`.                                                                                                                               |
| `host`                         | Optional host name.                                                                                                                                                               |
| `description`, `descriptionFr` | Required localized descriptions that fit a MySQL `TEXT` value in UTF-8 bytes.                                                                                                     |
| `room`                         | Required location.                                                                                                                                                                |
| `roomFr`                       | Optional French location; blank falls back to `room`.                                                                                                                             |
| `image`                        | Optional local path or HTTPS URL allowed by the Next.js image configuration.                                                                                                      |
| `link`                         | Optional HTTPS URL.                                                                                                                                                               |
| `linkText`, `linkTextFr`       | Required together when `link` is present; otherwise all three must be blank.                                                                                                      |
| `maxCheckIns`                  | Blank for unlimited scans, or a non-negative integer.                                                                                                                             |

## Update behavior

The CSV is authoritative for every imported event field. Applying it overwrites organizer edits made in the event editor when the same `importKey` appears. Export or reproduce those edits in the CSV before applying it again.

The importer preserves reminder state when an unchanged visible event is re-imported. Hiding an event marks its reminder complete. Unhiding a future event or moving its start time reopens reminder registration. The import locks each existing event row while applying these rules.

The importer does not delete database events missing from the CSV. Remove or hide those events through a separately reviewed operation.
