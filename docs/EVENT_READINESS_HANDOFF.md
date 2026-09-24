# Event readiness handoff

This file contains only outstanding work. When an item is completed and verified,
remove it rather than turning this document into a completion log. Git history records
completed implementation.

Earlier `REMAINING_WORK.md` reports came from different checkouts and are superseded.
Do not combine them into an additive backlog, and do not deploy an abandoned worktree
or prototype branch wholesale.

## Acceptance target and private data boundary

Run the remaining acceptance checks against release
`21924e0fbcc6287dca3ae8965cac5067ee32f973`, Azure revision
`track-the-hack--0000059`. Before testing, confirm that it is still the live revision;
later documentation-only commits do not change the test target. If application code or
production has advanced, reassess the target instead of assuming these instructions
still describe it. Keep Cloudflare Access enabled during testing. Public launch is a
separate decision.

The private schedule CSV and RSVP exports are operational data:

- `private-schedule/` is the ignored location for an operator-supplied schedule CSV.
  Production already contains the audited 41-event schedule; no schedule import is
  pending.
- `private-rsvp/` holds response exports, signed RSVP management links, recipient CSVs,
  and Apps Script backups. It is not an application module.
- Never commit, upload, paste into an issue, or print either directory's contents.
- Removing the schedule CSV from Git did not remove database events or affect the
  Sheet-to-database participant integration.

## 1. Complete physical scanner and offline acceptance

The release and migration are complete, but camera/USB behaviour, two-device
concurrency, and installed-PWA behaviour still require the physical environments below.
These are the highest-priority outstanding acceptance checks.

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

## 2. Resolve recipient decisions and run the one-recipient RSVP acceptance test

Sheet-side provisioning and reconciliation are complete: all 664 accepted rows have a
durable participant ID, a valid signed management link, `PENDING` status, the intended
deadline `2026-09-25T03:59:59.000Z`, and an RSVP refresh timestamp. The Sheet and
production participant counts match. Do not rerun preparation merely to repeat this
check. Preparation provisions records and links; it sends no email.

No invitation was known to have been sent at the last audit. Before generating the
campaign, decide how to handle the eight accepted row pairs that still share a
normalised recipient address: 31/329, 37/668, 79/347, 168/332, 296/432, 382/641,
428/598, and 454/559. Each row has its own participant ID and signed link, so the
campaign generator correctly rejects the duplicates instead of guessing whether one or
both applications should receive mail.

Row 2 is not a suitable default live test: its current admission status is `Excluded
(member)` even though stale Tracker fields show a confirmed RSVP. Select a different,
explicitly approved accepted row. External email requires action-time approval of the
exact recipient, sender, subject, template, and dry-run output.

1. Set `TRACK_TEST_SUBMISSION_ID` to the approved accepted row's submission ID and run
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

## 3. Retained remote branches

The obsolete remote branches have been deleted. Exactly four non-`main` branches remain:

- `2023` and `2025` are intentional year snapshots from histories that do not share a
  useful merge base with the rewritten `main`.
- `hackhers` preserves event-specific HackHers challenge narratives that are not in the
  current or archived resource pages on `main`.
- `ticket-tailor` contains a potentially valuable event-specific registration-question
  and response-capture concept. It does not fit the current architecture well enough to
  cherry-pick. Retain it until the product owner either declines that feature or asks
  for a narrow reimplementation against the current RSVP model.

`origin/HEAD` is symbolic and is not an additional branch.
