# Campus Duo — Detailed Project Blueprint

**Course:** CS455 Software Engineering  
**Document type:** Living project proposal / working baseline, **not** the one-page Deliverable 0 submission  
**Version:** Draft 1.0, 23 September 2026  
**Team:** To be completed by the team  
**Project status:** Proposal revision and approval status to be confirmed; no implementation or test results are claimed in this document.

- **GitHub:** [CS455-IITK-Campus-Duo](https://github.com/Manyruumpus/CS455-IITK-Campus-Duo-)
- **Jira:** [Campus Duo Jira](https://mohitpariharsworkspace-43776135.atlassian.net/?continue=https%3A%2F%2Fmohitpariharsworkspace-43776135.atlassian.net%2Fwelcome%2Fsoftware%3FprojectId%3D10000&atlOrigin=eyJpIjoiN2VmYmNkODIwNTdhNDFmYzkyYjgxYzFhMzFkNDVhZGIiLCJwIjoiamlyYS1zb2Z0d2FyZSJ9)

> **How to use this document:** This is a plan, not evidence of completed work. Verify team decisions and update it as requirements change. Keep the one-page course proposal separate. Before executing Deliverable 1, obtain proposal approval as required by the assignment. Do not claim that Jira/GitHub access, tests, CI, deployment, or agent controls are complete until verified.

## 1. Vision, problem, and success criteria

Campus Duo is a verified IIT Kanpur student platform for discovering compatible study partners and organizing study sessions in limited-capacity campus study spaces. Students currently rely on noisy groups or personal networks to find peers with the same courses, available time, and collaboration style. Campus Duo combines consent-based discovery, deterministic explainable ranking, mutual matching, and conflict-free booking of shared two-person tables/time slots.

The system must demonstrate three capabilities:

1. **Explainable discovery:** Candidate eligibility and compatibility come from explicit, testable rules, not unsupported LLM scoring.
2. **Correct shared-resource transactions:** No study-table slot may have two active reservations for the same time interval, including under concurrent requests and retries.
3. **Bounded agentic assistance:** An agent interprets natural-language requests, chooses among allow-listed read-only tools, explains evidence, and suggests slots; it cannot execute a like, message, booking, moderation action, or private-data lookup.

The product is a course prototype, not an official IITK booking system. Study spaces are platform-managed demonstration resources unless campus authorization and actual availability data are obtained. The platform must not suggest that its bookings reserve official university facilities without authorization.

### Intended users

- Verified IITK students seeking study partners for revision, courses, projects, assignment discussion, and competitive-programming practice.
- Administrators managing the platform's resource catalogue, reports, account actions, and audit review.

### Non-goals for the minimum viable product

- No official institute room-allocation integration without permission.
- No guarantee that recommendations predict friendship or collaboration success.
- No use of sensitive personal characteristics for ranking.
- No automatic outreach, matching, or booking by the agent.
- Social/dating discovery, shared Pomodoro, agenda generation, and rich realtime chat are **optional later extensions**. If social mode is added, it requires separate opt-in visibility, consent rules, and safety review; it must not displace the required study and booking workflows.

## 2. Scope and actors

| Role | Dashboard | Allowed actions | Not allowed |
|---|---|---|---|
| Student | Profile, recommendations, matches, bookings | Manage own profile and visibility; request recommendations; like/pass/hide; block/report; use chat after mutual match if implemented; create, view, reschedule, cancel own match's bookings | Manage resource inventory or other users' accounts; read private profiles/chats; change another pair's booking |
| Administrator | Resource catalogue, reports, audit | Create/update/disable/remove tables and slots; review reports; suspend/reactivate users under policy; inspect appropriately scoped audit records | Bypass audit records; expose private data beyond legitimate moderation scope |

**Entity onboarding/removal:** Administrators onboard study spaces and their reservable two-person tables, set fixed slot schedules, and disable/remove tables. Deleting a table with future active bookings is blocked: an administrator must resolve or cancel affected bookings with an audit entry first. Disabling prevents new reservations but does not silently erase existing ones. Users may delete/deactivate their own profiles subject to retention and booking policy defined in requirements.

### Mandatory user stories

- As a student, I want to verify my institute email and set discovery preferences so only eligible users can see me.
- As a student, I want to understand why a partner is recommended and see a consistent numerical score.
- As a student, I want to mutually match before communication or shared booking.
- As a matched student, I want to book, reschedule, or cancel an available table slot without double-booking.
- As an administrator, I want to onboard/disable tables and manage availability and reports.
- As a student, I want to ask the agent for relevant partners and available slots without giving it write permissions.

## 3. User journeys and business rules

### 3.1 Verification and discovery

1. A student signs up using a verified IITK email identity (or SSO if accessible and permitted). Domain-based email verification demonstrates email ownership, **not** comprehensive campus affiliation; document this limitation.
2. The student fills required courses/topics and weekly study availability, optionally setting goals, study style, and approximate preferred campus area; opts into study discovery.
3. The server filters candidates before scoring: verified and active; study-discoverable; not self; not blocked by either party; not hidden/reported by the requester; and with at least one declared overlapping availability slot.
4. The backend returns ranked, privacy-filtered cards containing a pseudonym/display name, score, and approved reasons. Exact private schedules and contact details are withheld.
5. Each student may like or pass another; a mutual match is established only when both have liked. Repeated likes are idempotent; a block disables future discovery/contact and follows a documented policy for existing matches/bookings.

### 3.2 Booking lifecycle

**Chosen unit of contention:** One **two-person study-table slot** identified by `(tableId, localDate, slotId)`, where slots are fixed, non-overlapping intervals in the configured IITK/local timezone. One pair booking occupies the entire two-person table for that interval. This avoids the ambiguity of consuming one seat for a two-person pair. A room contains multiple such tables; room capacity is therefore the number of active available table slots. Initial prototype uses discrete slots rather than arbitrary overlapping time ranges.

1. Either member of an active mutual study match requests a table slot; the server checks authentication, active match, account status, table availability, and no conflicting booking by this pair. Product decision to confirm: whether both members must approve the booking; initial MVP allows either member, notifies both, and allows either to cancel.
2. The server attempts an atomic insert of an active booking for the exact table/date/slot. A database-enforced **unique key among active bookings** ensures at most one active reservation for that table/date/slot. Only a successful commit creates `CONFIRMED`; a competing request receives HTTP `409 Conflict` plus safe alternative availability.
3. Rescheduling is one transaction: reserve target slot and release source slot with no intermediate externally visible state. If target is unavailable, the original confirmed booking remains intact. The API uses a booking version/precondition to prevent stale update races.
4. Cancellation changes booking state to `CANCELLED` and frees the unique active slot claim atomically. Repeated cancellation should be idempotent. All state transitions create audit records and send notifications only after commit (an outbox or equivalent reliable-after-commit mechanism is preferred).
5. A client-supplied idempotency key, scoped to account and operation, prevents a timeout/retry from producing a second transaction. The system never relies on a frontend availability check for correctness.

**Database implementation decision:** MongoDB's unique partial index on active `(tableId, localDate, slotId)` bookings can guard the single-table invariant. Multi-document operations for atomic rescheduling, cancellation plus associated audit/outbox record, and related policies may require transactions on a MongoDB deployment supporting transactions (e.g., replica set). Confirm the hosting configuration and verify behavior under failure before finalizing. An alternative is PostgreSQL with unique indexes and SQL transactions; compare implementation and free-tier/hosting costs in the architecture decision record. Do not claim a plain find-then-insert flow is race-safe.

**Concurrency invariant:** For each table/date/slot, `count(active bookings) <= 1`; no booking is marked confirmed before its storage operation commits. Run simultaneous requests from distinct matched pairs for one free table slot; assert exactly one success, the rest conflicts, and one durable active record. Also test concurrent reschedule vs cancellation and duplicate retries.

## 4. Deterministic partner matching

### 4.1 Eligibility and scoring

For each eligible pair \(A,B\), calculate a score in `[0,100]`:

\[
S(A,B)=35C+25T+20P+10L+10G,
\]

where every component is within `[0,1]`:

| Factor | Weight | Definition |
|---|---:|---|
| \(C\): course/topic overlap | 35 | \(\lvert C_A\cap C_B\rvert/\lvert C_A\cup C_B\rvert\), using canonical course/topic IDs |
| \(T\): time compatibility | 25 | \(\lvert T_A\cap T_B\rvert/\min(\lvert T_A\rvert,\lvert T_B\rvert)\), using a fixed grid of weekly slots |
| \(P\): study-style agreement | 20 | Mean normalized agreement on jointly provided style fields (pace, session length, discussion/silent, online/in-person); document each field's scoring map |
| \(L\): location fit | 10 | Same preferred campus area = 1; predefined nearby/compatible area = 0.5; otherwise 0 |
| \(G\): goal overlap | 10 | \(\lvert G_A\cap G_B\rvert/\lvert G_A\cup G_B\rvert\), using predefined goal IDs |

Required fields `courses` and `weeklyAvailability` must be non-empty; therefore \(C\) and \(T\) always have defined denominators. Candidates without time overlap are removed before scoring. For optional \(P,L,G\), a field contributes only when **both** users supplied it; unset/empty optional fields are not interpreted as incompatibility. If \(W\) is the set of available components, compute `score = 100 × sum(weight_i × factor_i for i in W) / sum(weight_i for i in W)`, where original weights are fractions 0.35, 0.25, 0.20, 0.10, 0.10. Apply consistent rounding only at presentation. Provide an indicator when optional-data coverage is low; ranking remains numeric without an undisclosed hard demotion. A separate data-completeness indicator and deterministic tie rule avoid claiming a score is fair while silently overriding it.

Example: if two students have `C=1`, `T=0.5`, and neither supplies style, location, or goals, the displayed score is `100 × (0.35 + 0.25×0.5)/(0.35+0.25) = 79.17`, alongside “limited preference data.” This illustrates a provisional score, not certainty about compatibility.

### 4.2 Ties, personalization, and privacy

- Display rounded scores, but sort by the unrounded score. Scores within one point count as a near tie; prefer higher absolute count of shared weekly slots, then use deterministic daily rotation seeded by candidate IDs and date for exact ties. Avoid a recency preference that systematically hides less-active students.
- Show evidence-backed reasons such as shared courses and general overlapping time windows, never exact private schedules, contact details, hidden fields, or sensitive traits.
- No sensitive or protected attributes are used. A block removes a pair from recommendations in both directions. User reports are scoped to moderation policy; a single unverified report does not automatically globally penalize someone.
- Ranking weights are **fixed for the MVP**. A later user-priority feature must define a documented weight-adjustment formula and tests rather than quietly altering scores.
- Validate explanation faithfulness by mapping each displayed reason to permitted rule output. Recalculate on relevant profile changes and document how stale cached recommendations are invalidated.

## 5. Agentic AI design and governance

### Purpose and workflow

The agent's useful workflow is more than producing a chat response: it interprets a student's natural-language query, chooses among limited read-only tools, applies structured filters, retrieves ranked eligible profiles and permitted reasons, optionally checks available study slots for an existing match, and proposes explainable choices. It does not own the eligibility decision or compute compatibility scores itself.

```text
Authenticated student query → parse/validate intent → allow-listed tool selection
→ server-side eligibility + deterministic score → sanitized reasons/slots
→ structured, grounded response → user chooses whether to take action
```

| Tool / capability | Safe input/output boundary |
|---|---|
| `searchEligibleProfiles(filters, limit)` | Caller identity comes from server session, not agent-supplied `userId`; returns only eligible public card IDs/fields |
| `calculateCompatibility(candidateIds)` | Backend loads permitted profiles, computes scores, returns numeric breakdown; agent cannot submit a fabricated score |
| `getAllowedMatchReasons(candidateIds)` | Returns allow-listed reason codes and sanitized text arguments only |
| `getAvailableStudySlots(matchId, dateRange)` | Checks caller's membership in active match; returns public table/slot availability, not another student's private calendar |

The agent can autonomously parse, call those **read-only** tools, select permitted recommendations, and draft explanations. Liking, accepting a match, messaging, booking/rescheduling/cancelling, reporting, or moderation require user action through separate authenticated application endpoints; the agent has no write-tool credentials. Even with explicit user consent, the user performs the action through normal guarded APIs rather than delegating it to the agent.

### Risks, controls, and tests

| Failure mode | Prevention and test |
|---|---|
| Prompt injection in a profile or request tries to invoke another tool | Treat all profile/query text as untrusted; tool allow-list and schemas; attempt a malicious profile instruction and confirm no write tool executes |
| Hallucinated score or invented matching reason | Backend owns score and reason codes; validate generated output against codes; fallback to deterministic template on mismatch |
| Private-data leakage or blocked-profile retrieval | Backend authorization and minimal projection; seed hidden/blocked profile fields and assert absent from agent tool/output traces |
| Invalid tool arguments or excessive result count | Validate mode, IDs, ranges, and limits; cap tool calls and tokens; test malformed and oversized requests |
| LLM timeout, outage, or rate limit | Deadline, bounded retry/circuit breaker as appropriate, non-LLM ranked results and reason templates; test outage path |

Record timestamp, requesting user pseudonymous ID, tool name, validated parameter categories, policy outcome, response status, model/provider usage and request correlation ID. Do not log private profile text, credentials, or raw chats. Evaluate retention and access policy during D1/D3 security review. Record AI Engineering Log entries with prompt/output, human critique, corrections, acceptance/rejection, and final artifact. Treat any generated proposal or architecture as a draft requiring team review.

## 6. Proposed architecture and data

**Architecture:** A React web client calls a Node.js/Express modular monolith with separate Profile/Auth, Matching, Match/Consent, Booking, Administration/Moderation, Notification, and Agent modules. MongoDB stores source-of-truth records; an external LLM is accessed only by the agent module. A modular monolith is a starting proposal because it reduces operational overhead and preserves clear server-side transaction boundaries; microservices can be considered and rejected/accepted with an architecture decision record in D1. Authentication/authorization guard every route and every agent tool, not only UI controls. No production cloud provider or deployment has been selected yet.

| Entity | Key fields / constraints |
|---|---|
| User | Stable ID, verified-email hash/identity, role, active/suspended status, created/updated timestamps |
| StudyProfile | User ID, public fields, course IDs, weekly slot IDs, style/goals/location, consent/visibility, profile version |
| Interaction | Actor, target, like/pass/hide/block/report state, timestamp; uniqueness for actor/target/action |
| Match | Canonical sorted user pair, active/closed state, creation time; one active pair record |
| StudySpace/Table | Space ID, table ID, descriptive location, capacity fixed at two users, active/disabled state |
| Slot | Table ID, local date, fixed slot ID/start/end, active/disabled status |
| Booking | Booking ID, match ID, table/date/slot, status, version, created/cancelled timestamps, idempotency reference; unique active table/date/slot |
| Audit/Outbox | Actor, entity/action, correlation ID, redacted metadata, timestamp, delivery state as needed |

**Illustrative API plan, not a finalized contract:** `POST /auth/verify`, `GET/PUT /profiles/me`, `POST /recommendations/search`, `POST /matches/likes`, `POST /bookings`, `PATCH /bookings/:id`, `DELETE /bookings/:id` (semantic cancellation), `GET /tables/availability`, `POST /reports`, and admin-only `POST/PATCH /admin/tables`. Write operations require authenticated callers, validated payloads, authorization, CSRF protections if cookie sessions are used, rate limiting where appropriate, and idempotency for booking. Document final endpoints in D2.

**Architecture decisions to document in D1 (not yet claimed as completed):** MongoDB unique index/transactions vs PostgreSQL relational constraints; modular monolith vs separate services; fixed slots vs arbitrary time intervals; deterministic score vs LLM scoring. Produce system/component/sequence diagrams, two meaningful rejected alternatives, three engineering decision records, and three critically evaluated LLM suggestions per assignment.

## 7. Requirements and acceptance criteria

| ID | Priority | Requirement | Acceptance evidence |
|---|---|---|---|
| FR-01 | Must | Only verified IITK-email users may access student workflows | Unverified API access denied; verification succeeds for controlled test account |
| FR-02 | Must | Student and admin dashboards and server-side RBAC are separate | Student cannot create/disable a table or read admin audit endpoint |
| FR-03 | Must | Student controls profile discovery; blocked users cannot see each other in recommendations | Visibility/block integration tests |
| FR-04 | Must | Eligibility filters and scoring implement Section 4 exactly | Hand-calculated fixtures, missing-data/tie tests |
| FR-05 | Must | Mutual likes create one active match; a single like does not authorize shared booking | Two-sided consent and idempotent-like tests |
| FR-06 | Must | Administrator can onboard, disable, and remove study tables subject to active bookings | Resource lifecycle and blocked-removal tests |
| FR-07 | Must | Booking creation enforces unique active table/date/slot | Concurrent final-slot test yields one success |
| FR-08 | Must | Reschedule either atomically succeeds or leaves original booking unchanged | Target-conflict/DB-failure regression tests |
| FR-09 | Must | Cancellation releases table slot without duplicate side effects | Repeated cancellation and rebooking tests |
| FR-10 | Must | Agent uses read-only allow-listed tools and cannot execute consequential actions | Tool-policy, authorization, and prompt-injection tests |
| FR-11 | Must | LLM failure leaves search/ranking and booking usable | Simulated outage tests |
| FR-12 | Must | Logs/audits record sensitive state changes without secret leakage | Audit inspection and redaction tests |
| FR-13 | Must | Reports and blocks can be submitted and reviewed by admin | Cross-role authorization and workflow test |
| FR-14 | Should | Mutual-match messaging with per-message authorization | Unmatched users cannot send/read messages |
| FR-15 | Could | Optional independent social mode with new consent policy | Separate approved scope/requirements and tests |

**Non-functional targets (proposed, to validate in D1):** Minimum 80% code coverage unless approved exception; no double allocation under a reproducible concurrency workload; baseline load model of at least 100 daily active users and 250 core transactions/day or a justified equivalent; measurable response latency/throughput targets set before testing; three failure/recovery demonstrations; input validation, secure secrets storage, and role-based protection; auditable outcomes without sensitive-data leakage. These are targets/requirements, **not claimed achieved measurements**.

## 8. Testing, security, reliability, and performance

### Testing matrix

| Layer | Planned evidence |
|---|---|
| Unit | Eligibility, each score factor, missing-data renormalization, ties, booking state transitions, agent reason validation |
| Integration | Verified identity/permissions, mutual likes, database unique index and transactional reschedule/cancel, agent tool policy |
| System/end-to-end | Profile → recommendation → mutual match → booking → reschedule/cancel; admin resource onboarding/removal |
| Adversarial | Last-slot races; repeated/idempotent requests; blocked-profile injection; student calling admin APIs; malformed LLM output |
| Regression | A named regression test for every significant defect fixed |
| Failure/recovery | DB unavailable during booking; LLM timeout; duplicate request; server restart/reschedule interruption |
| Load/performance | Realistic mixed read/write workload, latency percentiles, throughput, bottleneck diagnosis, before/after optimization |

Track at least five genuine defects/weaknesses found and fixed, including at least two from adversarial, concurrency, security, or failure testing. Do not invent bugs or results. Coverage evidence should distinguish relevant backend/frontend modules and justify exclusions if any.

### Threat model starter

- Unauthorized student access to admin endpoints or another pair's booking.
- Enumeration/leakage of hidden profiles, schedules, chat, or email identifiers.
- Booking races, replay, or duplicate requests that cause double allocation.
- Prompt injection and tool misuse by the agent.
- Spam, impersonation, harassment, and abusive reporting.
- Credential theft, weak session controls, exposed API keys, or unsafe error messages.

Plan at least three security test scenarios, including a demonstrated student-to-admin authorization-abuse attempt prevented at the API boundary. Store secrets outside the repository, redact logs, rate-limit sensitive actions, and document retention/deletion choices. The admin should not receive unrestricted data just because they have a dashboard.

### Observability and cost

Instrument request correlation IDs; log booking outcomes, conflicts, DB transaction failures, blocked authorization attempts, and agent tool choices without sensitive payloads. Record important state transitions in append-only/auditable events. Estimate hosting, database, storage, mail/identity, inference, and deployment costs against free-tier limits; compare estimated and actual usage where available. Choose and document a cloud deployment suitable for the assignment, subject to access and cost constraints.

## 9. Project management and traceability

Jira holds product requirements, user stories, tasks, bugs, sprint goals, estimates, priorities, individual assignments, status, and dashboard. GitHub holds code, issue-linked branches/commits, reviewed PRs, tests, and CI. Use each person's own account. Link significant work as:

`Requirement → User story → Jira issue → branch → commit(s) → PR/review → test case → test result`.

For at least 8–10 critical requirements, populate a real traceability matrix. Initial template (do not fabricate IDs):

| Requirement | User story | Jira issue | PR/commit | Test case | Actual result |
|---|---|---|---|---|---|
| FR-04 | To be written | To be created | Pending | Score fixtures | Pending |
| FR-07 | To be written | To be created | Pending | Concurrent last-slot test | Pending |
| FR-10 | To be written | To be created | Pending | Agent write-tool denial | Pending |

Follow issue-key conventions after the actual Jira project key is confirmed, for example `<KEY>-123` in branches/commits/PRs. Require another teammate to review significant PRs, keep Jira current during work, record sprint review/retrospective, and document any instructor/TA requirement change with impact on requirements, design, tests, schedule, and costs.

**Access checkpoint:** Instructor and assigned TAs need appropriate GitHub and Jira access. Verify invitations were accepted; merely writing the links is not equivalent to granting access. The supplied Jira link has redirect/query parameters; confirm staff can open the actual project directly.

## 10. Delivery milestones and current decisions

| Milestone | Course deadline | Team output |
|---|---|---|
| Deliverable 0 | 29 Aug 2026, 11:59 PM | One-page approved proposal (separate from this blueprint) |
| Deliverable 1 | 26 Sep 2026, 11:59 PM | Requirements/use cases, architecture/diagrams, alternatives and decisions, initial traceability, Jira setup/integration, sprint plan, AI Engineering Log |
| Deliverable 2 | 15 Oct 2026, 11:59 PM | Working code, bounded agent workflow, reviewed PR history, docs, Jira evidence, core transactional demo |
| Deliverable 3 | 6 Nov 2026, 11:59 PM | Test/coverage, five genuine fixed defects, concurrency/security/reliability/performance evidence, cost/timeline, deployment, final traceability |
| Final demo | 8–13 Nov 2026 | Scenario-led normal, concurrency, failure, security, agent, and traceability demonstrations; individual viva and retrospective |

All assigned deliverables must go to Hello IITK and the repository's `Deliverables/` directory, while Jira remains available to staff. The dates and deliverable requirements are from the CS455 assignment and must be reconfirmed against any subsequent instructor announcement.

**Immediate team decisions before implementation:** (1) confirm proposal approval; (2) confirm staff/team access and Jira–GitHub connection; (3) resolve MongoDB transaction hosting vs PostgreSQL alternative; (4) fix slot duration, timezone, match/booking cancellation policies; (5) agree on approval flow for booking by either matched student; (6) set exact measurable latency target and testing workload; (7) assign owners and schedule a sprint within the course timeline. Record decisions in Jira/architecture docs; do not represent this planning draft as completed engineering evidence.