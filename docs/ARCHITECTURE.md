# Architecture and data boundaries

This document describes the current system. It is authoritative for product and data
ownership; Git history contains the completed phase plans that led here.

## Purpose

Track the Hack stores only the pseudonymous operational state needed for RSVP, day-of
access, event scanning, reminders, and aggregate metrics. It does not store application
identity, contact details, application answers, resumes, detailed accessibility or
dietary information, waiver evidence, guardian consent, or team membership.

## Sources of truth

### Tally and the restricted Google Sheet

Tally collects applications. The restricted Sheet owns identity, contact details,
application review, acceptance decisions, the submission-to-participant mapping,
detailed dietary/accessibility information, waivers and consent evidence, and the
reconciled administrative RSVP view.

The Sheet creates `Hacker.id`. It must contain at least 128 random bits encoded as
22–128 URL-safe characters and must not be sequential, identity-derived, or equal to a
Tally submission ID. The adapter saves that ID before calling Tracker and reuses it
after a failure. Track the Hack never substitutes or generates a participant ID.

### Track the Hack

Tracker owns its transactional operational state:

- minimal participant records (`id`, T-shirt choice, meal category, RSVP state,
  walk-in flag, and acceptance deadline);
- signed RSVP-management and cancellation capabilities;
- one-time claim capabilities and active participant sessions;
- events, participant interests, reminders, Presence counters, and audit records;
- organiser users and roles;
- aggregate operational metrics.
- quantity-based hardware inventory, loans, and append-only return outcomes;
- Latte Lab availability, anonymised order configuration, and queue state.

The Sheet refreshes RSVP state from Tracker. A stale Sheet value is not evidence of the
current participant choice.

### Other systems

- Discord owns team names, membership, self-service, and identity mapping. Tracker has
  no team model or synchronised membership copy.
- The bulk-email application sends invitations from a private CSV generated from the
  Sheet. Tracker does not send campaign mail.
- `email-list-manager` owns mailing-list subscription and unsubscribe state.
- Devpost owns project submission and judging workflows.

## Authorisation boundaries

These credentials are deliberately not interchangeable:

- Organisers use NextAuth with a verified, pre-provisioned `@ctn-rtc.org` Google
  account and an assigned role. Local passwordless organiser auth is loopback-only.
- The bound Apps Script uses `Authorization: Bearer <SHEETS_INTEGRATION_API_KEY>` on
  the restricted integration endpoints. The key belongs in Apps Script properties,
  never a cell or client-side dialog.
- An RSVP-management/cancellation link contains a signed bearer capability in the URL
  fragment. A participant ID alone cannot change RSVP state.
- A claim link contains a separate five-minute, single-use capability in the fragment.
- A participant session uses an opaque `HttpOnly`, `SameSite=Lax` cookie whose keyed
  verifier is stored server-side. Participant sessions never grant organiser access.
- RSVP management and cancellation share the participant's managed-RSVP capability and
  `CANCELLATION_TOKEN_SECRET`; the routes expose different actions. Claim and
  participant-session secrets are separate from it and from each other.

Provision an organiser independently of participant workflows:

```sh
npm run organizer:provision -- organiser@ctn-rtc.org ORGANIZER ADMIN
```

The command requires a verified organisation-domain address and at least one valid
role. It does not grant participant access or create an RSVP/claim capability.

## Participant provisioning and RSVP

The bound Apps Script is versioned under `integrations/google-sheets/`. It maps the
bilingual Tally headers and sends only allow-listed operational fields.

`POST /api/integrations/sheets/hackers` accepts up to 500 records:

```json
{
	"hackers": [
		{
			"id": "wvY1HKlwYnFBO8t-YnQbwg",
			"tShirtSize": "M",
			"mealCategory": "HALAL",
			"acceptanceExpiry": "2026-09-25T03:59:59.000Z",
			"walkIn": false
		}
	]
}
```

Every field except `walkIn` is required. Unknown fields—including name, email, Tally
ID, application data, `confirmed`, and team data—are rejected. Provisioning is exact-ID
idempotent and preserves existing RSVP state. `TShirtSize.NONE` is an explicit opt-out,
not a missing value. `MealCategory.OTHER` tells scanner staff to consult the food lead;
the sensitive detail stays in the restricted Sheet.

The accepted-audience preparation command provisions accepted rows and stores stable
links. It never sends email. The private campaign CSV has these columns:

```text
email,name,rsvpUrl,deadlineEn,deadlineFr
```

It contains bearer capabilities and must not enter Git, artifacts, logs, issues, or
chat. See `RSVP_EMAIL_RUNBOOK.md` for the reviewed preparation and send process.

Opening `/rsvp/manage#<capability>` reads state without changing it. Explicit actions
post to `/api/rsvp/manage` with:

```json
{ "token": "<capability>", "action": "status | attend | decline" }
```

The same unexpired management link can read the current state and change between
attending and not attending. `POST /api/integrations/sheets/rsvp-reconciliation`
returns exact-ID records with `confirmed`, `status`, optional `rsvpLink`, and optional
`cancellationLink`; status is `PENDING`, `CONFIRMED`, or `DECLINED`. Cancellation remains
available after the RSVP deadline and uses an explicit POST from `/cancel`.

The retired `/rsvp/<participant-id>` mutation returns `410`. Do not restore it: the
participant ID appears in the day-of QR and is not an authorisation secret.

## Day-of access

An organiser visually verifies identity against the restricted Sheet and uses the
sidebar to issue access. No ID document data is recorded.

