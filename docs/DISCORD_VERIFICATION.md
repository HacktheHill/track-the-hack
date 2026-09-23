# Discord verification

Participants activate their day-of access in a browser, generate a personal link
using `/verify` or **Generate Verification Link** in Discord, and press **Verify
Discord account** at `/discord`. English and French are supported. Organizer
sign-in alone cannot verify a participant.

## Ownership and protocol

- The bot creates a random 32-byte reference and stores only its SHA-256 digest,
  the Discord ID, and expiry in its own PostgreSQL database. It sends the
  participant a private five-minute link: `/discord#v1.REFERENCE.EXPIRES.SIGNATURE`.
- The HMAC-SHA256 link signature covers `discord-link:v1.REFERENCE.EXPIRES`.
  `EXPIRES` is Unix seconds. Both services validate the signature and expiry.
  Neither the page GET nor a link preview consumes or completes verification.
- The browser posts only `{ token }` to `/api/discord/verify`. Track checks the
  active, unexpired, non-revoked participant session and takes `Hacker.id` from
  that session. Extra identity fields and cross-origin browser requests fail.
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
  switch accounts; a conflict needs organizer assistance. There is no automatic
  reassignment or role revocation in this flow.
- Track stores no Discord IDs, usernames, mappings, or team data. It does not
  log proofs or pass through bot error details. The proof stays in the URL
  fragment until success, which removes it from browser history. It is a private
  bearer capability: participants must not share their links.

The page is static translated copy; authorization happens on the POST. Its
cached HTML contains no participant or proof data, and `/api/*` uses the
existing service worker NetworkOnly rule. There is no pre-event participant
login or restoration of participant User/OAuth/HACKER roles in Track. The
Discord Hacker role and Discord-owned teams remain separate.

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
requires a separate organizer decision.

Deploy the matching Track and bot changes together and configure the same
secret. Old raw-ID links and the old `{ discordId }` endpoint contract are
intentionally rejected. Generate a new link after rollout. No command
registration changes are needed.

## Local integration test

Keep the bot checkout next to Track, or set `DISCORD_BOT_REPO` to its path.
With Node 24, Docker, and Chromium installed:

```sh
# In track-the-hack-bot
npm ci
npm run build

# In track-the-hack
npm run test:e2e:discord
```

This test requires the matching bot checkout, including its
`test/fixtures/verification-server.mjs`. It uses the production bot router,
proof generator, and mapping store; the Discord role call is a local double.
It creates a disposable PostgreSQL container, runs Track on a private local
port with the real MySQL/session flow, drives EN/FR browser verification,
checks invalid/expired links, wrong signatures, absent/forged/revoked/expired
sessions, organizer-only access, binding conflicts, races, failure/retry, and
log privacy. It removes its container and test participants afterward.
Screenshots go in ignored `artifacts/discord-verification/`.

`npm test`, `npm run typecheck`, and `npm run lint` remain the Track regression
checks; run `npm test` in the bot too. The separate Discord E2E command requires
the bot checkout and is therefore not part of the single-repository
`verify:dev` command. It does not validate live Discord permissions or deploy
either service.
