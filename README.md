# Track the Hack

Track the Hack manages Hack the Hill’s public schedule and day-of participant
operations, including RSVP, passes, scanning, hardware loans, Latte Lab, reminders,
and aggregate metrics.

The documentation index is in [`docs/README.md`](./docs/README.md).

## Local development

Use Node 24 and Docker:

```sh
npm install
npm run dev:setup
npm run dev
```

Open `http://localhost:3000`. `dev:setup` creates missing local configuration, starts
the loopback MySQL service, applies migrations, and seeds deterministic fixtures. It
refuses non-loopback or unexpected database targets and does not overwrite existing
environment values.

Choose **Sign in as local organiser** for development-only organiser access. That
provider works only when the flag, configured URL, request host, and network peer are
all local.

Before handoff, run:

```sh
npm run verify:dev
git diff --check
```

Use [`docs/E2E_TESTING.md`](./docs/E2E_TESTING.md) to select any additional check that
matches the changed feature. Do not run unrelated physical-device or provider tests by
default.

## System boundaries

- Tally and the restricted Google Sheet own participant identity and application data.
- Track stores pseudonymous operational records and aggregate state.
- Discord owns Discord identity and team membership.
- Participant links and sessions never grant organiser access.
- Cloudflare Access remains enabled during private testing.

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the complete data and
authorization model and [`docs/SECURITY.md`](./docs/SECURITY.md) for security controls.

## Common operations

| Task                                     | Documentation                                                    |
| ---------------------------------------- | ---------------------------------------------------------------- |
| Schedule import                          | [`docs/SCHEDULE_IMPORT.md`](./docs/SCHEDULE_IMPORT.md)           |
| Hardware import                          | [`docs/HARDWARE_IMPORT.md`](./docs/HARDWARE_IMPORT.md)           |
| RSVP recipient preparation               | [`docs/RSVP_EMAIL_RUNBOOK.md`](./docs/RSVP_EMAIL_RUNBOOK.md)     |
| Discord verification                     | [`docs/DISCORD_VERIFICATION.md`](./docs/DISCORD_VERIFICATION.md) |
| Organiser access                         | [`docs/ORGANISER_ACCESS.md`](./docs/ORGANISER_ACCESS.md)         |
| Notifications                            | [`docs/NOTIFICATIONS.md`](./docs/NOTIFICATIONS.md)               |
| Audit records and legacy-log retirement  | [`docs/AUDIT_LOGS.md`](./docs/AUDIT_LOGS.md)                     |
| Audit end-to-end acceptance and closeout | [`docs/AUDIT_ACCEPTANCE.md`](./docs/AUDIT_ACCEPTANCE.md)         |
| Offline behaviour                        | [`docs/OFFLINE_ACCEPTANCE.md`](./docs/OFFLINE_ACCEPTANCE.md)     |

## Deployment

The `container.yml` workflow validates images on pushes and pull requests. Production
deployment is an explicit dispatch of `main` through the protected environment:

```sh
gh workflow run container.yml --ref main
```

The workflow runs the migration job before promoting the web revision. A successful
image build is not a deployment. Roll back only to an image compatible with the
already-applied additive migrations.

Production changes that send messages, write external systems, alter real participant
state, or delete data require a separate review of the exact target and action.

## Contributing

This repository does not currently accept external contributions. Hack the Hill team
members should use the organisation’s contribution guidelines.

Questions: [development@ctn-rtc.org](mailto:development@ctn-rtc.org)

Copyright © 2023 Hack the Hill.
