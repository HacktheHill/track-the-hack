# Web Push transport

This page documents transport-specific behaviour. Participant preferences, Discord,
campaigns, and operator steps are in [`NOTIFICATIONS.md`](./NOTIFICATIONS.md).

## Configuration

Generate a VAPID pair with `npx web-push generate-vapid-keys` and set:

- `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` on the server;
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` to the same public key before building; and
- `VAPID_EMAIL` to the contact address, or leave its documented default.

Missing, invalid, or mismatched keys disable push. Keep the private key server-side and
preserve the pair across deployments.

Registration accepts allow-listed HTTPS push providers, canonical P-256 keys, and a
two-letter locale. Each event accepts at most 5,000 distinct endpoints. The server
rejects private or arbitrary destinations.

## Delivery

The Node process checks due events once per minute. MySQL leases prevent overlapping
workers from completing the same event, and expired leases allow recovery after a
restart. Provider requests have bounded timeouts. Successful or expired subscriptions
are removed; temporary failures remain for retry.

Delivery is at least once. A crash after a provider accepts a request but before MySQL
records success can cause a retry. The stable notification tag lets the browser replace
an earlier notification for the same event.

Moving a visible event to a future time reopens reminders. Hiding it closes new
registration. Existing in-flight provider requests cannot be recalled.

The custom push listener in `worker/index.js` is bundled into the generated service
worker. Generated worker files are build artefacts and are not committed.

## Verification

Focused tests cover endpoint restrictions, key validation, caps, leases, recovery,
timeouts, rescheduling, hidden events, and browser state. MySQL concurrency tests use
`PUSH_TEST_DATABASE_URL`, which must be a disposable loopback database whose name
contains `test` or `review`.
