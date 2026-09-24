# End-to-end testing

This runbook is the authoritative test process for Track the Hack. It covers each
meaningful authorisation boundary and user journey once. Do not add browser tests for
behaviour already proved more cheaply by a focused unit/integration test unless the
browser, network, service worker, database, or external-system boundary is itself the
risk.

## Test strategy

Use the narrowest layer that proves the behaviour:

| Layer              | Use it for                                                                                                                         | Do not use it for                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Unit/focused tests | validation, field allowlists, token verification, state transitions, locale rendering, SQL decision logic with a repository double | proving a real migration, cookie, browser, camera, service worker, or cross-device race |
| MySQL integration  | migrations, binary-collation identity, transactions, uniqueness, conditional updates, concurrent caps and claims                   | repeating every UI assertion                                                            |
| Browser E2E        | cookies, navigation, forms, protected pages, real tRPC/HTTP integration, service-worker fallback                                   | every enum value or malformed payload                                                   |
| Physical/manual    | camera decoding, USB scanners, vibration/audio, small-phone layout, two-device races, Google/Sheet/email provider behaviour        | logic already deterministic in automation                                               |
| Production smoke   | deployed configuration, provider identity, private networking, revision health, real redirects and controlled integrations         | destructive edge cases or exhaustive regression                                         |

A release is not “fully tested” if a required layer was skipped. Record skipped checks
with the concrete reason and the environment in which they still need to run.

## Safety and data rules

- Use only loopback development URLs for local organiser auth.
- `dev:setup` refuses any database except loopback MySQL database
  `track-the-hack`; do not bypass that guard.
- Use deterministic development participants or an explicitly approved production test
  row. Never scan or change a real participant merely to prove a path.
- Never print Sheet API keys, OAuth secrets, signed RSVP/claim/cancellation capabilities,
  participant-session cookies, or private CSV contents.
- External email, production database writes, real Apps Script writes, and production
  deployment require separate action-time authorisation and a reviewed target.
- Keep Cloudflare Access enabled throughout private production acceptance.

## Prerequisites

Use Node 24, Docker with Compose, and Chromium:

```sh
npm install
npm run dev:setup
```

`dev:setup` fills only missing ignored `.env` values, starts MySQL, deploys every
migration, and idempotently seeds:

- `dev-organizer@ctn-rtc.org` with `ADMIN` and `ORGANIZER`;
- normal participant `dev-participant-normal-01`;
- walk-in participant `dev-participant-walkin-01`;
- current check-in, merchandise, food, and attendance events.

It does not erase unrelated development rows. Set `CHROMIUM_PATH` only if Chromium is
not in a standard location.

## Standard automated gate

Run before pushing an application change:

```sh
npm run verify:dev
```

This runs the full focused suite, type checking, lint, database-backed lifecycle E2E,
and the production-build PWA test. Also run:

```sh
npx prisma validate
npx prisma generate
git diff --check
```

For schema changes, verify migrations from both an empty schema and a disposable copy
of the current production-equivalent schema. Hosted CI performs a clean MySQL migration
run; inspect its result rather than assuming a local mock covers migration behaviour.

Useful narrower commands while iterating:

```sh
npm test
npm run typecheck
npm run lint
npm run test:e2e:dev
npm run test:e2e:pwa
npm run test:e2e:discord
npm run test:e2e:scanner
```

Next config and server modules always validate their environment. There is no
`SKIP_ENV_VALIDATION` bypass: builds that import server modules must provide values
matching `src/env/schema.mjs`, and production server imports keep the same validation.

Do not run all narrower commands after `verify:dev` merely to duplicate the same work.
Run a focused command first during development, then the full gate once before handoff.

## What the automated lifecycle must prove

`npm run test:e2e:dev` uses real MySQL, HTTP, browser cookies, the production Apps
Script mapper, and loopback SMTP. It must cover:

1. bilingual Tally fixture mapping and strict pseudonymous provisioning;
2. Sheet bearer authentication and rejection of identity/application fields;
3. RFC MIME invitation delivery to loopback, RSVP status read, attend, decline, and
   reopening the same management link;
