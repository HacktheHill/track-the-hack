# Phase 3: Discord, teams, reporting, and final completion

## Objective

Complete the remaining participant integrations and reporting work in this repository, settle team ownership coherently, remove any residual legacy or privacy-incompatible behaviour, and verify the Phase 1–3 system end to end.

This is the final implementation phase, not a collection of separate cleanup phases. Keep Discord verification, the selected team model, reporting, final privacy enforcement, and release verification together.

## Starting point and scope

- Read `docs/PROPOSED_FLOW.md`, `docs/PHASE_1_INTEGRATIONS.md`, and `docs/PHASE_2.md` before changing code.
- Phase 1 owns the minimal Hacker model, organizer authentication, provisioning, RSVP/cancellation, and legacy participant-path removal.
- Phase 2 owns Sheet-issued access, claim capabilities, participant sessions, walk-ins, participant profile/QR, and scanner workflows.
- Work only in this repository. Document contracts required from the Discord bot, Sheets, bulk-email tooling, and email-list-manager, but do not modify those external repositories or services.
- Applications remain at `https://apply.hackthehill.com`; no application or `/apply` work belongs here.
- Assume fresh event data. Do not add legacy participant-data migration machinery.
- Preserve unrelated working-tree changes. Do not commit, push, or open a PR unless the task owner explicitly requests it.

## Discord verification

- Restore Discord verification using the Phase 2 participant session to prove the current `Hacker.id`. Do not use NextAuth participant accounts and do not accept a Discord ID from the participant-facing Track the Hack page.
- Generate a cryptographically random, opaque, short-lived, single-use verification challenge tied server-side to the participant session/Hacker.
- Provide an authenticated bot-to-Track-the-Hack verification contract. The bot owns the Discord identity mapping; Track the Hack returns only the participant proof needed to complete the association.
- Track the Hack must not receive, store, or log the Discord user ID, username, email, or other Discord identity data. Challenges, bot credentials, and bearer capabilities must not appear in normal logs or audit details.
- Make verification replay-safe and ensure one participant cannot complete or inspect another participant's challenge.
- Keep the bot credential boundary distinct from organizer NextAuth, Sheet API keys, RSVP IDs, cancellation capabilities, claim capabilities, and participant sessions.

## Team source of truth

Choose and implement exactly one team source of truth using the criteria in `docs/PROPOSED_FLOW.md`. Do not maintain two writable sources.

- Use Option A when Track the Hack needs team data for participant self-service or judging: retain `Team` and `Hacker.teamId`, make Track the Hack authoritative, add participant-session-authorized web operations, and expose narrowly authenticated bot APIs using participant IDs. The Discord bot mirrors or invokes Track-owned membership changes rather than keeping an independent writable team database.
- Use Option C when Track the Hack does not need team data: remove `Team`, `Hacker.teamId`, team APIs, team UI, team metrics, and judging dependencies from this repository. Discord is then the only team system.
- Do not implement Option B unless newer explicit project direction selects it. Snapshot synchronization creates two representations and must not be introduced accidentally.
- Record the selected option and its external contract in repository documentation as part of this phase.
- Because Track the Hack participant sessions are issued only during in-person check-in, pre-event team formation remains in Discord. Do not add a separate pre-event participant-authentication system in this phase.
- If Option A is selected, enforce one current team per Hacker, authorize every membership change, define safe create/join/leave behaviour, and prevent bot or participant requests from changing unrelated participants or teams.

## Participant profile and organizer operations

- Update the Phase 2 participant profile to show team information only when the selected team model keeps it in Track the Hack.
- Keep participant access limited to the current Hacker's own operational fields, Presence information, Discord-verification state needed by the flow, and applicable team data.
- Keep organizer participant lookup limited to pseudonymous operational fields. Identity matching and front-desk lookup remain in the restricted Sheet.
- Do not restore a participant directory, name/email search, public profile, participant `User`, HACKER role, participant OAuth/password flow, or a raw Discord-ID verification route.

## Metrics and sponsor reporting

