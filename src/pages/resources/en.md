# Hack the Hill III Competition Guide

**September 25–27, 2026 · University of Ottawa**

Competition rules, challenge briefs, prizes, submission requirements, and judging criteria.

Participants must follow the [**Hack the Hill Participant & Event Policy**](https://docs.google.com/document/d/1mEmObs9W3Q_YJWZ26kinqstjbGlp90BIG_QOxKLwW5Q/edit) and [**MLH Code of Conduct**](https://github.com/MLH/mlh-policies/blob/main/code-of-conduct.md).

# Competition Schedule

**All competition times are Eastern Time (ET).**

| Competition milestone                        | Time                                              |
| -------------------------------------------- | ------------------------------------------------- |
| Opening Ceremony & challenge release         | Friday at 7:00 PM                                 |
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

The team roster listed on the final Devpost submission at 10:00 AM is considered the team's final competition roster. Changes after the deadline require organizer approval.

**Competitors must check in and participate in person.** Competitors may temporarily leave the venue, but leaving does not change competition deadlines or requirements.

Teams may receive advice, mentorship, debugging assistance, technical guidance, and feedback from people outside the team. Outside assistance must not amount to someone else substantially doing the team's project for them.

Each team must choose **exactly one** of the three main tracks: General, CGI, or Civic Technology. A team cannot compete in more than one main track.

The same project may also be entered into **as many Hack the Hill mini-challenges and MLH prize categories as it qualifies for**. Each Hack the Hill mini-challenge has one winning team. Entering these categories does not require a separate project and does not affect the team's choice of main track.

## Project Development

Substantive work on a competition project must take place during the official hacking period.

Before 10:00 PM Friday, teams may research, brainstorm, plan, discuss architecture, or develop ideas. They may also revisit an idea they have explored previously. However, teams may not enter a substantially pre-built project or reuse substantial project-specific implementation created before the hackathon.

### AI-Assisted Development

**AI-assisted development is allowed.**

Teams may use generative AI and coding assistants for any normal development activity, including research, coding, debugging, design, testing, and documentation. There is no requirement that a particular proportion of the project be manually written, and teams do not need to disclose AI use merely because AI was used.

Teams remain responsible for everything they submit and must understand their project well enough to explain its functionality, important technical decisions, architecture, and limitations to judges.

Judges may ask technical questions to understand the team's contribution and decision-making. Hack the Hill will not attempt to determine whether particular lines of code were AI-generated, and commit size, coding style, or AI use alone is not evidence of a rules violation.

## Existing Work and Verification

Teams may reuse generally applicable tools or resources they created previously, but they may not disguise pre-existing project-specific work as work completed during the hackathon.

Where there is a genuine question about compliance, organizers may request reasonable evidence such as repository history or an explanation of how the project was developed. Repository cleanliness, commit frequency, and code style are not judging criteria.

## Hardware

Teams may use their own hardware as well as equipment provided by Hack the Hill or MLH.

Borrowed hardware must be signed out and returned when required.

# Submission Rules

Teams must create a [**draft Devpost submission**](https://hack-the-hill-iii.devpost.com/) by 12:00 AM Sunday so organizers can prepare the judging schedule. The project may continue to be updated afterward.

The **final deadline is 10:00 AM Sunday**, which is also the end of the hacking period. Teams are responsible for allowing enough time to finish their submission.

The final Devpost project must include all competing team members, the team's selected main track, and every mini-challenge or MLH prize category the team wants to enter. Teams will only be considered for categories selected by the final submission deadline. Main-track or prize-specific deliverables must also be included where required.

[**Submit your project on Devpost →**](https://hack-the-hill-iii.devpost.com/)

Late submissions will not normally be accepted. Organizers may make reasonable accommodations for an event-wide technical failure, Devpost outage, or another circumstance clearly outside the team's control.

# Main Tracks and Prizes

Hack the Hill III has three main tracks. **Each team may compete in only one.**

| Main track                           |  1st |  2nd |  3rd |
| ------------------------------------ | ---: | ---: | ---: |
| **CGI — The Northwind Brief**        | $500 | $300 | $200 |
| **Civic Technology**                 | $500 | $300 | $200 |
| **General Challenge — Best Overall** | $500 | $300 | $200 |

Only eligible, registered, checked-in competitors listed on the winning team's final Devpost submission may receive Hack the Hill competition prizes.

# CGI Challenge — The Northwind Brief

You are the CGI consulting team. Northwind Utilities is the client. You have the weekend to diagnose the problem, build something that works, and explain what it is worth.

You do not need consulting experience to win. Strong technical work without a credible commercial case is incomplete; the challenge rewards teams that balance both.

## The Client

Northwind was founded in **1976** and supplies electricity and water to **1.8 million homes and businesses across six regions**. It is regulated, under pressure, and dealing with a serious customer-complaints problem:

- the complaints backlog has grown from a few hundred cases to **1,599 currently open**;
- average resolution time has risen from **9.1 to 38.2 days**;
- **77% of complaints** breach Northwind's service-level targets;
- its regulator satisfaction score has fallen from **4.3 to 2.6 out of 5**, and the regulator has written to the board;
- cost to serve per account is rising while first-contact resolution is falling; and
- contact-centre agents may need to work across four screens to answer one call.

Northwind operates **15 systems** across customer service, billing, and metering. The oldest went live in **1998**.

The board announced an AI strategy in March, but the Chief Operating Officer could not explain what the strategy contained when questioned by the regulator.

## What the Client Asked For

Northwind has invited four consulting firms to pitch. It has asked for an AI-powered solution that automates complaint triage and response, clears the backlog, and raises the regulator score above 4.0 within twelve months. It also expects a proposed solution and implementation plan.

**Your first job is to decide whether that is the right brief.**

## Anything Can Be the Answer

You are being asked to solve the client's problem, not simply build the technology the client requested. Your answer could be:

- an AI system;
- a data pipeline or analysis;
- a process or service redesign;
- infrastructure or an integration layer;
- a pricing or organizational change;
- a small, focused software tool;
- a recommendation that Northwind stop doing something; or
- another approach supported by the evidence.

You may conclude that Northwind's twelve-month target is not achievable through its proposed route. If so, show the arithmetic, explain what is achievable, and recommend a better path.

No option is prohibited or pre-approved. Judges will assess whether the recommendation follows from the evidence. Challenge the client's assumptions when appropriate, but do so with evidence rather than instinct.

Clients are often right about the pain they can see but wrong about its cause. Building exactly what was requested will still fail if it does not solve the underlying problem.

Northwind previously ran a nine-month AI assistant pilot in 2025 and paused it. The results are included in the data, and judges will expect teams to examine what happened.

## Challenge Data

[Download the Northwind synthetic data pack (ZIP)](/assets/resources/cgi/Northwind_Challenge_Data.zip)

**AI data restriction:** Using AI to analyze, interpret, or process the challenge data is strongly discouraged because this challenge is designed to assess how well your team understands the dataset's underlying structure and relationships. You may still use AI tools to write, explain, or debug code that processes the CSV files locally. Your team will be evaluated on its understanding of the data and must be able to explain its analysis and conclusions.

The archive contains six synthetic CSV files:

| File                          |    Rows | Contents                                                                                                                                                                                                                                        |
| ----------------------------- | ------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `northwind_complaints.csv`    | ~25,400 | Two years of individual complaints: dates, channel, category, priority, region, originating system, transfers, SLA target, days to close, breach and reopening flags, resolution action, information-only resolution, and bill-correction value |
| `northwind_systems.csv`       |      15 | The full application estate: age, vendor, technology, integration method, annual run cost, owning function, and notes                                                                                                                           |
| `northwind_monthly_kpis.csv`  |      24 | Monthly complaint volumes, average resolution time, first-contact resolution, call volume, cost to serve, and regulator score                                                                                                                   |
| `northwind_meter_reads.csv`   |     144 | Accounts, estimated-read rate, smart-meter penetration, billing exceptions, and serving systems by region and month                                                                                                                             |
| `northwind_ai_pilot_2025.csv` |       9 | The AskNorthwind pilot's sessions, containment, escalation, abandonment, repeat contact, and satisfaction results                                                                                                                               |
| `northwind_unit_costs.csv`    |      10 | Starting-point costs for calls, complaints, bill corrections, field visits, smart meters, agent staffing, and regulator penalties                                                                                                               |

Read all six files. The challenge's central insight is not visible in one file alone; it requires connecting two files that may not appear related.

Use only synthetic data. Do not use real customer data from any source.

You may use outside data, including public regulatory benchmarks and industry cost figures, but cite every outside source.

## Required Deliverables

All three deliverables are scored.

### 1. Client Pitch

Pitch to the judges as though they are Northwind's executive committee. They are busy, sceptical, and have already heard three other firms.

Cover, in whatever order works best:

- the diagnosis—what is actually wrong, supported by the data;
- the proposed solution, including its scope and sequence;
- a live demonstration of the build;
- the value—cost, benefit, payback, and assumptions; and
- the delivery approach—phases, team, risks, and what could go wrong.

Every team member must speak for at least **30 seconds**. Slides are optional.

### 2. Working Build

Build a real, working artefact. Choose or combine whichever approaches fit the evidence:

| Approach                        | What a strong build could demonstrate                                                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data and analysis**           | A notebook or dashboard proving the diagnosis from raw data through segmentation, root-cause analysis, or backlog forecasts under different interventions |
| **AI or machine learning**      | A classifier, clustering model, retrieval assistant, or response-drafting agent, with an honest account of accuracy, cost, and failure modes              |
| **Product or prototype**        | A working front end for the proposal, such as a unified agent desktop, customer journey, or exception-handling queue                                      |
| **Engineering or architecture** | A running integration layer, API, or data model that passes data end to end and shows how the application estate could be improved                        |
| **Service or process design**   | A redesigned and clickable journey supported by a clear operating model and role changes                                                                  |
| **Another approach**            | The smallest working artefact that proves the evidence-supported recommendation                                                                           |

### 3. One-Page Value Case

Submit one page containing numbers that a finance director could evaluate:

- what the solution costs to build and operate;
- what it saves, avoids, or earns, and over what period;
- the expected payback;
- every material assumption; and
- what happens if those assumptions are wrong.

Estimated figures are acceptable because Northwind is fictional, and `northwind_unit_costs.csv` provides a starting point. Undeclared estimates are not. A defensible estimate with visible assumptions is stronger than an unsupported confident number.

**CGI submission:** Add a repository or folder link to the final Devpost submission.

## CGI Judging

A CGI panel evaluates the proposal as a real client would, using the following 100-point rubric:

| Criterion                    |  Points | Question behind the score                                                                       |
| ---------------------------- | ------: | ----------------------------------------------------------------------------------------------- |
| **Problem Framing**          |      20 | Did the team identify the real problem, or merely deliver the brief it was handed?              |
| **Solution and Feasibility** |      20 | Could the proposal actually be delivered, at what cost, over what timeline, and with what risk? |
| **The Build**                |      25 | Does it run, was it demonstrated rather than described, and was it the right thing to build?    |
| **Value Case**               |      20 | Are the assumptions visible and reasonable, and would a finance director accept the analysis?   |
| **Pitch**                    |      15 | Was it clear, confident, on time, and supported by strong answers to the judges' questions?     |
| **Total**                    | **100** |                                                                                                 |

## CGI Challenge Tips

## What Wins Points

- a diagnosis that challenges the client's brief and proves the conclusion with Northwind's data;
- honest scope, including what should happen in the first 90 days and what should wait;
- naming what the proposed solution does not fix;
- a live demo that works the first time because the team tested it;
- visible and defensible financial assumptions; and
- a candid answer about the proposal's biggest risk.

## What Loses Points

- accepting the client's requested solution without testing the underlying assumptions;
- proposing technology that is not connected to the diagnosed problem;
- showing slides that describe a build instead of demonstrating one;
- presenting benefits without the assumptions behind them.

## A Workable Approach for First-Time Teams

1. Describe the situation in plain language before selecting a tool. What is Northwind's business, who is unhappy, and who pays?
2. Separate symptom from cause. The backlog is a symptom; the source of complaint volume and the factors slowing resolution may be different problems requiring different fixes.
3. Size the problem before solving it. Count which categories drive the greatest volume and cost.
4. Ask what a fix is worth before designing it. An excellent solution to a negligible part of the problem is still a weak recommendation.
5. Build the smallest thing that proves the point. A narrow working artefact is stronger than a broad unfinished one.
6. Rehearse the complete pitch out loud and against a timer at least twice.

Suggested roles include someone responsible for the diagnosis, someone for the build, someone for the numbers, and someone for the story. Team members may rotate roles, but ensure that each responsibility has an owner by Saturday lunchtime.

# Civic Technology Challenge

- **1st:** $500
- **2nd:** $300
- **3rd:** $200

Build something that brings **government closer to people, or people closer to government**.

Public institutions increasingly depend on digital systems that shape how people access services, understand public information, participate in decisions, establish identity, protect their privacy, and communicate with government. These may be policy questions, but they are also practical design and engineering problems.

Build a useful, responsible solution for the people and institutions that would actually rely on it. Consider their real constraints: accessibility, privacy, trust, limited resources, legacy systems, language, connectivity, and ease of use.

This can include tools related to public services, legislation, public information, civic participation, communication with institutions or representatives, feedback on public decisions, or other meaningful interactions between people and government.

The team's demo should clearly identify **the people being served, the public institution or civic process involved, and the interaction the project improves**. The connection may work in either direction: helping people interact with government or helping public institutions understand and serve people more effectively.

Civic Technology projects are judged using the general Hack the Hill rubric.

# General Challenge — Best Overall

- **1st:** $500
- **2nd:** $300
- **3rd:** $200

The General Challenge is open to any eligible software, hardware, data, AI, game, developer-tool, creative-technology, or other technical project.

There is no required theme. The goal is to recognize the strongest overall projects developed during the weekend.

**Additional ElevenLabs award:** Each member of the first-place General Challenge team receives **three months of the Pro tier**, a $297 value per person, with 600,000 credits per month.

# Mini-Challenges

Mini-challenges are separate from the three main tracks. A team may enter **any number of mini-challenges** for which its project qualifies, regardless of whether its selected main track is General, CGI, or Civic Technology. Awards vary by category and are listed below.

Teams must select every mini-challenge they want to enter on their final Devpost submission.

Mini-challenges are judged as part of the team's normal main-track judging session. Teams do not receive a separate presentation or demo for mini-challenges. Judges will consider each mini-challenge selected on the team's final Devpost submission while evaluating the same project demonstration.

Mini-challenge assessments from the different judging panels will be compared after judging to determine the winner of each category.

## $200 Hack the Hill Mini-Challenges

Each of the following selects one winning team and awards **$200 total to that team**:

- Best FOSS Project;
- Best UI/UX;
- Best Hardware Hack; and
- MathemaTech — Education for Everyone.

Each prize is divided equally among the eligible members of the winning team. A team may win more than one mini-challenge and may win a mini-challenge in addition to its selected main track.

## Sponsor-Awarded Mini-Challenge: Best Project Built with ElevenLabs

Hack the Hill's **Best Project Built with ElevenLabs** and MLH's **Best Use of ElevenLabs** are one combined challenge with one winning team. The winner receives both components of the combined award: the ElevenLabs Scale benefit provided through Hack the Hill and ElevenLabs, and the wireless-earbuds prize provided through MLH.

Build a project that makes meaningful, functional use of ElevenLabs to create natural, expressive, or dynamic audio. This could include an interactive AI companion, narrated experience, voice-enabled application, autonomous audio experience, or another project in which ElevenLabs contributes substantially to the result.

### ElevenLabs Access and Awards

| Recipient                                      | ElevenLabs and MLH benefit                                                                                                                                           |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **All participants**                           | One free month of the Creator tier—normally $22/month—with 131,000 credits                                                                                           |
| **First-place General Challenge team**         | Three months of the Pro tier for each team member—a $297 value per person—with 600,000 credits/month                                                                 |
| **Combined ElevenLabs challenge winning team** | Three months of the Scale tier for each team member—an $897 value per person, with 1.8 million credits/month—**plus the wireless-earbuds award offered through MLH** |

Use the [ElevenLabs Hacker Guide](https://docs.google.com/document/d/1mCh5MtOzBw0aJpurQVUmIVFfPMAHW3MjNemE-LNiMto/edit?usp=sharing) and [ElevenLabs documentation](https://mlh.link/elevenlabs?utm_content=Best+Use+of+ElevenLabs&utm_medium=referral&utm_source=mlh) to start building. The [official MLH prize page](https://www.mlh.com/events/hack-the-hill-30/prizes) contains the current MLH prize listing and fulfillment information.

### Claiming the Free Creator Tier

1. Join the [ElevenLabs Discord server](https://discord.com/invite/VnBvbbcdEC).
2. Open the `#🎟️│coupon-codes` channel and select **Start Redemption**.
3. Select Hack the Hill III and enter the same email address used for event registration.
4. The Discord bot will send a unique coupon code.

See the [redemption video tutorial](https://youtu.be/S143_JtCtV8) for a walkthrough.

## Best FOSS Project — $200

Build the strongest project whose core implementation uses **only open-source technologies**.

To qualify, the technologies that provide the project's core functionality—including its principal frameworks, libraries, databases, models, and software dependencies—must be open source. A proprietary API, platform, or service that provides part of the project's core functionality makes the project ineligible for this category.

Judges will consider the quality of the project, its technical execution, and how effectively the team has built the solution using an open-source technology stack.

## Best UI/UX — $200

Awarded to the project with the strongest overall user experience.

Judges will consider usability, interaction design, visual or physical coherence, clarity, and basic accessibility. The design should make the project's core functionality easier to understand and use rather than simply adding visual polish.

Projects without a traditional graphical interface may still qualify where they provide a meaningful user experience.

## Best Hardware Hack — $200

Awarded to the strongest project that **meaningfully incorporates hardware into its core functionality**.

Judges will consider how important the hardware is to the project, the quality of the hardware/software integration, technical execution, creativity, and whether the demonstrated system works.

Simply connecting a peripheral to an otherwise software-only project is not enough; the hardware should be a meaningful part of the hack.

## MathemaTech — Education for Everyone — $200

MathemaTech's mission is to make world-class education accessible to everyone.

Build something that meaningfully improves **learning or access to education**.

Projects may address barriers to education, improve how something is taught or learned, or serve learners whose needs are not adequately addressed by existing tools.

Judges will consider educational value, accessibility and reach, creativity, and the quality of the implemented solution.

## Other MLH Prize Categories

MLH also offers separate sponsor prize categories. Teams may enter as many as their project qualifies for, without changing their selected main track or building a separate project.

| MLH category                               | Prize listed by MLH              | What the project should demonstrate                                                                                                                                       |
| ------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Best Use of Gemini API**                 | MLH Swag Kits                    | Meaningful use of Gemini to add AI capabilities such as language interaction, analysis, summarization, or content generation                                              |
| **Best Use of Solana**                     | Ledger Nano S Plus               | Meaningful use of Solana in an application such as a game, social or consumer product, decentralized-finance tool, supply-chain system, identity product, or payment tool |
| **Best Use of Tiger Data**                 | Stream Deck Mini                 | An innovative and effective use of Tiger Data for PostgreSQL-backed real-time data, time-series workloads, metrics, analytics, or high-performance dashboards             |
| **Best Use of Presage**                    | Fitbit Inspire and Presage perks | Use of a Presage SDK to incorporate capabilities such as contactless vital signs, movement, emotion, engagement, or focus tracking                                        |
| **Best Use of Vultr**                      | Portable Screens                 | Meaningful use of Vultr infrastructure, cloud compute, or cloud GPUs to run or support the project                                                                        |
| **Best Use of Auth0**                      | Wireless Headphones              | Meaningful use of an Auth0 API for authentication or security capabilities such as social sign-in, multi-factor authentication, passwordless login, or AI-agent security  |
| **Best Domain Name from GoDaddy Registry** | Digital Gift Card                | Effective use of a domain registered through GoDaddy Registry                                                                                                             |

The Presage award also includes free refills of Presage development credits for three months and 30% off Presage usage charges during the first year after going live.

These summaries reflect the prizes currently published by MLH. See the [official MLH prize page](https://www.mlh.com/events/hack-the-hill-30/prizes) for sponsor links, claim codes, complete requirements, and any updates.

# Judging Format

Main-track judging takes place **in person**.

Each team receives:

- **5 minutes** to present and demonstrate the project
- **3 minutes** of questions from judges

The project demonstrated must be the project submitted on Devpost.

Teams should focus on their **core idea and strongest working functionality**. More features do not automatically mean a stronger project.

Judges evaluate what the team actually built and demonstrated. Mockups, slides, or descriptions may help communicate an idea, but they do not receive technical credit as though the functionality were implemented.

Projects do not need to be production-ready or fully feature-complete. A focused project that executes its core idea well may score more highly than a broader project containing many incomplete features.

# Judging Criteria & Scoring

**Projects are scored out of 45 points: 40 points across the four project criteria and 5 points for presentation.**

| Criterion                          |       Points | What judges consider                                                                                                                                                                                       |
| ---------------------------------- | -----------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Technical Execution**            |       **15** | Whether the core functionality works, the technical challenge involved, the quality of the team's technical decisions, and whether the team understands its implementation.                                |
| **Idea & Impact**                  |       **10** | Whether the idea is clear, interesting, useful, creative or compelling, and whether the implementation meaningfully delivers on that idea.                                                                 |
| **Design & Usability**             |       **10** | Whether the project is understandable and usable, whether its interface or physical design supports its purpose, and whether basic accessibility and inclusive design have been considered where relevant. |
| **Learning & Technical Decisions** |        **5** | What the team learned, difficult problems it encountered, and important decisions or trade-offs made during the hackathon.                                                                                 |
| **Presentation**                   |        **5** | Clarity, use of the five-minute presentation, effectiveness of the demo, and ability to answer questions.                                                                                                  |

## Technical Execution

Technical Execution rewards **working functionality**, meaningful technical work, sound decisions, and the team's understanding of what it built. Teams should be ready to explain how important parts of the project work and why they chose their approach.

## Idea & Impact

This criterion applies to all kinds of hacks. A project does not need to solve a social problem to score highly.

A game, creative project, technical experiment, or developer tool may have strong impact because it creates an interesting experience, solves a technical problem, or demonstrates a compelling idea.

## Design & Usability

Judges should consider whether someone can reasonably understand and use the project's core functionality. Depending on the project, this may include a graphical interface, API or CLI design, developer experience, physical interaction, or the clarity of the intended workflow.

Visual polish can strengthen a project but does not replace working functionality.

## Learning & Technical Decisions

Teams should be able to explain important challenges, trade-offs, and lessons from the weekend.

Using familiar technologies does not prevent a strong score, and using unfamiliar technologies does not automatically earn one. Judges should look for genuine learning and problem-solving.

## Judging Principles

**Depth matters more than breadth.** A team does not earn additional points merely for adding more screens, dashboards, integrations, or features.

**Claims should be backed by the demo.** If a project claims to perform an important function, judges should normally be able to see that function working.

**Technical understanding matters.** Judges may ask reasonable questions about architecture, data flow, technical choices, limitations, or challenges encountered.

**This is not only a pitch competition.** A strong presentation helps communicate a good project but cannot substitute for implementation.

**Integrity matters.** Intentional cheating or misrepresentation—including presenting substantial pre-existing or third-party project work as work completed by the team during the hackathon—may result in disqualification.

## Judge Scoring Guidance

Judges should use the full scoring range and evaluate projects as **36-hour hackathon projects**, not as production software.

A low score indicates that the criterion is substantially missing or poorly demonstrated. A middle score indicates competent execution. A high score should represent work that clearly stands out from the other projects judged.
