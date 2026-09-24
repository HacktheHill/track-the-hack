# Event readiness handoff

This file contains only outstanding work. When an item is completed and verified,
remove it rather than turning this document into a completion log. Git history records
completed implementation.

Earlier `REMAINING_WORK.md` reports came from different checkouts and are superseded.
Do not combine them into an additive backlog, and do not deploy an abandoned worktree
or prototype branch wholesale.

## Current release boundary

The source of truth is the current `origin/main`; resolve its exact SHA immediately
before deployment. The production application is still Azure Container App revision
`track-the-hack--0000058`, running image
`trackthehackacr.azurecr.io/track-the-hack:85af7abb4adda34541b172ded3a766e4b3a01a41`.
The production revision is healthy and receives 100% of traffic, but it predates the
current source. Do not describe the new code as deployed until the Azure migration,
application rollout, and post-deployment checks below have all succeeded.

The production database is privately networked. Use the existing Azure Container Apps
migration job rather than exposing MySQL or copying database credentials elsewhere.
Keep Cloudflare Access enabled during testing. Public launch is a separate decision.

The private schedule CSV and RSVP exports are operational data:

- `private-schedule/` is the ignored location for an operator-supplied schedule CSV.
  Production already contains the audited 41-event schedule; no schedule import is
  pending.
- `private-rsvp/` holds response exports, signed RSVP management links, recipient CSVs,
  and Apps Script backups. It is not an application module.
- Never commit, upload, paste into an issue, or print either directory's contents.
- Removing the schedule CSV from Git did not remove database events or affect the
  Sheet-to-database participant integration.

## 1. Deploy and accept current `main`

This is the highest-priority outstanding item. The release changes the `Event` schema
and day-of scanner behaviour, so migration and application rollout must remain one
ordered operation.

### Pre-deployment review

1. Fetch `origin/main`, record the exact release SHA, and review every commit since the
   currently deployed application image before deploying.
2. Confirm the push-triggered workflow is not reporting a real build, test, or image
   failure. Waiting for redundant checks is not required, but do not ignore a known
   failure.
3. Review
   `prisma/migrations/20260924010000_add_event_scanner_enabled/migration.sql`. It adds
   `Event.scannerEnabled`, defaults existing rows to enabled, then disables every
   `CAREER_FAIR` event and events currently named `Team Formation` or
   `Closing Ceremony`.
4. Confirm that this remains the intended initial disabled set. If operations identifies
   another schedule-only event, do not add a mutable-name runtime rule. Apply the
   migration, then update the explicit field through a reviewed editor/database
   operation.
5. Confirm Azure still shows revision `0000058` and image `85af7abb…`. A different live
   revision means another operator deployed and the rollout must be reassessed.

### Deployment mechanism

Dispatch `.github/workflows/container.yml` from `main`. Its Production job is the
authoritative release path and performs these steps in order:

1. Build and push runtime, migration, and Prisma Studio images tagged with the release
   commit SHA.
2. Update and start the `track-the-hack-migrate` Container Apps job.
3. Wait for that exact migration execution to report `Succeeded`.
4. Update the `track-the-hack-organizer` job to the new migration image.
5. Update the `track-the-hack` and `track-the-hack-prisma` applications.
6. Reapply the configured health probes.

Do not update the application image manually before the migration succeeds. If the
migration fails, inspect that execution's logs; do not repeatedly start new executions
without determining whether the failure is transient or deterministic.

### Post-deployment provider checks

Record non-secret evidence for the release SHA and migration execution, then verify:

- the migration execution is `Succeeded`;
- latest and latest-ready revision are the same new revision;
- the new revision is `Running`, `Healthy`, and `Provisioned` and receives 100% of
  traffic;
- `/api/healthz` and `/api/readyz` succeed through the protected production route;
- runtime, migration, organiser-job, and Prisma Studio image tags match the release SHA;
- exactly one applied `20260924010000_add_event_scanner_enabled` migration exists;
- all 41 events and schedule content remain present;
- scanner-disabled rows are exactly the operator-approved set;
- participant, RSVP, claim, session, and presence counts have not unexpectedly changed.

