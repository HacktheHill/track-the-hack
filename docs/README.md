# Documentation map

This index points to the current user, development, architecture, and operations
documentation. Each subject should have one primary page rather than several copies of
the same procedure.

## Start here

- [`../README.md`](../README.md): product overview, local start, deployment summary,
  and links to release-critical runbooks.
- [`DEVELOPMENT.md`](./DEVELOPMENT.md): configuration, commands, repository layout,
  quality gates, and the definition of a documented change.
- [`USER_GUIDE.md`](./USER_GUIDE.md): English and French participant and organiser
  journeys for every rendered route.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md): data ownership, trust boundaries,
  authorisation, lifecycle, privacy, and database design.
- [`SECURITY.md`](./SECURITY.md): browser protections, credentials, threat boundaries,
  and security verification.
- [`ui-consistency.md`](./ui-consistency.md): Canadian English and French-Canadian
  language rules, shared UI primitives, contrast, and accessibility verification.
- [`E2E_TESTING.md`](./E2E_TESTING.md): automated, browser, device, integration, and
  production acceptance matrix.
- [`ORGANISER_ACCESS.md`](./ORGANISER_ACCESS.md): organiser sign-in, access grants,
  roles, and acceptance checks.

## Feature and operations coverage

| Area                                                  | Authoritative documentation                                                                                                              |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Participant provisioning, RSVP, claim, pass, sessions | [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`RSVP_EMAIL_RUNBOOK.md`](./RSVP_EMAIL_RUNBOOK.md), [`E2E_TESTING.md`](./E2E_TESTING.md)         |
| Google Sheets adapter                                 | [`../integrations/google-sheets/README.md`](../integrations/google-sheets/README.md), [`E2E_TESTING.md`](./E2E_TESTING.md)               |
| Schedule, event interests, reminders                  | [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`SCHEDULE_IMPORT.md`](./SCHEDULE_IMPORT.md), [`PUSH_NOTIFICATIONS.md`](./PUSH_NOTIFICATIONS.md) |
| QR and physical scanning                              | [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`E2E_TESTING.md`](./E2E_TESTING.md), [`AUDIT_LOGS.md`](./AUDIT_LOGS.md)                         |
| Offline and installable app behaviour                 | [`OFFLINE_ACCEPTANCE.md`](./OFFLINE_ACCEPTANCE.md), [`ARCHITECTURE.md`](./ARCHITECTURE.md)                                               |
| Discord verification                                  | [`DISCORD_VERIFICATION.md`](./DISCORD_VERIFICATION.md), [`E2E_TESTING.md`](./E2E_TESTING.md)                                             |
| Web Push and Discord notifications                    | [`NOTIFICATIONS.md`](./NOTIFICATIONS.md), [`PUSH_NOTIFICATIONS.md`](./PUSH_NOTIFICATIONS.md)                                             |
| Hardware Desk                                         | [`HARDWARE_IMPORT.md`](./HARDWARE_IMPORT.md), [`E2E_TESTING.md`](./E2E_TESTING.md)                                                       |
| Latte Lab                                             | [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`E2E_TESTING.md`](./E2E_TESTING.md)                                                             |
| Events editor and schedule import                     | [`SCHEDULE_IMPORT.md`](./SCHEDULE_IMPORT.md), [`USER_GUIDE.md`](./USER_GUIDE.md)                                                         |
| Organiser access and roles                            | [`ORGANISER_ACCESS.md`](./ORGANISER_ACCESS.md), [`ARCHITECTURE.md`](./ARCHITECTURE.md)                                                   |
| Metrics                                               | [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`USER_GUIDE.md`](./USER_GUIDE.md)                                                               |
| Audit ledger and retention                            | [`AUDIT_LOGS.md`](./AUDIT_LOGS.md), [`AUDIT_ACCEPTANCE.md`](./AUDIT_ACCEPTANCE.md)                                                       |
| Security and credential handling                      | [`SECURITY.md`](./SECURITY.md), [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`E2E_TESTING.md`](./E2E_TESTING.md)                             |
| Build, deployment, health and rollback                | [`../README.md`](../README.md), [`DEVELOPMENT.md`](./DEVELOPMENT.md), [`E2E_TESTING.md`](./E2E_TESTING.md)                               |
| Visual language, components and localization          | [`ui-consistency.md`](./ui-consistency.md), [`USER_GUIDE.md`](./USER_GUIDE.md)                                                           |

## Keeping documentation useful

Update documentation when a change affects a user journey, public or integration
contract, environment variable, operational command, data boundary, or release check.
Internal refactors do not need narrative documentation. Prefer one authoritative page
and links to it over repeating the same procedure in several runbooks.
