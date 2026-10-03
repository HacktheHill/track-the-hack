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
Disclosure thresholds are reviewed by metric in `private-metrics/disclosure.ts`.
Counts already pooled in old snapshots are never reconstructed without original sources.
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

Country and travel views include an outside-Canada summary. Historical SQL is
classified locally before suppression into Canada, outside Canada, or unclassified;
only these aggregate counts enter the archive. An explicit country (including
English/French country names or residence codes) is required; city-only and
nonanswers remain unclassified. Residence is never substituted for travel origin.
Existing snapshots without those broader aggregates display conservative bounds,
not an assumption that every suppressed response is international. Travel uses a
verified minimum with unclassified-response coverage; small derived totals remain
masked. Re-importing historical SQL preserves existing Devpost aggregates.

Across cohort and historical dimensions, a sufficiently large pooled group now
has a population share. Multi-select pools show selection counts without a
people/project percentage. Rare tags cannot yield unique-project totals after
suppression, so these are not reconstructed. No suppressed category names or
sensitive identity-group inferences are introduced.

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
Thresholds are one for countries, public project tags and broad nonsensitive choices;
two for education categories; five for sensitive attributes and precise locations. Unknown historical fields,
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
deduplicated per project after reviewed spelling aliases are combined. Recovered public technology/prize tags and team sizes include counts of one.
Previously pooled page aggregates remain pooled until original details are recovered. Prize interest is not an award or eligibility result. Coverage
counts nonblank fields, not validated links. Drafts never enter these charts.

Team size is one creator plus the additional-member count. Summed memberships
are not unique people and can differ from Devpost's submitter total. No project
titles, narratives, links, identities or project-level records enter the archive;
school names from the export are not used as participant demographics. These
non-PII exports cannot establish attendee-to-project linkage. Organizer totals
remain separate from SQL application and check-in populations. The comparison
view adds Devpost participation across all available editions.

When an export is unavailable, organizer project pages may be reviewed through
the normal authenticated Devpost interface. Reconcile the entire paginated roster
to public/hidden submitted totals, count visible `Created by` member cards, use
the displayed technology/prize tags and field presence, and read the draft total
from the submission filter. Do not treat missing source fields as zero answers.
For this method, `sourceMethod` is `organizer-pages`, `teamSchools` coverage is
explicitly null, and the digest identifies the canonical non-identifying page
observations. Retain only the suppressed, strict-schema aggregate, never names,
URLs, descriptions or project-level observations. Attach it with:

```sh
npm run metrics:import-history-devpost -- \
  --snapshot /absolute/path/to/existing-snapshot.json \
  --output /absolute/path/to/new-snapshot.json \
  --i-aggregate /absolute/path/to/reviewed-page-aggregate.json
```

An aggregate and CSV cannot be supplied for the same edition. The dashboard
labels page-based team counts and field coverage separately from export counts.

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
as a single longitudinal funnel. HTH III now includes numeric age distributions and cohort summaries, controlled
language-keyword mentions, profile-field availability, shirt preferences, dietary
selections and nonblank accommodation-response counts from bounded Sheet reads.
Submitted project team sizes and all recovered technology/prize tags come from
local Devpost exports. Tracker registered-team sizes and post-event surveys are
not available in this retained snapshot.
Further historical stage-conversion cards, shareable filter URLs and additional
HTH III matched outcome analyses are optional follow-up work, not release blockers.

## Expanded report coverage (October 2026)

### Shared category normalization

`private-metrics/normalization.ts` owns reviewed bilingual aliases for schools,
specific programs, study levels, gender/pronouns, racial/ethnic backgrounds,
language preferences, prior participation, shirts, dietary choices, acquisition
channels, attendance modes and technologies. Imports
normalize before aggregation and small-category pooling. Case/whitespace variants
combine; no fuzzy matching or city/campus inference is used. Original source files
remain unchanged. Toronto Mississauga/Scarborough and joint programs remain distinct.
The additional `discipline` dimension groups reviewed programs without replacing
specific-program detail; unknown disciplines are explicitly unclassified.

HTH III school/study-level "other" selections (including the French "École ou
organisation non indiquée" selector) use the matching follow-up answer
when supplied. Unknown specifics remain subject to existing label safety and
suppression. Diagnostics contain only answered/matched/unmapped and category counts,
never original answer labels. Devpost aliases deduplicate per project, not by
summing already aggregated tags. HTH I's existing page-based project snapshot is
preserved because per-project tag overlaps cannot be recovered from its aggregates.

The October 3 full sweep supersedes the older checklist's raw-spelling notes.
Diagnostics now cover all collected reviewed categorical fields, not just education.
Multi-identity combinations retain their meaning, but equivalent option ordering
and bilingual labels combine. Historical pronouns are never converted into inferred
gender identities. Broad ethnicity options do not absorb narrower options from a
different form. Lactose intolerance, milk allergy and dairy-free diets remain distinct,
as do unspecified nut, peanut and tree-nut allergies. Original geographic strings,
ambiguous study-year numbers and unrecovered categories are not guessed.
Country codes and English/French country names use the existing explicit-country
classifier. Numeric ages/team sizes, technical status enums, named prize tracks and
repeated event instances do not need bilingual category merging; events remain separate.
The Sheet option parser preserves nested parenthetical examples, and multi-select
checkbox aliases are deduplicated per application row before counting. Historical
dietary option lists are similarly deduplicated before counting; free-text additions
remain pooled. All disclosure thresholds are unchanged.

Reviewed institution-name aliases include [Ryerson / Toronto Metropolitan](https://www.torontomu.ca/media/releases/2022/04/ryerson-university-changing-its-name-to-toronto-metropolitan-uni/)
and [UOIT / Ontario Tech](https://brand.ontariotechu.ca/guidelines/writing/editorial-style-guide/style-guidelines/university-name.php).

The Data quality view has an edition-wide coverage matrix distinguishing available,
not collected, not recovered, and deliberately excluded topics. Availability is
not a claim of identical populations, exhaustive answers or a cell-for-cell PDF copy.

The expanded import adds HTH I locations by attendance mode, missing answers among
walk-ins and event-expectation response coverage. HTH II includes activity-type
scheduled/scan/person/unit totals, role distributions, confirmed-any-scan and
walk-in intersections, age spread/range/under-22 summaries, linked accounts,
email verification and distinct Discord-verification source accounts. Original
report inconsistencies are resolved using source SQL and matching population bases.
The collapsed source appendix includes original table row/column counts and
nonblank analytical-field coverage, before event exclusions. Credential/contact
fields and framework credential internals have no dashboard insight and are excluded.

The earlier checklist's partial entries for those recovered figures are superseded
by this expansion. Application time-series remain intentionally excluded. HTH I
meal/event records and platform joins remain unreliable; HTH III platform/staff
aggregates and HTH I rare project tags are still not recovered. No unavailable
figure is replaced by zero or inferred from a different event.

`aggregate-sheet-report.mts` is a pure local reducer for bounded header-grounded
reads. Its raw input must never be saved. `enrich-archive-report.mts` combines a
reviewed aggregate capture with local II/III Devpost exports and writes a new
mode-600 snapshot, refusing overwrite. The III PII export's variable-length member
suffix is discarded; only fixed project fields contribute to aggregate counts.
Profiles and narratives contribute only field-presence or controlled-keyword counts.
Dates remain source-specific, and raw exports stay outside Git and the site.
