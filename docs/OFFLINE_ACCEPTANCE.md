# Offline and PWA acceptance

This is the authoritative end-to-end runbook for Track the Hack's offline
experience. Follow every required gate in this document after changing the service
worker, runtime caching, public routes, participant pass, schedule queries, PWA
manifest, or deployment configuration.

The work is complete only when the automated gate, Android check, iPhone check,
production smoke, cleanup, and evidence record all pass. A successful build by itself
is not offline acceptance.

## Supported boundary

“Available offline” means that the current service worker has installed and the
browser has already loaded any dynamic data needed for that view while online.

| Surface              | Offline expectation                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| Home                 | Available from the installed worker                                                                        |
| Public schedule      | Available after schedule data has loaded online; cached data expires after seven days                      |
| Visible event detail | Available after schedule data has loaded online and the detail page has been opened                        |
| Maps                 | Page and all six map SVGs remain available                                                                 |
| Resources            | Available from the installed worker                                                                        |
| Sponsor detail       | Available after that sponsor page has been opened online                                                   |
| Participant pass     | `/profile` falls back to the QR-only `/pass` shell after the profile has been opened online on that device |
| English and French   | The same boundary applies to unprefixed English routes and `/fr` routes                                    |

Scanning, claims, RSVP, authentication, Discord verification, metrics, Event
Services, organiser pages, saved-schedule changes, reminders, and every other write
remain online-only. There is no offline scanner, write queue, background sync,
credential cache, roster download, or conflict reconciliation.

The participant pass stores only the opaque participant ID needed to generate the QR.
Profile HTML, confirmation state, T-shirt size, meal category, attendance, sessions,
and private API responses must never be available from an offline cache. Signing out
must remove the saved pass.

## Required test environments

Use all three environments:

1. The production-build automated test with Node 24, Docker/MySQL, and Chromium.
2. A supported Android phone with current Chrome and an installed Track the Hack PWA.
3. A supported iPhone with current iOS, Safari, and an Add to Home Screen web app.

The two phones must use the deployed HTTPS origin. A phone cannot validate a service
worker against another computer's `localhost`, and `next dev` never enables this
service worker. Keep Cloudflare Access enabled; authenticate each device while online
with an authorised test account.

Use a designated test participant. Activating a claim, signing out, or creating any
production participant state is a real write and requires the normal production-test
authorisation. Do not use a real attendee merely to complete this runbook.

## 1. Automated production-build gate

From a clean checkout of the candidate revision:

```sh
npm ci --include=dev
npm run test:e2e:pwa
npm test
npm run typecheck
npm run lint
git diff --check
```

`npm run test:e2e:pwa` starts local MySQL through `dev:setup`, builds with
`next build`, starts with `next start`, seeds disposable schedule and participant
records, drives Chromium, and cleans up its generated records. It must not be replaced
with a `next dev` run.

The PWA test must pass all of these assertions:

- every URL in `publicPrecacheUrls` returns a successful response;
- the service worker installs, activates, and controls the page;
- seeded public schedule data and its event detail survive an offline reload;
- home, maps, all six map SVGs, resources, and an opened sponsor detail survive an
  offline reload;
- the English and French variants behave identically;
- `/profile` falls back to the same QR payload in the static pass shell;
- no profile detail appears in the offline pass;
- APIs, private Next data, scanner, Event Services, and organiser routes fail closed to
  the short localised offline page.

Push the candidate and require both jobs in **Track the Hack CI** to pass. The `pwa`
job is the clean hosted MySQL/Chromium proof; the general `test` job covers migrations,
focused tests, types, lint, and a separate production build. Record the workflow URL
and do not treat a skipped, cancelled, or superseded run as a pass.

Useful inspection commands are:

```sh
gh run list --commit "$(git rev-parse HEAD)" --limit 10
gh run view RUN_ID
```

## 2. Prepare each physical device

Run the following preparation separately on Android and iPhone. Do not reuse the
result from one platform as evidence for the other.

1. Record the device model, OS version, browser version, candidate commit, deployed
   revision, date, and tester.
2. Remove an older Track the Hack home-screen installation.
3. Clear website data for `tracker.hackthehill.com` only. Do not clear unrelated
   browsing data.
4. Disable private/incognito browsing and allow local website storage.
5. Connect to the internet, open `https://tracker.hackthehill.com`, and complete
   Cloudflare Access while online. Wait for the page to finish loading, refresh it
   once, and confirm it loads normally again; this gives the newly installed worker a
   navigation to control before the offline checks.
