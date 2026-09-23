# Google Sheets integration

[`Code.gs`](./Code.gs) is the source for the bound Apps Script attached to the restricted Tally response Sheet.

Set these Apps Script **Project Settings → Script properties** before using the `Track the Hack` menu:

- `TRACK_BASE_URL`: the deployed HTTPS Track the Hack origin
- `SHEETS_INTEGRATION_API_KEY`: the same secret configured on that deployment
- `RSVP_DEADLINE`: the event's actual RSVP deadline as an absolute ISO-8601 timestamp
- `CF_ACCESS_CLIENT_ID`: the Cloudflare Access service token client ID
- `CF_ACCESS_CLIENT_SECRET`: the matching service token secret

The menu accepts selected application rows, has a separate explicit action for
walk-ins, refreshes RSVP state, and issues a single-use participant-access QR with no time limit.
It creates a separate `Track Operations` tab and sends only participant ID,
T-shirt size, coarse meal category, expiry, and the selected walk-in flag to
Track the Hack. Names, emails, Tally IDs, waivers, and detailed restrictions
remain in Google Sheets.

## Updating the live Sheet's script

1. Apply the `20260915000000_add_no_tshirt_option` database migration and deploy the matching Track version first. Use `Code.gs` from that same repository revision so the Sheet and API agree on the supported fields and responses.
2. In **Hack the Hill III Hacker Application Form**, open **Extensions → Apps Script** and confirm the project is **Track the Hack Integration**. Keep a private backup of its existing `Code.gs`. Preserve the `Responses` and `Track Operations` tabs, including all saved submission-to-participant ID mappings.
3. Replace the contents of the existing **Code.gs** with this directory's [`Code.gs`](./Code.gs). Update the existing file in the bound project; adding a second copy would duplicate its functions and constants.
4. Open **Project Settings → Script properties** and check the five properties listed above against the target deployment. Add any missing properties; if the section is empty, all five are required. Keep valid existing values, and use the event's actual RSVP deadline.
5. **Save project to Drive**, then reload the Sheet. Confirm the **Track the Hack** menu includes **Accept selected walk-in application(s)**. The script's `onOpen` only builds the menu; this check does not accept applicants, call Track, or send email.

This is a [bound script](https://developers.google.com/apps-script/guides/bound) used through the Sheet's menu. Saving it and reopening the Sheet updates that workflow; no web-app deployment or new installable trigger is required.

When ready to resume operations, **Track the Hack → Set up operations tab** upgrades the older 11-column header by appending **Walk-In** in column L, preserving the existing rows and participant IDs. This action writes only to the Sheet. If the headers do not match, inspect the mismatch instead of deleting or recreating the operations tab.

Accepting applications, refreshing RSVP status, and issuing access are separate manual actions that call Track. Do not run them as an installation check. This script contains no email-sending functions.

## T-shirt opt-outs

The English “I do not want a T-shirt” and French “Je ne souhaite pas recevoir de t-shirt” answers are stored as `NONE`. These applicants can be accepted in the same batch as applicants who selected a size, and their saved operations rows can issue access normally.

For the live Sheet to support this choice, follow [Updating the live Sheet's script](#updating-the-live-sheets-script). A repository change alone does not update the script installed in the Sheet.

## Retrying acceptance

Acceptance saves and flushes each submission's participant ID to `Track Operations` before sending the provisioning request. If a request times out, only part of the batch reaches Track, or saving the result fails, rerun the same selection. The saved IDs are reused; do not delete the operations rows or replace their IDs to retry.

New rows keep `RSVP Status` and `Last Sync` blank until the API confirms the full batch. Existing confirmation, cancellation links, access expiry, and previous sync information are preserved if a retry fails. A successful retry changes a previously missing record's RSVP status to `PENDING`; confirmed participants remain confirmed.

All menu operations that write to the operations tab share a [document lock](<https://developers.google.com/apps-script/reference/lock/lock-service#getDocumentLock()>). If another operation runs for more than 30 seconds, the waiting operation asks you to retry. Success dialogs appear after the lock is released. Duplicate submissions in a selection or conflicting saved IDs are rejected before provisioning.

## Access codes without an expiry

Apply `20260922010000_remove_claim_expiry` and deploy the matching Track version
with this script. Access codes remain valid until used or replaced; the claim
endpoint now returns only `claimUrl`. The existing `Access Expires` column is
retained to preserve the operations tab layout and is cleared when access is
issued. Old values in that column no longer determine whether a code works.
