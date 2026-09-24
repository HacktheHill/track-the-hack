# Organiser access operations and acceptance

This runbook is the canonical operational guide for organiser authentication,
administrator access, organiser passes, and organiser scanning. It complements
[`E2E_TESTING.md`](./E2E_TESTING.md), which remains authoritative for the full
application test strategy.

Follow the entire **Release acceptance** section for a new authentication or scanner
release. A release is complete only when every applicable item has recorded evidence,
all deliberately created production data has been reconciled or removed, and every
skip has an owner and a follow-up date. A deployment by itself is not acceptance.

## Current access model

There are two current access levels:

- **Organiser:** may use an organiser pass, scan participant and organiser passes,
  manage events and event services, and read operational metrics.
- **Administrator:** an organiser whose `User.isAdmin` value is `true`; may also manage
  external organiser email addresses at `/internal/access`.

There is no current Mayor, Premier, or general role hierarchy. Do not recreate one to
represent future volunteers, sponsors, or other account classes. Add named capabilities
only when their real permissions are known.

Eligibility is evaluated as follows:

- Google sign-in is accepted only for a verified Google identity whose hosted-domain
  claim is exactly `ctn-rtc.org` and whose normalized profile and account emails match.
- A non-CTN address must be present in `OrganizerAccess` and must use an emailed,
  single-use link that expires after 15 minutes.
- CTN addresses are implicit and must not be added to `OrganizerAccess`.
- `User.disabledAt` denies access regardless of domain, allowlist state, administrator
  status, or an existing browser JWT.
- Protected procedures reload the user and access-list state from MySQL. Session
  `isOrganizer` and `isAdmin` fields are display hints, not mutation authority.
- Participant sessions are a separate cookie and never authorize organiser pages or
  procedures.

`admin@ctn-rtc.org` and other shared addresses receive no special treatment. Named
administrator grants are database state, not application constants.

## Route and data boundaries

| Surface            | Required identity                                  | Purpose                                                               |
| ------------------ | -------------------------------------------------- | --------------------------------------------------------------------- |
| `/auth/sign-in`    | Public behind the deployment perimeter             | CTN Google sign-in or an emailed link for an allowed external address |
| `/qr`              | Organiser                                          | **My pass** and **Scan passes** tabs                                  |
| `/metrics`         | Organiser                                          | Participant-specific operational metrics                              |
| `/internal/events` | Organiser                                          | Event and scanner-station management                                  |
| `/internal/access` | Administrator                                      | Add, list, and remove external organiser addresses                    |
| `/internal/roles`  | Administrator after redirect                       | Compatibility redirect to `/internal/access`                          |
| `/profile`         | Participant session                                | Private online participant details                                    |
| `/pass`            | Previously validated participant ID on that device | Static, offline-capable participant QR shell only                     |
| `/claim/qr`        | Issuing flow                                       | Display a short-lived participant claim on the issuing device         |
| `/claim`           | Claim capability                                   | Explicitly redeem the claim on the participant's device               |

An organiser QR encodes `organizer:<user-id>`. It contains no email address,
participant data, token, or session credential. It is an identifier, not an
authorization capability. A photographed pass can be presented to a legitimate
scanner, so the scanner must display the organiser's name for visual verification.

Participant scans write `Presence`. Organiser scans write `OrganizerPresence`.
Existing participant metrics remain participant-specific; do not silently add organiser
counts to them. An organiser record has no participant dietary, T-shirt, RSVP,
application, or event-interest fields.

## Configuration and deployment

The web Container App requires these secret-backed SMTP values in addition to the
existing NextAuth and Google OAuth settings:

```text
EMAIL_SERVER_HOST
EMAIL_SERVER_PORT
EMAIL_SERVER_USER
EMAIL_SERVER_PASSWORD
EMAIL_FROM
```

Store credentials in the deployment secret store and expose them to the app through
secret references. Do not put credentials in GitHub variables, workflow input, image
layers, command output, or this repository. `EMAIL_FROM` must be an address accepted by
the configured SMTP provider.

Deploy from reviewed `main` through `.github/workflows/container.yml`. The workflow must
finish the migration job before updating the web app. Confirm all of the following
before provisioning an administrator:

1. the deployment workflow conclusion is `success` for the intended commit;
2. the newest `track-the-hack-migrate` execution is `Succeeded`;
3. the web revision is healthy and receives 100 percent of intended traffic;
4. the `track-the-hack-organizer` job uses the same migration image tag;
5. all five SMTP settings are present as secret references; and
6. Cloudflare Access still protects `https://tracker.hackthehill.com`.

The migration must precede administrator grants because the command writes
`User.isAdmin`. Never run the Phase 1 baseline over a legacy production database.

## Provisioning and routine administration

