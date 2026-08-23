# Development verification

This workflow exercises the Track the Hack-owned lifecycle without requiring a
real Tally form, Google Sheet, email recipient, Google OAuth client, Gmail token,
or physical camera.

## One-time setup

Use Node 24 and Docker:

```sh
npm install
npm run dev:setup
```

`dev:setup` fills only missing values in the ignored `.env`, waits for MySQL,
deploys all migrations, and idempotently refreshes these fixtures. It refuses to
run migrations or seeds unless `DATABASE_URL` points to the local
`track-the-hack` MySQL database.

- organizer: `dev-organizer@ctn-rtc.org` with `ADMIN` and `ORGANIZER`
- normal participant: `dev-participant-normal-01`
- walk-in participant: `dev-participant-walkin-01`
- current CHECK_IN, MERCHANDISE, FOOD, and ATTENDANCE scanner events

It is safe to rerun. It does not erase existing development rows.

## Complete automated verification

```sh
npm run verify:dev
```

That single command runs unit tests, type checking, linting, the core local
lifecycle below, and the production-build PWA/offline browser check. Focused
tests cover provider adapters that do not benefit from browser E2E. No
third-party credentials or physical devices are needed.

## Faster lifecycle-only check

```sh
npm run test:e2e:dev
```

The command starts Next on a free loopback port and uses the real MySQL schema.
It verifies:

1. Tally fixture review through the production `Code.gs` mapper, Sheet bearer
   authentication, and strict pseudonymous provisioning
2. Invitation and confirmation MIME generation through loopback SMTP, with the
   captured links driving browser RSVP confirmation and cancellation
3. Browser claim-QR rendering and activation, participant profile/QR,
   replacement-session revocation, sign-out, and walk-in access
4. Browser local-organizer sign-in, protected `/qr`, and authenticated `/metrics` SSR access
5. Browser interaction with the `/qr` manual scanner, authorization rejection,
   CHECK_IN API mutation, and MySQL Presence row
6. CHECK_IN, MERCHANDISE, FOOD, and ATTENDANCE tRPC mutations and aggregate metrics

The generated test participants and their logs are removed afterward. Seeded
fixtures remain. The browser checks use an installed Chromium; set
`CHROMIUM_PATH=/path/to/chromium` if it is not in a common system location.

## Manual Tally, Sheet, and email workflow

Start the app in one terminal:

```sh
npm run dev
```

Use another terminal as the restricted Sheet/bulk-email boundary:

```sh
npm run dev:participant -- rsvp
npm run dev:participant -- reconcile
npm run dev:participant -- claim
npm run dev:participant -- walk-in
```

- `rsvp` provisions the accepted normal fixture and delivers an invitation email
  through an ephemeral loopback SMTP server.
- `reconcile` prints RSVP state and, after confirmation, delivers the confirmation
  email through the same local SMTP path.
- `claim` prints a day-of claim URL and the participant ID used by the scanner.
- `walk-in` runs the same access contract with `walkIn: true`.

Invitation and confirmation messages are real RFC MIME emails stored as `.eml`
files under `.dev-mailbox/`. Open them in a mail client or follow the convenience
URL printed beside the file. The mailbox uses only `example.test` addresses and
never connects outside loopback.

For organizer operations, use the navigation sign-in button, choose **Sign in
as local organizer**, select a scanner workflow, and type or paste either fixture
ID into the labelled manual scanner. The camera is not required.

## Automated PWA/offline browser check

The service worker is intentionally disabled by `next dev`. Test its real build:

```sh
npm run test:e2e:pwa
```

The command builds and starts the production server on a free loopback port,
provisions and activates a temporary participant, loads `/profile`, installs the
service worker, switches Chromium offline, and reloads `/profile`. It requires
the static `/pass` fallback to preserve the same participant QR while omitting
profile details and attendance. The temporary participant is removed afterward.

## Deployment smoke tests

The local suite is the development acceptance gate. A deployment may additionally
smoke-test its own Google OAuth redirect, Google API credentials, and Apps Script
URL; those environment checks do not block local development and are not
substitutes for the automated suite.

The legacy Hardware database table has no user-facing workflow in this app, so it
is outside the implemented lifecycle rather than an untestable dev dependency.
