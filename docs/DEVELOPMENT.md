# Development reference

This document describes the current repository and its local commands. Safety- and
release-critical procedures remain in the runbooks linked from
[`README.md`](./README.md).

## Repository layout

- `src/pages`: Pages Router screens and HTTP API routes.
- `src/components`: shared rendered UI and scanner/schedule controls.
- `src/client`: browser-side data and presentation helpers.
- `src/server`: authentication, HTTP boundaries, tRPC routers, repositories, and
  domain services.
- `src/styles`: shared design tokens and UI primitives.
- `public/locales/en` and `public/locales/fr`: paired user-facing translations.
- `prisma`: current schema, additive migrations, and deterministic local seed data.
- `integrations/google-sheets`: versioned bound Apps Script integration.
- `scripts`: guarded imports, provisioning, development fixtures, retention, and E2E
  drivers.
- `test`: Node test-runner suites; MySQL suites skip when the disposable local
  database is not available.
- `.github/workflows`: validation, dependency review, organiser provisioning, image
  build, migration, and deployment automation.

## Configuration

`.env.example` is the complete variable list. `src/env/schema.mjs` is the executable
contract; both must change together.

| Variable                                                                                             | Purpose                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `MYSQL_ROOT_PASSWORD`                                                                                | Password used only by the local Docker MySQL service.                                                                                         |
| `DATABASE_URL`                                                                                       | MySQL connection. Local setup refuses a non-loopback host or a database other than `track-the-hack`.                                          |
| `NEXTAUTH_SECRET`                                                                                    | Signs NextAuth data. Use an independent secret of at least 32 random bytes.                                                                   |
| `NEXTAUTH_URL`                                                                                       | Canonical application origin used for authentication and participant links.                                                                   |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                                           | Google Workspace organiser OAuth credentials. Empty local values disable a usable Google flow.                                                |
| `EMAIL_SERVER_HOST`, `EMAIL_SERVER_PORT`, `EMAIL_SERVER_USER`, `EMAIL_SERVER_PASSWORD`, `EMAIL_FROM` | SMTP transport for allowed-email organiser magic links.                                                                                       |
| `DEV_AUTH_ENABLED`                                                                                   | Enables the fixed local organiser only when the request and configured origin are loopback. Never enable it as a production access mechanism. |
| `SHEETS_INTEGRATION_API_KEY`                                                                         | Authenticates the bounded Google Sheets integration API.                                                                                      |
| `CANCELLATION_TOKEN_SECRET`                                                                          | Signs legacy RSVP cancellation capabilities.                                                                                                  |
| `CLAIM_TOKEN_SECRET`                                                                                 | Signs participant claim capabilities.                                                                                                         |
| `PARTICIPANT_SESSION_SECRET`                                                                         | Protects opaque participant sessions.                                                                                                         |
| `DISCORD_BOT_URL`, `INTERNAL_API_SECRET`                                                             | Optional signed Track-to-bot verification and notification channel. Both are required to enable it.                                           |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`                                                                       | Build-time browser Web Push public key. It must equal `VAPID_PUBLIC_KEY`.                                                                     |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`                                               | Optional server Web Push identity. Configure the complete matching set or leave it disabled.                                                  |

Never commit `.env`, generated secrets, participant links, provider identifiers, or
production database credentials. `npm run dev:setup` fills only blank local secret
values and does not replace an existing value.

## HTTP and application API surface