### Local or approved database-connected CLI

The command normalizes the address, writes idempotently, reads the resulting row back,
and fails if verification does not match the requested state:

```sh
# External organiser who will use email sign-in
npm run organizer:provision -- organiser@example.com

# Named CTN administrator
npm run organizer:provision -- person@ctn-rtc.org --admin
```

`--admin` rejects non-CTN addresses. A CTN address without `--admin` makes no database
change because verified CTN Workspace identity is already sufficient.

### Production workflow

Prefer the protected **Provision Track organizer** GitHub Actions workflow for
production writes. Supply the exact email and administrator Boolean after reviewing the
target:

```sh
gh workflow run provision-organizer.yml \
  --ref main \
  -f email=person@ctn-rtc.org \
  -f administrator=true
```

For an external organiser, set `administrator=false`. Record the resulting workflow
run and Azure job execution, wait for `Succeeded`, and retain only the normalized email
and non-secret execution identifiers in the restricted operations record. The success
message is emitted only after database readback.

The initial named administrator grants are:

```sh
npm run organizer:provision -- daniel.thorp@ctn-rtc.org --admin
npm run organizer:provision -- agam.singh@ctn-rtc.org --admin
```

Do not repeatedly run those commands as a health check. Verify an existing grant by
signing in and opening `/internal/access`, or through a read-only approved database
check.

### External access-list UI

An administrator uses `/internal/access` to add one normalized external address at a
time, inspect the current list, or remove an address. The page intentionally cannot
change administrator status. Adding the same address is idempotent; removing an already
removed identifier is also safe at the API boundary. Both the state-changing and no-op
outcomes are audited.

Removing an address invalidates the next protected request even if the browser still
has a JWT. It also prevents redemption of an outstanding email link and causes that
organiser's copied pass to be rejected as an invalid organiser pass. Removal does not
delete historical `OrganizerPresence` or audit evidence.

## Local and automated verification

Use Node 24, Docker with Compose, and Chromium. Start from a clean checkout of the
candidate commit:

```sh
npm install
npm run dev:setup
npm run verify:dev
npx prisma validate
npx prisma generate
git diff --check
```

`verify:dev` includes the focused suite, type and lint checks, real-MySQL lifecycle
test, browser scanner path, participant and organiser scans, aggregate metrics, and the
production-build PWA privacy test. Record exact pass, failure, and skip totals; do not
replace them with “tests passed.”

Confirm the focused suite contains and passes coverage for:

- verified CTN Google profile acceptance and provider/domain/verification/email-match
  rejection;
- loopback-only development sign-in;
- unknown email token suppression and allowed-address token persistence;
- organizer and administrator procedure guards reloading current database state;
- CTN-address rejection by the external allowlist;
- idempotent access-list addition and administrator-only mutation;
- typed organiser pass parsing and rejection of disabled, removed, or unknown users;
- participant and organiser scanner paths, caps, duplicate scans, adjustments, stale
  reconciliation, and concurrent boundaries;
- organiser subjects returning a name but no participant-only fields; and
- English/French translation completeness.

### Migration and schema-drift proof

Run migration checks only against disposable MySQL databases whose names clearly contain
`test` or `review`. Never point these commands at production:

```sh
docker compose exec -T mysql sh -lc \
  'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e \
  "DROP DATABASE IF EXISTS track_the_hack_review_empty;
   CREATE DATABASE track_the_hack_review_empty CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"'

export EMPTY_TEST_DATABASE_URL='mysql://root:root@127.0.0.1/track_the_hack_review_empty'

DATABASE_URL="$EMPTY_TEST_DATABASE_URL" npx prisma migrate deploy
DATABASE_URL="$EMPTY_TEST_DATABASE_URL" npx prisma migrate status
npx prisma migrate diff \
  --from-url "$EMPTY_TEST_DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --exit-code
```

If the local root password is not `root`, change only the URL password; the first
command reads the actual Compose password inside the container. The deployed schema
must have no drift. For an upgrade-path test, restore the reviewed immediately
preceding production-equivalent schema into a second, explicitly disposable database,
run `migrate deploy`, and verify all of the following:

- legacy `ADMIN` assignments became `User.isAdmin = true`;
- `VerificationToken`, `OrganizerAccess`, and `OrganizerPresence` exist;
- `_RoleToUser`, `Role`, and the legacy `RoleName` enum no longer exist; and
- historical structured or legacy audit evidence remains readable.

Destroy only the named disposable databases after recording the result.

### Current-state authorization proof

Automated tests prove the guard logic, but also exercise one live local session against
the disposable development database:

1. Sign in as `dev-organizer@ctn-rtc.org` through the loopback-only provider and leave
   `/metrics` open.
