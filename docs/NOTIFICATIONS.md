# Participant notifications

This is the authoritative product, operations, release, and end-to-end acceptance
runbook for participant Web Push and Discord notifications. Transport internals live
in [`PUSH_NOTIFICATIONS.md`](./PUSH_NOTIFICATIONS.md) and
[`DISCORD_VERIFICATION.md`](./DISCORD_VERIFICATION.md). The broader application test
matrix lives in [`E2E_TESTING.md`](./E2E_TESTING.md).

## Supported behaviour

An authenticated participant can enable or disable Web Push and Discord notifications
independently on `/profile`. A participant with both channels enabled intentionally
receives both. Disabling Discord notifications does not unlink the Discord account or
remove its Hacker role. Disabling Web Push deletes the participant subscription,
removes anonymous event registrations for the same endpoint, and asks the browser to
unsubscribe.

The event bell has two modes:

- an authenticated participant creates one participant reminder keyed by Hacker and
  event; when the event starts, it fans out to every enabled and available channel;
- an anonymous visitor retains the legacy endpoint-and-event Web Push reminder.

The scheduler removes a matching anonymous registration before sending a participant
push, so one browser endpoint cannot receive both paths for the same event. Cancelling
an authenticated reminder cancels the entire reminder, including Discord.

Organisers use `/internal/notifications` to create one campaign per meal or other food
service. Creating a campaign snapshots every distinct Hacker with a positive
`Presence.value` for at least one `CHECK_IN` event. The snapshot includes unreachable
and opted-out participants so cohort sizes continue to describe the food-service
population rather than only the notification audience.

Campaign ordering is:

1. every non-`STANDARD` meal category in one dietary-priority pool;
2. a deterministic seeded shuffle of that pool;
3. a separate deterministic seeded shuffle of `STANDARD` participants;
4. the dietary-priority order followed by the standard order; and
5. balanced numbered cohorts whose sizes differ by at most one and never exceed the
   organiser-entered maximum.

The UI displays aggregate dietary counts, never an individual's category. A `DRAFT`
campaign can be regenerated with a new seed and current check-in snapshot. Queueing
the first cohort changes the campaign to `LOCKED`; its membership can no longer
change. The campaign becomes `COMPLETED` after every cohort has a terminal
announcement and may then be archived. A late check-in is reported but is not added
to the frozen campaign. Create a new campaign for the next food service.

Each cohort accepts exactly one announcement of 1–500 trimmed characters. The exact
body is sent through both channels under the fixed Web Push title **Hack the Hill
update / Mise à jour Hack the Hill**. Queueing always creates one Web Push and one
Discord delivery row per cohort member. The worker re-reads the participant's latest
preference and channel availability before each attempt and records ineligible
channels as skipped.

## Delivery states and retry policy

The organiser page refreshes approximately every ten seconds and summarizes each
cohort as unsent, queued, sending, complete, or partially failed. The underlying
per-channel states are `PENDING`, `SENDING`, `SENT`, `FAILED`, and `SKIPPED`.

Workers claim bounded batches with database-time leases. A temporary provider failure
is retried automatically up to three total attempts with bounded backoff. An organiser
can explicitly retry unsuccessful deliveries that became retryable after a link,
subscription, or provider problem was corrected. Successful deliveries are never
recreated by retry.

Expected terminal reasons are:

| Reason              | Meaning                                                                                     | Automatic retry      | Organiser action                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------- |
| `channel_disabled`  | The participant opted out before delivery began.                                            | No                   | None; honour the opt-out.                                                                               |
| `not_linked`        | No bot-owned Discord binding exists.                                                        | No                   | Complete verification, then use **Retry unsuccessful deliveries** if the participant wants the message. |
| `dm_unavailable`    | Discord rejected the DM, normally because DMs are closed.                                   | No                   | Participant reopens DMs, then an organiser may retry.                                                   |
| `push_unavailable`  | No active participant push subscription exists.                                             | No                   | Participant enables push, then an organiser may retry.                                                  |
| `push_expired`      | The push service returned `404` or `410`; Track removed the subscription and disabled push. | No                   | Participant enables push again, then an organiser may retry.                                            |
| `temporary_failure` | A transport or network operation may succeed later.                                         | Up to three attempts | Retry only after automatic attempts have ended and the provider is healthy.                             |
| `uncertain`         | Discord may have accepted the DM before the bot could persist its receipt.                  | Never                | Inspect with the test participant and decide deliberately; do not blindly resend.                       |

