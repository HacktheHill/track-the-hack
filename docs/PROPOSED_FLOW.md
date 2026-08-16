# Proposed Track the Hack Data Model

## Background

Hack the Hill II experienced a ransomware attack, which affected MLH's willingness to partner with us that year. For Hack the Hill III, the goal is to reduce the amount of participant information stored in Track the Hack and keep sensitive application data in safer third-party systems.  
Track the Hack should remain focused on RSVP, participant access, QR scanning, check-in, meals, merchandise, teams if retained, and attendance. Applications, application review, identity data, participant waivers, and guardian consent move outside the app.

## Data Ownership

### Tally and Google Sheets

Tally holds application submissions and participant identity and continuously syncs them to Google Sheets. The Sheet is the authoritative administrative view for application review, acceptance decisions, participant IDs, reconciled RSVP status, and event preparation. Track the Hack does not make an independent acceptance decision.

* Identity and contact information  
* Tally application IDs, resumes, and application answers  
* School and demographic information  
* Accessibility requests and detailed dietary information  
* T-shirt size and minor/adult status  
* MLH-required consents  
* Participant waiver evidence and, for minors, guardian consent or signatures  
* Acceptance decisions and reconciled RSVP status

Emergency contacts will not be collected.

### Track the Hack

Track the Hack stores only the pseudonymous operational data needed for RSVP and the event itself. Detailed application, identity, accessibility, dietary, waiver, and guardian information remains in Tally or restricted Sheet views.  
The Sheet is authoritative for acceptance and participant provisioning. Track the Hack is authoritative for its own transactional state, such as RSVP changes, Presence records, and active participant sessions, until that state is reconciled back where needed.

### Other Systems

The existing bulk email CLI and React Email templates handle RSVP invitations and confirmations from filtered CSV files. The Discord bot owns Discord identity mapping, and email-list-manager owns mailing-list subscription and unsubscribe handling.

## Target Hacker Model

Use the random participant ID assigned in the Sheet as Hacker.id. It must be high-entropy, non-sequential, and not derived from an email address, name, student number, or other predictable value. Tally's own application ID remains in Tally and the Sheet and is not imported into Track the Hack.  
The participant-specific Hacker fields should be limited to:

* id  
* tShirtSize  
* mealCategory  
* confirmed  
* walkIn  
* acceptanceExpiry  
* optional teamId if teams remain in Track the Hack

Standard createdAt and updatedAt metadata may remain.  
Keep Event, Presence, Hardware, and organizer User/Role models. Keep Team only if Track the Hack remains the source of truth for team membership. Presence semantics, counters, and maximum-check-in rules remain unchanged. Presence records are created by event workflows rather than imported from the Sheet.  
The current Hacker model's identity, application, demographic, emergency-contact, accessibility, detailed dietary, acceptance-review, unsubscribe, and participant-User-linkage fields are removed. Replace detailed dietaryRestrictions with the operational mealCategory field.

## Application Review and Provisioning

1. Applicants submit the Tally application, which syncs to the application-review Sheet.  
2. Organizers review applications in the Sheet and record acceptance decisions there.  
3. Each accepted hacker is assigned a random participant ID in the Sheet.  
4. Accepted rows are used to provision the minimal Track the Hack record and to generate the RSVP email CSV.

Provisioning must be rerunnable and idempotent. It sends only id, acceptanceExpiry, tShirtSize, mealCategory, and any other explicitly required operational field.  
The RSVP email CSV contains only email, id, and optionally name for personalization. The existing bulk email CLI passes the non-email columns to the React Email template.

## Waivers and Guardian Consent

Default approach: collect the participant waiver and, for minors, guardian consent in the initial Tally application. Tally retains the evidence; Track the Hack stores none of it.  
This means some applicants who are not accepted will complete the documents, but it avoids maintaining a separate signing system in Track the Hack. If operational, timing, or legal requirements later make application-stage signing unsuitable, either or both workflows may move to the accepted-hacker RSVP stage; where practical, keep them together.

## RSVP

The RSVP invitation uses the Sheet-assigned participant ID and does not create a participant login session.

1. The RSVP link opens a confirmation page rather than changing state on GET.  
2. Track the Hack verifies that the participant ID exists and acceptanceExpiry has not passed.  
3. On explicit confirmation, set confirmed \= true and create or rotate a separate cancellation capability tied to the participant.  
4. Show the confirmation response.

The cancellation capability, not Hacker.id alone, authorizes cancellation. This matters because Hacker.id is later displayed in the participant's operational event QR.  
A rerunnable reconciliation process exports id, confirmed, and, for newly confirmed hackers, the cancellation link needed by the confirmation-email template. The Sheet updates rows by exact id and tracks whether the confirmation email has already been sent.  
The confirmation email is sent through the existing bulk email workflow. Its cancellation link opens an explicit confirmation page and then sets confirmed \= false. Cancellation remains available independently of the RSVP deadline or day-of check-in.

## Day-Of Participant Access

Full participant access is issued in person after identity verification. RSVP and day-of authentication are separate.

### Check-In Flow

1. The participant presents government-issued ID. An organizer verifies it visually and finds the participant's accepted row in the Sheet; ID details are not recorded.  
2. The organizer selects the row and uses a Google Sheets sidebar action to issue app access.  
3. The Apps Script backend calls a restricted Track the Hack endpoint with the participant ID, required operational fields from the selected row, and an API key kept in server-side Apps Script configuration rather than spreadsheet cells or the browser sidebar.  
4. Track the Hack creates or updates the minimal Hacker record and returns a random, short-lived, single-use claim URL.  
5. The participant scans the QR code on the device they will use. Track the Hack atomically consumes the claim token and creates the participant session in an HTTP-only, Secure, SameSite cookie.

