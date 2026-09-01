# Phase 3: External teams, reporting, privacy cleanup, and final verification

## Objective

Complete aggregate reporting and final privacy cleanup in this repository, enforce external-only team ownership, and verify the Phase 1–3 system end to end.

This is the final implementation phase, not a collection of separate cleanup phases. Keep external-only team ownership, reporting, final privacy enforcement, and release verification together.

## Starting point and scope

- Read `docs/PROPOSED_FLOW.md`, `docs/PHASE_1_INTEGRATIONS.md`, and `docs/PHASE_2.md` before changing code.
- Phase 1 owns the minimal Hacker model, organizer authentication, provisioning, RSVP/cancellation, and legacy participant-path removal.
- Phase 2 owns Sheet-issued access, claim capabilities, participant sessions, walk-ins, participant profile/QR, and scanner workflows.
- Work only in this repository. Document contracts required from Sheets, bulk-email tooling, and email-list-manager, but do not modify those external repositories or services.
- Discord account linking and bot behaviour are outside this repository and Phase 3; they are not missing deliverables.
- Applications remain at `https://apply.hackthehill.com`; no application or `/apply` work belongs here.
- Assume fresh event data. Do not add legacy participant-data migration machinery.
- Preserve unrelated working-tree changes. Do not commit, push, or open a PR unless the task owner explicitly requests it.

## Team source of truth

Option C is selected. Discord is the sole team system and owns team names, membership, self-service, and any team association used for judging.

- Remove `Team`, `Hacker.teamId`, team APIs, team UI, team metrics, and Track-owned judging dependencies from this repository.
- Track the Hack must not accept a Discord team ID or membership snapshot and exposes no Discord or team API.
- Keep pre-event team formation in Discord. Do not add a separate pre-event participant-authentication system.
- Do not add Track-owned team CRUD, synchronization, or matchmaking without a new explicit source-of-truth decision.

## Participant profile and organizer operations

- Remove team information from the Phase 2 participant profile.
- Keep participant access limited to the current Hacker's own operational fields and Presence information.
- Keep organizer participant lookup limited to pseudonymous operational fields. Identity matching and front-desk lookup remain in the restricted Sheet.
- Do not restore a participant directory, name/email search, public profile, participant `User`, HACKER role, participant OAuth/password flow, or a raw Discord-ID verification route.

## Metrics and sponsor reporting

- Keep only aggregate operational metrics derived from the minimal Hacker model, Presence, and events. Demographic reporting stays in Tally or restricted Sheet views.
- Do not infer, reconstruct, or import demographics, school, identity, detailed dietary/accessibility information, application answers, or waiver/guardian data for reporting.
- Sponsor reporting defaults to aggregate data. Do not add individual participant export or sharing without a separately documented explicit opt-in, specific purpose, and field-minimized disclosure. If no such approved feature exists, individual-level sharing remains unsupported.
- Preserve aggregate sponsorship tooling that does not use participant identity or application data.

## Audit logging and privacy boundary

- Preserve the audit-log framework, but use opaque participant IDs and minimum operational details for participant and Presence actions.
- Do not log raw RSVP cancellation capabilities, Sheet API keys, claim/session secrets, or external identity/application data.
- Check user-visible errors, server logs, analytics hooks, exports, seeders, fixtures, and tests for accidental identity or secret disclosure.
- Keep organizer, Sheet, RSVP, cancellation, participant-session, and claim authorization mechanisms separate and non-interchangeable.

## Final repository cleanup

- Remove obsolete participant providers, roles, routes, APIs, components, dependencies, environment variables, translations, assets, seed data, tests, and documentation left behind by the old identity/application system or superseded Phase 1–2 implementations.
- Remove dead participant-User linkage, application/review, resume/signature upload, emergency-contact, unsubscribe, demographic dashboard, public-profile, directory/search, raw Discord-ID, and obsolete team code.
- Do not add or manage an `/apply` redirect; application routing is already handled externally at `https://apply.hackthehill.com`.
- Preserve events and schedules, maps and resources, hardware inventory, organizer role administration, aggregate sponsorship tooling, organizer authentication, and valid Presence behaviour.
- Keep the final implementation consistent with the exact minimal Hacker field list and data-ownership boundary in `docs/PROPOSED_FLOW.md`.

## External-system context

- Discord teams and account linking remain external. Track the Hack has no Discord bot contract and receives no Discord identity or team data.
- The Google Sheet and Apps Script continue to own identity lookup, participant provisioning/access issuance, and walk-in review.
- The bulk-email tooling continues to own RSVP invitation and confirmation delivery from the documented CSV/export contracts.
- `email-list-manager` continues to own subscription and unsubscribe state.

These are handoff requirements for other repositories; this phase changes only Track the Hack.

## Verification

- Verify no team model, field, API, UI, metric, or synchronized membership snapshot remains in Track the Hack.
- Test aggregate metrics and verify that participant-level or demographic fields cannot be queried or exported.
- Run a repository-wide search for removed PII fields, legacy roles/providers/routes, participant `User` linkage, raw Discord IDs, secret logging, and obsolete environment variables. Investigate every live-code match rather than assuming a name is harmless.
- Run the complete Phase 1–3 automated suite, Prisma validation/generation, migrations against a disposable database when available, TypeScript, lint, production build, and `git diff --check`. Report each result separately.
- Exercise the full local lifecycle where infrastructure permits: minimal provisioning, RSVP/cancellation, access issuance, single-use claim, participant profile/offline QR, organizer scanning, and Presence. Team operations remain external to this repository.
- Verify unaffected organizer and public features still work. Keep source/build checks, database-backed verification, browser verification, and external-system readiness as separate claims.
- Inspect the final diff for unrelated changes and any weakening of the approved privacy boundary.

## Completion criteria

Phase 3 is complete when Track the Hack contains no team state or synchronization, reporting is operational and aggregate by default, no legacy participant identity/application path remains, unaffected event and organizer functionality is preserved, and the complete Phase 1–3 lifecycle passes the strongest available repository, database, and browser checks.
