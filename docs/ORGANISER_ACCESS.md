# Organiser access

Organisers can scan passes, manage event operations, and view metrics. Administrators
can also manage external organiser addresses at `/internal/access`.

## Access model

- A verified Google identity in `ctn-rtc.org` may sign in as an organiser.
- A named CTN organiser with `User.isAdmin = true` is an administrator.
- An external address must be in `OrganizerAccess` and uses a single-use email link
  that expires after 15 minutes.
- `User.disabledAt` denies access, including for an existing browser session.
- Protected procedures reload current database access. Session claims are display
  hints, not mutation authority.
- Participant sessions never authorise organiser pages or procedures.

An organiser pass contains `organizer:<user-id>`. It is an identifier, not a session
credential. The scanner displays the organiser's name for visual confirmation.

## Provisioning

Use the protected production workflow for production changes:

```sh
gh workflow run provision-organizer.yml \
  --ref main \
  -f email=person@ctn-rtc.org \
  -f administrator=true
```

Set `administrator=false` for an approved external organiser. The equivalent command
for a local or approved database-connected environment is:

```sh
npm run organizer:provision -- person@ctn-rtc.org --admin
npm run organizer:provision -- organiser@example.com
```

The command is idempotent and verifies the stored state. `--admin` accepts only CTN
addresses. The `/internal/access` page adds or removes external addresses; it does not
change administrator status. Removing an address invalidates its next protected
request and any outstanding email sign-in link.

SMTP sign-in requires `EMAIL_SERVER_HOST`, `EMAIL_SERVER_PORT`, `EMAIL_SERVER_USER`,
`EMAIL_SERVER_PASSWORD`, and `EMAIL_FROM` as secret-backed runtime values.

## Acceptance

Run the standard gate in [`E2E_TESTING.md`](./E2E_TESTING.md), then verify the changed
boundary with the smallest useful live check:

1. Confirm the intended migration and web revision are healthy and Cloudflare Access
   remains enabled.
2. Sign in with one applicable organiser method and open a protected page.
3. Open **My pass** and scan it from a second organiser session.
4. Scan one approved participant by QR or manual ID and reconcile the resulting
   presence record.
5. For administrator changes, add and remove one disposable external address and
   confirm access follows the current list.
6. Confirm participant sessions and non-administrators cannot use administrator
   procedures.

Do not expose email links, cookies, participant identifiers, or organiser pass values
in logs or release evidence. Remove disposable access entries and reconcile test
presence records after the check.
