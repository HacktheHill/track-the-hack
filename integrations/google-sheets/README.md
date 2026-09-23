# Google Sheets integration

[`Code.gs`](./Code.gs) and [`Sidebar.html`](./Sidebar.html) belong in the bound Apps Script project for the restricted Tally response Sheet. The visible **Track the Hack → Pass activation** menu opens a sidebar with one action: **Show pass activation QR**.

Select any cell in one response row whose **Admission status** is **Accepted**, then press the button. It saves or reuses a stable participant ID and opens a one-time, five-minute QR that the participant scans to activate their pass. The claim API also creates or updates the minimal participant record if needed. The day-of button does **not** send an RSVP invitation, confirm an RSVP, or change the Sheet's RSVP status. Repeated clicks reuse the display window, which the organizer can move and maximize on another screen. Browsers may block popup creation or automatic fullscreen; in that case the sidebar shows an **Open QR** link. A failed request can be retried with the same ID.

Only the participant ID, T-shirt size, coarse meal category, acceptance expiry, and walk-in flag go to Tracker. Names, email addresses, Tally IDs, waivers, and detailed dietary answers remain in the Sheet. The response-row columns hold RSVP data from the separate pre-event process, as well as the day-of QR expiry and last sync time. This workflow does not require a new **Track Operations** tab.

## Provisioning before RSVP invitations

Provisioning means assigning a stable opaque participant ID in the Sheet and creating or updating the minimal Tracker record for that ID. Tracker creates a separate, stable, signed RSVP-management link; the participant ID alone can no longer change an RSVP. `prepareSelectedRowsForRsvp()` is available for a reviewed RSVP/email preparation process but is intentionally absent from the sidebar. It provisions up to 500 selected Accepted response rows with retry-safe IDs, obtains each private link by reconciliation, and writes it to the matching response row. A failed or incomplete response must be retried before exporting invitation recipients. An automatic trigger on every status edit is not installed, because intermediate edits or bulk Tally syncs could provision the wrong rows.

The older acceptance, RSVP refresh, and issue-access functions remain in `Code.gs` only for compatibility with existing **Track Operations** rows and tests. They are not shown in the menu. Existing operational IDs are read when a response row is first issued a pass, avoiding a second identity for the same submission. Do not delete the old tab until every prior participant ID has been reconciled into the response rows.

## Script properties and live update

Set `TRACK_BASE_URL` to the deployed HTTPS Tracker origin, `SHEETS_INTEGRATION_API_KEY` to the matching API secret, and `RSVP_DEADLINE` to the absolute ISO-8601 deadline. If Cloudflare Access protects the API, set **both** `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` to the service token already authorized for Tracker. Do not print or paste secret values into logs or issue reports.

To update the live bound script, first back up its existing source and response rows and inspect the existing response headers and **Track Operations** IDs. Replace `Code.gs`, add `Sidebar.html` under that exact filename, save, and reload the Sheet. If the six old Track-owned headers are still the exact final columns, the separate, operator-invoked `migrateLegacyResponseColumnsForRsvp()` preserves their data and expands them to the new layout; it never runs from the menu. Review the [runbook](../../docs/RSVP_EMAIL_RUNBOOK.md) before invoking it. Opening the sidebar makes no Tracker request; pressing **Show pass activation QR** does. This local repository change does not update the installed script. Test one known test submission first, and verify that its saved ID is unchanged on retry.

## RSVP status

The response-row schema includes an **RSVP Status** column: `PENDING` (no answer), `CONFIRMED` (attending), or `DECLINED` (not attending). A successful preparation reconciles the state and signed link; the participant's choices occur in Tracker. `refreshResponseRsvpStatus()` refreshes those fields in response rows and remains outside the sidebar. The **Cancellation Link** column and older operations-tab refresh remain only for compatibility with previously issued links. Do not treat either Sheet status as live until its refresh has run. See [`docs/RSVP_EMAIL_RUNBOOK.md`](../../docs/RSVP_EMAIL_RUNBOOK.md) before exporting or sending.