Discord deliveries use a stable UUID and bot-side receipt keyed by UUID and content
hash. Replaying a confirmed delivery returns its recorded result without another DM.
Reusing a UUID with different content is rejected. A crash after Discord accepts a DM
but before the receipt is durable becomes `uncertain` to avoid a silent duplicate.

## Privacy and security boundaries

- Track stores Hacker IDs, channel preferences, Web Push subscriptions, reminder and
  campaign state, delivery UUIDs, and safe outcomes. It never stores Discord IDs or
  usernames.
- The bot alone resolves Hacker IDs through `discord_participant_links` and retains
  Discord delivery receipts.
- `/participant-links/status` returns only Hacker IDs and linked booleans.
- `/notifications/deliver` accepts at most 50 deliveries, disables Discord mentions,
  and returns only safe outcomes.
- Track-to-bot requests use the shared `INTERNAL_API_SECRET`, a timestamp no more than
  five minutes old, and endpoint-specific HMAC domains. Verification, link status,
  and notification delivery signatures are not interchangeable.
- Do not log or paste push endpoints, Web Push keys, Discord IDs, participant IDs, raw
  provider errors, or message text associated with a participant.
- Audit events contain opaque resource IDs, counts, channel names, enabled state, and
  a message content hash. The exact announcement remains only in the notification
  tables.

## Configuration and deployment order

Track requires the following notification settings:

- `DISCORD_BOT_URL`: private HTTPS bot origin;
- `INTERNAL_API_SECRET`: the same value configured on the bot, at least 32 random
  characters;
- `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`: a matching Web Push pair;
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: the same public key, present before the Track image
  is built; and
- `VAPID_EMAIL`: the Web Push contact address.

The notification transports are optional capabilities. Missing Discord or VAPID
configuration must show an unavailable channel without taking down the rest of Track.
Never print secret values while verifying configuration. Compare hashes or public
values where appropriate.

Deploy in this order:

1. Confirm successful, restorable Track and bot database backups.
2. Confirm the intended commits, current production revisions, database baselines,
   Key Vault references, shared-secret match, VAPID pair, workflows, alerts, and
   Cloudflare Access state.
3. Deploy the backward-compatible bot migration and bot image. The bot readiness
   check must require `discord_participant_links` and
   `notification_delivery_receipts`.
4. Verify the bot revision is healthy before deploying Track.
5. Deploy the Track Prisma migration and Track image.
6. Verify the migration execution succeeded, the new revision receives 100% of
   traffic, and its `/api/readyz` probe passes. That probe performs a database
   `SELECT 1`.
7. Keep Cloudflare Access enabled throughout private acceptance. Public launch is a
   separate decision.
8. Complete the real-provider acceptance procedure below before declaring the release
   fully accepted.

Rollback means redeploying a previously built immutable image only after confirming
that its code is compatible with the already-applied additive schemas. Do not reverse
or reset production databases as an ordinary rollback.

## Automated verification

From the Track repository, use Node 24 and Docker:

```sh
npm ci --include=dev
npx prisma generate
npm run verify:dev
npm run test:e2e:discord
npm run build
```

`verify:dev` covers unit, type, lint, local MySQL/HTTP lifecycle, browser, and PWA
checks. `test:e2e:discord` uses the adjacent bot's real protocol, database store, and
role adapter with Discord API calls doubled; it does not contact Discord or send a DM.
The test database protections in `E2E_TESTING.md` remain mandatory.

From the bot repository:

```sh
npm ci
npm test
```

The bot suite covers signed request validation, request bounds, link status,
idempotent successful delivery, hash mismatch, unlinked accounts, DM rejection,
transient failure, and uncertain receipts. Automated checks are necessary but do not
replace the real-provider acceptance below.

## Real-provider end-to-end acceptance

This procedure sends real external messages and changes production operational data.
Use designated test accounts and obtain separate action-time confirmation immediately
before each step marked **SEND BOUNDARY**. Never treat approval to deploy, draft, or
preview as approval to send.

### 1. Choose a safe test environment and audience

Prefer a protected staging environment connected to real Web Push and Discord
providers. Production is acceptable only when all of these conditions are true:

