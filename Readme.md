# Campus Duo

> **CS455 — Software Engineering Course Project**  
> **Deliverable 0: Project Proposal**

Campus Duo is an IIT Kanpur platform for verified students to discover compatible study partners and book capacity-limited study spaces or study-session slots after a mutual study match. It combines deterministic, explainable matching with a governed Agentic AI assistant. The project emphasizes correct transactions, privacy, safety, concurrency, testing, security, observability, and traceable software engineering practice.

## Project Links

- **Jira:** [Campus Duo Jira Board](https://mohitpariharsworkspace-43776135.atlassian.net/?continue=https%3A%2F%2Fmohitpariharsworkspace-43776135.atlassian.net%2Fwelcome%2Fsoftware%3FprojectId%3D10000&atlOrigin=eyJpIjoiN2VmYmNkODIwNTdhNDFmYzkyYjgxYzFhMzFkNDVhZGIiLCJwIjoiamlyYS1zb2Z0d2FyZSJ9)
- **Repository:** [CS455-IITK-Campus-Duo](https://github.com/Manyruumpus/CS455-IITK-Campus-Duo-)
- **Proposal:** [`Deliverables/Deliverable_0_Project_Proposal_Campus_Duo.md`](Deliverables/Deliverable_0_Project_Proposal_Campus_Duo.md)

> **Access requirement:** The instructor and assigned TAs must be invited to both the Jira project and this GitHub repository with appropriate access. Every team member must contribute from their own GitHub account.

## Problem

Students often struggle to identify peers studying the same course, sharing compatible availability, or wanting similar forms of collaboration such as revision, project work, competitive-programming practice, or assignment solving. Informal groups are noisy and do not provide privacy controls, compatibility ranking, or reliable session planning.

Campus Duo provides a verified, consent-first system for discovering compatible study partners and safely planning a study session in a capacity-limited space.

## Core Features

- IITK email verification and secure authentication
- Student profile, discovery consent, and privacy settings
- Study preferences: courses, topics, availability, goals, study style, interests, and locations
- Deterministic compatibility filtering and ranking
- Like, Pass, Save, Block, and Report actions
- Mutual-match-only chat for study partners
- Capacity-aware study-space/session booking
- Booking creation, rescheduling, and cancellation
- Separate Student and Administrator dashboards
- Controlled Agentic AI recommendations and explanations
- Transaction, moderation, booking, and agent audit logs

## Roles

| Role | Primary responsibilities |
|---|---|
| **Student** | Manages profile/privacy settings, obtains recommendations, connects through mutual Likes, uses mutual-match chat, and creates/reschedules/cancels bookings |
| **Administrator** | Manages study spaces and capacities, reviews reports, suspends/removes accounts if necessary, and reviews booking, moderation, and agent audit logs |

## Transaction and Concurrency

A mutually matched pair can book a limited-capacity study-space time slot. A booking is a stateful transaction:

```text
Create booking     → consumes one capacity unit
Reschedule booking → releases old capacity and consumes new capacity atomically
Cancel booking     → releases capacity and records an audit event
```

The central correctness requirement is that a single capacity unit can never be allocated twice. When multiple users attempt to reserve the last seat concurrently, the system will use server-side validation, an atomic conditional database update/transaction, and active-booking uniqueness constraints so that only the permitted number of requests succeeds.

## Compatibility Ranking

For Study Mode, Campus Duo will initially use the following deterministic score:

\[
S(u,v)=0.35C+0.25T+0.15G+0.10I+0.10L+0.05P
\]

| Symbol | Meaning |
|---|---|
| \(C\) | Course overlap |
| \(T\) | Availability overlap |
| \(G\) | Study-goal compatibility |
| \(I\) | Interest overlap |
| \(L\) | Preferred-location overlap |
| \(P\) | Study-style compatibility |

Eligibility filtering removes the requesting user, unverified profiles, users outside the relevant mode, blocked users, users who opted out of discovery, and profiles that violate privacy or pass rules.

## Agentic AI

### Match Recommendation and Explainer Agent

The agent accepts a natural-language request such as:

> “Find me a CS455 problem-solving partner this weekend.”

It extracts permitted structured filters, calls restricted backend tools, presents ranked candidates, and generates a concise explanation supported by the deterministic matching result.

### Allowed tools

```text
searchEligibleProfiles(userId, mode, filters, limit)
calculateCompatibility(userProfile, candidateProfiles, mode)
getAllowedMatchReasons(userId, candidateId, compatibilityBreakdown)
getAvailableStudySlots(matchedUserIds, preferredTime, preferredLocation)
```

The agent does not directly query the database and receives only data allowed by authorization and privacy rules.

### Action boundaries

| Category | Agent actions |
|---|---|
| **Autonomous** | Parse request, retrieve authorized candidates, obtain deterministic scores, explain approved matching evidence, recommend available slots |
| **User approval required** | Like a user, send a message, create/reschedule/cancel a booking, submit a report |
| **Prohibited** | Access hidden profiles, private chats, exact schedules, contact details, credentials, sensitive attributes, or take moderation actions |

The system will validate tool arguments and agent outputs, audit important agent decisions/tool calls, prevent unsupported explanations, and provide a safe fallback when the LLM provider is unavailable.

## Planned Stack

| Layer | Planned technology |
|---|---|
| Frontend | React, React Router, Tailwind CSS |
| Backend | Node.js, Express.js, Socket.io |
| Database | MongoDB with atomic operations/transactions for capacity handling |
| Authentication | IITK email verification, secure sessions/JWT, RBAC |
| AI | API-based LLM with a Node.js orchestration service and allow-listed tools |
| Testing | Jest, React Testing Library, Supertest/Postman, concurrency/load tests |
| Delivery | GitHub, Jira, pull requests, peer review, CI, cloud deployment |

## Engineering Workflow

Jira is the system of record for requirements, user stories, tasks, estimates, sprints, bugs, priorities, and progress. GitHub is the system of record for code and reviewed implementation. Significant work must preserve the following traceability:

```text
Requirement → User Story → Jira Issue → GitHub Branch → Commit(s) → Pull Request → Test Case → Test Result
```

### Branch and pull-request convention

```text
Branch:  feature/CD-123-capacity-aware-booking
Commit:  CD-123 enforce atomic capacity allocation
PR:      CD-123: Add capacity-aware booking transaction
```

Every significant pull request should reference its Jira issue, describe the implementation and tests performed, and receive review from at least one other team member before merging.

## Project Status

**Current phase:** Deliverable 0 — Proposal submission and approval pending.

Implementation of Deliverable 1 begins only after proposal approval. The initial backlog, system architecture, requirements traceability matrix, and sprint plan will be maintained in Jira and committed to the repository after approval.

## Planned Repository Layout

```text
.
├── Deliverables/
│   └── Deliverable_0_Project_Proposal_Campus_Duo.md
├── docs/
│   ├── architecture/
│   ├── requirements/
│   ├── testing/
│   └── ai-engineering-log/
├── frontend/
├── backend/
├── tests/
└── README.md
```

## Initial Risks

| Risk | Initial mitigation |
|---|---|
| Race conditions and overbooking | Atomic updates/transactions, constraints, and reproducible concurrency testing |
| Harassment or privacy abuse | Verification, consent and visibility controls, mutual-match chat, block/report workflow, administrator review |
| LLM hallucinations or data leakage | Deterministic ranking, approved evidence only, output validation, restricted tools, audit logging |
| LLM/API failure | Timeouts, error handling, and deterministic non-AI fallback |
| Scope expansion | MVP-first delivery: profiles, matching, booking, admin controls, governed AI, and testing |

## License

This repository is maintained for the CS455 course project. Licensing and reuse terms will be finalized by the project team.
