# Google Sheets integration

[`Code.gs`](./Code.gs) and [`Sidebar.html`](./Sidebar.html) are the source for the bound Apps Script attached to the restricted Tally response Sheet.

The organizer workflow runs entirely from the `Responses` tab:

1. Open **Track the Hack → Open check-in sidebar** once.
2. Select any cell in one applicant row whose **Admission status** is **Accepted**.
3. Click **Provision & show QR**.
4. The button opens the claim QR directly in a dedicated display tab or window. Later clicks reuse the same display tab, including after the sidebar is reopened.

The single button creates or updates the Track participant, issues a five-minute single-use claim, refreshes that participant's RSVP state, and writes the result beside the form response. The display page counts down and hides the QR at expiry. Issuing a new QR revokes any previous claim and active participant session for that participant.

## Response columns

The sidebar appends these Track-owned columns after the existing response and admissions columns without moving or overwriting them:

- `Track Participant ID`
- `Track RSVP Link`
- `Track RSVP Status`
- `Track Cancellation Link`
- `Track Access Expires`
- `Track Last Sync`

Every read and write resolves columns by their header text, so the workflow does not depend on fixed column letters. The participant ID is saved and flushed before the API request; a timeout can therefore be retried without creating a second participant.

The legacy `Track Operations` tab is no longer read or written. The integration does not delete it, so historical data remains available until an organizer deliberately archives or removes it.

## Configuration

Set these Apps Script **Project Settings → Script properties**:

- `TRACK_BASE_URL`: the deployed HTTPS Track the Hack origin
- `SHEETS_INTEGRATION_API_KEY`: the matching integration bearer secret
- `RSVP_DEADLINE`: the event's actual RSVP deadline as an absolute ISO-8601 timestamp
- `CF_ACCESS_CLIENT_ID`: the Cloudflare Access service-token client ID
- `CF_ACCESS_CLIENT_SECRET`: the matching Cloudflare Access service-token secret

The Sheet sends only the participant ID, T-shirt size, coarse meal category, RSVP expiry, and `walkIn: false` to Track the Hack. Names, email addresses, Tally IDs, waivers, detailed restrictions, admission reasoning, and other application answers remain in Google Sheets.

## Updating the live bound script

1. Deploy the matching Track revision first so the Sheet and API agree on request and response formats.
2. In **Hack the Hill III Hacker Application Form**, open **Extensions → Apps Script** and confirm the project is **Track the Hack Integration**.
3. Keep a private backup of the existing bound project.
4. Replace the existing `Code.gs` with this directory's [`Code.gs`](./Code.gs).
5. Add or replace an HTML file named exactly `Sidebar` with [`Sidebar.html`](./Sidebar.html). Do not paste the HTML into `Code.gs`.
6. Verify all five script properties above without exposing their values.
7. Save the project to Drive and reload the Sheet. Confirm the **Track the Hack** menu contains only **Open check-in sidebar**.

Opening the sidebar adds the six headers if they are missing, but it does not provision a participant or call Track. Provisioning occurs only when the organizer presses the sidebar button on an accepted row.

## Failure and retry behaviour

- A non-accepted, blank, header, multi-row, or non-`Responses` selection is rejected before any API request.
- The participant ID and RSVP link are committed before claim issuance. Retrying reuses that ID.
- If claim issuance fails, no QR is shown.
- If the claim succeeds but RSVP reconciliation fails, the QR is still shown and the sidebar reports that RSVP status could not be refreshed.
- If the browser blocks the display window, the sidebar presents a manual **Open the QR display** fallback link.
- All Sheet mutations use a document lock so simultaneous organizers cannot create competing IDs for the same row.
