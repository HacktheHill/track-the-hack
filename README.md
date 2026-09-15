# Track the Hack

Track the Hack is a comprehensive event management solution designed to streamline hackathon organization. This software is developed by and for [Hack the Hill](https://hackthehill.com), Ottawa's largest hackathon.

## Getting Started

Use Node 24 and Docker, then run:

```sh
npm install
npm run dev:setup
npm run dev
```

Open `http://localhost:3000`. The setup command creates or completes the ignored
`.env`, starts and waits for MySQL, deploys migrations, and idempotently seeds a
local organizer plus deterministic participant/event fixtures. It never replaces
a non-empty environment value, and refuses to migrate or seed anything except
the local `track-the-hack` MySQL database.

Choose **Sign in as local organizer** on the sign-in page to reach `/qr` and
`/metrics`. That passwordless provider is opt-in and accepts only when the
configured URL, request host, and network peer are all loopback; Google remains
the only organizer provider on LAN or deployed instances.

Run the complete credential-free development verification with:

```sh
npm run verify:dev
```

It runs the unit/type/lint checks plus selected end-to-end coverage for the real
MySQL and HTTP lifecycle, local organizer session, browser scanner UI, captured
SMTP email links, and production-build service-worker/offline behavior. The
scanner E2E uses its normal manual-input fallback; camera decoding is not part of
the dev gate. Provider SDK details stay focused tests. Set `CHROMIUM_PATH` only
when Chromium is not installed in a common system location.

See [`docs/DEV_E2E.md`](./docs/DEV_E2E.md) for the fixtures, local email artifacts,
manual browser path, and the individual faster test commands.

The production Google Sheets adapter is versioned in
[`integrations/google-sheets`](./integrations/google-sheets). Its three required
deployment properties and live menu workflow are documented there.

Discord verification uses the active participant session and signed personal
links from the separate bot. Setup, bot-owned identity storage, and the local
two-service test are in [`docs/DISCORD_VERIFICATION.md`](./docs/DISCORD_VERIFICATION.md).

## Self-host the database

`npm run dev:setup` is the supported local path. For manual control, run
`docker compose up -d --wait`, `npx prisma migrate deploy`, and
`npx prisma db seed` in that order.

## Azure Container Apps deployment

The `container.yml` workflow deploys only from `main` through the `Production`
environment. Configure `AZURE_RESOURCE_GROUP` and `AZURE_ACR_LOGIN_SERVER` in
that GitHub environment. The workflow runs the migration job first, waits for a
successful execution, and only then promotes the web and Prisma Studio images.
Participant RSVP mail is owned by the external bulk-email deployment contract in
[`docs/PHASE_1_INTEGRATIONS.md`](./docs/PHASE_1_INTEGRATIONS.md). Development
exercises the same link contract through a credential-free loopback SMTP sink.

## Contributing

We appreciate your interest, but please note that we currently do not accept external contributions.

If you're part of the Hack the Hill team, refer to our [Contribution guidelines](https://github.com/HacktheHill/.github/blob/main/CONTRIBUTING.md).

## Contact

For inquiries, please contact us at [development@ctn-rtc.org](mailto:development@ctn-rtc.org).

Copyright © 2023 Hack the Hill. All Rights Reserved.