4. reconciliation of `PENDING`, `CONFIRMED`, and `DECLINED` without changing state;
5. claim-QR rendering, explicit claim consumption, participant profile/event QR, and
   participant sign-out;
6. replacement issuance revoking an older claim and active session;
7. the walk-in flag through the same reviewed provisioning and claim path;
8. loopback-only organiser sign-in and protected scanner/metrics access;
9. manual scanner input writing a real Presence row;
10. all four scanner workflow response allowlists and aggregate metrics;
11. cleanup of generated participants, sessions, capabilities, Presence, and logs.

The automated PWA test must build and start production mode, activate the service
worker, load an authenticated profile, go offline, and verify that `/profile` becomes
the same QR-only pass without profile details. Public-route offline acceptance is also
required after public cache changes; see the manual PWA section below.

## Manual local journey

Start the app:

```sh
npm run dev
```

In another terminal, use the restricted-system simulator:

```sh
npm run dev:participant -- rsvp
npm run dev:participant -- reconcile
npm run dev:participant -- claim
npm run dev:participant -- walk-in
```

The commands use `example.test` recipients and an ephemeral loopback SMTP server. Real
MIME files are written under ignored `.dev-mailbox/` and no mail leaves the machine.

Perform one coherent journey instead of isolated duplicate clicks:

1. Provision the normal fixture and open the captured invitation.
2. Read status without changing it; attend; reconcile; decline; reconcile; attend again
   with the original link.
3. Issue a claim and open it on the participant browser. Confirm that merely loading or
   previewing the page does not consume it; explicitly activate it.
4. Verify profile fields, event QR, “My pass” navigation, and sign-out.
5. Reissue access and confirm the old session no longer opens the profile.
6. Run the walk-in path and verify `walkIn` without a separate participant form.
7. Sign in as the local organiser, open Scanner, select each workflow, and use the manual
   input with the fixture ID.
8. Verify check-in confirmation/T-shirt output, merchandise T-shirt output, food
   diet/escalation output, and attendance interests. Confirm disallowed fields do not
   appear in other workflows.
9. Verify metrics change only through the expected aggregate counters.

## Scanner and multi-device acceptance

With `npm run dev:setup` complete and `npm run dev` running on the configured loopback
URL, run `npm run test:e2e:scanner` for the scripted mobile layout path. Then use a real
small phone and USB scanner when scanner code, station configuration, or feedback
changes.

Test one station in each semantic class, not every event row:

- disabled station: absent and rejected server-side;
- blank/one maximum: repeat scan remains idempotent;
- maximum greater than one: deliberate repeats increment to the cap;
- attendance: interests load; other workflows cannot request them.

For the capped station:

1. Hold one QR continuously in view; it must count once.
2. Remove it for at least one second and present it again; it must increment once.
3. Scan A → B → A; A must be eligible for a deliberate repeat.
4. Reach the cap; later scans must return `limit` without increasing.
5. Confirm distinct visual feedback for new, incremented, unchanged, limit, and error.
6. Where supported, confirm sound and vibration differ and failure of either capability
   does not stop scanning.
7. Repeat with a USB scanner; each form submission is deliberate.
8. From two organiser devices, race a scan near the cap and verify the database cannot
   exceed it.
9. Make a manual adjustment from both devices and verify stale reconciliation returns
   the server's count rather than overwriting it.
10. Reload after selecting a station and verify persistence; if that station becomes
    ineligible, verify safe fallback.

Use manual `+`/`−` to restore test counters when safe, and verify cleanup directly.

## PWA and offline acceptance

The service worker is disabled in `next dev`; never use development mode to claim
offline behaviour works.

First run the automated profile privacy check:

```sh
npm run test:e2e:pwa
```

For public-cache or worker changes, use Android Chrome or an equivalent installed-PWA
environment with a production build:

1. Load online and wait until the service worker is activated and controls the page.
2. Visit home, populated schedule, a real event detail, maps, resources, sponsors, and
   participant pass in English and French.
