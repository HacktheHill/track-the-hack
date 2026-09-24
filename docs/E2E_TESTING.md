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

- `dev-organizer@ctn-rtc.org` with organiser and administrator access;
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

## Event Services acceptance

Use seeded development participants and disposable imported inventory. Never use the
production import or a real participant merely to test these paths.

For Hardware Desk, dry-run counted and uncounted fixtures plus duplicate keys,
normalized duplicate names, unknown modes/categories, invalid Boolean flags,
negative/fractional counted quantities, an uncounted quantity, and bag/box display
wording. Apply the valid fixture to an empty target; prove a second apply and a target
with a legacy `Hardware` row both fail. Then complete one journey:

1. With an active participant session, open Services and search the catalogue in both
   languages. Confirm counted items show exact quantities, uncounted items show only
   Available or Out of stock, and no cart or mutation is offered.
2. As an organiser, toggle an uncounted item Out of stock and back to Available. Build
   a mixed counted/uncounted cart, adjust individual quantities, scan the participant QR,
   enter a temporary pickup name, acknowledge physical-ID collection, and review the
   final cart before one checkout.
3. From two organiser sessions, race checkout of the last unit. Exactly one succeeds,
   no quantity becomes negative, and retrying the winning idempotency key creates no
   second loan.
4. Find the loan by QR, then by pickup name. Partially return one line. On a later atomic
   return, split an eligible line across Returned, Damaged, Missing, and Consumed;
   verify only Returned counted units become available and uncounted outcomes do not
   change global quantities. Confirm Consumed is absent for an ineligible reusable item
   and a forged Consumed request is rejected.
5. Retry the return key and confirm no duplicate outcome. Finish the remaining lines,
   acknowledge returning the physical ID, and verify the temporary name disappears
   from database results and search. Repeat closure without the acknowledgement and
   confirm it warns rather than blocking the physical-desk decision.
6. Reconcile counted items: total equals available plus open-loan units plus damaged,
   missing, and consumed. Reconcile every loan line against all four outcomes. Confirm
   logs contain opaque IDs but no pickup name or ID details.

For Latte Lab, leave the seeded lab closed and complete this journey at the smallest
supported phone viewport:

1. Open Services as a participant. Confirm the menu says closed and no order can be
   submitted. As an organiser, enable the lab and all ingredients.
2. Time a normal order from drink selection through review and submission; it should
   take under 30 seconds. Check required milk/base choices, optional defaults, direct
   editing, one prominent submit action, and the dairy/almond badges plus persistent
   cross-contact notice.
3. Double-click submit and race a second device for the same participant. Exactly one
   active order exists. Verify Queued position, cancel while Queued, and rejection of a
   participant cancellation after preparation starts.
4. Place two participant orders. On the organiser queue, move the first through
   Queued → Preparing → Ready → Completed. Confirm skipped, reversed, repeated, stale,
   and concurrently raced transitions fail, while retrying one successful transition
   key is idempotent. Participant polling must replace queue position with Preparing
   and Ready status.
5. Confirm terminal orders clear pickup names while retaining configuration and
   timestamps. Cancel active orders with each supported reason class and verify the same
   privacy behaviour.
6. Toggle ice, each milk, each syrup, sweeteners, and every fixed base ingredient. A
   drink with no valid configuration is disabled; unavailable options disappear or are
   disabled; a stale hidden configuration is rejected server-side. Existing queued
   orders remain unchanged. Closing the lab blocks new orders without altering them.
7. Exercise every drink/temperature/milk/flavour/sweetener combination in focused tests,
   not the browser. In the browser, sample one optional-milk drink, one required-milk
   drink, London Fog, and Hot Chocolate.

For both services, repeat the browser path in English and French where labels are
longest. Check keyboard-only operation, visible focus, labels, associated errors, screen
reader announcements, and 44-pixel-or-larger touch controls. In a production PWA build,
load `/services`, `/hardware`, `/latte-lab`, `/internal/hardware`, and
`/internal/latte-lab`, then go offline. Each must fail closed to the localized offline
page; catalogue quantities, loans, orders, queue position, pickup names, and ingredient
availability must not appear in Cache Storage or private Next-data responses.

The automated PWA test must build and start production mode, verify every explicit
precache URL, activate the service worker, cache public English and French routes, and
reload them offline. It also loads an authenticated profile and verifies that `/profile`
becomes the same QR-only pass without profile details, while private routes use the
offline fallback. Scanning and all writes remain online-only.

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
offline behaviour works. [`OFFLINE_ACCEPTANCE.md`](./OFFLINE_ACCEPTANCE.md) is the
authoritative release-closing procedure. It includes:

- the local production-build MySQL/Chromium command and its required assertions;
- the hosted CI jobs that must pass;
- clean installation and empty-cache checks;
- the complete English/French route matrix on Android Chrome and an iPhone
  home-screen web app;
- participant-pass privacy, sign-out cleanup, reconnect behaviour, and test-data
  cleanup;
- production deployment evidence and an explicit definition of complete.

Run at minimum:

```sh
npm run test:e2e:pwa
```

Then follow the linked physical-device and production sections in order. Inspecting
cache names is useful diagnosis but is not a substitute for an offline relaunch on both
required device platforms. Do not mark the PWA accepted while the runbook contains a
failed or unexplained skipped item.

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

1. only an active participant session with a positive `CHECK_IN` presence can
   complete a valid five-minute personal link;
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
4. Before check-in, open the link and confirm the button is disabled with the
   check-in-required message and no binding or role is created.
5. Scan that participant at a station whose workflow is `CHECK_IN`, reload the same
   link, and confirm the button becomes enabled while no binding or role has yet been
   created. An attendance, food, or merchandise Presence must not satisfy this
   requirement.
6. Complete verification in English. Confirm the bot owns the resulting binding and
   the expected existing Discord role is present.
7. Retry the same valid link and confirm the idempotent success path. Generate another
   link for the same accounts and confirm it cannot silently reassign either identity.
8. Exercise the French page with a fresh approved test identity, unless the automated
   browser test is the accepted evidence for this release and no translated UI changed.
9. Inspect both services for redacted, useful logs. Proofs, Discord IDs, participant
   IDs, and internal bot error details must not appear in Track logs.
10. Remove only the test binding with the bot's documented management command. Role
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
- verified CTN Google OAuth, external-email allowlist, and magic-link delivery;
- live Apps Script authentication with the designated test row;
- public schedule/event data and bilingual static routes;
- one controlled participant claim/profile/pass path;
- scanner authorisation and a reversible test Presence;
- push readiness/key match if reminders changed;
- Cloudflare Access remains enabled.

For an offline/PWA change, complete every production and physical-device step in
[`OFFLINE_ACCEPTANCE.md`](./OFFLINE_ACCEPTANCE.md). Its completed acceptance record is
the offline portion of the production-smoke evidence; a green build or unauthenticated
Cloudflare redirect does not replace it.

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
