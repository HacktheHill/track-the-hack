# Discord verification

Participants activate their day-of access in a browser and an organiser checks
them in through a scanner station whose workflow is `CHECK_IN`. They then generate
a personal link using `/verify` or **Generate Verification Link** in Discord and
press **Verify Discord account** at `/discord`. English and French are supported.
Organiser sign-in alone cannot verify a participant.

## Ownership and protocol

- The bot creates a random 32-byte reference and stores only its SHA-256 digest,
  the Discord ID, and expiry in its own PostgreSQL database. It sends the
  participant a private five-minute link: `/discord#v1.REFERENCE.EXPIRES.SIGNATURE`.
- The HMAC-SHA256 link signature covers `discord-link:v1.REFERENCE.EXPIRES`.
  `EXPIRES` is Unix seconds. Both services validate the signature and expiry.
  Neither the page GET nor a link preview consumes or completes verification.
- On page load, the browser makes a read-only `GET` to `/api/discord/verify`.
  Track enables the button only when the browser has an active, unexpired,
  non-revoked participant session and that participant has a positive Presence
  for an event whose scanner workflow is `CHECK_IN`. The link fragment is not
  sent or consumed by this request.
- The browser posts only `{ token }` to `/api/discord/verify` after the participant
  presses the enabled button. Track repeats the session and positive check-in
  checks, then takes `Hacker.id` from that session. Extra identity fields and
  cross-origin browser requests fail.
- Track posts `{ token, hackerId }` to the bot's `/verify`. The headers are
  `x-track-the-hack-timestamp` (Unix seconds) and `x-track-the-hack-signature`
  (hex HMAC-SHA256 of `discord-complete:v1:TIMESTAMP.EXACT_JSON_BODY`). Request
  timestamps must be within five minutes of the bot's clock.
- The bot resolves the reference and reserves a one-to-one Discord↔Hacker
  binding using database uniqueness constraints, then ensures the existing
  Discord Hacker role is assigned. An existing role still requires a binding.
  Its success response is only `{ ok: true }`.
- The same participant can retry the same link while valid, or generate a new
  link for the same Discord account. A failed role assignment retains the
  binding so a retry can finish safely. Neither side of a binding can silently
  switch accounts; a conflict needs organiser assistance. There is no automatic
  reassignment or role revocation in this flow.
- Track stores no Discord IDs, usernames, mappings, or team data. It does not
  log proofs or pass through bot error details. The proof stays in the URL
  fragment until success, which removes it from browser history. It is a private
  bearer capability: participants must not share their links.

The page is static translated copy. Its read-only eligibility request controls
the button, while authorisation is repeated on the POST. Its cached HTML contains
no participant or proof data, and `/api/*` uses the existing service worker
NetworkOnly rule. There is no pre-event participant login or restoration of
participant User/OAuth/HACKER roles in Track. The Discord Hacker role and
Discord-owned teams remain separate.

## Configuration

Set both `DISCORD_BOT_URL` (the bot's server origin) and `INTERNAL_API_SECRET`
(at least 32 random characters) in Track. If either is unset, verification
returns unavailable; the rest of Track works normally. The secret must match
the bot's `INTERNAL_API_SECRET`. Use HTTPS for deployed service URLs.

The bot needs `TRACK_THE_HACK_URL`, its existing Discord guild/role/token
settings, and its **own PostgreSQL** `DATABASE_URL`. It never uses Track's MySQL.
The bot creates `discord_verification_challenges` and
`discord_participant_links` at startup by default. For managed migrations, run
`npm run migrate:db` in the bot repo first, then set
`VERIFICATION_RUN_MIGRATIONS=false`. Startup checks both tables exist.
Expired challenge rows are removed at bot startup, every 15 minutes, and when a
new link is generated. Participant bindings persist across bot restarts. For an
account correction, a trusted bot operator runs `verification:manage unlink`
with exactly one Discord or participant ID; the transaction removes the binding
and that Discord account's outstanding challenges. For an event reset, pause
verification on both services and run `verification:manage reset
--confirm-current-event-reset`. Reset does not remove Discord roles, which
requires a separate organiser decision.

Deploy the matching Track and bot changes together and configure the same
secret. Old raw-ID links and the old `{ discordId }` endpoint contract are
intentionally rejected. Generate a new link after rollout. No command
registration changes are needed.

## Testing

The authoritative local two-service and controlled deployed verification
procedures are in [`E2E_TESTING.md`](./E2E_TESTING.md#discord-verification).
This document defines the protocol and configuration; it does not maintain a
second test checklist.
