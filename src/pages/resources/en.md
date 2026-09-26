# Hack the Hill III

## Competition Rules, Challenges, Prizes & Judging

**September 25–27, 2026**

**University of Ottawa**

These rules govern the Hack the Hill III competition. All participants must also follow the [**Hack the Hill Participant & Event Policy**](https://docs.google.com/document/d/1mEmObs9W3Q_YJWZ26kinqstjbGlp90BIG_QOxKLwW5Q/edit), the [**MLH Code of Conduct**](https://github.com/MLH/mlh-policies/blob/main/code-of-conduct.md), applicable uOttawa requirements, and any additional rules published for a specific challenge or prize. The Participant & Event Policy already governs venue use, safety, safeguarding, conduct, and organizer enforcement powers, so those requirements are not repeated here.

# Competition Schedule

| Competition milestone                        | Time                                              |
| -------------------------------------------- | ------------------------------------------------- |
| Team Formation                               | Friday, September 25 at 9:00 PM                   |
| **Hacking begins**                           | **Friday at 10:00 PM**                            |
| Draft Devpost submission                     | **Sunday at 12:00 AM** — midnight Saturday night  |
| **Hacking ends / final submission deadline** | **Sunday at 10:00 AM**                            |
| Judging                                      | 10:30 AM–12:00 PM, 1:00–3:00 PM, and 3:30–5:00 PM |
| Closing Ceremony                             | 5:00 PM in C140                                   |

> The official hacking period is **36 hours**, from 10:00 PM Friday to 10:00 AM Sunday. Exact judging assignments will be announced on Discord.

# Competition Rules

## Eligibility and Teams

Teams may have up to **four members**. Competitors must be current students or recent graduates who graduated within the previous year.

Every competitor must be **registered for Hack the Hill III and checked in at the event**. Participants under 18 may compete and receive prizes provided they have completed the applicable registration and consent requirements.

Organizers, volunteers, judges, sponsor representatives, and others with privileged competition access may not compete.

A competitor may be a member of **one competing team only**. Everyone materially contributing to the project as a competitor must be an eligible member of that team and must appear on its final Devpost submission.

Participants are expected to participate in person. They may temporarily leave the venue, but leaving does not change competition deadlines or requirements.

Teams may receive advice, mentorship, debugging assistance, technical guidance, and feedback from people outside the team. Outside assistance must not amount to someone else substantially doing the team's project for them.

Each team must choose **exactly one** of the three main tracks: General, CGI, or Civic Technology. A team cannot compete in more than one main track.

The same project may also be entered into **as many mini-challenges as it qualifies for**, including the MLH prize categories. Each mini-challenge has one winning team. Entering mini-challenges does not require a separate project and does not affect the team's choice of main track.

## Project Development

Substantive work on a competition project must take place during the official hacking period.

Before 10:00 PM Friday, teams may research, brainstorm, plan, discuss architecture, or develop ideas. They may also revisit an idea they have explored previously. However, teams may not enter a substantially pre-built project or reuse substantial project-specific implementation created before the hackathon.

Teams may use normal development resources, including libraries, frameworks, APIs, SDKs, open-source software, templates, public datasets, pretrained models, development tools, code generators, and other generally available resources. Applicable licences and attribution requirements still apply.

### AI-Assisted Development

**AI-assisted development is allowed.**

Teams may use generative AI and coding assistants for any normal development activity, including research, coding, debugging, design, testing, and documentation. There is no requirement that a particular proportion of the project be manually written, and teams do not need to disclose AI use merely because AI was used.

Teams remain responsible for everything they submit and must understand their project well enough to explain its functionality, important technical decisions, architecture, and limitations to judges.

Judges may ask technical questions to understand the team's contribution and decision-making. Hack the Hill will not attempt to determine whether particular lines of code were AI-generated, and commit size, coding style, or AI use alone is not evidence of a rules violation.

## Existing Work and Verification

Teams may reuse generally applicable tools or resources they created previously, but they may not disguise pre-existing project-specific work as work completed during the hackathon.

Where there is a genuine question about compliance, organizers may request reasonable evidence such as repository history or an explanation of how the project was developed. Repository cleanliness, commit frequency, and code style are not judging criteria.

## Hardware

Teams may use their own hardware as well as equipment provided by Hack the Hill or MLH, subject to venue and safety requirements.

Borrowed hardware must be signed out, used according to the Hardware Rules, and returned when required.

# Submission Rules

Teams must create a [**draft Devpost submission**](https://hack-the-hill-iii.devpost.com/) by 12:00 AM Sunday so organizers can prepare the judging schedule. The project may continue to be updated afterward.

The **final deadline is 10:00 AM Sunday**, which is also the end of the hacking period. Teams are responsible for allowing enough time to finish their submission.

The final Devpost project must include all competing team members and all challenge or prize categories the team wants to enter. Challenge-specific deliverables must also be included where required.

Late submissions will not normally be accepted. Organizers may make reasonable accommodations for an event-wide technical failure, Devpost outage, or another circumstance clearly outside the team's control.

# Main Tracks and Prizes

Hack the Hill III has three main tracks. **Each team may compete in only one.** The advertised maximum prize assumes a four-person team.

| Challenge                            |  1st |  2nd |  3rd |
| ------------------------------------ | ---: | ---: | ---: |
| **CGI — The Northwind Brief**        | $500 | $300 | $200 |
| **Civic Technology**                 | $500 | $300 | $200 |
| **General Challenge — Best Overall** | $500 | $300 | $200 |

Only eligible, registered, checked-in competitors listed on the winning team's final Devpost submission may receive Hack the Hill competition prizes.

# CGI Challenge — The Northwind Brief

The CGI Challenge places teams in the role of a consulting team advising the fictional **Northwind Utilities**.

Northwind supplies electricity and water to **1.8 million homes and businesses across six regions**. It is regulated, under pressure, and dealing with a serious customer-complaints problem:

- **1,599 complaints** are currently open;
- average resolution time has risen from **9.1 to 38.2 days**;
- **77% of complaints** breach Northwind's service-level targets;
- its regulator satisfaction score has fallen from **4.3 to 2.6 out of 5**; and
- agents may need to use four of Northwind's 15 systems to answer one call.

Northwind has asked for an AI-powered complaint-triage and response system that can clear the backlog and raise its regulator score above 4.0 within twelve months. **Your first job is to decide whether that is the right solution.**

Your answer could be AI, data analysis, a process redesign, infrastructure, an integration, a product prototype, a pricing or organizational change, or something else entirely. No approach is pre-approved. Judges will assess whether your recommendation follows from the evidence and whether your build supports it.

Northwind previously ran a nine-month AI assistant pilot in 2025 and paused it. Its results are included in the data.

## Challenge Data

[Download the Northwind synthetic data pack (ZIP)](/assets/resources/cgi/Northwind_Challenge_Data.zip)

The archive contains six synthetic CSV files that are safe to publish, share, and commit to a repository:

| File                          | Contents                                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `northwind_complaints.csv`    | Two years of complaint records, including resolution, SLA, transfer, reopening, and bill-correction fields |
| `northwind_systems.csv`       | Northwind's 15 systems, their age, technology, integrations, cost, owner, and notes                        |
| `northwind_monthly_kpis.csv`  | 24 months of operational volumes, resolution, calls, cost to serve, and regulator scores                   |
| `northwind_meter_reads.csv`   | Metering, estimated reads, smart-meter coverage, and billing exceptions by region and month                |
| `northwind_ai_pilot_2025.csv` | Nine months of results from the paused AskNorthwind assistant pilot                                        |
| `northwind_unit_costs.csv`    | Starting-point costs for calls, complaints, corrections, visits, smart meters, staff, and penalties        |

Read all six files. A central insight requires connecting evidence across files. You may use outside benchmarks or public data, but you must cite the source.

At **3:00 PM Saturday**, Northwind will provide an update that changes part of the situation. Teams should be prepared to adapt their proposal.

## Required Deliverables

CGI teams must submit and demonstrate:

- a **five-minute executive-style pitch**, followed by **three minutes of questions**, covering the diagnosis, proposal, live demo, value, and delivery approach;
- a **working build** demonstrated live—the build may be an analysis, AI or ML system, product prototype, integration, architecture, service design, or another appropriate artefact; and
- a **one-page value case** showing build and operating costs, expected savings or benefits, payback, assumptions, and the effect of those assumptions being wrong.

Every team member must speak for at least **30 seconds** during the pitch. Slides are optional; a working demo is not.

AI development tools are allowed. Teams must be able to explain and defend everything they present, including model behaviour, accuracy, costs, and failure modes where relevant.

The final Devpost submission must include a repository or folder link, the one-page value case, and any slides used. Use only synthetic data—do not use real customer data.

## CGI Judging

The CGI Challenge uses its own 100-point rubric:

| Criterion              |  Points |
| ---------------------- | ------: |
| Problem Framing        |      20 |
| Solution & Feasibility |      20 |
| The Build              |      25 |
| Value Case             |      20 |
| Pitch                  |      15 |
| **Total**              | **100** |

Judges will look at whether the team identified the real problem, proposed a feasible response, built something that supports that response, made a credible value case, and communicated it effectively.

Strong submissions use the data to challenge or validate the client's assumptions, scope an achievable first phase, state what the proposal does not fix, show a reliable live demo, and make their financial assumptions visible. Technology without a supported diagnosis, slides in place of a working build, unsupported benefit estimates, running over time, and leaving the presentation to one person will lose points.

Northwind's fictional Chief Operating Officer will take questions at times announced on Discord. Asking focused client questions is encouraged.

# Civic Technology Challenge

- **1st:** $500
- **2nd:** $300
- **3rd:** $200

Build something that brings **government closer to people, or people closer to government**.

This can include tools related to public services, legislation, public information, civic participation, communication with institutions or representatives, feedback on public decisions, or other meaningful interactions between people and government.

Software, hardware, data, AI, and other technical approaches are all welcome.

To qualify for the Civic Technology Challenge, the team's demo must clearly demonstrate that people–government connection. This is an **eligibility requirement**, not an additional hidden scoring category.

Qualifying Civic Technology projects are judged using the general Hack the Hill rubric.

# General Challenge — Best Overall

- **1st:** $500
- **2nd:** $300
- **3rd:** $200

The General Challenge is open to any eligible software, hardware, data, AI, game, developer-tool, creative-technology, or other technical project.

There is no required theme. The goal is to recognize the strongest overall projects developed during the weekend.

# Mini-Challenges

Mini-challenges are separate from the three main tracks. A team may enter **any number of mini-challenges** for which its project qualifies, regardless of whether its selected main track is General, CGI, or Civic Technology. Each mini-challenge selects **one winning team**.

Teams must select every mini-challenge they want to enter on their final Devpost submission.

## Best Project Built with ElevenLabs

Build a project that makes meaningful use of ElevenLabs.

**Prize:** Each eligible member of the winning team receives **three months of ElevenLabs Pro**.

This Hack the Hill mini-challenge is separate from MLH's **Best Use of ElevenLabs** prize category. Teams may enter both if they meet both sets of requirements.

## Best FOSS Project

Build the strongest project using **only open-source technology**.

## Best UI/UX

Awarded to the project with the strongest user interface and overall user experience.

## Best Hardware Hack

Awarded to the strongest project that meaningfully incorporates hardware.

## MathemaTech — Education for Everyone

**Prize: $200 total for the winning team**

MathemaTech’s mission is to make world-class education accessible to everyone.

Build something that empowers education for the better. Your project could:

- remove an existing barrier to education;
- explore a new way of learning; or
- serve an overlooked or underserved niche in a way no one has tried before.

## MLH Prize Categories

The MLH categories are also mini-challenges. Teams may enter as many as their project qualifies for, without changing their selected main track or building a separate project.

The current MLH categories are:

- **Best Use of ElevenLabs**
- **Best Use of Gemini API**
- **Best Use of Solana**
- **Best Use of Tiger Data**
- **Best Use of Presage**
- **Best Use of Vultr**
- **Best Use of Auth0**
- **Best Domain Name from GoDaddy Registry**

See the [official MLH prize page](https://www.mlh.com/events/hack-the-hill-30/prizes) for each category's required technology, eligibility requirements, and current prize details.

# Judging Format

General and Civic Technology judging takes place **in person**.

Each team receives:

- **5 minutes** to present and demonstrate the project
- **3 minutes** of questions from judges

The project demonstrated must be the project submitted on Devpost.

Teams should focus on their **core idea and strongest working functionality**. More features do not automatically mean a stronger project.

Judges evaluate what the team actually built and demonstrated. Mockups, slides, or descriptions may help communicate an idea, but they do not receive technical credit as though the functionality were implemented.

Projects do not need to be production-ready or fully feature-complete. A focused project that executes its core idea well may score more highly than a broader project containing many incomplete features.

# General Judging Criteria, Principles & Scoring Guidance

General and Civic Technology projects receive **40 core points plus up to 5 bonus points for presentation**.

| Criterion                          |       Points | What judges consider                                                                                                                                                                                       |
| ---------------------------------- | -----------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Technical Execution**            |       **15** | Whether the core functionality works, the technical challenge involved, the quality of the team's technical decisions, and whether the team understands its implementation.                                |
| **Idea & Impact**                  |       **10** | Whether the idea is clear, interesting, useful, creative or compelling, and whether the implementation meaningfully delivers on that idea.                                                                 |
| **Design & Usability**             |       **10** | Whether the project is understandable and usable, whether its interface or physical design supports its purpose, and whether basic accessibility and inclusive design have been considered where relevant. |
| **Learning & Technical Decisions** |        **5** | What the team learned, difficult problems it encountered, and important decisions or trade-offs made during the hackathon.                                                                                 |
| **Presentation**                   | **+5 bonus** | Clarity, use of the five-minute presentation, effectiveness of the demo, and ability to answer questions.                                                                                                  |

## Technical Execution

Judges should focus on **working implementation**, not repository aesthetics.

A technically strong project should do what the team claims it does and demonstrate meaningful technical work. Judges may ask how important parts of the system work or why particular approaches were chosen.

Code cleanliness, naming conventions, comment density, repository organization, test coverage, or whether code appears AI-generated are not independent judging criteria.

## Idea & Impact

This criterion applies to all kinds of hacks. A project does not need to solve a social problem to score highly.

A game, creative project, technical experiment, or developer tool may have strong impact because it creates an interesting experience, solves a technical problem, or demonstrates a compelling idea.

## Design & Usability

Judges should consider whether someone can reasonably understand and use the project's core functionality.

Visual polish can strengthen a project but does not replace working functionality.

## Learning & Technical Decisions

Teams should be able to explain important challenges, trade-offs, and lessons from the weekend.

Using familiar technologies does not prevent a strong score, and using unfamiliar technologies does not automatically earn one. Judges should look for genuine learning and problem-solving.

AI-assisted development is fully compatible with a high score.

## Judging Principles

**Depth matters more than breadth.** A team does not earn additional points merely for adding more screens, dashboards, integrations, or features.

**Claims should be backed by the demo.** If a project claims to perform an important function, judges should normally be able to see that function working.

**Technical understanding matters.** Judges may ask reasonable questions about architecture, data flow, technical choices, limitations, or challenges encountered.

**This is not a code review.** Judges should not spend the judging period inspecting source-code style or trying to determine whether code was written manually or generated with AI.

**This is not only a pitch competition.** A strong presentation helps communicate a good project but cannot substitute for implementation.

## Judge Scoring Guidance

Judges should use the full scoring range and evaluate projects as **36-hour hackathon projects**, not as production software.

A low score indicates that the criterion is substantially missing or poorly demonstrated. A middle score indicates competent execution. A high score should represent work that clearly stands out from the other projects judged.

Different project types should be evaluated according to their purpose. A game should not be expected to solve a public-policy problem, a backend tool should not require an elaborate visual interface, and a hardware project should not be judged as though it were a web application.

# Rule Violations and Disqualification

Judges should report suspected rule violations to organizers rather than independently disqualifying teams.

Organizers may take reasonable action for violations of the Competition Rules, Participant & Event Policy, MLH Code of Conduct, or applicable venue requirements. Depending on the circumstances, this may range from guidance or a warning to removal or disqualification.

Disqualification is not automatic for every mistake unless a rule expressly says otherwise. Organizers may consider seriousness, intent, competitive impact, safety, and whether the issue can reasonably be corrected.

Intentional cheating or misrepresentation—including presenting substantial pre-existing or third-party project work as work completed by the team during the hackathon—may result in disqualification.
