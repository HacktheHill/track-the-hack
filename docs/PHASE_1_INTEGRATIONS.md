# Phase 1 integration contracts

Track the Hack accepts pseudonymous operational records only. Tally and the restricted Sheet keep applications, identity, contact details, detailed dietary/accessibility data, waivers, and consent evidence.

## Participant ID

The Sheet creates `Hacker.id`; Track the Hack never creates or substitutes it. Generate at least 128 random bits and encode them as 22–128 URL-safe characters (`A-Z`, `a-z`, `0-9`, `_`, `-`). The ID must not be sequential, derived from identity, or equal to Tally's application ID.

The external RSVP CSV is `email,id` with optional `name`. Email and name are template inputs for the external bulk-email workflow and must not be sent to Track the Hack. An invitation URL is `${NEXTAUTH_URL}/rsvp/<id>`.

## Authentication

Sheet endpoints require `Authorization: Bearer <SHEETS_INTEGRATION_API_KEY>`. Keep this key in server-side Apps Script properties, never in a Sheet cell or browser sidebar. Requests and responses are JSON. A request may contain at most 500 records or IDs.

## Minimal provisioning

`POST /api/integrations/sheets/hackers`

```json
{
	"hackers": [
		{
			"id": "wvY1HKlwYnFBO8t-YnQbwg",
			"tShirtSize": "M",
			"mealCategory": "HALAL",
			"acceptanceExpiry": "2026-09-01T03:59:59.000Z",
			"walkIn": false
		}
	]
}
```

All properties are required except `walkIn`. The accepted enums are the Prisma `TShirtSize` values and exactly `STANDARD`, `VEGETARIAN`, `VEGAN`, `HALAL`, `OTHER`. Unknown properties—including email, name, Tally IDs, application fields, and `confirmed`—are rejected. Repeating a request updates the exact `id` without creating a duplicate and does not overwrite RSVP state. `teamId` remains schema-only until the Phase 3 ownership decision and is not accepted by this endpoint.

## RSVP and cancellation

Opening `/rsvp/<id>` is read-only. Its explicit button posts to `POST /api/rsvp/<id>`. Confirmation fails with the same public response for a missing or expired ID, sets `confirmed=true`, and rotates the cancellation capability.

Cancellation links use `/cancel#<signed-capability>`. The fragment is not sent in the GET request or normal access logs. The page explicitly posts the capability to `POST /api/rsvp/cancel`; the participant ID by itself cannot cancel. Cancellation does not check `acceptanceExpiry` or Presence state.

## Reconciliation and confirmation-email data

`POST /api/integrations/sheets/rsvp-reconciliation`

```json
{ "ids": ["wvY1HKlwYnFBO8t-YnQbwg"] }
```

The response is keyed by exact IDs:

```json
{
	"records": [
		{
			"id": "wvY1HKlwYnFBO8t-YnQbwg",
			"confirmed": true,
			"cancellationLink": "https://track.example/cancel#..."
		}
	],
	"missingIds": []
}
```

The call is rerunnable. Confirmed records with an active capability include the cancellation link needed by the external confirmation-email CSV. Track the Hack does not track whether the Sheet has sent that email; the Sheet owns that state.

## Organizer provisioning

Organizer login is Google-only and requires a verified `@ctn-rtc.org` address, an existing `User`, and at least one role. Pre-provision one with:

```sh
npm run organizer:provision -- organizer@ctn-rtc.org ORGANIZER
```

This command is intentionally separate from participant provisioning. Organizer sessions, Sheet API keys, RSVP IDs, and cancellation capabilities are not interchangeable authorization mechanisms.
