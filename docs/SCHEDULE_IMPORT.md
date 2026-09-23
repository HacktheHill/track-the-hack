# Schedule import

`scripts/import-events.mts` validates and imports the event schedule from CSV. The default input is `prisma/hack-the-hill-iii-events.csv`.

## Run the import

Validate the default file without changing the database:

```sh
npm run schedule:import
```

Validate another file:

```sh
npm run schedule:import -- path/to/events.csv
```

Apply a validated file only after reviewing the dry-run result and database target:

```sh
npm run schedule:import -- path/to/events.csv --apply
```

For production, run the command from the migration image in a one-off Azure Container Apps job with `DATABASE_URL` supplied from the existing database secret. The repository does not provide a production schedule-import workflow. Record the image SHA, input-file SHA, job execution, and operator in the deployment log.

After applying, verify the event count, hidden-event count, scanner-workflow counts, and `maxCheckIns` values against the CSV. Open the public schedule and organizer event list in both languages before treating the import as complete.

## CSV contract

The importer requires every column below and rejects unknown columns.

| Column                         | Rule                                                                                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `importKey`                    | Unique, stable event identity. A later import updates the row with this key.                                                                  |
| `seriesKey`                    | Stable grouping key for related event occurrences. It does not control upsert identity.                                                       |
| `start`, `end`                 | `M/D/YYYY h:mm AM` in `America/Toronto`. The hour must be 1–12. The importer applies the date's actual Eastern offset and rejects nonexistent or ambiguous daylight-saving times. |
| `hidden`                       | `TRUE` or `FALSE`. Hidden events do not appear on the public schedule.                                                                        |
| `name`, `nameFr`               | Required English and French names.                                                                                                            |
| `type`                         | A Prisma `EventType` value.                                                                                                                   |
| `scannerWorkflow`              | `ATTENDANCE`, `CHECK_IN`, `MERCHANDISE`, or `FOOD`.                                                                                           |
| `host`                         | Optional host name.                                                                                                                           |
| `description`, `descriptionFr` | Required localized descriptions that fit a MySQL `TEXT` value in UTF-8 bytes.                                                                 |
| `room`                         | Required location.                                                                                                                            |
| `image`                        | Optional local path or HTTPS URL allowed by the Next.js image configuration.                                                                  |
| `link`                         | Optional HTTPS URL.                                                                                                                           |
| `linkText`, `linkTextFr`       | Required together when `link` is present; otherwise all three must be blank.                                                                  |
| `maxCheckIns`                  | Blank for unlimited scans, or a non-negative integer.                                                                                         |

## Update behavior

The CSV is authoritative for every imported event field. Applying it overwrites organizer edits made in the event editor when the same `importKey` appears. Export or reproduce those edits in the CSV before applying it again.

The importer preserves reminder state when an unchanged visible event is re-imported. Hiding an event marks its reminder complete. Unhiding a future event or moving its start time reopens reminder registration. The import locks each existing event row while applying these rules.

The importer does not delete database events missing from the CSV. Remove or hide those events through a separately reviewed operation.
