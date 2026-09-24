# Event readiness handoff

This is the operating brief for an agent arriving without the earlier conversation.
Read the decisions and current evidence before implementing any item. Earlier
`REMAINING_WORK.md` reports came from different checkouts and are superseded; their
items are not an additive backlog.

Status verified on September 23, 2026:

| Surface         | Verified state                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository      | The implementation was rebuilt directly on the post-cleanup `main` baseline `6c8e9b2`. Scanner work is `c38c958`, public offline support is `5d90a6d` plus matcher correction `c2fbf34`, and language/EEF work is `a758b15`. This handoff is the only later documentation change. Start future work from a fresh fetch of `origin/main`.                                                                                   |
| Production app  | Azure Container App revision `track-the-hack--0000058` is Running, Healthy, Provisioned, and receives 100% of traffic. Its image is tagged `85af7abb4adda34541b172ded3a766e4b3a01a41`; the later `d30cfc2` commit changes only this handoff.                                                                                                                                                                            |
| Release checks  | Deployment run [35935204267](https://github.com/HacktheHill/track-the-hack/actions/runs/35935204267) succeeded for the currently deployed image. For the new implementation, local tests report 178 total, 174 passed, and four MySQL-only cases skipped because Docker is unavailable; typecheck, lint, Prisma validation, XML validation, and a production PWA build passed. Hosted CI and deployment remain pending. |
| Production data | 41 events matching the private authoritative schedule; the last audited participant count was a partial 100 provisioned, all unconfirmed. Refresh these mutable counts before acting.                                                                                                                                                                                                                                   |

`main` and the deployed image now have different application code. The scanner schema
change requires migration `20260924010000_add_event_scanner_enabled` before the new
application revision receives traffic. The
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
- Explicit scanner eligibility, capped repeat-scan outcomes, persisted station choice,
  date/time station labels, and progressive audio/vibration feedback.
- Public-only offline caching for home, schedule and event data, maps, resources,
  sponsors, and participant pass; private routes and APIs remain network-only.
- British-Canadian English and French-Canadian punctuation rules in
  `docs/ui-consistency.md`, the targeted interface terminology changes, and EEF SVG
  aspect-ratio hardening.

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
    - scan optically from a second organiser device;
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

## Implemented event-readiness work

The six previously deferred items were rechecked against `main` before implementation
and are now present in the commits named in the status table. Do not reapply the
abandoned prototypes.

### Scanner eligibility and event data

`Event.scannerEnabled` is explicit throughout the Prisma schema, event editor, APIs,
scanner service, schedule importer, synthetic CSV tests, and import documentation. The
migration defaults existing events to enabled, then disables Career Fair events and
events whose current English name is `Team Formation` or `Closing Ceremony`. That
name/type matching is a one-time data migration only; runtime authorization uses the
stored boolean. Scans and manual count adjustments both reject disabled events.

Before production deployment, inspect the migration's planned update against the 41
current events and confirm with operations whether any additional schedule-only rows
should be disabled. After deployment, query the actual disabled set; do not assume the
seed matched forever. Future changes belong in the editor or private authoritative CSV
using its required `scannerEnabled` column.

### Repeat scans, station selection, and feedback

The server returns `new`, `incremented`, `unchanged`, or `limit`. A deliberate repeat
scan increments every workflow when `maxCheckIns > 1`, using one conditional SQL
update so concurrent devices cannot exceed the cap. Blank/unlimited and `1` remain
idempotent; `0` remains capped at zero. Manual adjustments retain expected-value
compare-and-set reconciliation and the server's count remains authoritative.

The camera suppresses continuous detections of the same visible code and clears that
suppression after 750 ms without a detection; A → B → A and a code deliberately
removed and presented again can therefore increment. Every USB/manual submission is
treated as deliberate. The scanner keeps `useScannerOperation`, so scans, selector
changes, and count adjustments cannot race through the interface.

The selected station is saved in local storage and safely falls back to participant
view if the event is no longer scannable. Labels include localized weekday/time to
distinguish repeated names. Visual text, Web Audio cues, and vibration patterns differ
for each outcome and errors; storage, audio, and vibration failures are non-fatal.
Workflow cards no longer repeat the event name or participant ID, and food information
uses `Diet`/`Régime`. Audit actions now distinguish increments and caps from unchanged
duplicates.

Automated coverage includes workflow allowlists, all multi-check-in workflow types,
uncapped/single-count idempotence, disabled events, first-scan races, cap concurrency,
stale adjustments, editor/API projections, localized feedback, and importer shape.
Still required in the deployed environment: real-MySQL concurrency, a small-phone
camera test, USB scanner input, and two simultaneous organiser devices.

### Public-information offline support

The service worker precaches localized shells for home, schedule, event details, maps,
resources, sponsors, and participant pass, plus all six current SVG floor maps. Only
the server-filtered public `events.all` query is split into a dedicated GET and cached;
all other API traffic remains network-only. Event details select from that public list,
so a successful schedule load carries the real ID and detail payload for every visible
event. Hidden events are still filtered by the server before the response can enter a
cache.

Organiser, metrics, authentication, RSVP, claim, participant-profile, and private Next
data requests have earlier network-only rules. Profile preserves its existing static
pass fallback; other private navigation receives a localized `/_offline` page rather
than private cached content. Generated fallback workers are excluded from TypeScript,
Git, and Workbox's ordinary public-file scan. No custom push-worker behaviour was
changed.

The production build generated a service worker containing the intended route order,
cache names, public manifest entries, and private network-only rules. Still required:
exercise install/update/activation and offline reload in Android Chrome, confirm French
and English route fallbacks, and load a populated production-equivalent schedule before
disconnecting. The four MySQL-dependent tests and full PWA browser E2E remain skipped
locally because `/var/run/docker.sock` is unavailable.

### Language, terminology, and sponsor asset

`docs/ui-consistency.md` now records British-Canadian `-ise` house spelling and the
French-Canadian no-space-before-`: ; ? !` rule, with explicit exclusions for
identifiers, CSS properties, APIs, data keys, URLs, proper names, and quotations.
User-facing English copy was audited for the targeted American forms, and current
French locale JSON plus Resources copy was normalized to the punctuation rule.

The approved labels are now `Statistiques`, `Outils organisateurs`, navigation
`Scanner`, and `Lecteur de codes QR`. The two Devpost deadlines and the closing novelty
quotation remain unchanged. The EEF SVG has `preserveAspectRatio="xMidYMid meet"`;
`xmllint` passed and a 354×110 white-background render retained the orange emblem,
black text, transparent cutouts, and accepted proportions.

## How to use the review findings

The open findings below were independently reviewed at the pre-merge branch `faebc48`.
They are candidates to triage, not authorization to land every suggestion. Verify each
against freshly fetched `main` before changing code. Prioritize the retired RSVP
documentation before an invitation campaign. The audit-transaction question needs an
explicit product decision; the remaining UI, build-flag, and migration-naming items
can be scoped with related work. Preserve applied migrations exactly as they are. The
scanner selector and Canadian-language findings from that review are resolved by the
implementation section above and have been removed from the open list.

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

### The organiser event editor modal has no focus trap or Escape handler

`src/components/ScheduleEventDialog.tsx` uses the native `<dialog>` element with
`showModal()`, which provides a focus trap, Escape via `onCancel`, and an inert
background. `src/components/EventEditor.tsx` still renders a `createPortal` div with
`role="dialog" aria-modal="true"` and neither behaviour, so keyboard focus escapes into
the page behind it. The organiser-facing dialog is now the less accessible of the two,
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

## Local prototype disposition and chronology

The primary `review/history-cleanup-ready` checkout and detached `2cc8`/`43fe` and
`rsvp-live-test` worktrees contained mixed old implementation, review reports, and
untracked files. Their useful requirements are captured above; their code must not be
merged or deployed wholesale. The obsolete worktrees were removed. Before switching
the primary checkout to `main`, all of its tracked and untracked prototype work was
saved recoverably as `stash@{0}` with message `archive:
review-history-cleanup-ready prototypes before 2026-09-23 cleanup`. The ignored
primary-checkout `.env`, `google-credentials.json`, and `private-rsvp/` were not moved,
deleted, or committed. The unique `65033ce` sponsor-list commit is obsolete.

The following 16 non-`main` remote branches remain. They survived the cleanup because
they are long-lived year branches or standalone histories without sufficient merged-PR
evidence to treat deletion as lossless. The repository history rewrite makes a simple
“not merged” result inconclusive. Do not deploy them or merge them wholesale; delete
one only after an owner or a content-level review confirms its unique commits are no
longer needed.

- Year snapshots: `2023`, `2025`.
- Older data/registration/auth experiments: `database-refactor`,
  `feat/model-change-luis`, `hacker-registrations-v2`, `microsoft-login`,
  `ticket-tailor`.
- Event and participant feature histories: `feat/discord-team-operations`,
  `feature/event-notification`, `notifications`, `fix/revert-qr-rotation`,
  `feat/qr-code-offline-support`, `feat/qr-code-offline-support-v2`.
- Content/tooling histories: `hackhers`, `hardware-tracking-tool`,
  `localization-wip`.

`origin/HEAD` is only the symbolic remote default and is not an additional branch.
Create future work from fresh `origin/main`.

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
   branches without a PR were retained. The final local cleanup archived the primary
   prototype changes in the stash named above, removed every auxiliary worktree, and
   left only the primary checkout on `main`. Check the live branch, stash, and worktree
   inventory before any further cleanup.
7. On current `main`, the event-readiness implementation was rebuilt rather than copied
   from those prototypes: scanner work in `c38c958`, offline work in `5d90a6d` and
   `c2fbf34`, and language/EEF work in `a758b15`. No production deployment had
   occurred when this handoff was updated.
