# Phase 2: day-of participant access

An organiser checks a government ID against the Sheet, issues a one-time code,
and the participant scans it to put a session on their own phone. After that
they can show an event QR that organisers scan all weekend.

Applications, identity and waiver evidence stay in Tally and the Sheet. Nothing
added here stores a name, an email or a phone number.

## Read this before wiring anything up

Two integration boundaries are external on purpose. Neither should be handled
by loosening this app.

1. **Participant ids come from the Sheet.** `Hacker.id` has no `@default`, which
   is Waaberi's decision from phase 1. Adding one breaks the contract, since the
   Sheet reconciles rows by exact id and an id this app made up is one the Sheet
   has never heard of. A `cuid()` would also fail the id rules, because it
   carries a timestamp. Creating a `Hacker` with no id fails loudly today, and
   that is what we want.

2. **The Sheets sidebar is what calls these endpoints.** It lives outside this
   repository as Apps Script. This repository defines and enforces only the
   request and response contract it uses.

Locally you need neither. `npx prisma db seed` makes up ids, and the
provisioning endpoint accepts any valid id you post at it. To experiment,
change your environment rather than the schema.

## The two QR codes

The **claim QR** shows on the organiser's screen and the participant scans it
with their phone camera. It holds `https://<host>/claim#<claimId>.<HMAC>`, lasts
five minutes, works once, and only exists to hand a session to one device. It
holds a URL because a camera app will only offer to open a QR that looks like a
link.

The **event QR** shows on the participant's phone and an organiser scans it
through `/qr`. It holds `Hacker.id` and nothing else, lasts the whole event, and
only identifies someone at a station.

This repository never draws the claim QR. We return a URL and the sidebar turns
it into a QR. `/claim` is where the participant lands after scanning, not where
the code is shown.

## The flow

```
Organiser picks the row in the Sheet
    |
    | POST /api/integrations/sheets/claim   (Bearer SHEETS_INTEGRATION_API_KEY)
    v
issueParticipantAccess()       strict operational record + 32 random bytes
replaceParticipantAccess()     provision, replace claim, revoke session atomically
    |
    v
{ "claimUrl": "https://<host>/claim#<claimId>.<HMAC>", "expiresAt": "..." }
    |
    | the sidebar renders this as a QR, the participant scans it
    v
/claim reads window.location.hash and waits for an explicit tap
    |
    | POST /api/claim  { "token": "<claimId>.<HMAC>" }
    v
consumeClaimToken()      check the HMAC before going near the database
redeemClaimToken()       consume claim and store one keyed session verifier atomically
    |
    v
Set-Cookie: participant_session=<random 32-byte capability>; HttpOnly; SameSite=Lax
Set-Cookie: participant_pass=1
    |
    v
/profile shows the event QR, confirmation, size, meal category, Presence
```

## What was added

1. `ClaimToken` and `ParticipantSession`, with clean-database migrations
2. Strict access issuance, atomic claim redemption, and revocable participant sessions
3. The Sheet claim endpoint, participant claim endpoint, and participant sign-out endpoint
4. The claim page, private profile, and public static `/pass` offline shell
5. Explicit check-in, merchandise, food, and attendance scanner workflows on `Event`
6. Event-linked Presence counters with unique `(hackerId, eventId)` identity and atomic caps
7. Scanner responses limited to the fields required by the selected workflow
8. Focused lifecycle, scanner-workflow, and offline-pass tests

`qrcode` went back into `package.json`, since phase 1 removed it along with the
old encrypted QR component.

The HMAC helpers were generalised so the cancellation capability and the claim
token share them instead of keeping two copies. `createCancellationToken` and
`readCancellationToken` kept their old shape.

## Endpoints

`POST /api/integrations/sheets/claim`, with
`Authorization: Bearer <SHEETS_INTEGRATION_API_KEY>`, is the only access-issuance
call the Apps Script must make. Its complete request body is:

```json
{
	"id": "wvY1HKlwYnFBO8t-YnQbwg",
	"tShirtSize": "M",
	"mealCategory": "HALAL",
	"acceptanceExpiry": "2026-09-01T03:59:59.000Z",
	"walkIn": false
}
```

`walkIn` may be omitted. Omission preserves its value on an existing record and
defaults it to `false` on a new one. Every other key is rejected. The endpoint
creates or updates the Hacker without changing RSVP confirmation, revokes any
active participant session, replaces any outstanding claim, and returns only
`claimUrl` and `expiresAt`. Errors are `400` for any invalid or extra field,
`401` for a bad key, and `405` for anything but POST.

`POST /api/claim`, no API key, `{ "token": "..." }`. The signed token is the
credential. Returns `{ "ok": true }` and the cookies, or `{ "ok": false }` with
one generic message. Spent, expired, forged and malformed all look identical
from outside, so the response cannot confirm a token was real.

`POST /api/participant/sign-out` deletes the server-side session verifier and
expires both participant cookies. It returns `204`, including when the browser
no longer holds a usable session.

## Why it works this way

1. **Only the opaque id is stored.** The database holds `claimId`, never the
   signature, so a dump is not a pile of working links.
2. **Five minutes, one use.** That QR sits on a screen at a busy desk where
   anyone in the queue can photograph it.
3. **Redeeming is a conditional update.** The checks live in the `WHERE` clause
   rather than a read then a write, so two phones cannot both get a session.
