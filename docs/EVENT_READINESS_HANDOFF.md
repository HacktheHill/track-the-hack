# Track the Hack event-readiness handoff

Last verified: 2026-09-23 19:53 EDT
Repository baseline after the schedule-history rewrite and rebase merge: `85af7abb4adda34541b172ded3a766e4b3a01a41` (`origin/main`)
Production revision: `track-the-hack--0000058`
Production image: `trackthehackacr.azurecr.io/track-the-hack:85af7abb4adda34541b172ded3a766e4b3a01a41`

## Purpose

This document replaces the conflicting `REMAINING_WORK.md` snapshots that were created from different checkouts on September 23. It records current production evidence, decisions already made, work deliberately deferred, and the exact safety gates for completing that work.

Do not treat the older reports as additive backlogs. Several of their items are already in `main`, and several dirty-worktree implementations would regress current protections if copied wholesale.

## Decisions already made

- Keep Cloudflare Access enabled during development and acceptance testing. Public launch is a separate reviewed action.
- The private downloaded `Hack the Hill III Run of Show - Events Schedule.csv` is the authoritative schedule. It must remain outside this public repository.
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

- The Container App is Running and healthy on revision `track-the-hack--0000058`.
- Revision `track-the-hack--0000058` is Provisioned and Healthy and receives 100% of production traffic.
- GitHub Actions run `35935204267` completed image validation, the idempotent migration job, and deployment successfully for `85af7abb4adda34541b172ded3a766e4b3a01a41`.
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

The repository previously contained a stale 44-row copy of the schedule. It has been removed from the working tree and from every ordinary remote branch and tag. The importer now requires an explicit private input path, its tests use synthetic events, and the migration image no longer embeds the real schedule. This does not require a production data write because production is already correct.

GitHub's server-managed, read-only PR refs for PRs 327 through 340 still retain the old commits. GitHub does not permit clients to update `refs/pull/*`; complete server-side dereferencing, garbage collection, and cached-view removal therefore requires a GitHub Support request. Existing clones or forks can also retain old objects and must be cleaned by their owners. Until Support completes that request, describe the repository cleanup as complete for ordinary branches and tags, not as a total server-side erasure.

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

Do not merge or deploy them. After this handoff and the private-schedule removal are committed, they may be removed with `git worktree remove --force` only after one final path/status inventory and explicit destructive-action confirmation. Preserve the separate ignored `private-rsvp/` directory unless the operator explicitly authorizes its deletion.

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

## New findings not covered by the sections above

### R1 — The authoritative Phase 1 documents describe the retired RSVP contract (High)

`73287c4` replaced ID-authorized RSVP with a signed management capability. That is a
real security improvement: `Hacker.id` is printed in the day-of event QR, so the old
`POST /api/rsvp/<id>` meant anyone who photographed a participant's pass could confirm
that participant's attendance. `docs/PROPOSED_FLOW.md` had already reasoned this way
about cancellation; extending it to confirmation closes the gap.

`docs/PHASE_1_INTEGRATIONS.md` and `docs/PROPOSED_FLOW.md` — the two files this
repository calls "the authoritative contracts" — were not updated with it:

- `PHASE_1_INTEGRATIONS.md:17` still gives the invitation URL as
  `${NEXTAUTH_URL}/rsvp/<id>`. That page now renders an "old link" notice and
  `POST /api/rsvp/<id>` returns `410 old_rsvp_link_retired`.
- `PHASE_1_INTEGRATIONS.md:47` still documents the whole `POST /api/rsvp/<id>`
  confirmation flow. Decisions now go to `POST /api/rsvp/manage` with
  `{ token, action: "status" | "attend" | "decline" }`.
- `PHASE_1_INTEGRATIONS.md:64-75` documents the reconciliation response as
  `{ id, confirmed, cancellationLink }`. It is now
  `{ id, confirmed, status, rsvpLink?, cancellationLink? }`, where `status` is
  `PENDING | CONFIRMED | DECLINED` and `rsvpLink` is present whenever a capability
  exists, not only when confirmed. The documented `cancellationLink` behaviour is
  unchanged.
