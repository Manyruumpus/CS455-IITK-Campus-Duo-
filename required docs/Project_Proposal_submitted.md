# Revised Project Proposal — Campus Duo: Study-Partner Matching and Shared-Seat Booking

**Course:** CS455 — Software Engineering  
**GitHub:** https://github.com/Manyruumpus/CS455-IITK-Campus-Duo-  
**Jira:** https://mohitpariharsworkspace-43776135.atlassian.net/?continue=https%3A%2F%2Fmohitpariharsworkspace-43776135.atlassian.net%2Fwelcome%2Fsoftware%3FprojectId%3D10000&atlOrigin=eyJpIjoiN2VmYmNkODIwNTdhNDFmYzkyYjgxYzFhMzFkNDVhZGIiLCJwIjoiamlyYS1zb2Z0d2FyZSJ9

## 1. Problem and scope

Campus Duo is a verified IIT Kanpur platform for finding compatible study partners and booking shared study seats or rooms. A student creates a profile containing courses, study goals, preferred study style, availability, and approximate preferred locations. The system presents ranked partner recommendations and allows students to send a mutual match request. After a mutual study match, the pair can reserve a capacity-limited study seat for a specified time slot. The project focuses on three engineering concerns: transparent partner matching, conflict-free booking, and bounded AI assistance.

## 2. Roles and administrative control

Campus Duo has two roles with separate dashboards and permissions:

- **Student:** Creates and updates a verified profile; controls visibility and study preferences; views recommendations; sends or accepts mutual match requests; creates, reschedules, and cancels bookings; and can hide, block, or report another user.
- **Administrator:** Reviews reports; suspends or removes accounts when justified; creates, updates, disables, and removes study spaces, seats, and slot capacities; and monitors booking, moderation, and agent audit logs.

Thus, administrators explicitly onboard and remove the shared-resource entities used for study-session bookings.

## 3. Core workflow and concurrency

A verified student requests a study partner, for example: *“Find me a CS455 problem-solving partner this weekend.”* The system filters eligible candidates, computes compatibility scores, and displays recommendations. Students may Like, Pass, or Hide a candidate. A chat is enabled only after both students mutually Like each other in Study Mode.

A mutual match may create a booking for a seat and time slot. The booking lifecycle is **create → reschedule/modify → cancel**. Creating consumes one unit of slot capacity; rescheduling atomically releases the old capacity and consumes new capacity; cancellation atomically releases capacity and records an audit event.

The shared, contended resource is a limited-capacity study seat/room slot. For example, if two matched pairs simultaneously attempt to reserve the final seat for the same date and slot, exactly one request must succeed. The server validates identity and availability, then performs an atomic conditional reservation. The database enforces a unique active reservation key `(seatId, date, slot)` and/or uses a transaction with a capacity counter. The successful request receives booking confirmation only after the database write succeeds; competing requests receive `409 Conflict` and are offered other seats or a waitlist. This server-side rule prevents double booking independently of the client UI. A reproducible concurrency test will issue simultaneous requests for the last seat and verify that exactly one reservation is confirmed.

## 4. Study-partner compatibility scoring

Before ranking, the matcher excludes the requesting student, inactive accounts, users blocked by either party, candidates hidden or reported by the requesting student, candidates outside the requested visibility policy, and candidates without any declared availability overlap. Every remaining candidate receives an explainable score from 0 to 100:

\[
S(A,B)=35C+25T+20P+10L+10G
\]

All components are normalized to \([0,1]\):

| Component | Weight | Calculation |
|---|---:|---|
| Course overlap \(C\) | 35 | Jaccard overlap: \(\lvert courses_A \cap courses_B\rvert / \lvert courses_A \cup courses_B\rvert\) |
| Time compatibility \(T\) | 25 | Common preferred weekly slots divided by the smaller number of declared available slots |
| Study-style fit \(P\) | 20 | Mean agreement on session length, pace, in-person/online mode, and silent/discussion preference |
| Location fit \(L\) | 10 | Same location = 1; compatible campus area = 0.5; otherwise 0 |
| Goal fit \(G\) | 10 | Jaccard overlap of study goals such as revision, assignments, projects, or exam preparation |

The ranking shows a score and grounded reason, for example: *“82/100: shared CS455 and CS330, three common evening slots, and similar discussion-oriented study preference.”* It does not reveal contact details, exact schedules, or sensitive profile fields.

Missing optional preferences are not treated as disagreement. If a component is absent for either student, it is removed and the remaining weights are renormalized to sum to 100. Candidates with only course information are labelled **Limited preference data** and ranked below candidates having course, time, and at least one additional preference/goal field. Candidates within one point are considered tied; ties are resolved by greater availability overlap, then recent profile activity, followed by stable pseudo-random rotation for exact ties. The system does not use protected or sensitive attributes. Students can mark preferences as high priority and can hide, block, or report candidates.

## 5. Bounded recommendation agent

The **Campus Duo Recommendation Agent** is advisory only. It interprets a student’s matching request, calls restricted tools to search eligible profiles, obtain deterministic compatibility scores, retrieve approved matching reasons, and suggest available study slots. It may explain compatibility and propose non-sensitive profile improvements or study-session plans using only explicitly shared course, goal, and availability data.

The agent may not create or accept a match, reserve/reschedule/cancel a seat, message another student, access private profiles/chats, reveal exact schedules or contact details, override eligibility/concurrency checks, or infer sensitive attributes. Users explicitly send match requests and explicitly confirm every booking. Agent requests use minimized data, tool calls and outputs are validated and audit-logged, and the platform returns a safe deterministic response if the AI service is unavailable.

## 6. Stack, risks, and development process

The proposed stack is React for the client, Node.js/Express for the API, MongoDB for profiles and bookings, IITK email/SSO verification for authentication, and an API-based LLM for the bounded recommendation agent. The project will use GitHub for code, pull requests, and peer review, and Jira for requirements, user stories, estimates, sprints, defects, and progress tracking.

Key risks are booking races, privacy leakage, harassment, unsupported AI output, AI/API failure, and scope growth. Planned mitigations are atomic reservation logic and concurrency testing; role-based access, visibility controls, block/report workflows, and admin review; allow-listed agent tools and validated grounded outputs; deterministic fallback behavior; and an MVP focused on profiles, matching, booking, administration, and testing.

For significant work, the team will maintain: **Requirement → User Story → Jira Issue → GitHub Branch → Commit(s) → Pull Request → Test Case → Test Result**. Jira identifiers will be used in branch names, commits, and pull requests. The instructor and assigned TAs will be invited to both the Jira project and GitHub repository with appropriate access.

## 7. Validation plan

The team will test: (1) concurrent requests for the same final seat/slot, verifying exactly one confirmed booking; (2) known profile pairs with manually calculated scores; (3) incomplete-preference, tie, hidden/block/report, and no-availability cases; (4) authorization tests proving that the agent cannot invoke booking or messaging actions; and (5) AI/API failure fallback. The final deliverables will include a deployed prototype, API and concurrency tests, documented scoring logic, traceable Jira/GitHub activity, and a short evaluation using test profiles and user feedback.