2. In the local database, set only that user's `disabledAt` to the current UTC time.
3. Refresh `/metrics` and attempt one scanner API request. Both must be denied on the
   next request even though the JWT still exists.
4. Restore only that test user's `disabledAt` to `NULL`, sign in again, and confirm
   access returns.
5. Verify a participant-only browser remains unable to open `/qr`, `/metrics`, or
   `/internal/access` throughout the test.

Never perform this disable/restore exercise against a named production administrator.

## Release acceptance

Use designated test identities and events. Record their identifiers privately before
the first write, capture the initial Presence values, and define cleanup in advance.
Do not use a real attendee or operational station merely because it is convenient.

### 1. Perimeter and anonymous access

In a signed-out browser and with `curl -I`, verify `/`, `/qr`, `/metrics`,
`/internal/access`, and `/internal/roles` on
`https://tracker.hackthehill.com` redirect to Cloudflare Access. After passing the
perimeter but without an organiser session, verify protected pages redirect to
`/auth/sign-in` and protected tRPC mutations return unauthorized. A participant cookie
must not change either result.

Do not use `track.hackthehill.com`; it is not the application hostname.

### 2. CTN Google sign-in and administrator boundary

Use a fresh browser profile:

1. Sign in as one named CTN administrator through Google.
2. Confirm `/qr`, `/metrics`, `/internal/events`, and `/internal/access` load.
3. Confirm `/qr` opens on **My pass**, shows a QR whose decoded value starts with
   `organizer:`, and displays no email address or participant fields.
4. Confirm **Scan passes** retains camera input, manual/USB input, and station selection.
5. Open `/internal/roles` and confirm it redirects to `/internal/access`.
6. Sign out, then sign in as a verified CTN organiser who is not an administrator.
7. Confirm `/qr`, `/metrics`, and `/internal/events` load, while `/internal/access` is
   denied.
8. Through an approved read-only production database path, confirm Daniel and Agam each
   have one normalized CTN `User` row with `isAdmin = true` and `disabledAt IS NULL`.

Negative Google claim combinations are proven in focused tests; do not attempt to forge
provider claims against production.

### 3. External organiser and magic-link privacy

Use one explicitly approved external test mailbox that is not a participant identity:

1. From the administrator page, add the address with surrounding spaces or mixed case
   only if the mailbox routing remains valid; confirm the list shows its trimmed,
   lowercase form.
2. Add it again and confirm there is still one list entry.
3. Submit the address on `/auth/sign-in`. Confirm the generic public response does not
   state whether access exists and exactly one message arrives.
4. In a separate signed-out browser profile, submit an unlisted sink address. Confirm
   the same public response appears, no message arrives, and an approved read-only
   database check shows no `VerificationToken` for that normalized address.
5. Open the allowed link once. Confirm organiser access and confirm the link fails when
   opened again in a fresh profile. Prove the 15-minute expiry in focused automation or
   controlled local time; do not wait on an operational production account merely to
   test a constant.
6. Request a new link, remove the address before opening it, and confirm redemption is
   denied.
7. Re-add the address, obtain a fresh link, sign in, then remove the address from the
   administrator's separate browser. On the external organiser's very next protected
   page load and API action, confirm access is denied without waiting for the JWT to
   expire.
8. Re-add the address only if that account is meant to remain enabled. Otherwise leave
   it removed and confirm no unused verification token remains.

Never paste a magic-link URL, token, cookie, or SMTP credential into the evidence log.

### 4. Administrator access-list audit

Verify `organizer.access.added` and `organizer.access.removed` records for `added`,
`removed`, and deliberate `unchanged` attempts. The records must contain opaque actor
and resource IDs, not the email address. Use the queries in
[`AUDIT_LOGS.md`](./AUDIT_LOGS.md).

### 5. Organiser and participant passes

Use two organiser-capable devices or browser profiles: one displays a pass and one
scans. Also use one designated participant pass.

1. Check **My pass** and **Scan passes** in English and French at desktop and the
   smallest supported phone viewport.
2. Decode the organiser QR using the scanner; do not copy it into a shared log. Confirm
   the result identifies an organiser and shows the display name when available.
3. Confirm the organiser result never shows or invents meal category, T-shirt size,
   RSVP status, application information, or event interests.
4. Confirm the participant result still shows only the fields permitted by the selected
   scanner workflow.
5. Photograph or screenshot only a designated test pass. Confirm possessing that image
   does not grant access to `/qr`, `/metrics`, or scanner APIs from a participant or
   anonymous browser.

### 6. Scanner workflows and persistence

Exercise one scanner-enabled station for each workflow. Capture the starting values so
test data can be restored deliberately.

