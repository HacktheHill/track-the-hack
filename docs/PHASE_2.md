# Phase 2: Day-of participant access and event operations

> Historical implementation brief. The bound Google Sheets Apps Script was
> subsequently implemented and is versioned in
> [`integrations/google-sheets`](../integrations/google-sheets); current behavior
> is documented in [`PHASE_2_IMPLEMENTED.md`](./PHASE_2_IMPLEMENTED.md).

## Objective

Implement the complete day-of path in this repository: an organizer issues access from an accepted Sheet row, the participant claims it on their device, Track the Hack creates a participant session that is separate from NextAuth, and the participant can use their operational profile and QR throughout the event.

This is one coherent implementation phase. Keep its schema, API, authentication, UI, scanner, offline, and test work together.

## Starting point and scope

- Read `docs/PROPOSED_FLOW.md` and `docs/PHASE_1_INTEGRATIONS.md` before changing code. They are the authoritative product and Phase 1 integration contracts.
- Phase 1 already supplies the minimal `Hacker` model, Sheet authentication, provisioning, RSVP/cancellation, and organizer-only NextAuth.
- Work only in this repository. Describe the required Google Sheets and Apps Script behaviour, but do not modify external systems or repositories.
- Applications already live at `https://apply.hackthehill.com`. Do not add application or `/apply` work.
- This implementation phase assumed fresh event data at the Phase 1 baseline. It does not require later deployments to reset the current database; see the [database lifecycle](../README.md#database-lifecycle). Do not build legacy participant-data migration or compatibility paths.
- Preserve unrelated working-tree changes. Do not commit, push, or open a PR unless the task owner explicitly requests it.

## Access issuance

- Add a restricted Sheet integration endpoint for issuing participant access. Use the existing `Authorization: Bearer <SHEETS_INTEGRATION_API_KEY>` boundary and constant-time authentication behaviour from Phase 1.
- Accept only the operational fields required to create or update the minimal Hacker record: exact participant `id`, `tShirtSize`, `mealCategory`, `acceptanceExpiry`, and `walkIn`. Reject unknown properties and all identity, contact, application, waiver, guardian, accessibility, detailed dietary, Tally-ID, and demographic fields.
- Reuse the Phase 1 validation and idempotent provisioning rules instead of creating a second interpretation of the Sheet contract.
- Each explicit access issuance creates a fresh, cryptographically random, short-lived, single-use claim capability and returns a claim URL suitable for display as a QR code.
- The claim QR and URL contain the opaque claim capability, not `Hacker.id` or any participant identity.
- Issuing replacement access atomically invalidates outstanding claim capabilities and revokes every previous participant session for that Hacker. Only one participant device may be active at a time.
- Do not expose raw claim or session capabilities in application logs, audit details, error tracking, or analytics.

## Claiming and participant sessions

- Add the necessary Prisma models and migration for claim capabilities and participant sessions. Raw bearer secrets must not be stored; persist only a safe hash, keyed digest, or equivalent verifier.
- Claim consumption must be atomic. Concurrent or repeated attempts against the same claim must result in exactly one successful participant session.
- Expired, revoked, malformed, and already-consumed claims must fail without revealing whether a Hacker record exists.
- Prevent browser prefetching, link previews, or harmless page refreshes from accidentally consuming a claim. Claim issuance may use a read-only landing page followed by an explicit same-origin action when needed.
- Create a participant session tied directly to `Hacker.id`, not to `User`, NextAuth `Session`, an organizer role, email, or another identity field.
- Store the participant session in an opaque `HttpOnly`, `Secure`, `SameSite` cookie with an intentional path, expiry, and CSRF strategy. Make the lifetime appropriate for event access and document the chosen values in the repository.
- Add shared server-side participant-authentication helpers for pages and APIs. A participant session can read and act only on its own Hacker record and must never satisfy organizer or Sheet authorization.
- Provide a participant sign-out/session-clear path. Revoked or expired sessions must stop authorizing immediately.

## Walk-ins

- Use the same access-issuance endpoint and claim/session flow for walk-ins. Do not create a separate Track the Hack walk-in form or participant account path.
- A walk-in record is created or updated with `walkIn=true` only after the external Tally submission has synced to the Sheet, an organizer has reviewed it, and the Sheet has assigned a valid participant ID.
- Walk-ins receive the same minimal Hacker model, authorization boundaries, operational QR, and Presence behaviour as other participants.

## Participant profile and operational QR

- Restore `/profile` as a participant-session-only page. It must not depend on NextAuth, `User`, email, name, or an organizer role.
- Limit the profile to the participant's operational event QR, confirmation state, T-shirt size, meal category, and that participant's own Presence records.
- The operational event QR contains only exact `Hacker.id`. It is an identifier for organizer-authenticated scanner workflows and is never accepted as a login or participant-session credential.
- Keep the participant's QR available without continuous internet access after it has been loaded on their device. Cache only the minimum data required to render the QR and do not cache identity data or bearer session secrets in client-readable storage.
- A participant must never be able to request another Hacker's profile, QR, Presence records, or operational fields by changing a route or API parameter.

## Organizer scanning and operational lookup

- Keep `/qr` and all scanner mutations organizer-authenticated through NextAuth and roles. Participant sessions and bare Hacker IDs must not authorize scanner actions.
- Preserve current Presence semantics, counters, and per-event maximum-check-in rules.
- Limit each scanner workflow to the fields it requires:
    - Check-in: confirmation state, check-in Presence, and T-shirt size where operationally required.
    - Merchandise: T-shirt size and merchandise-pickup Presence.
    - Food: meal category and food Presence.
    - Mini-events and workshops: attendance Presence.
- `MealCategory.OTHER` must tell the volunteer to contact the food lead with access to the restricted external information. Do not encode detailed dietary information in Track the Hack or use wristbands, stickers, or another physical dietary marker.
- Any organizer participant lookup in Track the Hack must use only the remaining operational fields. Front-desk identity lookup stays in the restricted Sheet; do not add name, email, profile, application, or demographic search.
- Audit participant and Presence actions using opaque participant IDs and operational details only. Do not copy identity or application data into logs.

## External-system context

The external Google Sheets sidebar and Apps Script must eventually:

1. Let an organizer select the accepted Sheet row after visually checking government-issued ID.
2. Never record details from the government ID.
3. Keep `SHEETS_INTEGRATION_API_KEY` in server-side Apps Script properties, never in a Sheet cell or browser sidebar.
4. Send only the allowed operational fields to the access-issuance endpoint.
5. Present the returned claim URL as a QR code for the participant's intended device.
6. Use the same action after reviewed Tally walk-in submissions have synced and received a participant ID.

This phase implements and documents the Track the Hack endpoint contract only. It does not implement the external sidebar or Apps Script.

## Verification

- Add focused tests for Sheet authentication, strict field rejection, minimal provisioning reuse, claim expiry, atomic single use, concurrent claims, replacement issuance, previous-session revocation, cookie attributes, sign-out, and organizer/participant authorization separation.
- Test that participant APIs cannot access another Hacker and that Hacker IDs cannot be used as login credentials.
- Test each scanner workflow's field exposure, organizer authorization, Presence creation/increment behaviour, and maximum-check-in handling.
- Verify the operational QR renders after loss of network connectivity without exposing participant-session secrets in client-readable storage.
- Run Prisma validation/generation, migrations against a disposable database when available, focused tests, TypeScript, lint, production build, and `git diff --check`. Report each result separately and do not describe an unrun check as passing.
- Inspect the final diff for new PII storage, raw-token logging, participant-to-User linkage, weakened organizer authorization, and unrelated changes.

## Completion criteria

Phase 2 is complete when an organizer can issue access for a normal participant or walk-in, exactly one device can claim the short-lived capability, the participant can use a private operational profile and offline event QR, organizer scanners can perform every documented Presence workflow, and none of those paths stores identity data or crosses the organizer, Sheet, RSVP, cancellation, or participant-session authorization boundaries.
