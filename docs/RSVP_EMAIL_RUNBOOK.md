# RSVP invitation preparation and send

This is a reviewed pre-event process, separate from the one-button day-of pass sidebar. Contact details stay in the restricted Tally response Sheet and the temporary local recipient CSV; Tracker receives only the minimal participant record. Opening a management link reads the current RSVP but does not change it. The participant chooses **I'll attend** or **I can't attend** on the page, and can use the original email link later to change that choice. No automatic confirmation email is sent.

1. After a reviewed Tracker deployment, back up the bound Apps Script source and response Sheet, confirm that the **Responses** tab has the exact eleven Tracker columns ending in **RSVP Refreshed At**, and update the bound project with `clasp`. Reload the Sheet so `onOpen()` rebuilds the menu. The legacy schema migrations and separate operations-tab workflow are retired; an unknown response layout is rejected without changing values.
2. Admissions reviews the recorded **Admission status** values and shared-email submissions. For the real campaign, choose **Track the Hack → Prepare accepted RSVP invitations** once. The command validates and processes every `Accepted`, `Accepté`, and `Acceptée` response regardless of selection, filters, or hidden rows; saves stable IDs before API calls; provisions bounded batches; obtains signed management links; fills **RSVP Link**, **RSVP Status**, **RSVP Deadline**, and **RSVP Refreshed At**; and reports the completed count. For a controlled test, set `TRACK_TEST_SUBMISSION_ID` to the approved test submission and run `prepareTestSubmissionForRsvp()` instead, then remove the property. Retry the all-Accepted command after any failed batch; a partial audience is not ready to mail. Preparation never sends email.
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

5. After the campaign, choose **Track the Hack → Refresh RSVP responses** as needed. The command reads every provisioned response row, refuses duplicate or missing Tracker participants before changing Sheet fields, reconciles `PENDING`, `CONFIRMED`, and `DECLINED`, updates **RSVP Refreshed At**, and reports the totals. Check that timestamp before making time-sensitive decisions; generic **Last Sync** is not enough. Participants continue to use the original email link; no follow-up worker or confirmation email is required.

Before the full campaign, complete the one-recipient Sheet, email, RSVP, claim,
scanner, reconciliation, and cleanup journey in
[`E2E_TESTING.md`](./E2E_TESTING.md#google-sheets-and-email).
Do not deploy or send merely because local tests pass. This document defines the
campaign operation; it does not maintain a second test checklist.
