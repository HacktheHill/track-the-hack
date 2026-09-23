# Track the Hack event-readiness handoff

Last verified: 2026-09-23 19:16-19:20 EDT  
Repository baseline: `d48c26591253ba0d5e033934e5114516dd72beff` (`origin/main`)  
Production revision: `track-the-hack--0000057`  
Production image: `trackthehackacr.azurecr.io/track-the-hack:d48c26591253ba0d5e033934e5114516dd72beff`

## Purpose

This document replaces the conflicting `REMAINING_WORK.md` snapshots that were created from different checkouts on September 23. It records current production evidence, decisions already made, work deliberately deferred, and the exact safety gates for completing that work.

Do not treat the older reports as additive backlogs. Several of their items are already in `main`, and several dirty-worktree implementations would regress current protections if copied wholesale.

## Decisions already made

- Keep Cloudflare Access enabled during development and acceptance testing. Public launch is a separate reviewed action.
- The downloaded `Hack the Hill III Run of Show - Events Schedule.csv` is the authoritative schedule.
- `Hacking`, `Judges Orientation`, and `Project Submission Deadline` are intentionally absent from the authoritative 41-event schedule.
- The Check-In, Late Check-In, and Merchandise times in that CSV are authoritative.
- Keep both Devpost deadlines in Resources:
    - mandatory draft by midnight at the start of Sunday, September 27;
    - final submission by 10:00 AM Sunday, September 27.
- No decision was made to remove the closing novelty quotation. Leave it unchanged unless separately requested.
- RSVP email sending is outside this work. Provisioning never authorizes a test or bulk send.
- Row 2 is the designated live RSVP/claim test row, but its live end-to-end test is deferred.
- Do not restore pre-reset participants if current evidence continues to show that no invitation campaign was sent. Provision from the authoritative Sheet instead.
- Deferred application changes must be rebuilt on current `main`; no dirty worktree may be deployed wholesale.

## Current verified production state

### Azure platform

- The Container App is Running and healthy on revision `track-the-hack--0000057`.
- The production MySQL Flexible Server is Ready, has public network access disabled, and has 35 days of backup retention.
- Earliest restore time observed during this review: `2026-08-19T22:59:49.337300+00:00`.
- Cloudflare Access remains the intended testing gate.

### Schedule

The production database already matches the authoritative downloaded CSV exactly. No production schedule import or deletion is required.

- events: 41
- hidden: 5
- `ATTENDANCE`: 26
- `CHECK_IN`: 2
- `FOOD`: 12
- `MERCHANDISE`: 1
- events with `roomFr`: 41
- events with stable `importKey`: 41
- canonical event-data SHA-256 for both the downloaded CSV and production: `77ddc0a3ef03e2bd0c24d2641a6d7af1b4c880cac773b7e326bc57c90e53cf95`

The repository CSV was stale at 44 rows. The event-readiness branch updates it to the authoritative 41-row source and updates its test expectations. This repository-only correction does not require a production data write because production is already correct.

### Participant state

At the beginning of the live audit, production had:

- hackers: 0
- claim tokens: 0
- participant sessions: 0
- presences: 0

This disproves the reports' later assumption that 166 participants remained in production. There is nothing valuable to recover from the current database, and point-in-time restoration should not be used merely to recreate unpublished RSVP links.

During this review, the operator ran **Prepare accepted RSVP invitations** in the bound Sheet. A subsequent read-only database audit found exactly 100 newly provisioned participants, all unconfirmed and non-walk-in, with deadline `2026-09-25T03:59:59.000Z`. Counts remained at 100 on a second check. This is a partial first batch, not completion of the full accepted audience.

Do not insert the remaining participants directly in MySQL. The Sheet owns participant IDs and management links. Capture the exact Apps Script error/toast, then rerun the idempotent Sheet action after resolving the failure. A successful run must be followed by a database count check and Sheet reconciliation before campaign preparation.

## Work already in `main`; do not redo

- Bound-Sheet sidebar for one-row pass provisioning.
- Reusable QR display window and hash refresh behavior.
- Whole-accepted-audience RSVP preparation and RSVP refresh commands.
- Stable participant IDs saved before API calls and idempotent participant provisioning.
- RSVP management and cancellation capabilities.
- Event stable keys, bilingual rooms, importer, editor, and strict validation.
- Scanner operation serialization while a scan/count adjustment is pending.
- Expected-value counter updates, stale cross-device reconciliation, and bounded concurrency tests.
- Safe small-screen scanner selector layout.
- Public hidden-event filtering.
- Participant offline pass.
- Persisted push subscriptions, invalid-subscription cleanup, leases, and scheduler startup from `src/instrumentation.ts`.
- EEF crop, transparent cutouts, orange emblem, and black text.
- Correct French `Accueil` and translated map reset controls.

## Deferred implementation work

These changes were explicitly approved for handoff rather than implementation in the current cleanup.

