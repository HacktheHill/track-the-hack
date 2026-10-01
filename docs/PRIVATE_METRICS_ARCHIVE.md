# Private metrics archive

The detailed organiser dashboard is an independent static export. The public
archive and its headline statistics remain unchanged.

## Data and build

Export a reviewed aggregate snapshot with:

```sh
npm run metrics:export-archive
PRIVATE_METRICS_FILE=/absolute/path/to/aggregate-snapshot.json npm run build:private-metrics
```

The exporter prints JSON to stdout and performs only read-only database queries.
Capture that output in a secure location, never in the public archive or Git.
The strict snapshot schema rejects unexpected participant-shaped fields.
Existing small-cell suppression is retained; hidden categories are not reconstructed.
Generated private data and exports are ignored by Git.

The build strips inherited live credentials. Only HTML, CSS, JavaScript, fonts,
icons and aggregate page payloads are generated in `private-metrics/out/`.
English and French routes contain the same snapshot. There is no runtime
database, NextAuth session, polling, API server, or service worker.

## Cloudflare Access and deployment

Before publishing any real data:

1. Create a host-wide self-hosted Access application for
   `metrics.hackthehill.com`. Review and approve its allow policy.
   An Access login without a matching allow policy must not grant access.
2. Verify unauthenticated requests to the root, French page, HTML, Next data,
   JavaScript chunks, and arbitrary asset paths are gated.
3. Deploy the static assets only to the dedicated Worker:

   ```sh
   npx wrangler deploy --config private-metrics/wrangler.jsonc
   ```

4. Verify custom-domain DNS/certificate, authenticated English/French rendering,
   keyboard/mobile navigation, cohort controls, and logout.
5. Verify the Worker's `workers.dev` production and preview URLs are disabled.
   Do not enable Pages URLs, public mirrors, preview domains, or unprotected
   asset delivery for this export.

The configuration uses Cloudflare Workers **static assets**, with no Worker
application script or backend. Access is enforced at the custom hostname.
Its alternate production/preview URLs are explicitly disabled. The entire
export is private, including Next page data and chunks. `_headers` disables
browser caching and indexing; these are defence in depth, not authentication.

Never deploy this output into `archive/out/`, the public Pages project, a
GitHub release, or an artifact preview with public access.

## Analysis

The archived dashboard reuses the live presentation and retains participation,
SES-accepted messages, RSVP/attendance intersections, all demographic cohorts,
event operations, service quantities, Devpost totals, source dates, linkage,
and integrity checks. It adds category shares, dimension answer coverage,
Devpost cohort-to-project matches, and publication/import comparisons.

Ideas were reviewed against the corrected HTH I/II notebooks in
`prev-hackathon-analysis/corrected_version`: separate rows from people,
preserve true denominators, distinguish walk-ins and event scans, and disclose
missing/defaulted answers. Historical editions are references, not merged data.
No time-series, survey results, exact age summaries, or team-size distributions
are invented when the retained aggregate snapshot does not support them.