4. **Fragment, not query string.** The token stays out of the GET request,
   access logs and referrer headers, same as the cancellation link.
5. **A tap, not consumption on load.** Link previews prefetch URLs and would
   otherwise burn the code before the participant touched anything.
6. **Separate secrets** for claims, sessions and cancellations, so leaking one
   does not compromise the others.
7. **The participant cookie is opaque.** It contains only 32 random bytes. The
   database stores an HMAC verifier tied directly to `Hacker.id`, never the raw
   cookie capability.
8. **One server-side session row per participant.** It expires after 36 hours.
   Every authenticated request checks that row, so replacement issuance and
   sign-out revoke an old cookie immediately.
9. **SameSite CSRF boundary.** Session-changing browser actions are POST-only;
   the participant cookie is `HttpOnly`, `SameSite=Lax`, scoped to `/`, and is
   also `Secure` in production.
10. **Exact ids stay exact.** Participant ids and their claim/session references
    use MySQL's binary collation, so changing letter case cannot select another
    participant or capability.

## Getting back to the pass

A participant has no account, so there has to be a way back to `/profile` that
is not "remember the URL". `/claim` redirects there when the request already
carries a session, and the navigation shows a "My pass" link.

That link needs the browser to know a session exists, but the session cookie is
`HttpOnly` and scripts cannot see it. So we set a second cookie,
`participant_pass=1`, readable by scripts and holding nothing else. It
authorises nothing: forge it and all you get is a link that `/profile` bounces
you off. The alternative was hitting an endpoint on every page load just to
decide whether to draw a menu item.

`src/utils/participant-pass.ts` holds the name and the hook. It sits under
`utils` because a component cannot import the session module without dragging
`node:crypto` into the browser bundle, and it reads the cookie after mount so
the server and client renders agree.

## Offline pass

`/profile` is always network-only and sends `Cache-Control: private, no-store`.
After an authenticated profile load, the browser stores only exact `Hacker.id`,
which is already the event QR payload. If a later `/profile` navigation fails
offline, the service worker serves the precached static `/pass` shell. It never
caches the profile HTML, profile JSON, participant cookie, T-shirt size, meal
category, confirmation state, or Presence records.

The fallback is scoped to `/profile`; unrelated offline pages do not render a
participant pass.

## Tests

The focused files under `test/` run with `npm test`. Lifecycle tests use a
`MemoryRepository`, and scanner tests use a narrow in-memory Prisma-shaped
client, so neither needs a database.

1. Issuance builds the URL correctly, expires in five minutes, and never stores
   the signature
2. A claim is single use, and rejects expiry, tampering, the wrong secret and reuse
3. Concurrent redemption gives exactly one device a server-side session
4. Re-issuing revokes both the unused claim and any live session while
   preserving RSVP confirmation
5. The session cookie is opaque, HttpOnly and SameSite, and requires a live,
   unexpired keyed verifier in the database
6. Participant sign-out revokes the verifier and clears both cookies
7. Scanner workflows expose only their allowlisted fields and enforce event
   counter limits
8. The offline pass stores only a validated participant id and clears it on
   sign-out

## Trying it locally

```sh
docker compose up -d
npx prisma migrate deploy
npx prisma db seed
npx next dev --webpack
```

`--webpack` is needed because plain `npm run dev` fails on this branch: Next 16
defaults to Turbopack and refuses to start next to a webpack config.

Get a seeded id, which `prisma/seeders/hackers.mts` makes up locally:

```sh
docker exec track-the-hack-mysql-1 mysql -uroot -proot -N -B \
  -e "SELECT id FROM Hacker LIMIT 1;" track-the-hack
```

```sh
curl -X POST http://localhost:3000/api/integrations/sheets/claim \
  -H "Authorization: Bearer $SHEETS_INTEGRATION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id":"<participant id>","tShirtSize":"M","mealCategory":"HALAL","acceptanceExpiry":"2026-09-01T03:59:59.000Z","walkIn":false}'
```

Open the returned `claimUrl` and press the button. Pressing it again gives the
generic failure. Worth checking too: reloading `/claim` first leaves the token
unused, "My pass" appears once you are through, reopening `/claim` bounces you
to `/profile`, and no fragment is left in the address bar.

For a phone, the URL is built from `NEXTAUTH_URL`, so point it at the machine's
LAN address, run with `--hostname 0.0.0.0`, and put it back afterwards. Use a
private tab to start clean. `/qr` cannot be reached
locally at all without Google OAuth on a verified `@ctn-rtc.org` account.

## Outside this repository

The in-repository Phase 2 path is implemented. The Google Sheets Apps Script
still has to send the exact request object documented above and draw the
returned `claimUrl` as a QR. Sheet/Tally column mapping and participant-id
generation remain external-system work; this app intentionally does not accept
alternate field names or infer missing values.

## Phase 3

The authoritative handoff is [`PHASE_3.md`](./PHASE_3.md).

**Team source of truth** is resolved as Option C: Discord alone owns team names
and membership. Track the Hack has no team model, team field, team API, profile
team display, or synchronized membership snapshot.

## Environment

```sh
CLAIM_TOKEN_SECRET=
PARTICIPANT_SESSION_SECRET=
```

Both need at least 32 characters, generated separately, for example with
`openssl rand -base64 32`.