- Cloudflare Access is still enabled;
- the designated participant has consented to receive the test messages;
- the organiser page's current checked-in count equals the complete designated test
  pool; and
- no real hacker can be included in the cohort snapshot.

The campaign UI deliberately does not reveal individual membership. If production
already contains any non-test positive `CHECK_IN` presence, **do not run a campaign
smoke test there**. Use protected staging or wait for a reviewed test window in which
only designated test records are positively checked in. Never send to cohorts merely
to discover who is in them.

Record a non-secret acceptance identifier such as `notification-e2e-YYYYMMDD-HHMM`,
the Track and bot commit SHAs, environment, operator, designated account count, and
start time. Do not record Hacker IDs, Discord IDs, push endpoints, or subscription
keys in the release note.

### 2. Verify services and configuration without sending

1. Confirm both deployment workflows completed successfully for the intended SHAs.
2. Confirm the Track, Prisma, and bot revisions are healthy, are running the intended
   immutable images, and receive the expected traffic.
3. Confirm the latest Track and bot migration jobs succeeded after the backups.
4. Confirm the Track readiness probe succeeds and the bot readiness endpoint reports
   ready from its permitted private network.
5. From an unauthenticated browser or HTTP client, confirm
   `https://tracker.hackthehill.com/internal/notifications` redirects to Cloudflare
   Access. Do not bypass or disable the gate.
6. Sign in through Access and as an organiser. Open `/internal/notifications` and
   confirm there is no Discord-availability warning.
7. Confirm the displayed checked-in count is exactly the approved test pool before
   creating a production test campaign.

Stop if a migration failed, a revision is unhealthy, the image SHA is unexpected,
Discord status is unavailable, or the checked-in population is not isolated.

### 3. Prepare one designated participant

Use the normal participant journey; do not insert notification rows directly.

1. Provision the designated record through the restricted Sheet flow, complete RSVP
   if applicable, issue day-of access, and redeem the claim in the browser that will
   receive the push.
2. Scan the participant once at a `CHECK_IN` station. Confirm their positive check-in
   without logging their Hacker ID.
3. In Discord, run `/verify` or **Generate Verification Link**, open the private link
   in the same participant browser, and press **Verify Discord account**. Confirm the
   Hacker role is present.
4. Open `/profile`. In **Notifications**, confirm Discord shows linked and enabled.
   If it was previously disabled, explicitly enable it.
5. Press the Web Push enable control. This click is the only point at which the app
   may request browser permission. Allow it, then confirm the profile reports Web Push
   enabled. If permission is denied, restore it in browser site settings, reload, and
   enable again.
6. Reload `/profile` and confirm both controls remain enabled. This verifies the
   server-side association rather than only a transient browser state.

If the browser or VAPID configuration is unavailable, or Discord does not show linked,
stop and fix the channel. Do not reinterpret a one-channel result as two-channel
acceptance.

### 4. Verify a two-channel event reminder

Use a reviewed, visible test event scheduled several minutes in the future. Creating,
rescheduling, hiding, or deleting a production event is a separate operational change
and requires its normal approval. Do not repurpose a real programme event.

1. While signed in as the designated participant, open the event and enable its bell.
   Confirm the bell remains enabled after reload.
2. Verify only aggregate or tester-owned evidence: one participant reminder exists;
   do not expose the push endpoint or Discord identity.
3. Allow the event start time to pass while the Track and bot revisions remain
   healthy.
4. Confirm the browser receives exactly one push with the localized event title and
   “This event has started.” or its French equivalent.
5. Confirm Discord receives exactly one DM with both event names and the bilingual
   start message.
6. Confirm no second push arrives through the anonymous path and no duplicate DM
   arrives after another scheduler interval or app restart.
7. Repeat the setup with Discord enabled and push unavailable or disabled, using a
   second reviewed test event, and confirm the Discord-only reminder succeeds.
8. Enable then cancel a third test reminder before its event begins; confirm neither
   channel receives it.

Record pass/fail and timestamps only. Preserve the event and delivery audit history;
hide or otherwise retire test events through the ordinary event workflow.

### 5. Verify a two-channel food-ready campaign

Reconfirm the checked-in population immediately before creating the campaign. For a
single designated tester, the page must show exactly one checked-in Hacker and the
expected aggregate dietary-priority count. For multiple designated testers, validate
the pool through the restricted operational source and ensure every person consented.

