# Phase 1 remaining work

Last audited: 2026-09-22

This file contains only unfinished Phase 1 work. Completed implementation, resolved defects, and passed verification have been removed.

The authoritative contracts remain:

- [`PROPOSED_FLOW.md`](./PROPOSED_FLOW.md)
- [`PHASE_1_INTEGRATIONS.md`](./PHASE_1_INTEGRATIONS.md)

## Deployment verification

These checks require real credentials or a deployed environment.

- [ ] Verify real organizer Google sign-in in staging with production-like OAuth configuration.
- [ ] Exercise RSVP confirmation and cancellation pages in a browser against the deployed backend.
- [ ] Confirm reconciliation returns correct absolute cancellation links for the deployed public URL.
- [ ] Confirm production secrets are independent and configured only in their intended server-side boundaries.
