# Hardware initial import

This runbook is for the one-time, reviewed import that makes Track the Hack the
authoritative hardware inventory. It is not a synchronisation process. Never commit the
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
consumption-enabled item types. It rejects duplicate keys, duplicate normalised names
within a category, blank names, invalid modes or Boolean flags, invalid counted
quantities, quantities on uncounted items, unknown categories, unsafe images, and bulk
bag/box display names. Reconcile known totals against the physical count and have a
second organiser review the CSV and output before requesting authorisation to apply it.

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

## Completed production classification correction

The initial production import predated inventory modes. The guarded correction was
backed up, dry-run, applied, and verified on 2026-09-24 with application release
`d1c7686b94e73a4b15eb024bc14b9633c1c51fa3`. Production now has these six uncounted,
consumption-enabled records with null total and available quantities:

- `small-black-buttons`;
- `the-red-button`;
- `mixed-colour-leds`;
- `male-pin-headers`;
- `resistors`;
- `wires`.

`aa-batteries` and `emg-electrodes` remain counted and are consumption-enabled. The
post-apply dry run reported that the intended reconciliation was already applied.

Do not run `npm run hardware:reconcile -- --apply` again as routine setup and do not
re-import the source Sheet. `npm run hardware:reconcile` is now a read-only diagnostic:
its normal result is **Hardware reconciliation is already applied.** A future write is a
recovery operation requiring a fresh backup, review of all eight exact key matches and
loan/outcome guards, and separate production authorisation.

## Rollback

Before an initial import, take and verify the normal database backup. If verification
fails before any checkout, restore that backup or—only with explicit database
authorisation—remove
the newly imported rows as one reviewed operation. Once a loan exists, do not delete or
re-import inventory: preserve the audit trail and correct it through a separately
reviewed reconciliation procedure.