- Keep only aggregate operational metrics derived from the minimal Hacker model, Presence, and events. Demographic reporting stays in Tally or restricted Sheet views.
- Do not infer, reconstruct, or import demographics, school, identity, detailed dietary/accessibility information, application answers, or waiver/guardian data for reporting.
- Sponsor reporting defaults to aggregate data. Do not add individual participant export or sharing without a separately documented explicit opt-in, specific purpose, and field-minimized disclosure. If no such approved feature exists, individual-level sharing remains unsupported.
- Preserve aggregate sponsorship tooling that does not use participant identity or application data.

## Audit logging and privacy boundary

- Preserve the audit-log framework, but use opaque participant IDs and minimum operational details for participant, Presence, Discord, and team actions.
- Do not log raw RSVP cancellation capabilities, Sheet API keys, claim/session secrets, Discord challenges, bot credentials, or external identity/application data.
- Check user-visible errors, server logs, analytics hooks, exports, seeders, fixtures, and tests for accidental identity or secret disclosure.
- Keep organizer, Sheet, RSVP, cancellation, participant-session, claim, Discord-bot, and team authorization mechanisms separate and non-interchangeable.

## Final repository cleanup

- Remove obsolete participant providers, roles, routes, APIs, components, dependencies, environment variables, translations, assets, seed data, tests, and documentation left behind by the old identity/application system or superseded Phase 1–2 implementations.
- Remove dead participant-User linkage, application/review, resume/signature upload, emergency-contact, unsubscribe, demographic dashboard, public-profile, directory/search, raw Discord-ID, and obsolete team code.
- Do not add or manage an `/apply` redirect; application routing is already handled externally at `https://apply.hackthehill.com`.
- Preserve events and schedules, maps and resources, hardware inventory, organizer role administration, aggregate sponsorship tooling, organizer authentication, and valid Presence behaviour.
- Keep the final implementation consistent with the exact minimal Hacker field list and data-ownership boundary in `docs/PROPOSED_FLOW.md`.

## External-system context

- The Discord bot must store Discord identity mapping, authenticate to the Track the Hack bot endpoints, consume verification challenges, and follow the selected team contract. Track the Hack must not store the Discord identity.
- The Google Sheet and Apps Script continue to own identity lookup, participant provisioning/access issuance, and walk-in review.
- The bulk-email tooling continues to own RSVP invitation and confirmation delivery from the documented CSV/export contracts.
- `email-list-manager` continues to own subscription and unsubscribe state.

These are handoff requirements for other repositories; this phase changes only Track the Hack.

## Verification

- Add focused tests for Discord challenge issuance, expiry, replay prevention, bot authentication, participant ownership, and absence of Discord identity storage/logging.
- Test every API and UI path for the selected team model, including unauthorized membership changes, duplicate membership, and bot/participant authorization separation when Option A is selected.
- Test aggregate metrics and verify that participant-level or demographic fields cannot be queried or exported.
- Run a repository-wide search for removed PII fields, legacy roles/providers/routes, participant `User` linkage, raw Discord IDs, secret logging, and obsolete environment variables. Investigate every live-code match rather than assuming a name is harmless.
- Run the complete Phase 1–3 automated suite, Prisma validation/generation, migrations against a disposable database when available, TypeScript, lint, production build, and `git diff --check`. Report each result separately.
- Exercise the full local lifecycle where infrastructure permits: minimal provisioning, RSVP/cancellation, access issuance, single-use claim, participant profile/offline QR, organizer scanning and Presence, Discord verification, and the selected team path.
- Verify unaffected organizer and public features still work. Keep source/build checks, database-backed verification, browser verification, and external-system readiness as separate claims.
- Inspect the final diff for unrelated changes and any weakening of the approved privacy boundary.

## Completion criteria

Phase 3 is complete when Discord verification works without Track the Hack holding Discord identity, exactly one team system is authoritative, reporting is operational and aggregate by default, no legacy participant identity/application path remains, unaffected event and organizer functionality is preserved, and the complete Phase 1–3 lifecycle passes the strongest available repository, database, and browser checks.
