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
Devpost matching by cohort, and publication/import comparisons. Operation tables
separate food, workshops and other activities; repeated event records are never
merged by name. Old snapshots without dates use explicitly nonchronological
record labels. New exports retain public event schedule metadata for day/time labels.

### Historical editions

The original SQL files in `../prev-hackathon-analysis` can be processed locally:

```sh
npm run metrics:import-history -- /absolute/path/to/prev-hackathon-analysis \
  /absolute/path/to/original-snapshot.json /absolute/path/to/new-snapshot.json
PRIVATE_METRICS_FILE=/absolute/path/to/new-snapshot.json npm run build:private-metrics
```

The importer parses selected dump columns without executing SQL or restoring
credentials. It preserves the source files and original snapshot, creates a new
mode-600 output (refusing overwrite), and exports aggregate results only. SQL,
contacts, profile URLs, audit text and accommodation answers never enter the site.
Demographic/logistics categories below five are pooled. Unknown historical fields,
small unpooled categories and inconsistent totals fail validation.

HTH I/II have separate edition views and source definitions. The HTH I audit-log
rollback reproduces the corrected PDF's 377 records and 273/426 identity-based
turnout; this is reconstruction, conditional on a complete audit trail. The
notebook excludes attendance, so that discrepancy is disclosed rather than
silently treating these as directly observed event-specific check-ins. HTH II
keeps explicit check-in and any-scan populations separate, excludes walk-ins from
the funnel, and never multiplies scans through repeated schedule-label joins.
Source SQL digests are retained for reproducibility. Meal-sitting bounds are
transcribed from printed page 33 of the corrected HTH II PDF and checked against
SQL service totals; the ranges are correlated, not exact per-instance counts.
Language counts reproduce the notebook's keyword patterns, except that C++ is
now case-insensitive: the SQL gives 432 mentions, rather than the report's 31
lowercase-only matches. The chart explains this correction; mentions are not
proficiency measures or an exhaustive technology inventory.

History includes report-based demographics, educational background, logistics,
transport requests, hybrid modes, form-duration summaries, supplied profile-field
counts, team-size distributions, technical-language mentions and a platform/staff
appendix. The comparison view puts scope definitions beside each event, without
calculating misleading cross-event changes or merging their pipelines.
The HTH III snapshot still has no exact ages, team sizes or post-event survey data.
No time-series is added. Synthetic CI fixtures contain no real historical data.

### Historical Devpost projects

In each Devpost organizer area, export **Projects data**, choose **Do not include**
personal information, and leave **Exclude unsubmitted (draft) projects** unchecked.
Record the lifetime registrant, submitter, submitted-project and team-up totals;
do not use a recent date range's activity totals. Add both exports to a new snapshot:

```sh
npm run metrics:import-history-devpost -- \
  --snapshot /absolute/path/to/snapshot-with-history.json \
  --output /absolute/path/to/new-snapshot-with-projects.json \
  --captured-at ISO_8601_CAPTURE_TIME \
  --i-projects /absolute/path/to/hth-i-without-pii.csv \
  --i-registrants COUNT --i-submitters COUNT --i-team-up COUNT --i-submitted COUNT \
  --ii-projects /absolute/path/to/hth-ii-without-pii.csv \
  --ii-registrants COUNT --ii-submitters COUNT --ii-team-up COUNT --ii-submitted COUNT
```

The importer checks submitted totals, rejects missing columns or unknown statuses,
deduplicates identical project rows, and refuses conflicting duplicates or an
existing output. The previous snapshot remains unchanged; the new file is mode 600.
Keep source exports and generated snapshots outside Git and CI artifacts.
At least one edition's export is required. Omit the other edition's arguments
for an incremental import; its existing history is preserved unchanged.

Historical **Project insights** adds registration-to-submitted-team conversion,
public/hidden/draft totals, submitted-project technology tags, team sizes,
prize-track interest and field completeness. Technologies are case-normalized,
deduplicated per project, but spelling aliases are not merged. Multi-select
technology/prize labels with fewer than five projects are omitted; rare team
sizes are pooled. Prize interest is not an award or eligibility result. Coverage
counts nonblank fields, not validated links. Drafts never enter these charts.

Team size is one creator plus the additional-member count. Summed memberships
are not unique people and can differ from Devpost's submitter total. No project
titles, narratives, links, identities or project-level records enter the archive;
school names from the export are not used as participant demographics. These
non-PII exports cannot establish attendee-to-project linkage. Organizer totals
remain separate from SQL application and check-in populations. The comparison
view adds Devpost participation across all available editions.

## Corrected-report coverage checklist

This is an aggregate analysis view, not a verbatim reproduction of the reports.
**Covered** means the main aggregate analysis is present; **partial** identifies
source figures or cross-tabulations not exported. In every section, raw contact
details, profile URLs, participant records and small demographic categories remain
excluded or pooled. Original SQL, notebooks and PDFs are not modified.

### HTH I