- `PHASE_1_INTEGRATIONS.md:17` describes the external RSVP CSV as `email,id` with
  optional `name`. `scripts/prepare-rsvp-campaign.mts` now emits
  `email,name,rsvpUrl,deadlineEn,deadlineFr`. This matters beyond accuracy: the CSV now
  carries **signed bearer capabilities**, which the RSVP runbook correctly says must
  never reach Git, artifacts, logs, or an issue, while the Phase 1 document still
  describes a file whose only sensitive content is an email address.
- `PROPOSED_FLOW.md:69-71` still describes the ID-link confirmation sequence.

Nothing in either document points to `docs/RSVP_EMAIL_RUNBOOK.md`, which does describe
the current flow correctly and thoroughly.

**Why it matters here:** the RSVP campaign is external, one-shot, and addressed to real
applicants. A reader following the stated authoritative contract would build it from
`/rsvp/<id>` links that return `410`.

**Fix:** update those sections and cross-reference the runbook. `Code.gs` was updated in
lockstep, so only the prose is stale.

### R2 — The scanner station selector cannot distinguish repeated event names (Medium)

`src/pages/qr/index.tsx:90-95` labels each option
`` `${t(`workflow.${event.scannerWorkflow}`)} — ${name}` `` with no time, and
`events.scannable` returns every event whose `end` is later than 30 minutes ago. The
authoritative schedule contains repeated names:

| Occurrences | Selector label                                      |
| ----------- | --------------------------------------------------- |
| 5           | `Food — Latte Lab`                                  |
| 4           | `Attendance — Career Fair`                          |
| 3           | `Attendance — Judging`                              |
| 2 each      | `Food — Snacks`, `Food — Breakfast`, `Food — Lunch` |

Before the event begins, all 41 events are in the list, so a volunteer sees five
identical `Food — Latte Lab` entries and must pick by position alone. The list is
ordered by `start`, which is the only cue. Selecting the wrong occurrence records
`Presence` against the wrong event row; it is recoverable through the manual `+`/`−`
adjustments, but only once someone notices.

This is adjacent to deferred item 3 but not covered by it: that item persists the
selection and adds feedback, which would make a wrong choice _sticky_ rather than
prevent it.

**Suggested fix:** include the start time (and date where the run spans days) in the
option label, e.g. `Food — Latte Lab · Sat 1:30 PM`. This is a label-only change in one
component and does not need the deferred `scannerEnabled` work.

### R3 — An RSVP decision is rolled back if its audit log write fails (Medium)

`src/server/repositories/prisma-rsvp-management.ts` creates the `Log` row inside the
same transaction that records the participant's choice (`transaction.hacker.update`
then `transaction.log.create`). Everywhere else, `src/server/lib/log.ts` deliberately
swallows failures so an audit problem cannot break a user action. Here the audit write
is load-bearing: a full `Log` table, a lock timeout, or an oversized `details` value
would roll the participant's RSVP back and show a generic failure.

This may be intentional — a stronger guarantee for a decision with real consequences —
but it silently inverts the established pattern.

**Fix:** move the log outside the transaction to match `log()`, or add a comment
stating that RSVP decisions are deliberately atomic with their audit record.

### R4 — Three pairs of migrations share a timestamp prefix (Low, latent)

```
20260922000000_add_event_import_identity      20260923000000_remove_sms_reminders
20260922000000_secure_sms_reminders           20260923000000_restore_event_tiktok_compatibility
20260923010000_add_event_room_fr              20260923010000_rsvp_management
```

Prisma orders migrations by full directory name, so ordering currently resolves
correctly only because the suffixes happen to sort the right way (`remove_` <
`restore_`, `add_` < `rsvp_`). A future migration whose name sorts earlier would run
before a dependency with no warning.

Four of these are pure round trips — `secure_sms_reminders` creates six SMS tables plus
`Event.smsNotifiedAt` and `remove_sms_reminders` drops exactly those six and the column
(the sets match, so `migrate deploy` will not fail); `restore_event_tiktok_compatibility`
re-adds `Event.tiktok` and `remove_event_tiktok` drops it again. **They must be kept**,
because production has applied them (see the corrections above).

