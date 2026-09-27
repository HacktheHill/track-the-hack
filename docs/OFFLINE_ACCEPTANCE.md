# Offline and PWA acceptance

Run this checklist when service-worker caching, public routes, the participant pass,
the manifest, or deployment configuration changes. Ordinary UI and server changes do
not require a full physical-device PWA pass.

## Supported boundary

After being opened online, home, schedule, event details, maps, resources, sponsor
details, and their French equivalents may be available offline. `/profile` may fall
back to the QR-only `/pass` view.

Claims, RSVP, authentication, Discord, organiser pages, scanners, services, reminders,
and API requests remain online-only. The offline pass stores only the opaque participant
ID. The separate judging shell may store only the authenticated judge's prepared
assignment snapshot and judge-owned work in IndexedDB. It must not cache authenticated
HTML, API responses, sessions, organiser pages, another judge's work, profile data,
RSVP state, T-shirt size, meal category, or attendance. Signing out removes both the pass
and any local judging namespace owned by that account.

## Automated check

Run:

```sh
npm run test:e2e:pwa
```

The test uses a production build and verifies that the service worker controls the
page, representative public English and French content survives offline, the same QR
appears in the offline pass, private routes fail closed, and profile details do not
enter caches. `next dev` is not evidence for offline behaviour.

For a judging release, the automated run must additionally authenticate an approved
synthetic judge, prepare assignments online, reload `/judging` offline through the
generic localized shell, complete main and mini scoring plus ranking, verify persistent
local-only warnings, reconnect and synchronize, and prove the administrator view changes
only after synchronization. Inspect Cache Storage to confirm no private HTML or API
response was stored. Verify account switching and sign-out clear the prior judge's data.

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
6. With an approved synthetic judge, repeat the prepare, full offline reload, edit,
   local-only warning, manual sync, and sign-out cleanup flow in both English and French.
   On iPhone, also close and relaunch before reconnecting; synchronization must not rely
   on service-worker Background Sync.

Do not require every event, sponsor, map interaction, or private route to be checked on
both phones. Automation covers the route matrix. The device smoke covers installation,
relaunch, storage, rendering, and pass privacy.

## Completion record

Record the candidate commit, deployed revision, automated result, Android and iPhone
models, one English and French public check, pass privacy and sign-out results, and any
test data cleanup. A failed privacy or fail-closed check blocks release. A device check
unrelated to the change may be skipped with its reason.

For judging, also record the round and assignment version, synthetic judge ID, prepared
timestamp, local-only count before reconnect, synchronized count after reconnect,
administrator last-sync observation, Chrome and Safari results, and cleanup. Lost queued
work, false synchronized status, cross-account disclosure, or private Cache Storage
content blocks release.