| Corrected report section                                        | Dashboard location                | Coverage and differences                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clean analysis base, identities and completeness                | Overview; Data quality            | Covered. Excludes the audited HackHers walk-ins; registration rows and normalized identities are distinguished. Missing answers are separate from pooled categories.                                                                                                                   |
| 1: Gender, university, location, preferred language             | Cohort explorer                   | Covered as separate distributions. Stored variants are retained; rare categories are pooled rather than reproduced down to one person.                                                                                                                                                 |
| 2: Study level, programme, graduation year, previous hackathons | Cohort explorer; Data quality     | Covered as distributions and an invalid-prior-count check. Free-text category variants are not silently combined.                                                                                                                                                                      |
| 3: Shirts, dietary needs, accessibility, transportation         | Event operations                  | Partial. Includes shirts, split fixed dietary choices, nonblank accommodation-response counts, transport flag counts and transport origins/schools. Raw dietary additions are pooled; accommodation text is excluded. A transport flag of zero is not interpreted as an answered “no.” |
| 4: Attendance mode                                              | Event operations; Cohort explorer | Partial. Includes preferred mode, online-only counts and location distributions, but not the location-by-mode cross-tabulation.                                                                                                                                                        |
| 5: Form completion time and supplied profile links              | Participant background            | Covered as duration summaries, short/long-form counts and profile-field availability. No individual durations or URLs are retained.                                                                                                                                                    |
| PDF attendance reconstruction and turnout appendix              | Overview; Data quality            | Covered with an explicit reconstruction warning. The notebook excludes attendance; the dashboard follows the reproduced PDF audit-log method, conditional on audit completeness. No HTH I meal/activity attendance is inferred from the reused HackHers tables.                        |

### HTH II

| Corrected report section                                      | Dashboard location                                      | Coverage and differences                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cluster 1: Matched pre-event registration funnel and walk-ins | Overview; Data quality                                  | Partial. Includes applications, accepted/confirmed rows, matched check-ins, separate walk-in totals, global any-scan attendance and confirmed-without-any-scan checks. Matched confirmed-with-any-scan and walk-in scan intersections are not separate dashboard metrics.          |
| Cluster 2: Gender, age, ethnicity, country                    | Cohort explorer; Participant background                 | Partial. Includes distributions and mean/median age. The PDF's KDE, standard deviation, extremes and under-22 summary are not separate metrics. Rare ages/categories are pooled.                                                                                                   |
| Cluster 2b: Schools                                           | Cohort explorer                                         | Covered. Raw institutional spellings are retained; a single spelling is not presented as the institution's fully normalized total.                                                                                                                                                 |
| Cluster 3: Education, majors, prior experience, language      | Cohort explorer                                         | Covered as distributions, subject to small-category pooling.                                                                                                                                                                                                                       |
| Cluster 4: Logistics and acquisition channels                 | Event operations; Cohort explorer                       | Covered for shirts, dietary choices across registration/check-in/any-scan bases, travel origins, split acquisition choices and nonblank accommodation counts. No raw accommodation text or inferred meal demand is shown.                                                          |
| Cluster 5: Registration timing                                | Not included                                            | Excluded by request: no daily/hourly/weekday application charts or walk-in timeline.                                                                                                                                                                                               |
| Cluster 6: Operational insights                               | Participant background; Event operations                | Partial. Includes team sizes, people with/without registered teams, language mentions and activity participation. Admission-rationale text and Discord-verification analysis are not imported. C++ uses case-insensitive matching, correcting the report's lowercase-only pattern. |
| Cluster 7: Platform context                                   | Participant background → Platform and staffing appendix | Partial. Includes platform-account and registration context, not a conversion funnel. The linked-user-account count is not separately imported.                                                                                                                                    |
| Cluster 8: Event schedule and attendance                      | Event operations                                        | Partial. Includes the published-event total and scanned activity labels with corrected repeated-name handling. The full schedule and schedule-versus-scan type comparison are not separate tables.                                                                                 |
| Cluster 9: Login providers and staff roles                    | Participant background → Platform and staffing appendix | Partial. Includes provider counts, distinct staff and staff-role assignment totals. Provider counts overlap; role-by-role counts and email-verification totals are not separately imported.                                                                                        |
| Cluster 10: Meals and refreshments                            | Event operations; Meal-sitting bounds disclosure        | Covered. Includes unique people, recorded portions, portions per person, scheduled instances and report-derived correlated sitting bounds. Repeated labels are not duplicated through schedule joins.                                                                              |

### Scope retained from HTH III

The HTH III view retains its aggregate Sheet/Tracker participation pipeline,
SES-accepted acceptance messages, RSVP/check-in intersections, demographics,
acquisition channels, services, event engagement, Devpost participation/project
totals, aggregate linkage checks and source dates. Email provider acceptance is
not inbox delivery. Project-source gaps are not participant drop-off.

The edition comparison labels the different populations rather than treating them
as a single longitudinal funnel. Exact HTH III ages, registered team-size
distribution and post-event survey results remain unavailable in this snapshot.
Further historical stage-conversion cards, shareable filter URLs and additional
HTH III matched outcome analyses are optional follow-up work, not release blockers.