### Scanner acceptance

Use test participants and reversible count adjustments; do not modify real participant
state unnecessarily.

1. On a small phone, verify the camera scanner fits, scrolls, and keeps controls
   reachable.
2. Confirm repeated station names are distinguishable by localised weekday/time.
3. Select a station, reload, and verify persistence. If the event is no longer
   scannable, verify safe fallback to participant view.
4. At a station with `maxCheckIns > 1`:
    - hold one QR continuously in frame and verify it counts once;
    - remove it for at least one second and present it again, verifying one increment;
    - scan A, then B, then A and verify A can increment again;
    - reach the cap and verify later scans report `limit` without increasing;
    - verify distinct visible feedback and, where supported, sound/vibration for new,
      incremented, unchanged, limit, and error outcomes.
5. At a station with blank `maxCheckIns` and one with `maxCheckIns = 1`, verify repeat
   scans are idempotent.
6. With a desktop USB scanner, deliberately submit the same participant more than once
   at a multi-check-in station and verify each submission is handled independently.
7. With two organiser devices, scan the same participant concurrently near the cap.
   Verify the value never exceeds the cap and both devices reconcile to the server.
8. Exercise manual `+`/`−` on two devices and verify a stale device receives the current
   count rather than overwriting it.
9. Verify every disabled event is absent from the selector and rejects a direct scan or
   adjustment server-side.

### Offline acceptance

Use production Android Chrome or an equivalently real installed-PWA environment. A
desktop DevTools cache inspection alone is insufficient.

1. Install/load online and wait for the service worker to activate and control the page.
2. Open home, schedule, an actual event detail, maps, resources, sponsors, and the
   participant pass in English and French.
3. Confirm the schedule is populated before disconnecting. Event details must use real
   IDs and show the same public data offline.
4. Go offline and reload each public surface. Verify all six map SVGs render.
5. Verify French private-route failures use the French offline page and English failures
   use the English page.
6. Verify organiser, metrics, authentication, RSVP, claim, participant-profile, and
   private API/Next data are not served from a private-content cache. `/profile` may use
   its existing QR-only pass fallback; it must not expose cached profile details.
7. Reconnect, activate a newer worker in a controlled test, and verify update/activation
   does not leave a mixed broken asset version.

Local Docker was unavailable because `/var/run/docker.sock` did not exist. The four
MySQL-dependent automated cases and database-backed PWA E2E were therefore skipped
locally. Run them in hosted CI or a disposable MySQL environment before calling the
release fully accepted.

## 2. Complete accepted-participant provisioning

The operator ran **Prepare accepted RSVP invitations**. Two later read-only production
checks found exactly 100 provisioned participants, all unconfirmed and non-walk-in,
with deadline `2026-09-25T03:59:59.000Z`. This looked like a stable partial batch, not
proof that the entire accepted audience completed. The exact Apps Script error or toast
was not captured.

Do not insert participants directly into MySQL. The Responses Sheet owns stable IDs and
signed management links, and preparation is intentionally idempotent.

1. Capture the exact error/toast if available; otherwise inspect existing Sheet state
   before rerunning.
2. Verify completed rows have durable Participant IDs, signed `/rsvp/manage#…` links,
   RSVP status, deadline, and refresh timestamps.
3. Correct the batch failure without replacing existing IDs or links.
4. Rerun **Prepare accepted RSVP invitations**. It scans every
   `Accepted`/`Accepté`/`Acceptée` response regardless of selection, filters, or hidden
   rows.
5. Confirm `processed` equals the complete accepted count.
6. Query production read-only and confirm the same count, one intended deadline, zero
   unexpected walk-ins, and no duplicate IDs.
7. Run the Sheet RSVP refresh and require zero missing IDs. `RSVP Refreshed At`, not
   generic `Last Sync`, is the freshness signal.
8. Recheck shared-recipient submissions. Earlier evidence flagged row pairs 31/329,
   37/668, 79/347, 168/332, 296/432, 382/641, 428/598, and 454/559, but the rows and
   decisions may have changed.

Preparation provisions records and links; it sends no email.

## 3. Run the one-recipient RSVP acceptance test

