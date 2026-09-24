# Hardware initial import

This runbook is for the one-time, reviewed import that makes Track the Hack the
authoritative hardware inventory. It is not a synchronization process. Never commit the
source Sheet export or cleaned CSV: costs, missing-item notes, and private operational
working data do not belong in this repository.

## Prepare and review the CSV

Before export, physically resolve every value in the Sheet's `Missing` column. Reduce
the starting quantity for counted equipment confirmed missing. Mark an item uncounted
when its starting physical stock is genuinely unknown; do not turn a bag or box into a
fictional checkout unit. Give every item a clean display name without bag/box wording.

Create a private UTF-8 CSV with exactly these headings:

```csv
importKey,category,name,inventoryMode,quantity,consumptionAllowed,description,imageUrl
arduino-uno,MICROCONTROLLERS,Arduino Uno,COUNTED,12,false,Microcontroller board,/assets/hardware/arduino-uno.webp
resistors,MISCELLANEOUS,Resistors,UNCOUNTED,,true,,
```

`importKey`, `category`, `name`, `inventoryMode`, `quantity`, and
`consumptionAllowed` headings are required. The key must be stable and URL-safe.
Categories are `INPUTS`, `OUTPUTS`, `MICROCONTROLLERS`, or `MISCELLANEOUS`. Mode is
`COUNTED` or `UNCOUNTED`. Quantity is a non-negative whole number for counted items and
must be blank for uncounted items. `consumptionAllowed` is exactly `true` or `false`.
Description is optional. `imageUrl`, when present, must be a reviewed local path below
`/assets/`; add and review that asset in the same application revision. Do not include
unit cost, tax, total cost, or the old Missing column.

## Validate without writing

Use a local copy of the intended production revision and its normal protected database
configuration:

```sh
npm run hardware:import -- /absolute/private/path/hardware-cleaned.csv
```

The dry run reports counted item types, total known units, uncounted item types, and
consumption-enabled item types. It rejects duplicate keys, duplicate normalized names
within a category, blank names, invalid modes or Boolean flags, invalid counted
quantities, quantities on uncounted items, unknown categories, unsafe images, and bulk
bag/box display names. Reconcile known totals against the physical count and have a
second organiser review the CSV and output before requesting authorization to apply it.

## Apply once

Applying is a separately authorized production database write:

```sh
npm run hardware:import -- /absolute/private/path/hardware-cleaned.csv --apply
```

The command refuses to write when any new hardware item or loan exists. It also stops
if the legacy `Hardware` table unexpectedly contains rows; do not delete or translate
those rows automatically. Investigate their ownership and obtain an explicit migration
decision.

After apply, compare the reported totals with the reviewed dry run, open the organiser
catalogue, and spot-check each category plus zero-, one-, multi-quantity, and uncounted
items. From a participant session, confirm counted availability is exact, uncounted
availability has no number, and no mutation controls appear. Keep the private CSV only
for the approved operational retention period, then dispose of it through the
organisation's normal secure process.

## One-time production classification correction

The initial production import predated inventory modes. Use `npm run
hardware:reconcile` to inspect the exact eight stable keys and guards without writing.
The command refuses the six uncounted conversions if they have any loan history or
aggregate outcome quantities. After a verified backup and separate authorization, run
`npm run hardware:reconcile -- --apply`. It atomically converts the six reviewed bulk
component records to uncounted, removes their bag/container descriptions, and enables
Consumed for those records plus AA batteries and EMG electrodes. It never re-imports
the source Sheet and is safe to dry-run again after application.

## Rollback

Before apply, take and verify the normal database backup. If verification fails before
any checkout, restore that backup or—only with explicit database authorization—remove
the newly imported rows as one reviewed operation. Once a loan exists, do not delete or
re-import inventory: preserve the audit trail and correct it through a separately
reviewed reconciliation procedure.
