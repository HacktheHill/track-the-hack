# Phase 2: day-of participant access

An organiser checks a government ID against the Sheet, issues a one-time code,
and the participant scans it to put a session on their own phone. After that
they can show an event QR that organisers scan all weekend.

Applications, identity and waiver evidence stay in Tally and the Sheet. Nothing
added here stores a name, an email or a phone number.

## Read this before wiring anything up

Two pieces are missing on purpose. Neither should be filled in by loosening the
app.

1. **Participant ids come from the Sheet.** `Hacker.id` has no `@default`, which
   is Waaberi's decision from phase 1. Adding one breaks the contract, since the
   Sheet reconciles rows by exact id and an id this app made up is one the Sheet
   has never heard of. A `cuid()` would also fail the id rules, because it
   carries a timestamp. Creating a `Hacker` with no id fails loudly today, and
   that is what we want.

2. **The Sheets sidebar is what calls these endpoints.** It does not exist and
   cannot live here, since it is Apps Script inside the Sheet. Nothing real
   flows through this feature until someone writes it.

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
issueClaimToken()        32 random bytes, expiry now + 5 minutes
replaceClaimToken()      one row per participant, so re-issuing kills the old QR
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
redeemClaimToken()       UPDATE ... WHERE consumedAt IS NULL AND expiresAt > now
    |
    v
Set-Cookie: participant_session=<hackerId>.<expiry>.<HMAC>; HttpOnly; SameSite=Lax
Set-Cookie: participant_pass=1
    |
    v
/profile shows the event QR, confirmation, size, meal category, team, Presence
```

## What was added

1. `ClaimToken` in `prisma/schema.prisma` plus its migration
2. `issueClaimToken` and `consumeClaimToken` in `hacker-lifecycle.ts`
3. `replaceClaimToken` and `redeemClaimToken` in `prisma-hacker-lifecycle.ts`
4. `src/pages/api/integrations/sheets/claim.ts`, called by the sidebar
5. `src/pages/api/claim.ts`, called by the participant's phone
6. `src/pages/claim/index.tsx` and `src/pages/profile.tsx` with their locales
7. `src/server/lib/participant-session.ts`, the signed session cookie
8. `src/components/QRCode.tsx`, which draws the event QR
9. `src/utils/participant-pass.ts` and a "My pass" link in `Navigation.tsx`
10. Five cases in `test/hacker-lifecycle.test.ts`

`qrcode` went back into `package.json`, since phase 1 removed it along with the
old encrypted QR component.

The HMAC helpers were generalised so the cancellation capability and the claim
token share them instead of keeping two copies. `createCancellationToken` and
`readCancellationToken` kept their old shape.

## Endpoints

`POST /api/integrations/sheets/claim`, with
`Authorization: Bearer <SHEETS_INTEGRATION_API_KEY>` and `{ "id": "..." }`.
Returns `claimUrl` and `expiresAt`. Errors are `400` for a malformed id, `401`
for a bad key, `404` for an unknown participant, `405` for anything but POST.
Re-issuing is how you recover someone who lost their code or changed phones.

`POST /api/claim`, no API key, `{ "token": "..." }`. The signed token is the
credential. Returns `{ "ok": true }` and the cookies, or `{ "ok": false }` with
one generic message. Spent, expired, forged and malformed all look identical
from outside, so the response cannot confirm a token was real.

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
7. **The session expiry is inside the signature**, so editing it breaks the
   signature instead of extending the session.

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

## Tests

`test/hacker-lifecycle.test.ts`, run with `npm test`. It uses a
`MemoryRepository` instead of Prisma, so it needs no database.

1. Issuance builds the URL correctly, expires in five minutes, and never stores
   the signature
2. A claim is single use, and rejects expiry, tampering, the wrong secret and
   unknown participants
3. Re-issuing revokes the unused claim and leaves one row
4. The session cookie is HttpOnly and SameSite, and rejects a wrong secret, a
   swapped id, a hand-stretched expiry and its own expiry
5. The navigation hint is not HttpOnly, holds no id, grants no session, and is
   cleared alongside the real cookie

Checked with a mutation run: breaking the single-use condition failed exactly
one test and left the rest passing.

The flow was also driven by hand with curl, and then end to end on an Android
phone over the LAN with the camera app. Opening the page did not consume the
code, activating landed on the pass, the fragment was gone afterwards, back did
not return to the token, "My pass" appeared and stayed across pages, reopening
the link bounced to the pass, and a spent code failed.

## Trying it locally

```sh
docker compose up -d
npx prisma migrate reset          # drops local data, reapplies migrations, seeds
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
  -d '{"id":"<participant id>"}'
```

Open the returned `claimUrl` and press the button. Pressing it again gives the
generic failure. Worth checking too: reloading `/claim` first leaves the token
unused, "My pass" appears once you are through, reopening `/claim` bounces you
to `/profile`, and no fragment is left in the address bar.

For a phone, the URL is built from `NEXTAUTH_URL`, so point it at the machine's
LAN address, run with `--hostname 0.0.0.0`, and put it back afterwards. Use a
private tab to start clean, since there is no sign out. `/qr` cannot be reached
locally at all without Google OAuth on a verified `@ctn-rtc.org` account.

## Left to integrate

1. **Tally form finished**, with waiver and guardian consent. Outside this repo,
   Daniel has it in progress.
2. **Sheet columns and participant id generation.** Outside this repo, waiting
   on the Tally form.
3. **Apps Script sidebar.** Outside this repo. It has to generate the id, send
   it through the phase 1 provisioning endpoint, then call the claim endpoint
   and draw the returned URL as a QR.
4. **Participant session shape**, plain cookie or NextAuth. Waiting on Daniel
   and Kai. Right now it is a plain signed cookie, because NextAuth brings
   accounts, providers and an adapter that a participant with no account does
   not need. Swapping it is contained to `participant-session.ts` and its
   callers.
5. **Session revocation on re-issue.** Nothing needs a database lookup to verify
   a session today, which is fast but means the server cannot kill one on
   demand. Issuing a new claim kills the old token, but a live session survives
   until it expires. Doing it properly needs per-participant state, so it waits
   on point 4.
6. **Sign out.** `clearParticipantSessionCookies` exists but nothing calls it.
   Worth deciding whether participants should have one, given access is issued
   in person.
7. **Workflow specific scanner views.** Blocked: the scanner works out its mode
   from the event type, but `EventType` only has `ALL`, `WORKSHOP`, `SOCIAL`,
   `CAREER_FAIR` and `FOOD`, so check-in and merchandise cannot be identified.
   Someone has to decide whether to add enum values or do it another way.
8. **Discord verification.** Nothing blocking it, just not started.

Also worth fixing separately: `npm run dev` needs `--webpack` like `build`
already has.

## Phase 3

The phase split is not written down anywhere, so this is what is left rather
than an official list. `PHASE_1_INTEGRATIONS.md` mentions a "Phase 3 ownership
decision" for `teamId`, which matches the last item in the implementation order
in `PROPOSED_FLOW.md`.

**Team source of truth**, still open between Track the Hack owning teams with
the bot updating them, Discord owning them and pushing a snapshot, or teams
living only in Discord. `teamId` is in the schema but provisioning rejects it
until this is settled, and `/profile` shows a team name that may need revisiting.

**Retention** for old application records, resumes and signatures. Phase 1
dropped the columns, but whatever is in production still needs handling.

## Environment

```sh
CLAIM_TOKEN_SECRET=
PARTICIPANT_SESSION_SECRET=
```

Both need at least 32 characters, generated separately, for example with
`openssl rand -base64 32`.
