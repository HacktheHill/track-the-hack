# Track the Hack

Track the Hack is a comprehensive event management solution designed to streamline hackathon organisation. This software is developed by and for [Hack the Hill](https://hackthehill.com), Ottawa's largest hackathon.

## Getting Started

Use Node 24 and Docker, then run:

```sh
npm install
npm run dev:setup
npm run dev
```

Open `http://localhost:3000`. The setup command creates or completes the ignored
`.env`, starts and waits for MySQL, deploys migrations, and idempotently seeds a
local organiser plus deterministic participant/event fixtures. It never replaces
a non-empty environment value, and refuses to migrate or seed anything except
the local `track-the-hack` MySQL database.

Choose **Sign in as local organiser** on the sign-in page to reach `/qr` and
`/metrics`. That passwordless provider is opt-in and accepts only when the
configured URL, request host, and network peer are all loopback; Google remains
available on LAN and deployed instances, together with emailed sign-in links for
addresses on the organiser access list.

Run the complete credential-free development verification with:

```sh
npm run verify:dev
```

It runs the unit/type/lint checks plus selected end-to-end coverage for the real
MySQL and HTTP lifecycle, local organiser session, browser scanner UI, captured
SMTP email links, and production-build service-worker/offline behaviour. The
scanner E2E uses its normal manual-input fallback; camera decoding is not part of
the dev gate. Provider SDK details stay focused tests. Set `CHROMIUM_PATH` only
when Chromium is not installed in a common system location.

See [`docs/E2E_TESTING.md`](./docs/E2E_TESTING.md) for the authoritative automated,
browser, physical-device, external-integration, and production acceptance process.

The current data ownership, authorisation boundaries, participant lifecycle, scanner
semantics, and offline privacy model are documented in
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

The production Google Sheets adapter is versioned in
[`integrations/google-sheets`](./integrations/google-sheets). Its three required
deployment properties and live menu workflow are documented there.

The production schedule CSV, dry-run and apply commands, overwrite behaviour, and
post-import checks are documented in
[`docs/SCHEDULE_IMPORT.md`](./docs/SCHEDULE_IMPORT.md).

Discord verification requires both an active participant session and a positive
check-in scan, then uses signed personal links from the separate bot. Protocol,
configuration, and bot-owned identity storage are in
[`docs/DISCORD_VERIFICATION.md`](./docs/DISCORD_VERIFICATION.md);
all local and deployed verification procedures are in
[`docs/E2E_TESTING.md`](./docs/E2E_TESTING.md#discord-verification).

## Self-host the database

`npm run dev:setup` is the supported local path. For manual control, run
`docker compose up -d --wait`, `npx prisma migrate deploy`, and
`npx prisma db seed` in that order.

## Azure Container Apps deployment

The `container.yml` workflow deploys only from `main` through the `Production`
environment. Configure `AZURE_RESOURCE_GROUP` and `AZURE_ACR_LOGIN_SERVER` as
environment variables, plus `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and
`AZURE_SUBSCRIPTION_ID` as environment secrets for OIDC login. The resource
group, registry, web app, Prisma Studio app, and `track-the-hack-migrate` job
must already exist. The workflow updates and runs the migration job first,
waits for success, then promotes the web and Prisma Studio images and reapplies
the health probes. Roll back by redeploying a previously built image only after
confirming its code remains compatible with the migrated schema; migrations are
not automatically reversed.

The web app also requires `EMAIL_SERVER_HOST`, `EMAIL_SERVER_PORT`,
`EMAIL_SERVER_USER`, `EMAIL_SERVER_PASSWORD`, and `EMAIL_FROM` for organiser
magic links. Configure them as Container App secret references before promoting
this version; do not put SMTP credentials in GitHub variables or the image.

### Database lifecycle

The Phase 1 redesign started from an empty current-schema database. Decisions to
retain or delete records from deployments that predate that baseline remain an
external data-owner and infrastructure responsibility. Do not run the Phase 1
baseline over a legacy database.

After that baseline exists, keep the database and apply the versioned Prisma
migrations during each deployment. A normal application release does not reset
production data. Any future reset is a separate, explicitly approved cutover
operation with its own retention and rollback plan.

Participant RSVP mail follows [`docs/RSVP_EMAIL_RUNBOOK.md`](./docs/RSVP_EMAIL_RUNBOOK.md),
while the complete one-recipient acceptance journey is in
[`docs/E2E_TESTING.md`](./docs/E2E_TESTING.md#google-sheets-and-real-email-acceptance).
Development exercises the same link contract through a credential-free loopback SMTP
sink but never sends externally.

## Contributing

We appreciate your interest, but please note that we currently do not accept external contributions.

If you're part of the Hack the Hill team, refer to our [Contribution guidelines](https://github.com/HacktheHill/.github/blob/main/CONTRIBUTING.md).

## Contact

For inquiries, please contact us at [development@ctn-rtc.org](mailto:development@ctn-rtc.org).

Copyright © 2023 Hack the Hill. All Rights Reserved.
