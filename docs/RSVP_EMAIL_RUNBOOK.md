# RSVP invitation preparation and send

This is a reviewed pre-event process, separate from the one-button day-of pass sidebar. Contact details stay in the restricted Tally response Sheet and the temporary local recipient CSV; Tracker receives only the minimal participant record. Opening a management link reads the current RSVP but does not change it. The participant chooses **I'll attend** or **I can't attend** on the page, and can use the original email link later to change that choice. No automatic confirmation email is sent.

1. After a reviewed deployment of the RSVP migration and Tracker code, back up the bound Apps Script source and response Sheet, update `Code.gs`, and verify its existing response-row headers and participant IDs. The prior production layout had six final Track-owned headers (`Track Participant ID` through `Track Last Sync`). If and only if those exact six are still the final columns, run `migrateLegacyResponseColumnsForRsvp()` once from the Apps Script editor after a separate review. It preserves every existing ID, old link, status, and timestamp while adding the four new operational fields. It is not a menu action and refuses any other layout. Do not replace the live script or run migration merely because this repository changed.
2. In the restricted response Sheet, review accepted rows and run `prepareSelectedRowsForRsvp()` from the Apps Script editor for selections of at most 500 rows. It saves IDs before API calls, provisions Tracker, replaces the old ID-only RSVP link with a signed management link, and fills **RSVP Link**, **RSVP Status**, and an ISO-8601 **RSVP Deadline**. Retry any failed batch; a partial batch is not ready to mail.
3. Export the response tab as CSV into the ignored `private-rsvp/` directory. Verify that every accepted row to be invited has `PENDING`, a nonempty signed `/rsvp/manage#…` link, a future ISO deadline, and the intended applicant email. Prepare a minimal CSV:

   ```bash
   npm run rsvp:prepare -- --input private-rsvp/responses.csv --output private-rsvp/rsvp-recipients.csv --base-url https://tracker.hackthehill.com
   ```

   The command fails on missing/duplicate IDs or recipient addresses, invalid links, and inconsistent or expired deadlines. It does not send or make a network request. The output is created with private file permissions and is not overwritten on retry.
4. From the sibling `bulk-email` repository, dry-run the provided-CSV service campaign with the active bilingual template:

   ```bash
   npm run start -- send --campaign-id hth3-rsvp-2026 --template-dir ../react-email-templates/emails/hackthehill --template rsvp-invitation.tsx --file ../track-the-hack/private-rsvp/rsvp-recipients.csv --purpose "RSVP invitation for accepted Hack the Hill III applicants" --dry-run
   ```

   Review the rendered HTML and text in both languages, counts, suppression results, sender, deadline, and test-recipient flow. A real `test` or `send` invocation sends email through SES and needs separate action-time approval. The real send also requires a committed, clean template checkout and the normal `bulk-email` campaign confirmation. Never put the private CSV or management tokens in Git, artifacts, logs, or an issue.
5. After the campaign, run `refreshResponseRsvpStatus()` as needed to reconcile `PENDING`, `CONFIRMED`, and `DECLINED` onto the response rows. Participants continue to use the original email link; no follow-up worker or confirmation email is required.

Before the full campaign, use one designated test application to verify the entire chain: provision → local recipient CSV → approved test email → open without changing state → yes → no → reopen the same link → yes, then test the deadline rule. Do not deploy or send merely because local tests pass.