`POST /api/integrations/sheets/claim` accepts the same strict operational participant
record and returns only a claim URL and expiry. Issuance creates or updates the minimal
record, replaces an outstanding claim, and revokes any active participant session.

The claim QR contains `/claim#<claim-id>.<signature>`. The token is in the fragment so
it does not enter the initial GET, normal access logs, or referrer headers. The page
waits for an explicit tap before `POST /api/claim` consumes it. Redemption is atomic:
two devices racing one claim cannot both receive a session. The participant session
lasts 36 hours, and reissue or sign-out revokes the stored verifier immediately.

A non-authorising `participant_pass=1` marker lets navigation show “My pass”; forging it
only reveals a link to a server-protected route. `/profile` is private and network-only.
After a successful profile load, the browser stores only the validated participant ID
needed to reproduce the event QR. Offline `/profile` falls back to the static `/pass`
shell without caching profile HTML, confirmation state, T-shirt size, meal category,
Presence, or participant cookies.

A walk-in first completes the same Tally application. After review, the Sheet marks the
row accepted and `Walk-In`, assigns its ID, and uses the same access-issuance endpoint.
There is no separate unrestricted walk-in form.

## Events, scanning, and interests

The public schedule exposes only non-hidden events and public fields. Hidden operational
stations may still be scanned if `scannerEnabled` is true. Scanner eligibility is an
explicit event field and is enforced server-side for both scans and manual adjustments.

Each station owns a `scannerWorkflow`:

- `CHECK_IN`: confirmation state and T-shirt choice;
- `MERCHANDISE`: T-shirt choice;
- `FOOD`: meal category and food-lead escalation;
- `ATTENDANCE`: event interests.

Every response is allow-listed for its workflow. The event owns the label, workflow,
eligibility, and maximum; clients cannot override them.

Presence is unique by participant and event. A first valid scan creates the counter.
When `maxCheckIns > 1`, a deliberate repeat scan increments atomically to the cap. Blank
and `1` make repeat scans idempotent; `0` is capped at zero. Manual `+`/`−` adjustments
use expected-value reconciliation so a stale device cannot overwrite a newer count.
The API reports `new`, `incremented`, `unchanged`, or `limit`.

Participants may save interests in visible events. Only their participant session can
change their selections. Organiser attendance scans may display those public-event
interests; food, merchandise, and check-in workflows cannot retrieve them.

## Event Services

Hardware Desk and Latte Lab are separate domains. They share participant sessions,
organiser authorization, audit conventions, transactional mutations, idempotency, and
localisation, but no generic store, cart, inventory, or workflow framework.

Hardware inventory is quantity-based. A checkout atomically moves units from available
to on loan. Each return action is append-only and divides units into good, damaged, and
missing outcomes. Good units become available; damaged and missing units remain
unavailable. At all times, total quantity equals available plus outstanding loans plus
damaged plus missing. There is no application inventory editor or repair workflow. The
restricted source Sheet is used only to prepare the reviewed initial import described
in `HARDWARE_IMPORT.md`; after import, Tracker owns the operational inventory.

Latte recipes and compatibility rules are code-owned. Ingredient availability is a
boolean operational switch, not stock accounting. Lab closure prevents new orders but
does not alter the queue. A database-unique active-participant key enforces one Queued,
Preparing, or Ready order per participant, including concurrent submissions. Completed
and cancelled orders retain anonymised configuration and timestamps for operations.

Both domains use a temporary, 1–40 character pickup name because staff need a spoken
label at the physical counter and the pseudonymous participant record has no name. This
is not a participant-profile field. Hardware clears it transactionally when every loan
unit has an outcome; Latte Lab clears it on completion or cancellation. Audit logs use
only opaque loan, order, and participant IDs. Hardware records only acknowledgements
that a physical ID was collected or returned—never its type, number, image, or other
contents. Participant responses never expose other participants, pickup names,
organiser IDs, or audit data.

## Public offline data

The service worker may cache only these public surfaces after an online load: home,
schedule, visible event details, maps and map assets, resources, sponsors, and the
static participant pass. `events.all` is isolated into its own GET before caching so it
can never share a tRPC batch with private data. Hidden events are filtered server-side.

All other APIs are network-only. Organiser, metrics, authentication, RSVP, claim,
participant-profile, Event Services, and private Next data routes must show an offline/unavailable state
rather than cached private content. The custom push worker is independent of the route
cache.

## Reminders, metrics, and privacy

Participants can request reminders for visible events. Push subscriptions are scoped
to event and endpoint. Due-event processing uses leases and bounded provider work;
`PUSH_NOTIFICATIONS.md` documents the operational protocol.

Tracker metrics are aggregate and operational. Demographic reporting comes from Tally
or the restricted Sheet. Individual sponsor sharing requires separate explicit consent,
a documented purpose, and field-minimal disclosure.

Audit records use the versioned, append-only `AuditEvent` ledger and opaque
operational IDs; they must not copy Tally/Sheet identity or application data.
Scanner mutations and their audit entries commit atomically. Structured copies
are emitted to Azure Log Analytics after commit for operational search, while
MySQL remains authoritative. Both copies have a 90-day retention policy; see
`AUDIT_LOGS.md`. Exact participant and capability identifiers use binary
collation; new migrations that add such references must preserve case-sensitive
identity.

## Database lifecycle

The privacy redesign established the current schema from a reviewed clean baseline.
Legacy data retention or deletion from older deployments belongs to the relevant data
owner and infrastructure operator, not application startup code.

Once the current baseline exists, preserve the database and apply versioned Prisma
migrations before starting the corresponding application revision. A normal release
must not reset production data. Rollback is safe only when the previous application is
compatible with the already-migrated schema.
