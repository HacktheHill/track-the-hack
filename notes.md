# Track the Hack Notes

Local notes from a codebase pass on 2026-06-12. This file is intentionally ignored by git.

## Project Shape

- Next.js 14 Pages Router app written in TypeScript and React.
- Backend API is tRPC v10 under `src/server/api`, exposed through `src/pages/api/trpc/[trpc].ts`.
- Database layer is Prisma with a MySQL datasource in `prisma/schema.prisma`.
- Auth is NextAuth v4 with Prisma adapter, JWT sessions, and Discord, GitHub, Google, email, and credentials providers.
- Styling uses Tailwind CSS with custom Hack the Hill colors, gradients, fonts, and responsive breakpoints in `tailwind.config.mjs`.
- Localization uses `next-i18next` with English and French JSON namespaces in `public/locales`.
- PWA support is configured through `next-pwa`, with generated service worker files ignored.

## Top-Level Structure

- `src/pages`: route components and API routes. User-facing pages include home, schedule, maps, resources, sponsors, QR, confirm, profile, auth, apply, hackers, metrics, internal admin pages, and unsubscribe.
- `src/components`: shared layout and UI components. `App` wraps pages with `Head`, `Navbar`, `BottomMenu`, and the page `main`; form controls for applications live in `src/components/apply`.
- `src/server/api/routers`: tRPC routers for users, hackers, events, presence, teams, metrics, QR, audit logs, and sponsorship Gmail drafts.
- `src/server/lib`: server-side integrations and helpers for email, Gmail drafts, S3 presigned URLs, audit logging, redirects, and application questions.
- `src/client`: browser-only helpers for S3 uploads, QR/sound behavior, sponsor data, and client types.
- `src/utils`: shared schemas and utilities, including the core Zod application schemas and role helpers.
- `prisma`: schema, migrations, and seeders.
- `public`: static assets, fonts, PWA icons, maps, markdown resources, school list, and locale files.
- `.github`: self-hosted production deploy workflow and Dependabot config.

## Main Features

- Event schedule: public schedule pages load events through `trpc.events` and group/filter by date and event type.
- Authentication: sign-in/sign-up pages use NextAuth providers; the session callback enriches the session with `user.id`, roles, and `hackerId`.
- Application flow: application questions are generated from `src/server/lib/apply.ts`; validation is split into page-level Zod schemas plus a combined `hackerSchema` in `src/utils/common.ts`; form data is cached in local storage; resumes upload through a presigned S3 URL after submission.
- Hacker management: organizers/mayors/premiers can browse, filter, inspect, update, and paginate hackers through `hackers` routes and pages.
- Confirmation flow: accepted hackers can confirm attendance, sign waivers with a canvas signature, create or join teams, and upload signatures to S3.
- QR flow: hackers can display time-limited encrypted QR codes; organizers can scan QR codes and update event presence/check-ins.
- Metrics: metrics page displays aggregate applicant/attendance demographics with Recharts.
- Internal tools: role management, walk-in codes, and sponsorship Gmail draft generation.
- Email: localized application confirmation email is sent through Nodemailer and `i18next-fs-backend`.
- Audit logging: several mutations call the shared `log` helper to persist action details.

## Development Patterns

- API routers are composed manually in `src/server/api/root.ts`.
- tRPC procedures use `publicProcedure` for public endpoints and `protectedProcedure` for authenticated endpoints.
- Authorization is usually implemented inside protected procedures by loading the current user and checking roles with `hasRoles`.
- Prisma is normally accessed through `ctx.prisma` from the tRPC context or the shared `prisma` singleton in `src/server/db.ts`.
- Pages that need auth/roles commonly use `getServerSideProps`, `getServerSession`, and redirect helpers from `src/server/lib/redirects.ts`.
- Public/static pages typically use `getStaticProps` plus `serverSideTranslations`.
- UI access control is also used client-side with the `Filter` component, which conditionally renders children based on session roles.
- Display strings are mostly translation keys; application question metadata generates label/option keys instead of hard-coded display copy.
- Form validation relies on Zod schemas and `zod-i18n-map`.
- The codebase uses strict TypeScript settings, including `noUncheckedIndexedAccess`.
- Formatting is Prettier with the Tailwind plugin. Linting is `next lint` plus `@typescript-eslint`.

## Local Development

- Install dependencies with `npm install`.
- Start the app with `npm run dev`.
- Build with `npm run build`.
- Lint with `npm run lint`.
- Format with `npm run format`.
- Local database support is in `docker-compose.yml`; start MySQL with `docker compose up -d`.
- README suggests `npx prisma db push` and `npx prisma db seed` for local setup.
- Prisma seed command is configured as `npx tsx prisma/seeders/index.mts`.

## Deployment

- `.github/workflows/node.js.yml` runs on pushes to `main` and manually.
- The workflow uses a self-hosted runner, installs with `npm ci`, creates `.env`, builds, rsyncs to `/home/azure/track-the-hack/`, runs `npx prisma migrate deploy`, and reloads PM2.
- Dependabot is configured only for GitHub Actions updates.

## Room For Improvement

- There are no test/spec files and no `npm test` script. This is the biggest coverage gap because the app has role-gated mutations, auth callbacks, application validation, QR expiry logic, S3 upload rollback paths, and confirmation flows.
- `.github/workflows/create-env.mjs` prints the full `secrets` object to CI logs. Even if GitHub masks some values, the helper should not log secrets.
- `src/server/lib/s3.ts` logs generated presigned URLs. Those URLs are bearer-style temporary access and should not be written to logs.
- `src/server/api/routers/qr.ts` logs encrypted QR payload input during decrypt. Remove the log before production use.
- Some server modules create their own `new PrismaClient()` instead of using the shared singleton/context, including `src/server/lib/redirects.ts`, `src/server/api/routers/teams.ts`, and `src/server/api/routers/auditLog.ts`. Consolidating on the shared client would reduce connection churn and make testing easier.
- `metrics.getMetrics` is a `publicProcedure` even though the metrics page has a server-side role redirect. If the underlying data should be restricted, the procedure should also enforce roles.
- `teams.create` is a `publicProcedure` and accepts an arbitrary `hackerId`. If team creation should only be done by the signed-in hacker or an organizer, enforce that at the procedure level.
- `hackers.apply` has a hard-coded application deadline string (`2024-09-31T00:00:00.000Z`) and the apply page currently redirects to `/`. Move event-year dates/feature flags into configuration or database state.
- Authorization checks are repeated across many procedures. A small role-aware tRPC middleware or helper procedure would make protected routes less error-prone.
- `src/server/api/routers/auditLog.ts` has a missing semicolon and logs created audit entries to stdout; it also bypasses `ctx.prisma`.