1. Open `/internal/notifications` as an organiser.
2. Create a campaign named with the acceptance identifier, for example
   `TEST notification-e2e-20260924-1200`, and set the maximum cohort size to the test
   pool size.
3. Confirm the snapshot count, cohort count, cohort sizes, dietary-priority count,
   Web Push eligibility, Discord eligibility, dual-channel count, and unreachable
   count. For the one-person test, size, push, Discord, and dual must all be `1`, and
   unreachable must be `0`.
4. While the campaign is still `DRAFT`, use **Regenerate draft** once. Confirm its
   snapshot remains the isolated test pool. This exercises draft-only regeneration.
5. Select the cohort and enter a unique bilingual body, for example:

    ```text
    [TEST notification-e2e-20260924-1200] Food is ready. No action is required. / Le repas est prêt. Aucune action n'est requise.
    ```

6. Open the preview. Confirm the exact body, target cohort, unique Hacker count, Web
   Push count, Discord count, and unreachable count. Confirm the text contains no
   `@everyone`, `@here`, user mention, role mention, or sensitive information.
7. Cancel the first confirmation dialog and confirm no delivery was queued. Reopen the
   preview and recheck every value.
8. **SEND BOUNDARY:** state the environment, exact campaign and cohort, exact body,
   unique participant count, and per-channel delivery counts. Obtain explicit
   confirmation immediately before pressing **Confirm**.
9. Press **Confirm** once. Do not double-click or refresh in an attempt to accelerate
   delivery. Confirm the campaign becomes `LOCKED` and the cohort no longer offers a
   second send action.
10. Wait for terminal counts. Confirm exactly one Web Push and one Discord delivery are
    `SENT`, with zero `PENDING`, `SENDING`, `FAILED`, and `SKIPPED` for the one-person
    dual-channel test.
11. On the participant devices, verify the exact body arrived once on each channel.
    Confirm the push uses the fixed bilingual application title and opens `/profile`.
    Confirm Discord rendered the text literally and did not create a mention.
12. Wait through at least two scheduler intervals and refresh the organiser page.
    Confirm no duplicate notification appeared and counts remained stable.

Do not invoke **Retry unsuccessful deliveries** when both deliveries succeeded. Retry
is tested only with a deliberately created, understood, and approved failure; it must
never resend a `SENT` row.

### 6. Verify opt-out enforcement

This test uses a new campaign because a cohort permits only one announcement.

1. On `/profile`, disable Discord notifications. Confirm the account remains linked
   and the Hacker role remains present.
2. Disable Web Push. Confirm the profile reports it disabled and the browser no longer
   has an active subscription for the site.
3. Reload the profile and confirm both preferences remain disabled.
4. In the organiser page, create a second isolated campaign with the acceptance ID
   suffixed by `-opt-out`. Confirm push eligibility, Discord eligibility, and dual
   eligibility are `0`, while unreachable equals the cohort size.
5. Draft another clearly marked bilingual test body and verify the preview reports
   zero eligible deliveries. Queueing still creates durable per-channel evidence that
   the worker can mark skipped; it does not override the opt-out.
6. **SEND BOUNDARY:** restate that the expected outcome is no external message and
   obtain explicit confirmation before pressing **Confirm**.
7. Confirm terminal counts show two `SKIPPED` channel rows per one opted-out
   participant and zero `SENT`. Confirm no push and no DM arrive.
8. Re-enable only the channels the participant wants after the test. Enabling Web Push
   must again happen through the participant's browser click.

This proves that a preference change is enforced by the delivery worker, not merely by
the eligibility preview.

### 7. Exercise failure and retry safely

Do not manufacture a provider failure in production by changing secrets, stopping
services, blocking all DMs, expiring a real subscription, or disrupting networking.
Automated tests cover those conditions. If a natural test-account failure occurs:

1. Record only the safe failure code and aggregate count.
2. Fix the test account or wait for provider recovery.
3. Open **Retry unsuccessful deliveries** and confirm the dialog.
4. **SEND BOUNDARY:** obtain explicit confirmation for the retry because it can send an
   external message.
5. Confirm only the previously unsuccessful row is requeued and all existing `SENT`
   counts remain unchanged.
6. If the result is `uncertain`, do not retry automatically. Ask the designated
   participant whether a DM arrived, compare the safe receipt state, and record the
   deliberate decision.

### 8. Close acceptance