| Workflow      | Participant expectation               | Organiser expectation                        |
| ------------- | ------------------------------------- | -------------------------------------------- |
| `CHECK_IN`    | Confirmation and T-shirt choice only  | Name/organiser marker; no participant fields |
| `MERCHANDISE` | T-shirt choice only                   | Name/organiser marker; no T-shirt value      |
| `FOOD`        | Meal category and food-lead flag only | Name/organiser marker; no dietary value      |
| `ATTENDANCE`  | Public-event interests may load       | No participant-interest request or display   |

For both participant and organiser subjects:

1. scan once and confirm the correct current-state table receives one row;
2. repeat at a blank/one maximum and confirm idempotence;
3. repeat at a maximum above one and confirm atomic increments stop at the cap;
4. exercise `+`/`−`, stale expected-value handling, lower bound, and upper bound;
5. disable the station and confirm both scan and adjustment APIs reject it; and
6. race two organiser devices near a cap and confirm the database never exceeds it.

Verify persistence with an approved read-only database client:

```sql
SELECT `organizerId`, `eventId`, `value`, `label`, `createdAt`, `updatedAt`
FROM `OrganizerPresence`
WHERE `organizerId` = '<designated-organizer-id>'
  AND `eventId` = '<designated-event-id>';

SELECT `hackerId`, `eventId`, `value`, `label`, `createdAt`, `updatedAt`
FROM `Presence`
WHERE `hackerId` = '<designated-participant-id>'
  AND `eventId` = '<designated-event-id>';
```

The organiser scan must not create a `Hacker` or participant `Presence` row. The
participant scan must not create an `OrganizerPresence` row. Scanner audit records must
use subject type `user` for organisers and `hacker` for participants.

After removing an external organiser's allowlist entry, present that person's existing
organiser QR to a still-authorized scanner and confirm it is rejected. Historical
`OrganizerPresence` must remain intact.

### 7. Participant route separation and offline privacy

With only a participant session, confirm `/profile` works but organiser pages and APIs
remain denied. Confirm `/pass` contains only the previously validated participant QR
identifier and remains available through the production service worker after it has
been loaded once online. Confirm private profile HTML, cookies, meal category, T-shirt
size, RSVP state, and Presence history are absent from Cache Storage and offline
responses.

Confirm `/claim/qr` displays the issuing device's claim and `/claim` performs explicit,
single-use redemption on the participant device. The capability must remain after `#`
in the URL and must not appear in request logs or referrer headers.

### 8. Metrics and events

As both an administrator and a non-administrator organiser, confirm metrics and event
management are available. Confirm a participant and anonymous browser are denied.
Compare metrics before and after organiser-only scans: established participant metrics
must not change. Compare before and after a participant scan: only the intended
participant counter may change.

### 9. Logs, cleanup, and final sign-off

Review application logs and structured audit records without exporting identities.
Confirm scanner records distinguish `hacker` and `user` subjects and access-list events
contain no email address, token, QR value, or cookie.

Clean up only the designated test state:

- restore intentionally changed event settings and counters to their recorded values;
- remove the external test address unless it is an approved lasting organiser;
- invalidate or allow to expire unused test verification tokens;
- revoke designated participant sessions or claims created only for the test;
- retain audit and historical Presence evidence unless the documented test plan
  explicitly authorized its removal; and
- verify no unrelated event, participant, organiser, or access-list row changed.

The release has **zero remaining organiser-access work** only when this checklist is
complete:

- [ ] candidate commit passed the standard automated gate with exact totals recorded;
- [ ] empty and upgrade-path MySQL migrations passed with zero schema drift;
- [ ] a current local JWT was denied immediately after its test user was disabled;
- [ ] production migration, revision health, image tags, traffic, and protected routes
      were verified;
- [ ] named CTN administrator and non-administrator CTN sign-ins passed;
- [ ] Daniel and Agam's administrator rows were verified read-only after migration;
- [ ] allowed, unknown, removed-before-redemption, single-use, and live-session removal
      email cases passed;
- [ ] administrator UI and idempotent access-list audits passed;
- [ ] English and French organiser QR tabs passed on representative desktop and phone
      devices;
- [ ] participant and organiser scans passed all four workflows and persistence checks;
- [ ] duplicate, cap, adjustment, stale, disabled-station, and concurrency boundaries
      passed at the appropriate automated or physical layer;
- [ ] participant/organiser route and offline-data boundaries passed;
- [ ] organiser scans did not change participant metrics;
- [ ] logs were reviewed for identity and secret minimization;
- [ ] test data was reconciled, cleanup was verified, and no unexplained delta remains;
- [ ] every skipped check has been completed—there are no “pending,” “not tested,” or
      ownerless follow-up items.

Record the evidence format required by [`E2E_TESTING.md`](./E2E_TESTING.md#evidence-to-report).
