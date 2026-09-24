# End-to-end testing

Use end-to-end tests for boundaries that focused tests cannot prove: a real database,
browser cookies and navigation, service workers, physical scanners, or external
providers. Do not reproduce every validation branch or enum in a browser.

## Standard gate

For most application changes, run:

```sh
npm run verify:dev
git diff --check
```

`verify:dev` runs focused tests, type checking, lint, and the MySQL and browser
lifecycle. The slower production-build PWA check remains separate because CI already
runs it independently and most changes do not affect offline behaviour. During
development, run the narrowest relevant command first, then the applicable gate once
before handoff.

| Change                              | Additional check                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| Scanner layout or feedback          | `npm run test:e2e:scanner`; use one real camera or USB scanner before event use |
| Discord protocol                    | `npm run test:e2e:discord` with the matching bot checkout                       |
| Schema or transaction logic         | Clean MySQL migration plus the relevant concurrency test                        |
| Offline caching or participant pass | Follow [`OFFLINE_ACCEPTANCE.md`](./OFFLINE_ACCEPTANCE.md)                       |
| Notification provider behaviour     | Follow the short provider check in [`NOTIFICATIONS.md`](./NOTIFICATIONS.md)     |
| Organiser authentication or access  | Follow the acceptance check in [`ORGANISER_ACCESS.md`](./ORGANISER_ACCESS.md)   |
| Schedule, hardware, or RSVP import  | Run its dry run and review the summary before `--apply`                         |

Skipped checks are acceptable when they are unrelated to the change. State what was
skipped and why.

## Local setup

Use Node 24, Docker with Compose, and Chromium:

```sh
npm install
npm run dev:setup
npm run dev
```

`dev:setup` accepts only the loopback `track-the-hack` MySQL database, applies
migrations, and seeds a local organiser, two participants, and representative events.
Set `CHROMIUM_PATH` only when Chromium is not in a standard location.

The participant helper prepares local RSVP, reconciliation, claim, and walk-in
fixtures with `example.test` recipients and loopback SMTP:

```sh
npm run dev:participant -- rsvp
npm run dev:participant -- reconcile
npm run dev:participant -- claim
npm run dev:participant -- walk-in
```

No external mail is sent.

## Automated journey

The standard lifecycle covers one coherent path through:

1. bilingual Sheet mapping and pseudonymous provisioning;
2. RSVP read, attend, decline, reconciliation, and reuse of the same link;
3. claim activation, participant profile and pass, reissue, and sign-out;
4. organiser authentication and protected scanner access;
5. one representative scan for each workflow and aggregate metrics; and
6. cleanup of disposable local records.

Focused tests remain the right place for malformed payloads, token tampering, every
enum, caps, races, rollback, privacy projections, and authorization failures.

## Manual checks by feature

Perform only the section affected by the change.

### Scanner

- Confirm the selector, camera, manual field, and result remain reachable on a narrow
  phone and desktop in English and French.
- Scan one participant in each workflow class. Confirm only the required operational
  fields appear.
- Confirm a new record has a green result card, an increment has a distinct teal-green
  card, an unchanged record has an amber card, and a limit has a red card. Confirm the
  written result remains clear without relying on colour.
- Confirm the ascending success cues and descending limit or error cues are audible
  above expected room noise on the event device. On a handheld browser that supports
  vibration, confirm the corresponding vibration cues; unsupported devices may omit
  vibration without affecting the scan.
- For cap or concurrency changes, use two organiser sessions once and confirm the
  database count cannot exceed the cap.
- Use a real camera or USB scanner when decoding, feedback, or desk hardware changed.

Automated tests cover repeated scans, stale adjustments, disabled events, and cap
arithmetic. Do not corrupt requests manually to repeat them.

### Events and reminders

- Create or edit one bilingual event and confirm public visibility, room, time, link,
  scanner settings, and the selected locale.
- Save and remove one interest as a participant.
- Enable and disable one reminder if reminder behaviour changed.

Do not wait for a real event time. Focused scheduler tests use controlled database
times and are more reliable.

### Hardware Desk and Latte Lab

- Use a disposable local database, never production inventory.
- Complete one counted hardware checkout and return, plus one uncounted availability
  change. Confirm inventory and the audit record agree.
- Complete one Latte order from participant submission through organiser completion.
  Confirm cancellation and closed-lab behaviour if those areas changed.
- Check the longest changed path at a phone viewport and in both languages.

Focused tests cover inventory races, idempotency, every disposition, recipe
compatibility, transition errors, and one-active-order concurrency.

### Google Sheets and email

Local automation proves the mapper and captured MIME message. A live check is needed
only when Apps Script deployment, authentication, or real email configuration changed:

1. use one approved test row;
2. confirm the existing participant ID is reused;
3. prepare but do not send the private recipient file;
4. review one rendered message; and
5. obtain separate confirmation immediately before any external send.

Follow [`RSVP_EMAIL_RUNBOOK.md`](./RSVP_EMAIL_RUNBOOK.md) for an actual campaign.

### Discord

The two-service test covers proof validation, binding uniqueness, replay, conflicts,
and cleanup. A deployed smoke needs only one approved participant: verify that the link
is blocked before check-in, becomes eligible after a `CHECK_IN` scan, and grants the
expected role. Do not reproduce destructive or expiry cases in production.

### Organiser access

Use one organiser and, when administrator behaviour changed, one administrator. Confirm
sign-in, the organiser pass, a participant scan, an organiser scan, and current access
enforcement. Use one approved disposable external address only when email-link access
changed. See [`ORGANISER_ACCESS.md`](./ORGANISER_ACCESS.md).

## Production smoke

Production smoke tests only deployment-specific boundaries:

- intended revision and successful migration;
- `healthz`, `readyz`, Cloudflare Access, and organiser sign-in;
- public English and French pages;
- one approved participant claim and reversible scan when those paths changed;
- non-mutating hardware and Latte catalogue reads when Event Services changed; and
- real provider readiness when authentication or notifications changed.

When a release changes scanner persistence, audit events, retention, or the temporary
legacy `Log` path, complete [`AUDIT_ACCEPTANCE.md`](./AUDIT_ACCEPTANCE.md). Its scanner
matrix, MySQL/Azure reconciliation, privacy queries, scheduled-retention proof, and
legacy-table closeout are required in addition to this short production smoke.

Do not run exhaustive edge cases, create real loans or orders, or alter production
configuration merely to create test evidence. Keep Cloudflare Access enabled until
public launch is separately approved.

## Handoff

Report the commit and environment, commands and results, relevant browser or device,
manual paths exercised, skipped checks with reasons, and test data cleanup. Never
include secrets, cookies, participant links, provider identifiers, or private recipient
data.

For audit-related releases, also record the audit and correlation IDs, retention
execution, Azure table policy, legacy-write stop time, earliest table-removal time, and
current legacy-table status defined by [`AUDIT_ACCEPTANCE.md`](./AUDIT_ACCEPTANCE.md).
