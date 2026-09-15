# Google Sheets integration

[`Code.gs`](./Code.gs) is the source for the bound Apps Script attached to the restricted Tally response Sheet.

Set these Apps Script **Project Settings → Script properties** before using the `Track the Hack` menu:

- `TRACK_BASE_URL`: the deployed HTTPS Track the Hack origin
- `SHEETS_INTEGRATION_API_KEY`: the same secret configured on that deployment
- `RSVP_DEADLINE`: an absolute ISO-8601 timestamp, for example `2026-09-01T03:59:59.000Z`

The menu accepts selected application rows, has a separate explicit action for
walk-ins, refreshes RSVP state, and issues a five-minute participant-access QR.
It creates a separate `Track Operations` tab and sends only participant ID,
T-shirt size, coarse meal category, expiry, and the selected walk-in flag to
Track the Hack. Names, emails, Tally IDs, waivers, and detailed restrictions
remain in Google Sheets.

## T-shirt opt-outs

The English “I do not want a T-shirt” and French “Je ne souhaite pas recevoir de t-shirt” answers are stored as `NONE`. These applicants can be accepted in the same batch as applicants who selected a size, and their saved operations rows can issue access normally.

For the live Sheet to support this choice, its bound Apps Script must also use this version of `Code.gs`. Apply the `20260915000000_add_no_tshirt_option` database migration and deploy the matching Track version before updating the bound script to send `NONE`. A repository change alone does not update the script installed in the Sheet.

## Retrying acceptance

Acceptance saves and flushes each submission's participant ID to `Track Operations` before sending the provisioning request. If a request times out, only part of the batch reaches Track, or saving the result fails, rerun the same selection. The saved IDs are reused; do not delete the operations rows or replace their IDs to retry.

New rows keep `RSVP Status` and `Last Sync` blank until the API confirms the full batch. Existing confirmation, cancellation links, access expiry, and previous sync information are preserved if a retry fails. A successful retry changes a previously missing record's RSVP status to `PENDING`; confirmed participants remain confirmed.

All menu operations that write to the operations tab share a [document lock](<https://developers.google.com/apps-script/reference/lock/lock-service#getDocumentLock()>). If another operation runs for more than 30 seconds, the waiting operation asks you to retry. Success dialogs appear after the lock is released. Duplicate submissions in a selection or conflicting saved IDs are rejected before provisioning.
