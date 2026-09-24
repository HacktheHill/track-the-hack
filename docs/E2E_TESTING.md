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

On a real small phone, confirm the camera view fits and scrolls with every control
reachable. Where station names repeat, confirm the localised weekday and time make each
choice unambiguous. A disabled station must reject direct scanner and manual-adjustment
requests, not merely disappear from the selector.

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

Discord verification crosses the Track browser/session boundary, the signed service
request boundary, the bot's PostgreSQL identity store, and Discord role assignment.
Track must never store Discord IDs, usernames, mappings, or team data. Team creation
and membership tests belong to the bot and must not be duplicated here.

### Automated two-service test

Use the matching bot checkout documented in `DISCORD_VERIFICATION.md`. Install and
build it first, then run from Track:

```sh
npm run test:e2e:discord
```

This command is intentionally separate from `verify:dev` because the bot repository
and disposable PostgreSQL container are external prerequisites. It must exercise the
production proof generator, bot router, mapping store, Track MySQL participant/session
flow, and English and French browser pages. The Discord role call may remain a local
double. Confirm that it proves all of the following without logging a proof or private
identity value:

1. an active participant session completes a valid five-minute personal link;
2. loading or previewing the link is read-only and does not consume it;
3. absent, forged, revoked, and expired participant sessions fail;
4. malformed, wrongly signed, expired, and replayed proofs fail safely;
5. organiser authentication alone cannot verify a participant;
6. each Discord account and participant has at most one binding;
7. concurrent attempts cannot bypass either uniqueness rule;
8. role-assignment failure preserves the binding and a safe retry can finish;
9. conflict responses do not disclose the other account or participant; and
10. test participants, challenges, bindings, sessions, and containers are removed.

Run the bot's own focused tests as well as Track's standard gate. A passing local
double does not prove the deployed bot has the correct guild permissions or role.

### Controlled deployed verification

After deploying matching Track and bot releases with the same internal secret:

1. Confirm Track reports the feature available without exposing either service secret.
2. Activate an explicitly approved test participant session through the normal claim
   flow; organiser authentication is not a substitute.
3. In Discord, generate a new private verification link using `/verify` or
   **Generate Verification Link**. Do not paste the link into logs, issues, or chat.
4. Preview or open the link without pressing **Verify Discord account**. Confirm no
   binding or role is created.
5. Complete verification in English. Confirm the bot owns the resulting binding and
   the expected existing Discord role is present.
6. Retry the same valid link and confirm the idempotent success path. Generate another
   link for the same accounts and confirm it cannot silently reassign either identity.
7. Exercise the French page with a fresh approved test identity, unless the automated
   browser test is the accepted evidence for this release and no translated UI changed.
8. Inspect both services for redacted, useful logs. Proofs, Discord IDs, participant
   IDs, and internal bot error details must not appear in Track logs.
9. Remove only the test binding with the bot's documented management command. Role
   removal is a separate organiser decision; verify the intended cleanup explicitly.

Do not deliberately expire production participants, rotate a shared secret, reset all
event bindings, or break live Discord permissions merely to reproduce automated edge
cases. Record the Track revision, bot revision, test account class, result, and cleanup
without recording private identifiers.

## Google Sheets and real email acceptance

Automated lifecycle tests use the production mapper, real MySQL, browser interactions,
and captured loopback SMTP with pseudonymous fixtures. They do not write to the live
Sheet, call Apps Script, send externally, or prove the production service-token path.
Follow `RSVP_EMAIL_RUNBOOK.md` for campaign preparation and sending; the complete test
journey and its acceptance evidence are defined here.

### Preflight and one-row preparation

Use one explicitly approved test submission. Do not use a real participant merely
because their row is convenient.

1. Back up the bound Apps Script project and response Sheet.
2. Confirm the response layout has the exact supported Tracker columns and that the
   required script properties point to the intended protected deployment. Never print
   their values.
3. Push the reviewed script with `clasp`, reload the Sheet, and verify that `onOpen()`
   exposes the expected Track the Hack menu.
4. Review shared addresses and duplicate submissions before constructing any campaign.
   Exactly one row per intended recipient may remain in the accepted audience.
5. Set `TRACK_TEST_SUBMISSION_ID` to the approved submission and run
   `prepareTestSubmissionForRsvp()` only when fresh setup is required. Remove the
   property immediately afterward.
6. Confirm the row has one durable participant ID, one signed management link, the
   intended deadline, a refreshed RSVP status, and no unexpected changes to applicant
   fields. Retry preparation and verify the participant ID remains unchanged.
7. If the selected row already has a confirmed or declined response, do not call that
   a fresh invitation test. Choose another approved row or obtain explicit approval
   for the exact reversible reset/reissue operation.

Preparation provisions records and links but sends no email.

### Private recipient artefact and single approved email

1. Export the response tab into ignored `private-rsvp/` without committing or printing
   its contents.
2. Run `npm run rsvp:prepare` as documented in `RSVP_EMAIL_RUNBOOK.md` to produce the
   minimum private recipient CSV. Confirm its restrictive permissions and that no
   signed capability appears in terminal output.
3. Dry-run the bilingual campaign in the sibling bulk-email repository. Review the
   exact recipient count, suppression result, sender, reply-to address, deadline,
   subject, English and French rendering, text alternative, and campaign identifier.
4. Obtain action-time approval for the exact recipient, sender, subject, template, and
   rendered dry run before sending exactly one external test message.
5. Confirm the delivered message has the expected sender authentication and link host.
   Do not forward it or paste its management link into an issue, log, or chat.

A loopback SMTP test or successful dry run is not authorisation to send externally.

### Participant RSVP, claim, scanner, and reconciliation journey

Complete one coherent journey with the same designated test participant:

1. Open the RSVP management link and confirm that reading status does not mutate it.
2. Choose attending; refresh Sheet reconciliation and verify `CONFIRMED` without a new
   participant or management link.
3. Choose not attending; reconcile and verify `DECLINED`.
4. Reopen the original email link, choose attending again, and verify `CONFIRMED`.
5. Verify the configured deadline: test the boundary with controlled local time or an
   approved reversible test deadline, not by corrupting the campaign deadline.
6. Issue a five-minute claim and verify that loading or previewing its page is
   read-only. Explicitly activate it, then verify the participant session persists.
7. Open the profile/pass, confirm participant details and QR, and verify the installed
   PWA's offline pass exposes no extra private profile data.
8. Optically scan the pass from a second organiser device. Exercise check-in,
   merchandise, food or another station with `maxCheckIns > 1`, and attendance. Verify
   each workflow returns only its permitted participant fields.
9. Reissue access and confirm the old claim and prior participant session no longer
   grant access. Verify expiry and replay failures through focused automation unless a
   production-only configuration boundary changed.
10. Refresh RSVP responses once more and verify participant ID, link, state, and refresh
    timestamp remain consistent.
11. Remove only the test Presence/session/capability data that was explicitly created,
    restore reversible counters, and record anything intentionally retained.

Before a full campaign, verify accepted-audience preparation is complete, reconciliation
has zero missing or duplicate participant IDs, and the private recipient CSV matches the
reviewed audience. Obtain separate action-time approval for the final count,
suppressions, sender, deadline, subject, template, and rendered dry run. A successful
one-recipient test is not approval to send the campaign.

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