| Route                                                  | Contract                                                                                                                                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/auth/*`                                          | NextAuth organiser sign-in, callback, session, and sign-out endpoints.                                                                                                                                  |
| `POST /api/claim`                                      | Redeems a one-time fragment claim into an opaque participant session.                                                                                                                                   |
| `GET`, `POST /api/discord/verify`                      | Reads eligibility or completes a same-origin Discord link for the active, checked-in participant.                                                                                                       |
| `GET /api/healthz`                                     | Process liveness only; it does not prove database readiness.                                                                                                                                            |
| `GET /api/readyz`                                      | Database-backed readiness check used by deployment probes.                                                                                                                                              |
| `POST /api/integrations/sheets/hackers`                | API-key and optional Access-token protected minimal participant provisioning.                                                                                                                           |
| `POST /api/integrations/sheets/claim`                  | Protected provisioning plus one-time claim issuance.                                                                                                                                                    |
| `POST /api/integrations/sheets/rsvp-reconciliation`    | Protected bounded read of current RSVP states and links.                                                                                                                                                |
| `POST /api/integrations/sheets/dietary-reconciliation` | Protected update of coarse meal categories for existing participant IDs.                                                                                                                                |
| `POST /api/participant/sign-out`                       | Revokes the current participant session and clears its cookies.                                                                                                                                         |
| `GET`, `POST /api/push/register`                       | Reads Web Push availability; the POST body registers or removes the current browser endpoint.                                                                                                           |
| `POST /api/rsvp/manage`                                | Reads or changes RSVP state using the reusable fragment capability.                                                                                                                                     |
| `POST /api/rsvp/cancel`                                | Legacy signed cancellation path.                                                                                                                                                                        |
| `/api/rsvp/[id]`                                       | Retired ID-only RSVP endpoint; always returns `410 Gone`.                                                                                                                                               |
| `/api/trpc/*`                                          | Typed public, participant, organiser, and administrator procedures for events, scanning, users, metrics, Hardware Desk, Latte Lab, and notifications. Each procedure enforces its own context boundary. |

All participant capabilities belong in URL fragments or JSON request bodies, never
query strings. Personalized and mutation responses are non-cacheable. A new API route
must document its methods, caller, authentication, input/output allowlist, caching,
external side effects, and tests here or in a linked feature runbook.

## Commands

| Command                                            | Behaviour and safety boundary                                                                                                            |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                                      | Starts Next.js on `127.0.0.1`; it does not prepare the database.                                                                         |
| `npm run dev:setup`                                | Verifies the exact local database target, starts Docker MySQL, deploys migrations, and idempotently seeds fixtures.                      |
| `npm run dev:participant -- <command>`             | Exercises local Tally/Sheet, RSVP, claim, and email fixtures; see its usage output and `E2E_TESTING.md`.                                 |
| `npm run preview`                                  | Builds the production bundle and serves it on `127.0.0.1`; prepare the database separately.                                              |
| `npm run start`                                    | Serves an existing production build using Next.js defaults. Prefer `preview` for loopback-only local review.                             |
| `npm test`                                         | Runs fast Node tests. Skipped MySQL tests are not passes.                                                                                |
| `npm run typecheck`                                | Runs TypeScript plus Prisma migration-name and Apps Script checks.                                                                       |
| `npm run lint`                                     | Runs ESLint over application, Prisma, script, test, and integration code.                                                                |
| `npm run build`                                    | Builds the production PWA with Webpack. Generated service-worker files are build artefacts.                                              |
| `npm run format`                                   | Rewrites the repository with Prettier. Review the complete diff and preserve unrelated work before retaining its changes.                |
| `npm run verify:dev`                               | Runs tests, types, lint, and the local MySQL/HTTP browser lifecycle.                                                                     |
| `npm run test:e2e:dev`                             | Runs the disposable local database, SMTP, organiser, participant, and scanner lifecycle.                                                 |
| `npm run test:e2e:pwa`                             | Builds and verifies supported online/offline navigation and pass behaviour.                                                              |
| `npm run test:e2e:scanner`                         | Checks the organiser scanner at a narrow phone and desktop width in both locales. Requires a prepared local server.                      |
| `npm run test:e2e:discord`                         | Exercises Track and the adjacent bot protocol without contacting Discord.                                                                |
| `npm run check:commits`                            | Rejects merge commits and non-conventional commit subjects in the configured range.                                                      |
| `npm run organizer:provision -- <email> [--admin]` | Changes organiser access. Use only against a reviewed target; administrators must use CTN email.                                         |
| `npm run rsvp:prepare -- ...`                      | Produces a private recipient CSV; it does not send email. Follow `RSVP_EMAIL_RUNBOOK.md`.                                                |
| `npm run schedule:import -- <csv> [--apply]`       | Dry-runs by default. `--apply` writes the reviewed schedule; follow `SCHEDULE_IMPORT.md`.                                                |
| `npm run hardware:import -- <csv> [--apply]`       | Dry-runs by default. `--apply` writes the initial inventory; follow `HARDWARE_IMPORT.md`.                                                |
| `npm run hardware:reconcile [-- --apply]`          | Inspects by default. Apply only after review and authorisation.                                                                          |
| `npm run audit:purge`                              | Deletes audit events older than the retention cutoff. Production execution is handled by its scheduled job; see `AUDIT_LOGS.md`.          |
| `postinstall`                                      | Regenerates Prisma Client after dependency installation; do not run it as a deployment substitute for migrations.                        |

## UI and localization completion

Use the shared classes in `src/styles/globals.css`; do not introduce a one-off button
or field when a documented primitive fits. Every rendered string must live in matching
English and French namespaces. English follows British-Canadian spelling; French is
idiomatic Canadian French. Keep interpolation keys and semantic meaning aligned.

For a UI change, check a narrow phone and desktop, both locales when text or layout is
affected, keyboard focus, and the states changed by the work. Use the scanner browser
check for scanner layout. Text and meaningful control boundaries require WCAG 2.2 AA
contrast.

## Pull request and release gate

Use conventional commits, do not add merge commits, rebase before landing, and keep
unrelated working-tree changes intact. Before handoff, run the strongest applicable
gate and list every skipped check with its reason. A green image build is not a
deployment; a successful deployment is not authorisation to send email, push, or
Discord messages, mutate a production Sheet, or run a destructive database action.