The claim QR contains the one-time token, not the participant ID. Only one participant device is active at a time; issuing replacement access revokes the previous participant session.

### Walk-Ins

A walk-in completes the same Tally application at the event. After the submission syncs to the Sheet, an organizer reviews it, assigns a participant ID, and uses the same sidebar action to create the minimal Track the Hack record with walkIn \= true and issue access. No separate Track the Hack walk-in form is needed.

## Operational Event QR and Scanning

After claiming access, the participant can display a static event QR containing only Hacker.id. It remains available without continuous internet access and is an operational identifier for organizer-authenticated workflows, not a login credential.  
Scanner views expose only what the selected workflow needs:

* Check-in: confirmation state, check-in Presence, and T-shirt size where required  
* Merchandise: size and pickup Presence  
* Food: meal category and meal Presence  
* Mini-events and workshops: attendance Presence

## Food and Merchandise

Tally retains detailed dietary information. Track the Hack stores only mealCategory with STANDARD, VEGETARIAN, VEGAN, HALAL, and OTHER; OTHER directs the volunteer to a food lead with access to the restricted information. Do not use wristbands, stickers, or other physical dietary markers.  
Retain the existing TShirtSize enum and merchandise Presence workflow.

## Organizer Authentication

Keep NextAuth and User/Role for organizers, but restrict organizer login to verified @ctn-rtc.org Google accounts. Participant access no longer uses NextAuth or a User record.  
Remove participant User linkage and the HACKER role. Remove the ACCEPTANCE role because application review moves to the Sheet. Organizer sessions, participant sessions, the Sheets integration, RSVP links, and cancellation capabilities remain separate authorization paths. Participant sessions never confer organizer permissions.

## Open Decision: Team Formation

There must be one source of truth for teams.

* Option A: Track the Hack owns teams. Keep Team; the web app and Discord bot update it through authenticated APIs using participant IDs. This is closest to the current code and supports participant self-service and judging, but requires bot integration.  
* Option B: Discord owns teams and sends a team ID or membership snapshot to Track the Hack. This reduces team UI but creates synchronization risk.  
* Option C: Teams exist only in Discord. Remove team membership from Track the Hack. This is simplest, but Track the Hack cannot use teams for participant self-service or judging.

Recommendation: choose Option A if Track the Hack needs team data; otherwise choose Option C. Because full Track the Hack access is issued only at in-person check-in, pre-event team formation should remain in Discord unless a separate pre-event participant-authentication mechanism is added.

## Participant Features and Reporting

Replace the current participant-facing /hackers profile/directory flow with a participant-only /profile page backed by the day-of participant session. Limit it to the participant's event QR, confirmation state, T-shirt size, meal category, applicable team information, and their own Presence information.  
If organizers need participant lookup inside Track the Hack, use an authenticated operational view limited to the remaining operational fields. Front-desk identity lookup stays in the Sheet. Name-, email-, and profile-based participant search is removed.  
Keep Discord verification using the participant session to prove Hacker.id while the Discord bot retains the Discord identity mapping. Track the Hack does not store or log the Discord ID.  
Keep aggregate operational metrics from Track the Hack. Demographic reporting comes from Tally or the Sheet. Sponsor reporting defaults to aggregate data; individual-level sharing requires a separate explicit opt-in, a documented purpose, and disclosure limited to the fields required for that purpose.  
Existing functionality not otherwise placed in scope, including events and schedules, maps and resources, hardware inventory, organizer role administration, and aggregate sponsorship tools, remains unchanged. Keep the audit-log framework, but participant actions should use opaque IDs and logs must not copy Tally/Sheet application or identity data.

## Changes From Current main

Remove or replace the following existing Track the Hack functionality:

* The /apply application workflow, resume upload/storage, and saved application data; link or redirect applicants to Tally  
* Application review in Track the Hack, including acceptanceStatus, acceptanceReason, and the ACCEPTANCE role  
* Emergency-contact fields and UI  
* The current /confirm waiver/signature flow and signature upload; RSVP becomes attendance confirmation only  
* Team selection/creation from the current confirmation page unless the final team decision explicitly keeps it there  
* The current walk-in code/form, full Hacker creation, participant User linkage, and resume upload; replace it with the Tally/Sheet walk-in path described above  
* Participant User linkage, participant NextAuth login, the HACKER role, and participant password/OAuth account flows  
* The participant-facing /hackers directory and name/email/profile search  
* unsubscribed, unsubscribeToken, and the Track the Hack unsubscribe page because email-list-manager owns that workflow  
* Participant-level demographic dashboards and optional public profile sharing

New functionality required by this proposal:

* Sheet-assigned participant IDs and minimal Hacker provisioning  
* mealCategory  
* RSVP confirmation and cancellation capability  
* RSVP reconciliation back to the Sheet and confirmation-email export  
* Google Sheets sidebar access issuance and its protected Track the Hack endpoint  
* Single-use claim tokens and participant sessions independent of NextAuth  
* Operational participant QR using Hacker.id  
* The walk-in flow through Tally, the Sheet, and the same access-issuance path

## Recommended Implementation Order

1. Move application, waiver, and guardian-consent collection to Tally/Sheets and remove the corresponding Track the Hack application/review data paths.  
2. Reduce the Hacker model and update operational scanner/profile code to the minimal fields.  
3. Implement RSVP confirmation, cancellation capability, reconciliation, and React Email templates.  
4. Implement the Sheets sidebar endpoint, one-time claim flow, participant session, and walk-in path.  
5. Update participant profile, event QR, Discord verification, and metrics; then resolve and implement the team source-of-truth decision.

Delete, migrate, or retain existing application records, resumes, signatures, and other participant files according to an approved retention policy.