### 1. Explicit scanner eligibility

Add `scannerEnabled Boolean @default(true)` to `Event` and carry it through:

- Prisma schema, clean-baseline migration, and generated client;
- event create/update schemas;
- organizer event editor;
- managed/scannable API selections;
- schedule importer and CSV contract;
- server-side scan and adjustment authorization;
- tests and operational documentation.

Initial scanner-disabled events must include:

- Career Fair;
- Team Formation;
- Closing Ceremony.

Review the complete schedule with operations for any additional schedule-only events. Do not infer eligibility from mutable English/French names or broad event types.

### 2. Repeat-scan semantics for every multi-check-in station

The rule is based on `maxCheckIns`, not on `FOOD` alone:

- If `maxCheckIns` is greater than 1, a deliberate repeat scan increments atomically up to that limit.
- If `maxCheckIns` is 0 or 1, repeat scanning remains idempotent.
- Decide explicitly how a blank/unlimited `maxCheckIns` should behave before implementation; do not silently treat it as repeatable without an operator-approved cap.
- Holding one QR continuously in the camera frame must count once.
- Removing and deliberately presenting it again, including A → B → A, may increment at a multi-check-in station.
- Manual `+`/`−` adjustments remain available and use the server-authoritative count.
- Cross-device updates must retain current expected-value/stale reconciliation or an equivalently safe atomic contract.

Return a typed outcome such as `new`, `incremented`, `unchanged`, or `limit`, and test first-scan races, concurrent increments at the cap, stale decrements, and two physical organizers scanning the same participant.

Do not port the dirty implementation's removal of `useScannerOperation` or its expected-value parameter. Those are regressions relative to `main`.

### 3. Scanner interface and feedback

- Persist the selected event/station in local storage, falling back safely if that event is no longer scannable.
- Provide distinct visual, sound, and vibration feedback for new, incremented, unchanged/duplicate, limit, and error outcomes.
- Keep feedback progressively enhanced: scanning must still work if audio, vibration, or local storage is unavailable.
- Compact the manual/USB scanner input without removing its disabled/pending protection.
- Remove redundant participant ID and event-name output from workflow result cards.
- Use bilingual `Diet / Régime` wording for food information.
- Verify on a small phone, a desktop USB scanner, and two concurrent organizer devices.

### 4. Public-information offline support

After the first successful online load/install, make these public surfaces reloadable offline:

- home;
- schedule;
- individual event details with their actual event IDs/data;
- maps and map assets;
- resources;
- sponsors;
- participant pass.

Keep organizer, metrics, authentication, RSVP, claim, participant-profile, and private API responses network-only. They must show an explicit unavailable/offline state rather than cached private content.

The dirty prototype is requirements evidence only. It omits home, precaches a parameterless `/schedule/event`, alters unrelated configuration, and hand-edits worker behavior. Reimplement on current main after reading the installed Next.js 16 and `next-pwa` documentation. Test the production service worker, update/activation behavior, populated schedule data, route fallback, and Android offline reload.

### 5. Targeted bilingual terminology

Approved changes:

- French `Metrics` → `Statistiques`;
- French `Interne` → `Outils organisateurs`;
- organizer navigation `QR` → `Scanner`;
- French scanner page title → `Lecteur de codes QR`.

Do not redo already-correct `Accueil` or translated map controls. Keep both approved Devpost deadlines. Leave other Resources content unchanged unless separately reviewed.

### 6. EEF aspect-ratio hardening — low priority

The asset in main already has the correct crop, palette, and transparent cutouts. Add only:

```xml
preserveAspectRatio="xMidYMid meet"
```

Then validate XML, render at the real sponsor-card size, compare its aspect ratio, run the application build, and run `git diff --check`. Do not port the obsolete sponsor-list commit from `review/history-cleanup-ready`.

## RSVP completion and acceptance sequence

1. Capture the exact error/toast from the partial 100-row preparation run.
2. Verify the Sheet's first completed batch has durable Participant IDs, signed `/rsvp/manage#…` links, statuses, deadline, and refresh timestamps.
3. Correct the batch failure without changing already-issued IDs or links.
4. Rerun **Prepare accepted RSVP invitations**. It is intentionally idempotent.
5. Confirm the returned `processed` count equals the full accepted count.
6. Query production read-only and confirm the same participant count, one common intended deadline, zero unexpected walk-ins, and no duplicate IDs.
7. Run the Sheet RSVP refresh and confirm there are zero missing participant IDs before interpreting the Sheet as reconciled.
8. Resolve the shared-recipient email pairs before creating a campaign file:
    - rows 31 / 329
    - rows 37 / 668
    - rows 79 / 347
    - rows 168 / 332
    - rows 296 / 432
    - rows 382 / 641
    - rows 428 / 598
    - rows 454 / 559
