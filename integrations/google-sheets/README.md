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
