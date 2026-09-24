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
- Participant Web Push, Discord reminders, and food-service campaigns use the
  authoritative real-provider procedure and completion checklist in
  [`NOTIFICATIONS.md`](./NOTIFICATIONS.md#real-provider-end-to-end-acceptance). It
  requires separately confirmed sends and an isolated, consenting test audience.

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

This is the complete acceptance procedure for Hardware Desk and Latte Lab. Run it on a
disposable local database after the standard automated gate. Never re-run the production
hardware import, create a real participant loan, or place a real participant order merely
to test these paths.

The automated gate already covers malformed hardware CSV rows, importer guards,
counted-stock concurrency, checkout and return idempotency, invalid disposition and
Latte transitions, one-active-order concurrency, recipe compatibility, allergen
derivation, locale-key completeness, reconciliation guards, and private-route PWA
behaviour. Do not repeat every enum or invalid payload manually. The browser journey
below proves the cross-role, physical-desk, responsive, and privacy behaviour that the
focused tests cannot.

### Isolated setup and fixtures

Use a dedicated local `track-the-hack` database. If the current local database contains
hardware or Event Services records that must be retained, create a separate Compose
project and database; do not delete shared development data to make the importer pass.
Only for a confirmed disposable current Compose project, a full reset is:

```sh
docker compose down --volumes
npm run dev:setup
```

The first command destroys the current Compose project's local MySQL volume. Different
worktrees can resolve to the same default Compose project name, so inspect the project
and volume before running it. It is never a production or shared-development cleanup
command.

Create an ignored file such as `prisma/event-services-e2e.csv`:

```csv
importKey,category,name,inventoryMode,quantity,consumptionAllowed,description,imageUrl
e2e-reusable,MISCELLANEOUS,E2E reusable board,COUNTED,2,false,Reusable board,
e2e-batteries,MISCELLANEOUS,E2E batteries,COUNTED,4,true,Batteries returned to the desk,
e2e-components,MISCELLANEOUS,E2E components,UNCOUNTED,,true,Loose components,
```

Dry-run and review it before applying it to the empty disposable target:

```sh
npm run hardware:import -- prisma/event-services-e2e.csv
npm run hardware:import -- prisma/event-services-e2e.csv --apply
```

The dry run must report two counted item types, six known counted units, one uncounted
item type, and two consumption-enabled item types. The apply must create exactly those
three records. The focused importer tests—not this browser journey—prove the invalid-row,
duplicate, non-empty-target, and legacy-table rejection cases.

Start the app and create two separate participant sessions:

```sh
npm run dev
npm run dev:participant -- claim
npm run dev:participant -- walk-in
```

Open each emitted claim link in a different browser profile and explicitly activate it;
loading the link alone does not consume the claim. Use a third profile to choose **Sign
in as local organiser**. Keep the organiser, normal participant, and walk-in participant
profiles separate throughout the test.

For the database and audit inspections called out below, start Prisma Studio in another
terminal and open the printed loopback URL:

```sh
npx prisma studio --browser none --port 5555
```

Inspect `HardwareItem`, `HardwareLoan`, `HardwareLoanLine`, `HardwareReturnLine`,
`LatteOrder`, and `AuditEvent` directly. Do not edit rows through Studio during the
journey; use it as read-only evidence so the UI and server remain the only writers.

### Hardware Desk journey

Use `/hardware` for the participant and `/internal/hardware` for the organiser. Record
the starting fixture state before checkout.

1. In English, then Canadian French, search for all three fixture items. Confirm the
   reusable board shows `2` available, batteries show `4` available, and components
   show Available/`Disponible` without a number. Confirm a participant has no cart,
   checkout, return, or availability controls.
2. As the organiser, mark the uncounted components Out of stock/`Épuisé`. Reload or
   wait for the participant catalogue to refetch and confirm it cannot be added. Restore
   it to Available/`Disponible` before continuing.
3. Add one reusable board, two batteries, and three components to one cart. Adjust a
   quantity and remove/re-add a line once to verify ordinary cart correction. Scan the
   normal participant's QR or enter its opaque ID, enter a clearly synthetic temporary
   pickup name, confirm physical-ID collection, review the full summary, and submit one
   checkout.
4. Confirm the entire checkout either succeeds or fails together. After success, the
   reusable board must show `1` available, batteries `2` available, and components must
   still show Available without an invented global quantity.
5. Find the open loan first by participant QR/opaque ID, then by its temporary pickup
   name. In the return modal, note that every outstanding line defaults to Returned.
   Set unrelated lines to zero before submitting a partial return of one battery as
   Returned and one battery as Consumed. Confirm batteries now show `3` available: the
   Returned unit is available again and the Consumed unit is not.
6. Finish the loan in one atomic return: record the reusable board as Damaged; record
   the three components as one Returned, one Missing, and one Consumed; and acknowledge
   physical-ID return. Consumed must not be offered for the reusable board.
7. Confirm the terminal status is `CLOSED_WITH_MISSING`, the pickup name no longer finds
   an active loan, and the stored pickup name is null. The expected counted invariants
   are reusable total `2 = 1 available + 1 damaged`, and batteries total
   `4 = 3 available + 1 consumed`. The uncounted item keeps null total/available fields;
   its exact Returned, Missing, and Consumed outcomes live only on its loan and return
   records.
8. Inspect the corresponding structured audit events. They may contain opaque organiser,
   participant, item, loan, and return IDs plus disposition counts; they must contain no
   pickup name, physical-ID type, number, image, or other document detail.

The automated database test is the acceptance evidence for the last-counted-unit race,
duplicate idempotency keys, forged Consumed request, and arithmetic constraints. Do not
try to reproduce those cases by corrupting browser requests.

### Latte Lab journey

Use `/latte-lab` for participants and `/internal/latte-lab` for the organiser. Run the
participant path at the smallest supported phone viewport and time the first normal
order from drink selection to submission.

1. Confirm the lab starts closed and a participant cannot submit an order. Confirm the
   organiser queue is protected from participants. As the organiser, ensure every
   ingredient is available and open the lab.
2. As the normal participant, choose an iced Latte with oat milk and caramel. Confirm
   required milk selection, directly editable review fields, dairy/almond allergen
   badges when those choices are selected, the persistent cross-contact notice, and one
   prominent Place Order action. Enter a synthetic 1–40 character pickup name. Complete
   the normal path in under 30 seconds.
3. Double-click Place Order once as a user would accidentally. Confirm only one active
   order appears. The focused concurrency test—not repeated browser racing—is the
   database evidence that a participant cannot acquire two active orders.
4. Place a Tea order from the walk-in participant profile. Confirm both participants see
   their correct queued positions. In the organiser queue, move the older order through
   Queued → Preparing → Ready → Completed. Each participant page should reconcile
   within its polling interval (normally about three seconds), and the queue number must
   disappear once preparation starts.
5. While the second order is still Queued, cancel it from the participant page and
   confirm it leaves the active queue. Place another order, start it, and confirm the
   participant can no longer cancel it; finish or cancel it from the organiser queue
   using one appropriate reason.
6. Place one more order and leave it queued. Disable ice and confirm iced configurations
   disappear or become unavailable for new orders without changing the queued order.
   Disable Earl Grey and confirm London Fog becomes unavailable. Restore both ingredients
   before continuing.
7. Close the lab. Confirm new submissions are blocked while an existing active order is
   unchanged. Resolve the retained order through the organiser queue, then leave the lab
   closed unless it is deliberately being opened for event operations.
8. Inspect terminal `LatteOrder` rows and confirm `pickupName` and `activeHackerId` are
   null while the anonymised drink configuration and lifecycle timestamps remain.
   Confirm audit events use opaque IDs and never contain the pickup name.

The focused tests are the acceptance evidence for every recipe combination, unavailable
hidden configurations, invalid/skipped/reversed/stale transitions, idempotent retries,
all cancellation reason enums, and one-active-order races. Browser acceptance needs one
representative optional-milk drink and one required-milk drink, not every combination.

### Accessibility, language, physical devices, and privacy

Repeat the longest and most consequential portions of both journeys in English and
Canadian French. French interface text must not introduce extra spaces before `:`, `;`,
`?`, or `!`. Verify keyboard-only navigation, visible focus, meaningful labels,
associated validation errors, screen-reader announcements, and touch targets of at least
44 pixels. On the physical desk devices, verify the actual camera or USB scanner can
enter a participant QR and that the cart and four-outcome return controls fit the
supported phone/tablet viewport without hidden actions.

`npm run test:e2e:pwa` is the authoritative private-cache test. It must build and start
production mode, activate the service worker, and confirm `/services`, `/hardware`,
`/latte-lab`, `/internal/hardware`, and `/internal/latte-lab` fail closed offline.
Catalogue quantities, loans, orders, queue positions, pickup names, and ingredient
availability must not appear in Cache Storage or private Next-data responses. The same
test verifies that authenticated `/profile` becomes only the QR pass offline while
public English and French routes remain cached.

### Cleanup, evidence, and completion criteria

Before declaring Event Services complete:

1. Resolve every test loan and Latte order; do not leave active rows behind.
2. Restore every uncounted fixture item to Available and every Latte ingredient to
   available. Leave Latte Lab closed.
3. Confirm terminal hardware and Latte pickup names are null and no audit line contains
   either temporary name or physical-ID detail.
4. Delete the ignored `prisma/event-services-e2e.csv`. Retain the disposable database
   only as long as its evidence is useful. If it is truly disposable, remove its Docker
   volume with `docker compose down --volumes`; this destroys all local database data.
5. Record the commit, commands and exact pass/skip totals, browser profiles and physical
   devices, English/French paths, starting and ending inventory values, test record IDs,
   privacy inspection, and cleanup result.
6. For a deployed release, complete the non-mutating production smoke below. Do not
   create a production loan or order solely for validation.

When the standard automated gate passes, this manual journey passes, the production
smoke passes, all test state is cleaned up, and no skipped check remains unexplained,
Event Services has no remaining implementation or test work. Opening Latte Lab for an
event and processing real hardware loans are operations, not unfinished development.

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
- Event Services route authorisation and non-mutating catalogue/menu reads with a
  designated test session; verify the six production uncounted hardware types show no
  invented quantity, AA batteries and EMG electrodes remain counted, and Latte Lab is
  in its intended closed/open operational state;
- push readiness/key match if reminders changed;
- Cloudflare Access remains enabled.

For an offline/PWA change, complete every production and physical-device step in
[`OFFLINE_ACCEPTANCE.md`](./OFFLINE_ACCEPTANCE.md). Its completed acceptance record is
the offline portion of the production-smoke evidence; a green build or unauthenticated
Cloudflare redirect does not replace it.

Notification changes add a real-provider acceptance gate after these generic checks.
Run [`NOTIFICATIONS.md`](./NOTIFICATIONS.md#real-provider-end-to-end-acceptance) from
audience isolation through closeout. A production campaign test is prohibited when
the checked-in snapshot could include a non-test Hacker; use protected staging or a
reviewed window containing only designated test participants. Deployment approval is
not send approval.

Do not repeat destructive edge cases in production. Do not create a hardware loan,
Latte order, or availability change solely for smoke testing. Verify counts before and
after, and remove only explicitly created test records.

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
