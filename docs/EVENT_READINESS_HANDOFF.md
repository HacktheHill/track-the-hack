# Event readiness handoff

This is the operating brief for an agent arriving without the earlier conversation.
Read the decisions and current evidence before implementing any item. Earlier
`REMAINING_WORK.md` reports came from different checkouts and are superseded; their
items are not an additive backlog.

Status verified on September 23, 2026:

| Surface         | Verified state                                                                                                                                                                                                                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Repository      | The reviewed `main` baseline was `d30cfc218dd838c77f07d86b7a1888a750a970a7` after the schedule-history rewrite and two rebase merges. This handoff adds another docs-only commit; start new work from a fresh fetch of `origin/main`.                                                                                                                                          |
| Production app  | Azure Container App revision `track-the-hack--0000058` is Running, Healthy, Provisioned, and receives 100% of traffic. Its image is tagged `85af7abb4adda34541b172ded3a766e4b3a01a41`; the later `d30cfc2` commit changes only this handoff.                                                                                                                                   |
| Release checks  | Deployment run [35935204267](https://github.com/HacktheHill/track-the-hack/actions/runs/35935204267) succeeded. CI and image validation also passed on final `main` `d30cfc2`. Local tests: 174 total, 170 passed, four MySQL-only cases skipped without Docker; typecheck, lint, and Prisma validation passed. Hosted CI exercised MySQL migrations and the production build. |
| Production data | 41 events matching the private authoritative schedule; the last audited participant count was a partial 100 provisioned, all unconfirmed. Refresh these mutable counts before acting.                                                                                                                                                                                          |

`main` and the deployed image have different SHAs because the last merge only updated
this document. A new app change will require the usual reviewed deployment. The
container workflow validates images on a `main` push; its Production job runs only on
manual dispatch from `main` (`.github/workflows/container.yml`). Cloudflare Access
must remain enabled during testing.

Useful entry points: `integrations/google-sheets/README.md` and
`docs/RSVP_EMAIL_RUNBOOK.md` for provisioning and invitations;
`docs/SCHEDULE_IMPORT.md` and `scripts/import-events.mts` for the private schedule;
`src/server/services/scanner-workflows.ts` and `src/pages/qr/index.tsx` for scanner
behavior. Treat code and current production checks as authoritative if any snapshot
in this file has drifted.

## Decisions already made

- Keep Cloudflare Access enabled until a separately reviewed public launch.
- The private downloaded schedule CSV is authoritative. `Hacking`, `Judges Orientation`,
  and `Project Submission Deadline` are intentionally absent from it.
- The Check-In, Late Check-In, and Merchandise times in that CSV are authoritative.
- `Merch` and `Late Check-In` are intentionally hidden from the participant schedule.
  They stay scannable because `events.scannable` deliberately has no `hidden` filter.
  Treat them as operational stations; do not re-raise this.
- Keep both Devpost deadlines in Resources: the mandatory draft is due at midnight at
  the start of Sunday, September 27; the final submission is due at 10:00 AM Sunday,
  September 27. Keep the closing novelty quotation unless separately directed.
- RSVP email sending is outside this work. Provisioning never authorizes a test or bulk
  send.
- Row 2 is the designated live RSVP/claim test row, subject to the separate email-send
  approval below. No invitation campaign had been sent at the last audit. Do not use
  point-in-time restoration just to recreate unpublished RSVP links.
- Deferred work must be rebuilt on current `main`. No prototype worktree may be deployed
  wholesale.

## Work already in `main`; do not redo

- Bound-Sheet sidebar for one-row pass provisioning; reusable QR display window and hash
  refresh behavior.
- Whole-accepted-audience RSVP preparation and refresh commands; stable participant IDs
  saved before API calls; idempotent provisioning.
- RSVP management and cancellation capabilities.
- Event stable keys (`importKey`/`seriesKey`), bilingual rooms, importer, editor, and
  strict validation.
- Scanner operation serialization, expected-value counter updates, stale cross-device
  reconciliation, and the small-screen selector layout.
- Public hidden-event filtering; participant offline pass.
- Persisted push subscriptions, invalid-subscription cleanup, leases, and scheduler
  startup from `src/instrumentation.ts`.

## Current state and private data

At the beginning of this audit production had zero hackers, claim tokens, participant
sessions, and presences. The operator then ran **Prepare accepted RSVP invitations**.
Two read-only checks found a stable count of exactly 100 provisioned, all unconfirmed
and non-walk-in, with deadline `2026-09-25T03:59:59.000Z`. This is a partial first
batch, not proof that the full accepted audience was prepared. The exact Apps Script
error or toast was not captured. Do not insert participants directly in MySQL: the
Responses Sheet owns participant IDs and signed management links, and preparation is
designed to be retried with those identities unchanged.

Production already matched the private downloaded schedule exactly at the audit. The
canonical event-data SHA-256 was
`77ddc0a3ef03e2bd0c24d2641a6d7af1b4c880cac773b7e326bc57c90e53cf95` for
both the private CSV and the database. There were 41 events: 26 `ATTENDANCE`, two
`CHECK_IN`, 12 `FOOD`, one `MERCHANDISE`; five hidden; all 41 had `roomFr`, stable
`importKey`, and nonempty `seriesKey`. No schedule database import or deletion was
needed. The old tracked schedule had 44 stale rows. It was removed from the tree,
ordinary remote branches, and tags; GitHub's read-only PR refs 327–340 can still
retain old commits. The importer now requires an explicit private input path, tests
use synthetic fixtures, and the migration image no longer embeds the schedule.
Removing the public CSV does not change the Sheet RSVP integration or the already
imported database events. A future schedule update can use the documented private
importer after validating the operator-supplied file and reviewing its planned diff.

The schedule and RSVP exports are private operational data and are gitignored:
`private-schedule/` is the intended local location for an operator-supplied schedule
CSV; it is absent from a normal clone. `private-rsvp/` is the local operational
workspace for response exports, signed management links, recipient CSVs, and Apps
Script backups. Its name marks a data-handling boundary rather than an application
module; `tsconfig.json` excludes it. Neither directory is required to build or run
the app. Never commit, upload, paste into an issue, or log their contents.

## RSVP completion and acceptance sequence

1. Capture the exact error/toast from the partial 100-row preparation run.
2. Verify the Sheet's first completed batch has durable Participant IDs, signed `/rsvp/manage#…` links, statuses, deadline, and refresh timestamps.
3. Correct the batch failure without changing already-issued IDs or links.
4. Rerun **Prepare accepted RSVP invitations**. It is intentionally idempotent.
5. Confirm the returned `processed` count equals the full accepted count.
6. Query production read-only and confirm the same participant count, one common intended deadline, zero unexpected walk-ins, and no duplicate IDs.
7. Run the Sheet RSVP refresh and confirm there are zero missing participant IDs before interpreting the Sheet as reconciled.
8. Resolve shared-recipient submissions before generating the campaign CSV. The earlier review flagged row pairs 31/329, 37/668, 79/347, 168/332, 296/432, 382/641, 428/598, and 454/559. Recheck these against the current Sheet rather than assuming the row numbers or decisions are still current.
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
11. Do not send the full campaign without a separate action-time approval of the final recipient count, suppressions, sender, deadline, subject, template, and dry-run output. `scripts/prepare-rsvp-campaign.mts` prepares a private recipient CSV; it does not send email. `RSVP Refreshed At`, not generic `Last Sync`, is the Sheet freshness signal.

The preparation command scans every Accepted/Accepté/Acceptée response regardless of
selection, filters, or hidden rows, writes stable IDs before API calls, and processes
bounded batches. A successful `processed` count and a matching production count are
both required to call provisioning complete. A retry must preserve already-issued IDs
and links. The refresh command reads Tracker's `PENDING`, `CONFIRMED`, and `DECLINED`
states into the Sheet; it does not choose a response or send mail. See the RSVP runbook
for the complete message and suppression review.

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

## Deferred implementation work

These six items are approved for handoff rather than implementation in the current
cleanup. They are product changes, not evidence that the current deployment is broken.
Implement them in small PRs from current `main`; check that each item is still missing
before coding. The practical order is scanner eligibility, repeat-scan semantics,
scanner interface and feedback, public offline support, then terminology. The scanner
items share code and physical acceptance tests, but separate reviewable commits remain
useful. The offline item has the widest caching and privacy impact.

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

An earlier prototype, in an abandoned worktree and never merged, removed
`useScannerOperation` and its expected-value parameter. Do not port that; both are
regressions relative to `main`.

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

An earlier offline prototype, in an abandoned worktree and never merged, is
requirements evidence only. It omits home, precaches a parameterless `/schedule/event`, alters unrelated configuration, and hand-edits worker behavior. Reimplement on current main after reading the installed Next.js 16 and `next-pwa` documentation. Test the production service worker, update/activation behavior, populated schedule data, route fallback, and Android offline reload.

### 5. Targeted bilingual terminology

Approved changes:

- French `Metrics` → `Statistiques`;
- French `Interne` → `Outils organisateurs`;
- organizer navigation `QR` → `Scanner`;
- French scanner page title → `Lecteur de codes QR`.

Already-correct `Accueil` and translated map reset controls should not be reopened.
Keep the two Devpost deadlines and leave other Resources content unchanged unless it
receives a separate content review. Verify the four terms in both locale files and the
rendered organizer and participant views.

### 6. EEF aspect-ratio hardening — low priority

The current sponsor SVG already has the accepted crop, transparent cutouts, orange
emblem, and black text. The remaining small improvement is to add
`preserveAspectRatio="xMidYMid meet"` to `public/assets/sponsors/EEF.svg`, then validate
the XML, render it at sponsor-card size, and compare its aspect ratio. Do not port the
older `review/history-cleanup-ready` sponsor-list commit; its tiers, links,
dimensions, and placeholder assets are obsolete relative to `main`.

## How to use the review findings

The findings below were independently reviewed at the pre-merge branch `faebc48`.
They are candidates to triage, not authorization to land every suggestion. Verify
each against freshly fetched `main` before changing code. Prioritize the retired
RSVP documentation before an invitation campaign and the ambiguous scanner selector
before volunteers use repeated station names. The audit-transaction question needs an
explicit product decision; the remaining UI, build-flag, and migration-naming items
can be scoped with related work. Preserve applied migrations exactly as they are.

## Review findings

Findings from the September 23 independent code review. File and line references were
confirmed at `faebc48`; the subsequent merge and deployment changed the schedule
source handling and documentation, so recheck line numbers before editing.

### The authoritative Phase 1 documents describe the retired RSVP contract

The commit `feat(rsvp): manage attendance from one private link` replaced
ID-authorized RSVP with a signed management capability. (Its SHA is deliberately omitted:
the repository history was rewritten by `docs(operations): record repository history
purge`, so pre-purge SHAs no longer resolve.) That is a
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
- `PHASE_1_INTEGRATIONS.md:63-74` documents the reconciliation response as
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

### The scanner station selector cannot distinguish repeated event names

`src/pages/qr/index.tsx:90-95` labels each option
`` `${t(`workflow.${event.scannerWorkflow}`)} — ${name}` `` with no time, and
`events.scannable` returns every event whose `end` is later than 30 minutes ago. The
authoritative schedule observed on 2026-09-23 contained repeated names (counts are from
the private schedule CSV, which is not in this repository):

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

### An RSVP decision is rolled back if its audit log write fails

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

### Three pairs of migrations share a timestamp prefix

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
re-adds `Event.tiktok` and `remove_event_tiktok` drops it again. **They must be kept**:
production successfully deployed image `85af7abb` after its migration job, and the
earlier `d48c265` deployment also ran migrations. They are already applied and cannot
be deleted from the migration history.

**Fix:** no change to existing migrations. Require a unique, generator-produced
timestamp prefix for every future migration.

### The organizer event editor modal has no focus trap or Escape handler

`src/components/ScheduleEventDialog.tsx` uses the native `<dialog>` element with
`showModal()`, which provides a focus trap, Escape via `onCancel`, and an inert
background. `src/components/EventEditor.tsx` still renders a `createPortal` div with
`role="dialog" aria-modal="true"` and neither behaviour, so keyboard focus escapes into
the page behind it. The organizer-facing dialog is now the less accessible of the two,
and the better pattern already exists in the codebase.

### The event reminder control resets on every refetch

`src/components/ScheduleEventDetails.tsx:75` runs its push-availability effect on
`[event]`, where `event` is `query.data`. Superjson rebuilds the `Date` fields on each
refetch, defeating react-query's structural sharing, so the identity changes and the
effect resets `pushAvailable` and `notifyRequested` to `false` before re-probing. The
bell briefly shows as unavailable on every refocus.

**Fix:** depend on `event?.id` and `event?.start?.getTime()`.

### Save-to-schedule star: shared pending state, no optimistic update

On the schedule cards a single `update` mutation drives every star, so
`disabled={update.isLoading}` (`src/pages/schedule/index.tsx:465`) disables **all**
stars while any one save is in flight, and nothing changes visually until the round trip
completes — on conference wifi the primary new interaction will feel dead.
`update.isError` renders one alert at the bottom of the list, away from the star that
failed and without naming it. The control is also bespoke (`★`/`☆` glyphs with custom
classes) while `EventInterestButton` renders an SVG star with `ui-button ui-button-icon`,
which is what `docs/ui-consistency.md` asks for.

### `SKIP_ENV_VALIDATION` does not skip validation

`next.config.js:33` documents the flag and line 36 honours it, but only for the
config-time preflight import. `src/env/server.mjs` validates unconditionally whenever it
is imported, and pages import it, so page-data collection still fails without the
placeholder values. The Docker build succeeds only because `.github/workflows/build.env`
is mounted as a secret. This is worth knowing for validation step 5 of the future-PR
checklist above: a build cannot be run without that file.

**Fix:** honour the flag in `src/env/server.mjs`, or delete the flag and its comment and
document that a build requires the placeholder env file.

### British-Canadian English consistency in user-facing text

The repository mixes American and Canadian spelling in English user-facing copy.
This is a style issue, not a functional defect. Inventory rendered UI text (including
validation messages, email templates, and other participant-facing copy), then
document the **British-Canadian** house style in `docs/ui-consistency.md` and update
the copy consistently: `colour`, `centre`, `organise`, `organisation`, and analogous
forms where appropriate. This `-ise`/`-isation` preference is an explicit house-style
choice even where other Canadian authorities use `-ize`/`-ization`. Use the team's
licensed _Canadian Press Stylebook_ for other editorial questions, but let the
explicit house spelling preference prevail if they differ. Verify the edition
actually available to the team rather than hard-coding the proposed "16th edition,
2023" citation ([the publisher currently lists a 20th edition](https://the-canadian-press-store.myshopify.com/collections/print-editions)).
Scope the edit to English prose only:
preserve identifiers, CSS properties, APIs, dependencies, data keys, proper names,
quoted source material, and French translations. Review the resulting screens and
messages in context, not just search-and-replace results.

For French-Canadian (`fr-CA`) user-facing copy, the project's house typography is
**no space before `:`, `;`, `?`, or `!`** (for example, `Prêt?`, not `Prêt ?`). Add
this rule to `docs/ui-consistency.md` alongside the English spelling rule, audit
the rendered French strings and templates, and fix inconsistent copy without
changing variable interpolation, placeholders, URLs, or code syntax. This is a
project preference; do not infer it from the English spelling rule or apply it to
other locales.

## Local prototype disposition and chronology

The primary `review/history-cleanup-ready` checkout and detached `2cc8`/`43fe`
worktrees contained mixed old implementation, review reports, and untracked files.
The useful requirements are captured above. They must not be merged or deployed
wholesale: their RSVP, scanner, offline, and push variants predate later safeguards on
`main`. The `rsvp-live-test` worktree has a superseded remaining-work report. The
separate ignored `.env` files in some otherwise clean worktrees may contain credentials;
preserve them until their owner decides where to retain the settings. The unique
`65033ce` sponsor-list commit is obsolete. Create new work in a clean worktree from
fresh `origin/main`.

Chronology relevant to a future agent:

1. Earlier reports described a reset database and competing worktree prototypes; their
   participant counts and deployment SHAs are historical snapshots.
2. At this review's start, `main` was `83f0228` and production was on image `9e8166f`.
   During the review, `main` advanced to `d48c265` and production to revision `0000057`.
3. A read-only Azure audit found zero participants and 41 events. The event rows matched
   the private authoritative CSV exactly. The operator then ran the accepted-audience
   preparation menu command; two later audits found a stable partial 100 participants.
4. With operator authorization, `main` history was rewritten to remove the tracked
   schedule, 14 affected obsolete source branches were deleted, and PR 341 rebase-merged
   the source-handling changes and this handoff. The public CSV removal did not alter
   production event rows.
5. The manually dispatched workflow deployed revision `0000058` using image `85af7abb`.
   PR 342 then recorded that provider state in this handoff; final `main` was `d30cfc2`.
6. A later cleanup deleted 92 closed automated or merged PR branches. Historical
   branches without a PR and worktrees with uncommitted or ignored private data were
   retained. Check the live branch and worktree inventory before any further cleanup.