3. Disconnect, then reload each. Confirm event data and all six map SVGs remain usable.
4. Confirm organiser, metrics, auth, RSVP, claim, and private data/API routes do not
   reveal cached private responses. `/profile` may show only the QR-only pass fallback.
5. Confirm English and French offline failures render in the correct language.
6. Reconnect and activate a newer worker in a controlled second build. Confirm no mixed
   old/new asset failure, stale private cache, or reload loop.

Inspecting cache names is useful diagnosis but is not a substitute for these reloads.

## Event, reminder, and interest acceptance

When these areas change, test one representative event rather than the full schedule:

1. As an organiser, create or edit a bilingual event and verify validation, visibility,
   scanner eligibility/workflow, cap, localised room, link, and dates.
2. Verify a hidden event is absent from public `all/get` results but remains available to
   organiser management; scanning depends on `scannerEnabled`, not visibility.
3. In English and French schedule views, save and remove an interest. Verify a hidden or
   missing event cannot be saved and another participant's selection is inaccessible.
4. Enable then disable an event reminder. Verify refetch/reload state, denied browser
   permission, unavailable server keys, and unsubscribe failure behaviour.
5. For scheduler changes, run the isolated reminder database tests with
   `PUSH_TEST_DATABASE_URL` pointing only to a disposable database whose name contains
   `test` or `review`. Confirm claim leases, recovery, rescheduling, hidden-event
   closure, invalid subscription cleanup, and provider timeout.

Do not wait for a real event time in E2E; controlled database times and the scheduler's
focused tests prove that boundary more reliably.

## Discord verification

Use `npm run test:e2e:discord` with the separately configured bot repository. The test
must prove that an active participant session can complete one signed personal link,
that GET/link preview is read-only, replay and expired signatures fail, and identity
mapping remains bot-owned. Follow `DISCORD_VERIFICATION.md` for two-service setup.

Do not duplicate team creation/membership tests in Tracker; those belong to the bot.

## Google Sheets and real email acceptance

Automated tests use the production mapper with fixtures, not the live Sheet. Before an
actual campaign or Apps Script update:

1. back up the bound script and response Sheet;
2. confirm the exact supported Tracker columns and script properties;
3. update with `clasp`, reload the Sheet, and verify the menu;
4. run the designated one-row test and confirm the participant ID is unchanged on retry;
5. verify accepted-audience preparation is complete and Sheet reconciliation has zero
   missing IDs;
6. generate a private dry-run recipient CSV and review suppressions, count, sender,
   deadline, subject, and template;
7. obtain explicit action-time approval before sending exactly one external test;
8. complete RSVP, claim, scan, expiry/reissue, and cleanup with that recipient;
9. obtain separate approval before a full campaign.

Follow `RSVP_EMAIL_RUNBOOK.md`; never use the automated loopback mail result as
authorisation to send externally.

## Deployment and production smoke

Deploy only through the reviewed `main` workflow. The migration job must succeed before
the application revision changes. After deployment, record release SHA, image tags,
migration execution, revision, health, and traffic without recording secrets.

Smoke-test only what production configuration adds beyond local E2E:

- protected `healthz` and `readyz`;
- Google OAuth redirect and pre-provisioned organiser access;
- live Apps Script authentication with the designated test row;
- public schedule/event data and bilingual static routes;
- one controlled participant claim/profile/pass path;
- scanner authorisation and a reversible test Presence;
- push readiness/key match if reminders changed;
- Cloudflare Access remains enabled.

Do not repeat destructive edge cases in production. Verify counts before and after, and
remove only explicitly created test records.

## Evidence to report

For every verification handoff, list:

- commit SHA and environment;
- commands run and exact pass/fail/skip totals;
- migration database type and starting state;
- browser/device models used;
- paths exercised manually;
- skipped checks and why;
- production revision/image/migration execution when applicable;
- test data created and how it was cleaned up.

Do not summarise an unrun check as passed, and do not make “all paths tested” claims
without identifying the external and physical checks above.