**Fix:** no change to existing migrations. Require a unique, generator-produced
timestamp prefix for every future migration.

### R5 — The organizer event editor modal has no focus trap or Escape handler (Low)

`src/components/ScheduleEventDialog.tsx` uses the native `<dialog>` element with
`showModal()`, which provides a focus trap, Escape via `onCancel`, and an inert
background. `src/components/EventEditor.tsx` still renders a `createPortal` div with
`role="dialog" aria-modal="true"` and neither behaviour, so keyboard focus escapes into
the page behind it. The organizer-facing dialog is now the less accessible of the two,
and the better pattern already exists in the codebase.

### R6 — The event reminder control resets on every refetch (Low)

`src/components/ScheduleEventDetails.tsx:75` runs its push-availability effect on
`[event]`, where `event` is `query.data`. Superjson rebuilds the `Date` fields on each
refetch, defeating react-query's structural sharing, so the identity changes and the
effect resets `pushAvailable` and `notifyRequested` to `false` before re-probing. The
bell briefly shows as unavailable on every refocus.

**Fix:** depend on `event?.id` and `event?.start?.getTime()`.

### R7 — Save-to-schedule star: shared pending state, no optimistic update (Low)

On the schedule cards a single `update` mutation drives every star, so
`disabled={update.isLoading}` (`src/pages/schedule/index.tsx:465`) disables **all**
stars while any one save is in flight, and nothing changes visually until the round trip
completes — on conference wifi the primary new interaction will feel dead.
`update.isError` renders one alert at the bottom of the list, away from the star that
failed and without naming it. The control is also bespoke (`★`/`☆` glyphs with custom
classes) while `EventInterestButton` renders an SVG star with `ui-button ui-button-icon`,
which is what `docs/ui-consistency.md` asks for.

### R8 — `SKIP_ENV_VALIDATION` does not skip validation (Low)

`next.config.js:33` documents the flag and line 36 honours it, but only for the
config-time preflight import. `src/env/server.mjs` validates unconditionally whenever it
is imported, and pages import it, so page-data collection still fails without the
placeholder values. The Docker build succeeds only because `.github/workflows/build.env`
is mounted as a secret. This is worth knowing for validation step 5 of the future-PR
checklist above: a build cannot be run without that file.

**Fix:** honour the flag in `src/env/server.mjs`, or delete the flag and its comment and
document that a build requires the placeholder env file.

### R9 — Sponsor asset filenames mix case (Housekeeping)

`public/assets/sponsors/` contains `backboard.svg`, `cgi.svg`, `ciena.svg`,
`elevenlabs.svg` alongside `EEF.svg`, `MathemaTech.svg`, `UOSU.svg`. References match
today and the build passes, but mixed case is a common source of 404s that appear only
in the Linux container and not on a case-insensitive development machine. Worth
normalising while the set is small — and worth doing in the same change as the deferred
EEF aspect-ratio attribute rather than separately.

## Already covered above; re-checked, no new action

- **Blank `maxCheckIns` on all twelve `FOOD` events.** Confirmed still true in the
  private authoritative CSV and matching production data: `CHECK_IN` and `MERCHANDISE` set `1`, every `FOOD` row is blank.
  Deferred item 2 already requires an explicit decision on blank/unlimited behaviour
  before implementation. Current behaviour, for that decision: blank means `atLimit`
  never becomes true, so the counter increments without bound and the scanner's `+`
  control is never disabled.
- **The five hidden events.** `Merch` and `Late Check-In` remain hidden and are still
  scannable, because `events.scannable` deliberately has no `hidden` filter — that is
  correct and intentional. **Merch being hidden from the participant schedule is also
  intentional** (operator-confirmed 2026-09-23), even though its description reads as
  participant-facing copy; distribution is communicated outside the schedule. Treat
  `Merch` as an operational station, like `Late Check-In`, not as a schedule entry. No
  change required, and a future reviewer should not re-raise it.
- **Public hidden-event filtering, scanner serialization, expected-value counter
  updates, offline pass, push leases and scheduler startup.** All verified present in
  the code and correctly listed as already in `main`.
