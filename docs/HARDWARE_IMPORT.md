# Hardware initial import

This runbook is for the one-time, reviewed import that makes Track the Hack the
authoritative hardware inventory. It is not a synchronization process. Never commit the
source Sheet export or cleaned CSV: costs, missing-item notes, and private operational
working data do not belong in this repository.

## Prepare and review the CSV

Before export, physically resolve every value in the Sheet's `Missing` column. Reduce
the starting quantity for equipment confirmed missing. Count every bag, box, or bulk
row into an explicit number of meaningful checkout units; the importer deliberately
rejects unresolved bulk wording.

Create a private UTF-8 CSV with exactly these headings:

```csv
importKey,category,name,quantity,description,imageUrl
arduino-uno,MICROCONTROLLERS,Arduino Uno,12,Microcontroller board,/assets/hardware/arduino-uno.webp
```

`importKey`, `category`, `name`, and `quantity` are required. The key must be stable and
URL-safe. Categories are `INPUTS`, `OUTPUTS`, `MICROCONTROLLERS`, or `MISCELLANEOUS`.
Quantity is a non-negative whole number. Description is optional. `imageUrl`, when
present, must be a reviewed local path below `/assets/`; add and review that asset in
the same application revision. Do not include unit cost, tax, total cost, or the old
Missing column.

## Validate without writing

Use a local copy of the intended production revision and its normal protected database
configuration:

```sh
npm run hardware:import -- /absolute/private/path/hardware-cleaned.csv
```

The dry run reports item-type and checkout-unit totals. It rejects duplicate keys,
duplicate normalized names within a category, blank names, non-integer or negative
quantities, unknown categories, unsafe images, and unresolved bulk wording. Reconcile
both totals against the physical count and have a second organiser review the CSV and
output before requesting authorization to apply it.

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
catalogue, and spot-check each category plus zero-, one-, and multi-quantity items. From
a participant session, confirm the same exact availability is visible but no mutation
controls appear. Keep the private CSV only for the approved operational retention
period, then dispose of it through the organisation's normal secure process.

## Rollback

Before apply, take and verify the normal database backup. If verification fails before
any checkout, restore that backup or—only with explicit database authorization—remove
the newly imported rows as one reviewed operation. Once a loan exists, do not delete or
re-import inventory: preserve the audit trail and correct it through a separately
reviewed reconciliation procedure.
