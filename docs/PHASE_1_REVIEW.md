# Phase 1 remaining work

Last audited: 2026-08-22

This file contains only unfinished Phase 1 work. Completed implementation, resolved defects, and passed verification have been removed.

The authoritative contracts remain:

- [`PROPOSED_FLOW.md`](./PROPOSED_FLOW.md)
- [`PHASE_1_INTEGRATIONS.md`](./PHASE_1_INTEGRATIONS.md)

## Publish PR #202

The local branch is ready, but the remote PR still points to the old pre-rebase head.

- [ ] Review the final local diff and push the rewritten branch using `--force-with-lease`.
- [ ] Confirm the new remote PR diff is conflict-free, contains only the create-only migration baseline, and includes the cancellation-URL correction.
- [ ] Replace the PR body, which currently contains only `draft`, with the Phase 1 scope, clean-database boundary, risks, and verification summary.
- [ ] Let GitHub rerun its checks against the rebased head and investigate any new failure.
- [ ] Mark the PR ready once its checks pass.
- [ ] Obtain substantive human review.

## Deployment verification

These checks require real credentials or a deployed environment.

- [ ] Verify real organizer Google sign-in in staging with production-like OAuth configuration.
- [ ] Exercise RSVP confirmation and cancellation pages in a browser against the deployed backend.
- [ ] Confirm reconciliation returns correct absolute cancellation links for the deployed public URL.
- [ ] Confirm production secrets are independent and configured only in their intended server-side boundaries.