9. Set `TRACK_TEST_SUBMISSION_ID` to row 2's approved submission ID and run `prepareTestSubmissionForRsvp()` if a fresh row-2 setup is needed, then remove that property.
10. With separate approval for one external email, test row 2 end to end:
    - prepare minimal recipient CSV;
    - send one test invitation;
    - open without changing state;
    - choose attending;
    - choose not attending;
    - reopen the original link and choose attending again;
    - issue and consume a five-minute claim;
    - verify participant session persistence and offline pass;
    - scan optically from a second organizer device;
    - exercise check-in, merchandise, food/multi-count, attendance, expiry, reissue, and cleanup.
11. Do not send the full campaign without a separate action-time approval of the final recipient count, suppressions, sender, deadline, subject, template, and dry-run output.

## Why the folder is named `private-rsvp`

The folder is not application RSVP source code. It is a gitignored operational workspace for:

- response exports containing applicant contact data;
- signed RSVP management links;
- minimal recipient CSVs;
- local Apps Script backups that may include deployment identifiers.

Calling it `private-rsvp` makes the data-handling boundary explicit and avoids confusion with `src/pages/rsvp` and tracked RSVP implementation files. Keep the name. The repository TypeScript configuration now excludes it because its Apps Script `.js` backups are not part of the application typecheck.

Never commit, upload as a build artifact, paste into an issue, or print the contents of that directory in logs.

## Worktree and unpushed-code disposition

### Safe after final destructive-action confirmation

The following clean branches are patch-equivalent to work already landed in `main` and contain no remaining deployable work:

- `feat/sheets-check-in-qr-display`
- `fix/sheets-migration-selection-widths`
- `codex/rsvp-prepare-all-menu`
- `codex/sheets-rsvp-refresh-cleanup`
- `codex/finish-checkin-workflow`

The following clean temporary worktrees are behind or equal to current main and contain no unique changes:

- `/tmp/claude-1000/.../scratchpad/wt`
- `/tmp/opencode/track-the-hack-findings`
- `/tmp/opencode/track-the-hack-schedule-deploy`
- `/tmp/opencode/track-the-hack-sponsors`

The stale `/tmp/opencode/azure-hmac-review` registration is already prunable because its worktree metadata points to a missing directory.

### Dirty historical worktrees

The primary `review/history-cleanup-ready` checkout and detached `2cc8` / `43fe` checkouts contain mixtures of:

- files now identical to main;
- older variants of RSVP, schedule, and push code that main subsequently hardened;
- the scanner/offline/copy prototypes captured above;
- old review reports superseded by this handoff;
- an obsolete sponsor-list commit;
- duplicate migration and Apps Script staging files.

Do not merge or deploy them. After this handoff and the authoritative schedule correction are committed, they may be removed with `git worktree remove --force` only after one final path/status inventory and explicit destructive-action confirmation. Preserve the separate ignored `private-rsvp/` directory unless the operator explicitly authorizes its deletion.

The `rsvp-live-test` worktree contains only a stale untracked `docs/REMAINING_WORK.md`; this handoff supersedes it.

### Unique commit `65033ce`

`review/history-cleanup-ready` has one commit not patch-equivalent to main. Its sponsor-list change is obsolete relative to current main: tiers, links, dimensions, and placeholder assets are older. Scrap that commit. The only useful EEF visual work is already in main, except for the deferred low-priority aspect-ratio attribute.

## Validation required for future implementation PRs

For each future code PR:

1. Start from freshly fetched `origin/main` in a clean worktree.
2. Read the installed Next.js 16 guide relevant to the files being changed.
3. Run `npx prisma validate` and `npx prisma generate` for schema work.
4. Test migrations against an empty database and a disposable production-equivalent schema.
5. Run focused tests, full typecheck, lint, build, and `git diff --check`.
6. For scanner changes, run real MySQL concurrency tests and two-device physical acceptance.
7. For offline changes, run a production build and real Android install/reload testing.
8. Rebase before merging; do not create merge commits.
9. Verify GitHub Actions and the resulting Azure revision/image after landing.
10. Keep Cloudflare Access enabled until the separately reviewed public-launch step.

## Chronological evidence

- Earlier September 23 reports captured a reset database, later partial participant counts, and several dirty implementation prototypes. Their counts and deployment snapshots are no longer current.
- At the start of this review, GitHub `main` was `83f0228` and production was on image `9e8166f`.
- While the review was running, `main` advanced to `d48c265` and Azure deployed revision `track-the-hack--0000057` with that image.
- Read-only Azure inspection then found 0 participants and 41 events.
- Canonical comparison proved the 41 production events exactly matched the downloaded authoritative CSV.
- The repository was updated locally to match that authoritative schedule and to exclude `private-rsvp` from TypeScript.
- The operator then ran the accepted-audience preparation menu command.
- Two subsequent read-only database checks found a stable partial count of 100 participants, indicating the first batch completed and later processing did not.
