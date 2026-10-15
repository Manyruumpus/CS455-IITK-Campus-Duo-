# Campus Duo — AI Engineering Log

**Deliverable:** 1 | **Status:** Initial log; team review pending  
**Purpose:** Record actual AI involvement in requirements and architecture, critiques, edits and evidence. Never present generated text as a completed implementation, human review, or test result.  
**Owner:** TBD | **Last updated:** 23 September 2026

## Entry AIL-001 — D1 document drafting

| Field | Record |
|---|---|
| Date | 23 September 2026 (user's local date). |
| Requester | Mohit Parihar; other team members not specified. |
| Tool | Perplexity AI assistant. Model/version not provided; do not invent. |
| Input | `main_proposal.md` (Campus Duo Detailed Project Blueprint, draft 1.0) and screenshot of the Deliverable 1 checklist. |
| User request (abridged, not verbatim) | Generate separate Markdown documents from the proposal so all required D1 topics are covered, merging related topics as useful, before coding starts. |
| Generated artifact(s) | `01-requirements-and-use-cases.md`, `02-architecture-and-design.md`, `03-initial-traceability-matrix.md`, `04-project-setup-and-sprint-plan.md`, `05-ai-engineering-log.md`. |
| AI-generated suggestions | Modular monolith and transactional booking boundary; fixed two-person table slots; deterministic scoring and read-only agent; conditional MongoDB versus PostgreSQL evaluation. Most were already present as proposal ideas and were organized/expanded into D1 documents, not invented as implemented features. |
| AI limitations observed | Output cannot verify instructor approval, Jira/GitHub integration, real staff access, database transaction hosting, team assignment or actual test outcomes. Proposed slot policies, scoring maps and NFR latency thresholds still need decisions. |
| Immediate editorial control | Drafts mark unverified items as pending and keep evidence columns blank. No claim of tests, implementation, approved architecture or completed integrations. |
| Human review status | Pending; team must verify against course brief, proposal, security policy and platform feasibility. |
| Final acceptance/rejection | Pending reviewer name/date and edits; do not mark accepted merely because files were generated. |

For exact prompt/output provenance, retain the conversation or approved export according to course/privacy rules; this abridged entry alone does not reproduce a verbatim transcript.

## Three AI suggestions for critical evaluation

These are review candidates **from this drafting session and proposal baseline**, with actual human verdicts recorded upon Deliverable 2 completion.

| ID | Suggestion | Why useful | Risk / challenge | Required validation | Human verdict |
|---|---|---|---|---|---|
| AI-01 | Use a modular monolith with explicit domain modules. | Low deployment overhead and direct booking transaction boundary for a course prototype. | Modules may become tightly coupled without interface and ownership rules. | Team code-structure review; ADR-001 approval. | **ACCEPTED.** Implemented in Express backend (`routes/`, `services/`, `repository/`) and verified under Deliverable 2. |
| AI-02 | Use MongoDB unique partial active-slot index with transactions, but decide only after comparing PostgreSQL. | Storage constraint can guard concurrent claims; transactions protect multi-record transitions. | Intended MongoDB hosting may lack needed transaction setup; index alone does not guarantee atomic reschedule/audit. | ADR-004 spike on actual deployment: concurrent insert, cancellation race, failed reschedule and estimated costs. | **MODIFIED / DECIDED.** ADR-004 selected PostgreSQL 17. The partial unique index `booking_confirmed_resource_uk` demonstrated 100% collision prevention under 10-client concurrency race tests. |
| AI-03 | Keep LLM agent read-only and ground its replies in server-calculated scores/reason codes. | Retains usefulness of natural language without delegating booking/permissions to untrusted text. | Prompt injection, leakage, hallucinated explanation and outages remain possible. | Tool allow-list, authorization, malicious-profile, redaction and outage tests. | **ACCEPTED & VERIFIED.** Implemented in `backend/src/services/agentService.ts` and `scoringEngine.ts`. Bounded by allowlisted read-only tools, zero-mutation invariant, and deterministic template fallback. Verified by 9 safety tests in `backend/tests/agent.safety.test.ts`. |

## Deliverable 2 AI Engineering Entries

### Entry AIL-002 — Live Booking API & Frontend HTTP Adapter Integration

| Field | Record |
|---|---|
| **Date** | 15 October 2026 |
| **Requester** | Campus Duo Engineering Team (Mohit Parihar) |
| **Tool / Model** | Antigravity AI Pair Programmer (DeepMind) |
| **Input** | `D2_implementation_plan.txt`, `queries/06_resource_availability.sql`, `V005__bookings_and_idempotency.sql`, `IBookingService` interface. |
| **User Request** | Implement the complete PostgreSQL-backed booking vertical slice (health, locations, availability, atomic booking, participant-authorized retrieval/history, 10-client concurrency race verification, and frontend `HttpBookingAdapter` integration). |
| **Generated Artifacts** | `backend/src/routes/booking.ts`, `backend/src/services/bookingService.ts`, `backend/src/repository/bookingRepo.ts`, `backend/src/middleware/auth.ts`, `frontend/src/services/http/HttpBookingAdapter.ts`, `backend/tests/booking.test.ts`, `backend/tests/concurrency.race.test.ts`, `backend/tests/locations.test.ts`, `backend/tests/bookingRetrieval.test.ts`, `frontend/src/tests/httpBookingLive.integration.test.ts`. |
| **AI Suggestions** | (1) Add `GET /api/booking/locations` and `GET /api/booking` endpoints matching frontend query contracts. (2) Map demo booking IDs (`bk-1001` -> `...D581`) client-side while preserving strict backend ownership checks. (3) Scope test-cleanup helper to owning slot IDs to resolve Vitest worker race conditions. |
| **Human Critique & Edits** | Rejected mock authentication bypass; enforced strict `X-Campus-Duo-Test-Actor` UUID format validation client-side (`TE-003`); isolated database test cleanup in `testDbHelper.ts` to prevent race condition across parallel test workers (`TE-005`); enforced participant-only authorization on `getBooking()`. |
| **Reviewer & Date** | Mohit Parihar, 15 October 2026 |
| **Decision & Evidence** | **ACCEPTED & VERIFIED.** All 40 backend tests and 217 frontend tests pass; 10-client PostgreSQL concurrency race test proves zero duplicate bookings. |

---

### Entry AIL-003 — Bounded AI Recommendation Agent & Safety Verification

| Field | Record |
|---|---|
| **Date** | 15 October 2026 |
| **Requester** | Campus Duo Engineering Team (Mohit Parihar) |
| **Tool / Model** | Antigravity AI Pair Programmer (DeepMind) |
| **Input** | `01-requirements-and-use-cases.md#L121-125`, `02-architecture-and-design.md#L121-139`, `queries/03_study_candidates.sql`, `queries/01_private_account_profile.sql`. |
| **User Request** | Implement `POST /api/agent/recommend` governed by deterministic formula `35C + 25T + 20P + 10L + 10G`, allowlisted read-only tools, zero mutation invariant, grounding assertions, and offline template fallback. |
| **Generated Artifacts** | `backend/src/services/scoringEngine.ts`, `backend/src/services/agentService.ts`, `backend/src/routes/agent.ts`, `backend/tests/agent.safety.test.ts`. |
| **AI Suggestions** | (1) Decouple deterministic compatibility scoring from LLM inference. (2) Restrict agent to two read-only tools (`tool_get_eligible_candidates` and `tool_get_viewer_profile`) with zero write tools. (3) Implement `TemplateLlmClient` providing graceful non-LLM fallback during inference provider outage. |
| **Human Critique & Edits** | Asserted that adversarial prompt injection ("Ignore instructions and reserve table...") cannot mutate state; added pre/post database row count assertions (`SELECT count(*) FROM campus_duo.booking` invariant); verified dynamic renormalization of base weights when optional factors are omitted. |
| **Reviewer & Date** | Mohit Parihar, 15 October 2026 |
| **Decision & Evidence** | **ACCEPTED & VERIFIED.** 9/9 safety tests passed in `backend/tests/agent.safety.test.ts`. Backend test suite reached 49/49 passing. Zero mutation invariant empirically proven. |

---

### Entry AIL-004 — Local Account Lifecycle, Session Tokens & Authoritative RBAC

| Field | Record |
|---|---|
| **Date** | 15 October 2026 |
| **Requester** | Campus Duo Engineering Team (Mohit Parihar) |
| **Tool / Model** | Antigravity AI Pair Programmer (DeepMind) |
| **Input** | `01-requirements-and-use-cases.md#FR-01,FR-02`, `02-architecture-and-design.md`, `database/migrations/V008__runtime_access_privileges.sql`, `testDbHelper.ts`. |
| **User Request** | Extend Campus Duo D2 to implement a local account lifecycle (registration and login with `@iitk.ac.in` email addresses, scrypt password hashing, session tokens, current-user endpoint), enforce authoritative backend RBAC guarding administrative endpoints (`/api/admin/*`), remove client-side `Role: Student / Admin` switcher buttons from navigation headers, and verify end-to-end booking for newly registered students. |
| **Generated Artifacts** | `database/migrations/V009__local_auth_and_sessions.sql`, `backend/src/services/passwordService.ts`, `backend/src/services/authService.ts`, `backend/src/routes/auth.ts`, `backend/src/routes/admin.ts`, `backend/src/middleware/auth.ts`, `backend/tests/auth.lifecycle.test.ts`, `frontend/src/features/auth/LoginPage.tsx`, `frontend/src/tests/auth.local.test.tsx`, `frontend/src/components/layout/StudentLayout.tsx`, `frontend/src/components/layout/AdminLayout.tsx`, `frontend/src/features/error/ForbiddenPage.tsx`. |
| **AI Suggestions** | (1) Implement a stored procedure `campus_duo.register_student` with `SECURITY DEFINER` to allow student registration without granting broad table `INSERT` privileges on `user_account` to `campus_duo_app`. (2) Automatically create a mutual `STUDY` connection with seed student Sam upon registration so fresh students can immediately reserve study tables without pre-existing mock connections. (3) Use Node's built-in `node:crypto` `scryptSync` and `timingSafeEqual` for memory-hard, dependency-free password hashing. (4) Remove interactive role toggle buttons from `StudentLayout.tsx`, `AdminLayout.tsx`, and `ForbiddenPage.tsx`, replacing them with read-only role badges and Sign Out buttons. (5) Provide a unified authentication middleware accepting `Authorization: Bearer <sessionToken>` with fallback to `X-Campus-Duo-Test-Actor` in development mode. |
| **Human Critique & Edits** | Discovered column shadowing in PL/pgSQL function parameter naming when using `RETURNS TABLE` (`user_id` ambiguity); resolved by prefixing output parameters (`out_user_id`, etc.); fixed deletion order in `deleteTestUser` helper to respect foreign key constraints on `booking_connection_fk` and `audit_event_actor_fk`; preserved `isDemoAuthEnabled` honest notice in `LoginPage.tsx` for production mode. |
| **Reviewer & Date** | Mohit Parihar, 15 October 2026 |
| **Decision & Evidence** | **ACCEPTED & VERIFIED.** 17/17 backend tests passed in `backend/tests/auth.lifecycle.test.ts` (backend total: 66/66 passed across 9 files). 7/7 frontend tests passed in `frontend/src/tests/auth.local.test.tsx` (frontend total: 224/224 passed across 21 files). Clean builds and zero typecheck errors. |

---

**Review rule:** An AI-produced draft does not constitute proof of integration, test execution, project approval or a teammate's critical evaluation. All recorded evidence reflects actual test executions against the development environment.