Acceptance is complete only when all applicable boxes are checked:

- [ ] Automated Track and bot suites pass for the released commits.
- [ ] Backups and both migrations succeeded.
- [ ] Exact Track, Prisma, and bot images are healthy.
- [ ] Cloudflare Access remains enabled.
- [ ] The test audience was isolated and consented.
- [ ] Profile reported Discord linked and both channels enabled.
- [ ] The participant event reminder produced exactly one delivery per enabled
      channel and no anonymous/participant duplicate.
- [ ] The food-ready campaign preview matched the exact body and aggregate audience.
- [ ] One confirmed cohort action produced exactly one push and one DM per dual-channel
      test participant.
- [ ] The campaign locked after queueing and did not expose a duplicate-send action.
- [ ] The opt-out campaign produced only skipped rows and no external message.
- [ ] Any retry affected only unsuccessful rows; any uncertain DM received deliberate
      review rather than automatic resend.
- [ ] No logs or release evidence contain message-plus-participant pairs, Discord IDs,
      push endpoints, subscription keys, or secrets.
- [ ] Test campaigns reached `COMPLETED` and were archived; test events were retired
      through the ordinary workflow; desired participant preferences were restored.
- [ ] Release evidence records SHAs, workflow URLs, migration executions, revision
      names, aggregate delivery counts, operator, approver, and timestamps.

When every box is satisfied, there is no remaining implementation, migration,
deployment, configuration, or notification acceptance work for this feature. Removing
Cloudflare Access remains a separate public-launch decision, not part of notification
acceptance.

## Routine food-service operation

After acceptance, use this shorter checklist for each real meal:

1. Confirm the checked-in and dietary-priority aggregate counts are plausible.
2. Create a newly named campaign with the approved maximum cohort size.
3. Review every cohort's size and current push, Discord, dual, and unreachable counts.
4. Regenerate only while `DRAFT` if the snapshot or grouping must change.
5. Select one cohort, write one exact bilingual 1–500-character message, and preview
   the audience and channel counts.
6. Obtain the operational send confirmation, then press **Confirm** once.
7. Watch the cohort reach a terminal state. Investigate safe failure codes without
   viewing provider identifiers or logging the message with participant IDs.
8. Retry only eligible unsuccessful rows after fixing the cause and obtaining another
   confirmation.
9. Repeat for the remaining cohorts. Late check-ins wait for a new campaign.
10. Archive the campaign after all cohorts complete. Never delete notification history.

## Troubleshooting

| Symptom                                   | Check                                                                                                 | Resolution                                                                                                              |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Discord status is temporarily unavailable | Bot readiness, private URL, clock skew, shared-secret binding, and Track-to-bot network path          | Restore the capability; do not send with unknown Discord counts.                                                        |
| Discord shows not linked                  | Participant completed the current verification link and has a current bot binding                     | Run the normal verification flow; do not insert a Track-side Discord identifier.                                        |
| Push control is unavailable               | Browser support, secure context, permission, service worker, build-time public key, server VAPID pair | Restore browser permission or configuration, rebuild if the public key changed, then enable from the participant click. |
| Campaign has late check-ins               | Compare current count with frozen snapshot                                                            | Do not regenerate after locking; create a new campaign for the next service.                                            |
| Delivery remains queued/sending           | Track revision health, scheduler logs, lease age, database time, and provider reachability            | Let an expired lease recover; avoid manually editing delivery state.                                                    |
| `push_expired`                            | Subscription was rejected with `404`/`410`                                                            | Participant re-enables push; then retry only that unsuccessful row if the message is still relevant.                    |
| `dm_unavailable`                          | Test participant's DM privacy settings                                                                | Participant permits the DM; obtain confirmation before retrying.                                                        |
| `temporary_failure` after three attempts  | Provider and private network health                                                                   | Correct the cause, then use the confirmed retry action.                                                                 |
| `uncertain`                               | Bot receipt indicates a send may have escaped durable recording                                       | Ask the designated participant and make an explicit no-resend/resend decision; never automate it.                       |
| Campaign cannot be regenerated            | It is already `LOCKED` or `COMPLETED`                                                                 | Membership is intentionally immutable; create a new campaign if a different snapshot is needed.                         |

Never repair operational history with direct database edits. Preserve campaigns,
announcements, deliveries, receipts, and audit records for incident review.
