# Event reminders

Generate a VAPID key pair with `npx web-push generate-vapid-keys`. Set
`VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` on the server and set
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` to that same public key **before building** the
browser bundle. `VAPID_EMAIL` is optional and defaults to hello@hackthehill.com.
Blank keys disable push. Missing, invalid, or mismatched keys make the readiness
endpoint unavailable and registration fails rather than promising a reminder.
Keep the private key server-side and preserve the pair across deployments.

Registration accepts only a canonical Web Push subscription: an allowlisted
HTTPS provider endpoint, a 65-byte uncompressed P-256 public key, and a 16-byte
authentication secret. The API body is limited to 4 KB. Each event accepts at
most 5,000 distinct endpoints; an existing endpoint can still refresh its keys
or language at that limit. English and French registrations store only the
two-letter locale needed to choose the event name, notification body, and link.

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
Malformed legacy subscriptions are treated as permanently invalid and removed
instead of consuming retry work forever.

Delivery is at least once: a crash after a push service accepts a request but
before the database records its success can cause a retry. A process suspended
past its lease can also leave an in-flight request ambiguous. Web push offers no
transaction spanning remote delivery and MySQL; avoiding that retry would risk
losing reminders. The stable notification tag lets the service worker replace
an existing notification for the same event.

Moving an event to a future start time clears its completion marker and active
lease under the event row lock. This reopens registration and fences stale
worker database writes. A provider may already have accepted an in-flight push,
which cannot be recalled. Subscriptions successfully delivered before the edit
were deleted as normal, so those browsers must request a reminder again; pending
subscriptions retained during a race remain eligible at the new start time.
Hiding an event closes registration and marks its reminder complete under the
same row lock. Pending subscriptions are retained so a future unhide can reopen
registration without leaving browser state out of sync. Hidden events are also
excluded from worker claims as a safeguard. A worker may already hold a claimed
subscription when the event is hidden; an in-flight provider request cannot be
reliably recalled.

The `worker/index.js` push listener is bundled by next-pwa into a generated
`worker-*.js` file imported by `public/sw.js`. Both are copied to the production
image with the other public assets. Generated assets are ignored by Git.

CI runs the reminder concurrency/recovery suite against an isolated MySQL
service after applying migrations. Locally, set `PUSH_TEST_DATABASE_URL` to an
isolated loopback database whose name contains `test` or `review`, apply
migrations there, then run `npm test`. Without that variable, only the real
MySQL tests are skipped; configuration, API rejection, and browser state tests
still run. The integration suite never uses the app's `DATABASE_URL`.
