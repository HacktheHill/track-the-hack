# Participant notifications

Track supports participant preferences, event reminders, and organiser food-service
campaigns over Web Push and Discord. Web Push transport details are in
[`PUSH_NOTIFICATIONS.md`](./PUSH_NOTIFICATIONS.md); Discord identity remains owned by
the bot.

## Behaviour

- Participants may enable either channel independently.
- An event reminder sends when a saved event begins.
- A food-service campaign snapshots checked-in participants into either bounded
  cohorts or one all-participants cohort.
- A cohort can be sent once. Retry applies only to unsuccessful deliveries.
- `uncertain` Discord results require a human decision because a message may already
  have been delivered.
- Opt-outs are enforced again by the delivery worker, not only by the preview.

Campaign states are `DRAFT`, `LOCKED`, `COMPLETED`, and `ARCHIVED`. Delivery states are
`PENDING`, `SENDING`, `SENT`, `FAILED`, and `SKIPPED`. Do not edit these states directly
in the database.

## Privacy and security

Track stores push subscriptions and participant channel preferences. The bot stores
Discord identities and delivery receipts. Audit events contain opaque IDs, counts,
channel names, state, and a content hash, not the message paired with a participant.

Do not put push endpoints, subscription keys, Discord IDs, participant IDs, message
and-recipient pairs, or provider errors in logs or release notes. Track-to-bot requests
are signed with `INTERNAL_API_SECRET`; that secret is not interchangeable with
participant, claim, RSVP, or VAPID credentials.

## Configuration

- `DISCORD_BOT_URL` and `INTERNAL_API_SECRET` enable Discord delivery.
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_EMAIL` configure Web Push.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` must match the server public key at build time.

Missing optional configuration disables that channel without taking down the app.
Deploy the compatible bot migration and healthy bot revision before Track when the
shared protocol changes. Database migrations remain additive during rollback.

## Verification

Automated coverage proves preferences, cohort construction, opt-outs, idempotency,
leases, retry selection, provider timeouts, invalid subscriptions, and signed bot
responses. Run the normal gate and, for protocol changes, the two-service test:

```sh
npm run verify:dev
npm run test:e2e:discord
```

A real-provider check is needed only when provider configuration, delivery code, or
the participant or organiser notification UI changes. Use one consenting test
participant in a protected environment:

1. confirm the participant is checked in, Discord-linked, and enabled for the intended
   channels;
2. verify one future test-event reminder arrives once on each enabled channel;
3. create one isolated campaign and review its audience, exact bilingual message, and
   per-channel counts;
4. obtain explicit confirmation immediately before the external send;
5. confirm one delivery per channel and no duplicate after another scheduler cycle;
6. disable the channels and confirm a second isolated campaign produces only skipped
   deliveries if opt-out behaviour changed; and
7. archive test campaigns and restore the participant’s intended preferences.

Do not manufacture provider failures in production. Automated tests cover expired
subscriptions, bad signatures, timeouts, retries, and ambiguous receipts.

## Routine food-service operation

1. Review the checked-in and dietary-priority totals.
2. Create a campaign with the approved maximum cohort size. Leave the maximum blank
   when everyone currently checked in should be placed into one cohort.
3. Review cohort size and reachable-channel counts.
4. Write and preview the bilingual message.
5. Obtain the operational send confirmation and confirm once.
6. Watch delivery reach a terminal state. Retry only understood failures after fixing
   the cause and receiving another confirmation.
7. Archive the campaign when all cohorts are complete. Late check-ins belong in a new
   campaign.

For seconds or another event-wide call, create a fresh campaign and leave the maximum
cohort size blank. This takes a new checked-in snapshot, includes people who arrived
after an earlier meal campaign, and produces one cohort. It does not resend an earlier
cohort or add overlapping membership to a locked campaign. The normal preview and
confirmation steps still apply.

A blank maximum is stored as the campaign's all-participants mode, not converted to
the current headcount. Regenerating that campaign while it is still a draft therefore
refreshes the snapshot and keeps everyone together even if the checked-in population
has grown. Once the first announcement is queued, the snapshot remains locked.

If Discord counts are unavailable, push is unavailable, or the audience is not the
intended group, stop and fix that condition before sending.