No invitation was known to have been sent at the last audit. Row 2 is the designated
live test, but external email requires action-time approval of the exact recipient,
sender, subject, template, and dry-run output.

1. Set `TRACK_TEST_SUBMISSION_ID` to row 2's approved submission ID and run
   `prepareTestSubmissionForRsvp()` only if fresh setup is needed. Remove the property
   afterward.
2. Generate and inspect the minimal private test recipient CSV without printing its
   signed capability in logs or chat.
3. Obtain explicit approval and send exactly one test invitation.
4. Open without changing state, choose attending, choose not attending, then reopen the
   original link and choose attending again.
5. Issue and consume a five-minute claim, verify session persistence and offline pass,
   then optically scan it from a second organiser device.
6. Exercise check-in, merchandise, food/multi-count, attendance, expiry, access reissue,
   and test-data cleanup.

Do not send the full campaign without separate action-time approval of final recipient
count, suppressions, sender, deadline, subject, template, and dry-run output.
`scripts/prepare-rsvp-campaign.mts` creates a private CSV and never sends mail. See
`docs/RSVP_EMAIL_RUNBOOK.md` for the message and suppression review.

## 4. Decide the RSVP audit-transaction policy

`src/server/repositories/prisma-rsvp-management.ts` writes the RSVP decision and `Log`
row in one transaction. A log failure rolls the decision back. Elsewhere,
`src/server/lib/log.ts` swallows audit failures so logging cannot break a user action.

- If RSVP decisions require atomic audit evidence, retain the transaction and add an
  explicit comment and policy test.
- If participant intent must survive a log failure, commit the decision first and use
  non-blocking logging afterward, with a failure-path test.

Do not change the boundary until the intended guarantee is confirmed.

## 5. Remaining interface and build findings

Recheck each against current `main` before editing.

### Organiser event editor accessibility

`EventEditor` uses a portalled `role="dialog"` rather than the native `<dialog>` pattern
used by `ScheduleEventDialog`. Focus can escape and Escape is not handled. Use the
established modal pattern or add equivalent focus trapping, Escape cancellation,
initial focus, and focus restoration. Test keyboard-only create/edit/cancel/save flows.

### Event reminder refetch flicker

`ScheduleEventDetails` resets notification state in an effect depending on the event
object. Superjson may recreate dates on refetch and briefly make the bell unavailable.
Depend on stable primitives such as ID and start timestamp, then test an existing
reminder through refocus/refetch.

### Save-to-schedule interaction

One mutation pending state disables every schedule star, gives no immediate response,
and reports failures at the list bottom. Use per-event optimistic/pending state, roll
back on failure, identify the event in the error, and reuse shared interest-button
styling where practical.

### `SKIP_ENV_VALIDATION` contract

`next.config.js` says the flag skips validation, but `src/env/server.mjs` validates when
pages import it. Either honour the flag or remove the misleading comment and document
the build environment requirement. Do not weaken runtime production validation.

### Migration naming

Several applied migration pairs share timestamp prefixes. Do not rename or delete them.
Require a unique generator-produced timestamp prefix for every new migration.

## 6. Remote branches still requiring a decision

Sixteen non-`main` branches remain. They are year branches or standalone histories
without enough merged-PR evidence to call deletion lossless after the history rewrite.
A simple `git branch --merged` result is not reliable.

- Year snapshots: `2023`, `2025`.
- Data, registration, and authentication: `database-refactor`,
  `feat/model-change-luis`, `hacker-registrations-v2`, `microsoft-login`,
  `ticket-tailor`.
- Event and participant features: `feat/discord-team-operations`,
  `feature/event-notification`, `notifications`, `fix/revert-qr-rotation`,
  `feat/qr-code-offline-support`, `feat/qr-code-offline-support-v2`.
- Content and tooling: `hackhers`, `hardware-tracking-tool`, `localization-wip`.

`origin/HEAD` is symbolic and not an additional branch. Inspect unique commits and
current-main equivalents, ask the relevant owner when content is ambiguous, then
extract a narrow change or delete the branch. Once a branch decision is completed,
remove it from this list.
