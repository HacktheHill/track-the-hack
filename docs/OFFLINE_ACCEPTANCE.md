# Offline and PWA acceptance

Run this checklist when service-worker caching, public routes, the participant pass,
the manifest, or deployment configuration changes. Ordinary UI and server changes do
not require a full physical-device PWA pass.

## Supported boundary

After being opened online, home, schedule, event details, maps, resources, sponsor
details, and their French equivalents may be available offline. `/profile` may fall
back to the QR-only `/pass` view.

Claims, RSVP, authentication, Discord, organiser pages, scanners, services, reminders,
and all writes remain online-only. The offline pass stores only the opaque participant
ID. It must not expose profile HTML, RSVP state, T-shirt size, meal category,
attendance, sessions, or organiser data. Signing out removes it.

## Automated check

Run:

```sh
npm run test:e2e:pwa
```

The test uses a production build and verifies that the service worker controls the
page, representative public English and French content survives offline, the same QR
appears in the offline pass, private routes fail closed, and profile details do not
enter caches. `next dev` is not evidence for offline behaviour.

## Physical-device smoke

Use one current Android Chrome device and one current iPhone Safari device before a
release that changes offline behaviour.

1. Clear this site’s data, install the candidate from the deployed HTTPS origin, and
   launch it from the home-screen icon.
2. While online, open the schedule, one event, maps, resources, one sponsor, and an
   approved test participant profile. Repeat the public pages in French.
3. Go offline, fully close the app, and relaunch it.
4. Confirm the visited public pages render, `/profile` shows only the QR pass, and an
   online-only route shows the concise offline page.
5. Reconnect, confirm current data refreshes, sign out, go offline again, and confirm
   the saved pass is gone.

Do not require every event, sponsor, map interaction, or private route to be checked on
both phones. Automation covers the route matrix. The device smoke covers installation,
relaunch, storage, rendering, and pass privacy.

## Completion record

Record the candidate commit, deployed revision, automated result, Android and iPhone
models, one English and French public check, pass privacy and sign-out results, and any
test data cleanup. A failed privacy or fail-closed check blocks release. A device check
unrelated to the change may be skipped with its reason.