6. Install the site:
    - Android Chrome: open Chrome's **More** menu, choose **Install app** or
      **Install and create shortcut**, and add it. Google documents the current menu in
      [Create shortcuts for websites in Chrome](https://support.google.com/chrome/answer/15085120?co=GENIE.Platform%3DAndroid&hl=en).
    - iPhone Safari: use **Page Menu/Share → Add to Home Screen**, enable
      **Open as Web App**, and tap **Add**. Apple documents the current flow in
      [Turn a website into an app in Safari on iPhone](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios).
7. Launch Track the Hack from the new home-screen icon. Complete the rest of the check
   in that installed app, not an already open browser tab.

If the install option is absent, stop. Confirm HTTPS, manifest loading, and service
worker registration before continuing; a browser bookmark is not equivalent evidence.

## 3. Prove the empty-cache states

Do this immediately after installation, before opening the schedule or participant
profile:

1. Open the home page online and leave it open long enough for initial loading to
   finish.
2. Enable airplane mode, then explicitly turn Wi-Fi off if the device leaves Wi-Fi
   active in airplane mode.
3. Fully close the installed app, relaunch it from the home-screen icon, and open the
   schedule through app navigation.
4. Confirm the page stops loading and shows exactly one concise message:
    - English: **Schedule unavailable offline. Reconnect and open it once to save it.**
    - French: **Horaire non disponible hors ligne. Reconnectez-vous et ouvrez-le une
      fois pour l'enregistrer.**
5. In the browser address bar, open `https://tracker.hackthehill.com/pass`. The
   installed app intentionally hides its Pass navigation item when no pass hint exists,
   so this one empty-state check may be performed in the normal browser context. A
   pass must not be invented for fresh storage; the expected message says that no pass
   has been saved and that the profile must first be opened online.

Reconnect before continuing. This proves the no-cache state; it is not a failure.

## 4. Seed the supported offline content

While online, use the installed app and wait for each page to finish rendering:

1. Open home.
2. Open the schedule and choose one visible event with a distinctive bilingual title.
   Record the event title, start time, room, and detail URL.
3. Open that event detail.
4. Open maps and scroll through floors 0–5. Confirm each map image has rendered, not
   merely its heading.
5. Open resources and follow one sponsor link to its detail page. Record the sponsor.
6. Activate or use the authorised test participant session, open `/profile`, and wait
   for the participant QR and profile details to render. Save a screenshot of the QR
   pass only if the evidence location is access-controlled.
7. Switch the app to French and repeat steps 1–5, including the same event and sponsor.
8. Return to English, then leave the installed app on home.

Do not assume a link was cached because it appeared in markup. The schedule data must
render, the event detail must open, all six map images must render, and the sponsor
detail must be visited.

## 5. Validate offline behaviour on each device

Enable airplane mode, explicitly disable Wi-Fi, fully close the installed app, and
relaunch it from the home-screen icon. Keeping a previously rendered page on screen is
not a valid offline test.

Complete this matrix in English, then switch to French and repeat it:

| Check                 | Expected result                                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Home                  | Opens normally without a global connectivity banner                                                                                             |
| Schedule              | The recorded event remains visible with the same title and time                                                                                 |
| Event detail          | The recorded detail opens with its cached public information                                                                                    |
| Maps                  | Floors 0–5 render; no map is blank or replaced by a broken-image indicator                                                                      |
| Resources             | The resources page opens and remains readable                                                                                                   |
| Sponsor               | The previously opened sponsor detail opens; an unvisited sponsor is not required to work                                                        |
| Pass                  | `/profile` falls back to the QR-only offline pass and the QR renders                                                                            |
| Pass privacy          | No confirmation, T-shirt, meal, attendance, notification, session, or organiser information appears                                             |
| Online-only operation | Opening Services or another private workflow shows only **Internet connection required** / **Connexion Internet requise** and one schedule link |
| Write controls        | No RSVP, claim, reminder, saved-schedule, scanner, or other mutation succeeds offline                                                           |

For each navigation, force a fresh request by leaving the page and returning, or by
fully closing and reopening the installed app. Record screenshots of one public page,
the QR-only pass, and the online-only fallback in each language. Do not store or share
the QR screenshot outside the restricted acceptance record.

The physical-device smoke is checking platform installation, storage, navigation,
assets, and rendering. The automated PWA job remains the authoritative exhaustive
route and QR-payload equality check; do not create attendance records merely to rescan
the QR during offline acceptance.

## 6. Reconnect, clear the pass, and verify recovery

On each device:

1. Disable airplane mode and restore the original network.
2. Relaunch the installed app and confirm the schedule refreshes successfully.
3. Open the participant profile and confirm full private details are available only
   after the online request succeeds.
4. Sign out using the participant sign-out control.
5. Go offline again and open the pass. Confirm the saved QR is gone and the short
   no-offline-pass state appears.
6. Reconnect. Remove only test sessions or other records created for this acceptance,
   following the normal production cleanup process.

A reconnect must not cause a reload loop, a permanently stale page, or disclosure of
private data. Ordinary build-ID cache revisioning is sufficient; this runbook does not
require testing prolonged multi-version offline upgrades.

## 7. Production smoke and release evidence

Deploy only after the automated gate is green. The production workflow is an explicit
manual dispatch:

```sh
gh workflow run container.yml --ref main
```

Record the resulting **Build and deploy Track the Hack** URL. Require successful image
validation, registry pushes, migration execution, Container App updates, and health
probe configuration. A normal push validates images but intentionally skips the
production `deploy` job.

Because Cloudflare Access protects the site, an unauthenticated `curl` may return a
redirect to Access. That proves the gate is present, not application readiness. Run the
authenticated production smoke from the authorised devices and use the deployment
workflow/Azure health evidence for the protected health endpoints.

Use this acceptance record:

```text
Candidate commit:
Deployed revision and image tag:
Track the Hack CI URL:
Deployment workflow URL:
Migration execution/result:

Android model / OS / Chrome:
Android EN matrix: PASS / FAIL
Android FR matrix: PASS / FAIL

iPhone model / iOS / Safari:
iPhone EN matrix: PASS / FAIL
iPhone FR matrix: PASS / FAIL

Designated test participant:
Test data created:
Cleanup performed:
Restricted screenshot/evidence location:
Skipped checks and reason:
Tester and timestamp:
Final result: PASS / FAIL
```

## Definition of complete

Offline/PWA work has no remaining acceptance tasks when all of the following are true:

- the candidate commit is contained in the deployed production revision;
- the CI `test` and `pwa` jobs completed successfully for that candidate;
- the manually dispatched production workflow completed successfully;
- every Android English/French check passed;
- every iPhone English/French check passed;
- QR-only pass privacy and sign-out cleanup passed on both devices;
- online-only workflows failed closed on both devices;
- production test data was removed or explicitly documented as retained;
- the completed acceptance record contains no unexplained skip.

Any failed or skipped item keeps the release open. Once every item above is recorded as
passing, no additional offline-specific testing or implementation work remains.
