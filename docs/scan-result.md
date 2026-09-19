# Scanner details and event interests

The scanner uses the current pseudonymous participant model. Check-in and merchandise show T-shirt information (including opt-outs), food shows meal category and food-lead escalation, and attendance can show participant-selected event interests. Names and detailed dietary information remain outside Track the Hack.

Participants mark or remove event interests using their existing HTTP-only participant session. Organizer sessions and QR participant IDs cannot authorize these writes. The server derives the participant ID from the validated session, rejects cross-origin mutations, and rejects hidden or missing events. The browser's pass hint only controls whether the button is displayed.

An organizer or administrator can read event interests for an attendance workflow. The response contains only visible event IDs, localized names, and start times. Food, merchandise, and check-in interest requests are rejected. This extends attendance display with explicitly selected operational preferences; it does not change the minimal Hacker scalar fields or disclose identities. Presence counts remain keyed by event ID and participant ID and use the current concurrency-safe scan/adjust services.

Apply `20260915010000_add_event_interests` with `npx prisma migrate deploy` before deploying. Selections use a unique participant/event pair. This feature does not send notifications or import external registrations.

The original PR's screenshot gallery predates the participant-model migration and is historical. Current checks cover authentication separation, ownership, hidden events, workflow restrictions, localization, and scan-result rendering. Database calls in the interest tests are mocked; live migration and physical-camera checks are separate.
