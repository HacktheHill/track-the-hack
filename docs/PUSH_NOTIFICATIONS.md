# Event reminders

Generate a VAPID key pair with `npx web-push generate-vapid-keys`. Set
`VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` on the server and set
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` to that same public key **before building** the
browser bundle. `VAPID_EMAIL` is optional and defaults to hello@hackthehill.com.
Blank keys disable push. Missing, invalid, or mismatched keys make the readiness
endpoint unavailable and registration fails rather than promising a reminder.
Keep the private key server-side and preserve the pair across deployments.

Run `prisma migrate deploy` before starting the application. The existing Docker
`npm start` / `next start` deployment starts the reminder scheduler from Next.js
instrumentation, immediately and once per minute, without waiting for an API
request. The hook is not run during production builds. This scheduler requires a
continuously running Node server; a deployment using short-lived serverless
functions would need a separately scheduled worker.

Each due event is claimed atomically in MySQL for two minutes using the database
clock. Workers renew ownership before each batch of at most ten concurrent sends. Fast
providers can drain multiple batches in a tick; each event has a shared 30-second
budget before processing moves to the next event. Failed subscriptions move
behind other pending subscriptions and are retried on a later tick. Push HTTP requests
have a 30-second total deadline. Another process or overlapping tick cannot
claim an unexpired lease; an expired lease lets a replacement worker recover
after a restart. Deletes and completion are fenced by the lease token. Successful
and expired subscriptions are removed; temporary failures remain for the next
run. A unique event/endpoint key prevents concurrent registrations from creating
duplicate subscriptions.

Delivery is at least once: a crash after a push service accepts a request but
before the database records its success can cause a retry. A process suspended
past its lease can also leave an in-flight request ambiguous. Web push offers no
transaction spanning remote delivery and MySQL; avoiding that retry would risk
losing reminders. The stable notification tag lets the service worker replace
an existing notification for the same event.

The `worker/index.js` push listener is bundled by next-pwa into a generated
`worker-*.js` file imported by `public/sw.js`. Both are copied to the production
image with the other public assets. Generated assets are ignored by Git.

CI runs the reminder concurrency/recovery suite against an isolated MySQL
service after applying migrations. Locally, set `PUSH_TEST_DATABASE_URL` to an
isolated loopback database whose name contains `test` or `review`, apply
migrations there, then run `npm test`. Without that variable, only the real
MySQL tests are skipped; configuration, API rejection, and browser state tests
still run. The integration suite never uses the app's `DATABASE_URL`.
