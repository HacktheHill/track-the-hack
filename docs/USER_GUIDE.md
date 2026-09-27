# User interface guide

Track the Hack is bilingual. English routes use the default path and French routes use
the `/fr` prefix. The language selector keeps the current screen and changes the
locale. Screens show only actions available to the current public, participant,
organiser, or administrator context.

## Public and participant screens

| Route                               | Purpose                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `/`                                 | Event home and primary navigation.                                                                                 |
| `/schedule`, `/schedule/event?id=…` | Browse the programme, filter categories, open event details, and save events when participant access is active.    |
| `/maps`                             | View event floors with keyboard-accessible zoom and reset controls.                                                |
| `/resources`                        | Read event resources and open sponsor details.                                                                     |
| `/sponsors/[sponsor]`               | Read a sponsor description and open its relevant public links. Sponsorship tier is intentionally not displayed.    |
| `/rsvp/[id]`                        | Redirects old invitation URLs toward the current reusable RSVP-management flow.                                    |
| `/rsvp/manage#…`                    | Read and change the invitation response using the private fragment capability.                                     |
| `/cancel#…`                         | Supports older cancellation links. Current invitations should use RSVP management.                                 |
| `/claim#…`                          | Explicitly activate a one-time participant code on the current device. Opening the page alone does not consume it. |
| `/claim/qr#…`                       | Display a reusable organiser-provisioned claim QR until its expiry.                                                |
| `/profile`                          | View the current participant pass, operational preferences, notification choices, and recorded attendance.         |
| `/pass`                             | Display the pass saved on this device when offline. It contains only the participant QR identifier.                |
| `/services`                         | Enter participant services when an active participant session exists.                                              |
| `/hardware`                         | Browse currently available Hardware Desk items. Checkout and return remain organiser operations.                   |
| `/latte-lab`                        | Build and place a drink order when the lab is open and the selected ingredients are available.                     |
| `/discord#…`                        | Link the active, checked-in participant pass to the Discord account represented by the bot-issued fragment.        |
| `/_offline`                         | Explain unsupported offline navigation and provide a route back to the cached schedule.                            |
| `/judging`                          | Score assigned projects, save work offline after one online load, synchronize, and rank eligible projects.         |

The pass, public content, and prepared judge workspace are the deliberately supported
offline journeys. Personalized profile data, services, organiser screens, APIs, claim,
RSVP, and Discord verification remain network-only. Judge work saved only on the device
is not submitted and is not visible to organisers until synchronization succeeds.

## Organiser screens

| Route                     | Purpose                                                                                                                                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/auth/sign-in`           | Sign in with a verified `firstname.lastname@ctn-rtc.org` Google Workspace account, an allowed external-email magic link, or the loopback-only development account.                                 |
| `/qr`                     | Switch between the organiser pass and the scanner. Select the station, centre the participant QR in the camera, or scan/type the ID into the field immediately below it and press Enter.           |
| `/metrics`                | View aggregate operational counts without exposing participant identity.                                                                                                                           |
| `/internal`               | Open the organiser tools available to the signed-in role.                                                                                                                                          |
| `/internal/events`        | Create, edit, show, or hide programme events and configure optional scanner stations.                                                                                                              |
| `/internal/hardware`      | Manage inventory visibility, checkout carts, physical-ID custody, loans, and returns.                                                                                                              |
| `/internal/latte-lab`     | Open or close ordering, set ingredient availability, and move orders through the queue.                                                                                                            |
| `/internal/notifications` | Prepare food-service cohorts (or leave the maximum size blank for one all-participants cohort), review delivery totals, confirm announcements, inspect safe outcomes, and retry eligible failures. |
| `/internal/access`        | Administrators allow or remove external organiser email addresses. Named CTN Workspace access is implicit; CTN shared mailboxes are denied.                                                        |
| `/internal/roles`         | Compatibility route for older role-management links; current authorisation is defined in `ARCHITECTURE.md`.                                                                                        |
| `/internal/judging`       | Administrators import projects and judges, generate and adjust assignments, publish, monitor synchronized work, resolve eligibility, lock or reopen, and export results.                           |

## Judge workflow

Open `/judging` online once before leaving reliable connectivity. The page confirms when
the current assignment set is available offline. Select a table, complete only the
rubrics shown, and watch both the project state and persistent synchronization banner.
For General and Civic, choose 0 through 5 for each criterion; the page shows the awarded
weighted points and running total out of 45. For mini and sponsor categories, first
record eligibility, add the required private explanation for unsure or ineligible work,
then score eligible projects from 1 through 5.

Recusal requires a reason and remains incomplete until an administrator accepts it or
reassigns the visit. Once every scope is scored or resolved, order each eligible category
from weakest at the top to strongest at the bottom. Offline completion reads “ready on
this device”, never submitted. Use **Sync now** after reconnecting and do not hand a
shared device to another person until signing out or clearing offline judging data.

The scanner station selector determines whether a scan shows participant details or
records check-in, merchandise, food, or event attendance. Camera scans suppress only
the same continuously visible code; removing and presenting it again permits the next
deliberate scan. A USB scanner or typed identifier submits with Enter. Count correction
controls always show the server-confirmed value and report a stale update instead of
overwriting a newer device.

## Interface conventions

- A dark filled button is the primary action. Warm bordered buttons are secondary.
  Underlined transparent buttons are low-emphasis tertiary actions.
- Selected tabs and toggle buttons use a dark background with white text. Focus is
  visible and is never communicated by colour alone.
- Error and status messages appear next to the affected task and remain text-readable;
  sound or colour may reinforce them but is not the only cue.
- Controls have at least a 44 px target. Layouts must reflow without horizontal page
  scrolling at the smallest supported phone width.
- Sponsor tier names are internal ordering metadata and are not shown on sponsor detail
  pages.

## Language expectations

English copy uses Canadian vocabulary and British spelling, including `organiser`,
`authorised`, `centre`, and `colour`. French copy targets Canadian French and keeps the
same meaning, action, units, interpolation values, and error severity as English. A
literal word-for-word translation is not required when idiomatic phrasing is clearer.

Report a mismatch when one locale omits an action, changes a safety warning, exposes
internal implementation details, or no longer fits or reflows at the same viewport.
