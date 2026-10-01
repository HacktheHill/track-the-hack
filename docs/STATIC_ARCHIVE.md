# Static event archive

Track the Hack has two independent build targets in the same repository:

- `npm run build`: the existing live Next.js app, with its original authentication, API, database and PWA configuration.
- `npm run build:archive`: a Next.js `output: "export"` build containing public, read-only event content. Deploy **only `archive/out/`** to a static host.

The archive shares the winners, resources and sponsor presentation components with the live app. It replaces only their outer shell with authentication-free archive navigation. There is no new runtime server, function, database connection, session provider or tRPC client.

## Build and verify

Use Node 24 and the existing lockfile:

```sh
npm ci --include=dev
npm run build:archive
npm run test:archive
```

Browser verification requires Playwright's Chromium binary (`node node_modules/playwright-core/cli.js install chromium`). The browser checks serve the output as plain files, block all external/API/image-server requests, check English/French routes on desktop and mobile, test sponsor navigation and the resource download, and exercise replacement of a stale live-app service worker.

The build strips inherited application credentials from the Next.js subprocess environment. It copies only an allowlist of public assets and translation namespaces, never `.env` files or the live service worker. Generated `archive/public/`, `archive/.next/` and `archive/out/` directories are disposable, ignored build products; the live app's files are not modified.

## Included routes

English routes keep their current public URLs: `/`, `/winners/`, `/resources/`, `/metrics/` and `/sponsors/<id>/`. French uses the corresponding `/fr/` URLs. Language links and sponsor links preserve the selected language. The archive generates explicit routes rather than using Next.js's server-dependent internationalised routing.

Operational routes and APIs are **not exported**. Private profiles, passes, RSVP capabilities, scanning, judging, organiser tools and login do not become public pages. Unknown routes return the exported 404 page; do not configure a catch-all SPA fallback to `index.html`.

Resources remain a historical event guide. The archive banner makes clear that event instructions and features are no longer current.

## Public statistics and private analysis

`archive/data/metrics.json` contains only the already-public, organiser-provided headline figures, with a snapshot date and an explicit preliminary flag. It is **not** a dump of the organiser metrics API or an assertion that database totals are final.

To build a revised, approved snapshot without editing the default:

```sh
ARCHIVE_METRICS_FILE=/absolute/path/to/public-metrics.json npm run build:archive
```

The strict schema in `archive/metrics.ts` rejects unknown fields, including internal API responses, cohort breakdowns, participant identifiers and credentials. All accepted values become publicly readable in exported HTML/JSON/JavaScript. Review the input accordingly.

Keep detailed demographic/cohort/operational analysis in a separately reviewed report, stored privately by default. Do not place a private report or full dashboard JSON anywhere inside this public deployment, even behind a hidden link. If organiser-only static analysis is required later, protect a separate deployment and **all** of its assets with host-level access controls. The public archive does not implement authentication.

## Static hosting and reversible cutover

For Cloudflare Pages, use `npm run build:archive` and output directory `archive/out`. The output contains `_headers` with a static-compatible security policy. Other hosts need equivalent headers. Serve directory indexes and an actual 404 for missing paths. Verify downloads and both language routes with direct navigation as well as client navigation.

The separate `track-the-hack-archive` Pages project is a Direct Upload project, with `main` reserved as its production branch. Deploy a review build to a non-production branch without attaching the tracker hostname:

```sh
npx wrangler pages deploy archive/out --project-name track-the-hack-archive --branch archive-preview
ARCHIVE_TEST_ORIGIN=https://deployment-id.track-the-hack-archive.pages.dev node scripts/test-archive.mjs
```

Use the actual deployment URL printed by Wrangler, with no trailing slash. Hosted checks cover the same public pages, languages, mobile/desktop layouts, local assets, downloads and private-route 404s, plus persisted security headers and the cache-retirement worker. The old-worker migration simulation remains a local test because it requires replacing server responses. Direct Upload is deliberate: it does not alter the live Azure deployment workflow and does not imply automatic deployment on a Git push.

No automatic production cutover or Azure shutdown is part of this build:

1. Deploy to a separate static preview and run the browser checks/visual review before changing the existing tracker route.
2. Record the current Cloudflare DNS, tunnel routing, Access application and Azure revision so the switch can be reversed. Keep required Access rules for other routes/hosts intact.
3. Route `tracker.hackthehill.com` to the reviewed static deployment, preserving public URLs. Avoid caching HTML or `/sw.js` across the switch.
4. Verify from both a fresh browser and one with the live PWA already installed. The replacement `/sw.js` removes this origin's Cache Storage entries and unregisters itself. It deliberately does **not** erase IndexedDB or localStorage; retain operational records before considering any separate cleanup.
5. Confirm no organiser workflow, integration, bot or scheduled job still needs the web app or MySQL before stopping either. Disable/adjust affected alerts and jobs deliberately. Back up and verify restoration before database retention changes.
6. Shared tunnel, container registry, Container Apps networking and backup infrastructure may still serve the bot or other workloads. Do not delete or stop them just because the website is static.

MySQL stopping reduces compute cost, not retained storage cost, and Azure restarts a server after 30 continuous days stopped. Define off-season retention and monitoring separately. Do not remove a database merely to make the archive deployable.

To return to the live app, restore the recorded Cloudflare route to a healthy live revision, verify authentication and readiness, and verify the live PWA re-registers correctly. Keep the static deployment available as a fallback. Normal `npm run build` and the existing live deployment workflow remain unchanged.
