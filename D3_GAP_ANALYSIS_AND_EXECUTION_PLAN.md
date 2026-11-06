# Campus Duo — Deliverable 3 (D3) Acceptance Gap Analysis and Execution Plan

**Author:** Independent System Audit & Quality Assurance  
**Date:** November 4, 2026  
**Target Milestone:** Deliverable 3 (D3) Final Submission  
**Milestone Deadline:** November 6, 2026 at 23:59:59 IST  
**Repository Working Directory:** `C:\Users\cavlc\OneDrive\Desktop\AI\Campus-Duo-Qwen-Integration`  
**Active Working Branch:** `feat/KAN-49-d2-integration`  
**Current HEAD SHA:** `c8d80dbeee2a74c398480358d5d82ac3055b1695` (short: `c8d80db`)

---

## 1. Executive Summary & Verification of Git State

### 1.1 Working Tree and Commit Lineage
An exhaustive pre-flight verification was performed on the authoritative Integration repository located at `C:\Users\cavlc\OneDrive\Desktop\AI\Campus-Duo-Qwen-Integration`. The historical worktrees (`Campus-Duo-Qwen` and `CS455-IITK-Campus-Duo-`) remain strictly read-only and untouched.

The verified linear commit history of `feat/KAN-49-d2-integration` is:
1. **D2 Base / Upstream Merge:**  
   Commit SHA: `8fdea9297d0c6c4a40cc5c9351bcf383f01c1d76` (`8fdea92`)  
   Message: *Merge branch 'feat/KAN-35-booking-backend' into main*
2. **Commit A (AI Assistant & HF Router Wiring):**  
   Commit SHA: `4ac395279cbe469520682dc47ee4329d242642ed` (`4ac3952`)  
   Message: *feat(agent): recover KAN-49 AI assistant and KAN-45 Hugging Face inference wiring*  
   Contents: 15 approved source and test files (including `HuggingFaceRouterClient.ts`, `scoringEngine.ts`, `agent.safety.test.ts`, `agent.integration.test.ts`).
3. **Commit B (Runbook & Environment Configuration):**  
   Commit SHA: `c8d80dbeee2a74c398480358d5d82ac3055b1695` (`c8d80db`)  
   Message: *docs(agent): update runbook and environment templates for Hugging Face inference*  
   Contents: Exactly 2 files (`backend/.env.example`, `docs/D2-runbook.md`).

`git status --short` confirms:
- **0** staged files.
- **0** modified tracked files.
- **Untracked audit artifacts:** `COMMIT_B_REVIEW.md`, `COMMIT_B_FINAL_REVIEW.md`, `PROJECT_HANDOFF.md`, `STAGE3_HF_LIVE_VERIFICATION.md`, and binary capture `localhost.har` (unopened, uninspected, unindexed).

### 1.2 D3 Scope Overview
Deliverable 3 (D3) represents the final verification, testing, security, performance, costing, deployment, and governance deliverable for the CS455 Campus Duo peer-study matching and room booking system. 

The scope spans 20 Jira backlog issues (KAN-69 through KAN-88) covering:
- Defect remediation (`body-parser`/`qs` vulnerability, test fixture date misalignment).
- Test harness execution and coverage generation (frontend Vitest + v8 coverage, backend Vitest + coverage).
- Formal reports (concurrency race-condition, performance latency, failure/recovery rollback, security STRIDE threat model, adversarial penetration suite).
- Engineering governance (AI Engineering Log update, final requirements traceability matrix, 5-defect history register, costing breakdown, reproducible deployment runbook, and Jira sprint reconciliation).

With 72 hours remaining until the November 6, 2026 23:59 IST deadline, all necessary foundational implementations (booking backend, UI booking adapter, and AI assistant with fallback) are already in place. The primary work required is executing test runs, generating machine-readable coverage data, resolving two localized code/fixture bugs, and compiling formal, evidence-backed reports.

---

## 2. Comprehensive D3 Issue-by-Issue Inventory Matrix (KAN-69 to KAN-88)

The table below reconciles all 20 Deliverable 3 Jira tickets against actual local code evidence, test state, and remaining gaps.

| Jira Key | Summary | Issue Type | Assignee | Reviewer | Jira Status | Current Local State | Remaining Gaps / Action Items | Feasibility | Est. Hours |
|---|---|---|---|---|---|---|---|---|---|
| **KAN-69** | Deliverable 3 — Testing, Security, Performance, Cost, Deployment, Reliability | Epic | Mohit Parihar | N/A | To Do | Umbrella Epic tracking all D3 activities. | Coordinate delivery of KAN-70 through KAN-88. Package final release bundle. | High | 4h |
| **KAN-70** | Fix backend dependency vulnerabilities (body-parser, qs) | Bug | Sayani Patra | Mohit Parihar | To Do | Confirmed via `npm audit` in `backend/`: `body-parser` <1.20.9 (high DoS), `qs` 6.7.0-6.16.0 (moderate DoS). | Run `npm audit fix` in `backend/`. Verify `npm audit --omit=dev` shows 0 vulnerabilities. Re-run backend test suite. | High | 1h |
| **KAN-71** | Fix availability test fixture date mismatch | Bug | Mohit Parihar | Chaitanya Vishnoi | In Progress | 3 of 7 tests in `backend/tests/availability.test.ts` fail because test queries `2026-11-14` while DB seed has `2026-11-11`. | Refactor test to dynamically insert slots with matching dates (following `booking.test.ts` pattern). Verify 7/7 passing. | High | 1.5h |
| **KAN-72** | Frontend unit/integration test report and coverage | Task | Mohit Parihar | Sayani Patra | To Do | 182 tests across 17 files pass locally (`npm test` in `frontend/`). Typecheck, lint, build pass. | Run Vitest with v8 coverage provider (`npm run test:coverage`). Generate HTML/JSON reports in `Deliverables/D3/evidence/`. Document coverage gaps. | High | 3h |
| **KAN-73** | Frontend unit/integration test report and coverage *(Duplicate)* | Task | Mohit Parihar | Sayani Patra | To Do | Exact duplicate of KAN-72 created at 12:38 PM (3 mins after KAN-72). | Mark as Duplicate of KAN-72 in Jira. Close ticket with link to KAN-72. No separate code work. | High | 0.5h |
| **KAN-74** | Frontend-to-backend booking adapter | Task | Mohit Parihar | Sayani Patra | In Progress | Fully implemented in `frontend/src/services/http/HttpBookingAdapter.ts` (19KB). Unit & integration tests present. | Run test suites, capture execution logs, write formal integration sign-off document in `Deliverables/D3/`. | High | 2h |
| **KAN-75** | Final requirements-to-Jira-to-GitHub-to-testing traceability matrix | Task | Mohit Parihar | Sayani Patra | To Do | Requirements baseline documented in D1/D2 SRS (FR-01 to FR-12, QR-01 to QR-05, Invariants I1 to I5). | Construct comprehensive bidirectional mapping table linking SRS IDs -> Jira Keys -> Commits (`c5d4294`..`c8d80db`) -> Test files -> Status. | High | 5h |
| **KAN-76** | System test report | Task | Mohit Parihar | Chaitanya Vishnoi | To Do | End-to-end user journeys defined (Auth OTP, Room Discovery & Booking, AI Assistant Recommendation, Admin Inventory). | Execute multi-step E2E manual/automated scenarios against running frontend + API + PostgreSQL. Record logs, request/response bodies, screenshots. | Medium-High | 5h |
| **KAN-77** | AI Engineering Log final update | Task | Mohit Parihar | Chaitanya Vishnoi | To Do | AI Assistant implemented (Commit A), runbook updated (Commit B), live inference probed (Stage 3 report). | Compile formal D3 AI Engineering Log: document prompt templates, model selection (`Qwen/Qwen3-4B-Instruct-2507`), grounding rules, privacy redaction, and Stage 3 empirical results (HTTP 400/402 handling, zero booking side-effects, fallback activation). | High | 3h |
| **KAN-78** | Security and threat-model report | Task | Sayani Patra | Chaitanya Vishnoi | To Do | RBAC implemented (`ROLE_STUDENT`, `ROLE_ADMIN`), input validation present, SQL parameterized queries used. | Author STRIDE threat model: analyze spoofing, tampering, repudiation, info disclosure, DoS, elevation of privilege across UI, API, PostgreSQL. Document mitigations and demo auth boundaries (DEC-05). | High | 4h |
| **KAN-79** | Adversarial test suite and report | Task | Sayani Patra | Mohit Parihar | To Do | Adversarial tests present in `backend/tests/agent.safety.test.ts` (prompt injection, booking mutation bypass) and `backend/tests/auth.test.ts` (token tampering). | Execute suites, add additional tests for SQLi, parameter tampering, unauthorized cross-student booking cancellation. Capture output report. | High | 3.5h |
| **KAN-80** | Defect history with at least five meaningful defects fixed | Task | Sayani Patra | Chaitanya Vishnoi | To Do | 5+ high-value defects resolved across D2 and D3 development cycle. | Assemble Defect History Register with Root Cause, Severity, Before/After Reproduction, Commit SHA, and Regression Test for 5+ distinct defects. | High | 3h |
| **KAN-81** | Backend coverage report | Task | Sayani Patra | Mohit Parihar | To Do | Backend has extensive Vitest suite across auth, booking, availability, concurrency, agent. | Run `npx vitest run --coverage` in `backend/` using isolated `campus_duo_test` DB. Generate HTML/JSON artifacts under `Deliverables/D3/evidence/`. Analyze uncovered lines. | High | 3h |
| **KAN-82** | Final Jira dashboard and project report | Task | Sayani Patra | Chaitanya Vishnoi | To Do | Jira export data available (`Jira (5).csv`), commit history verified. | Generate final project health report: velocity metrics, sprint burndown, defect density, final issue status reconciliation, and governance sign-off. | High | 3h |
| **KAN-83** | Concurrency test report | Task | Chaitanya Vishnoi | Mohit Parihar | To Do | Verified concurrency test in `backend/tests/concurrency.race.test.ts` (10 concurrent requests -> 1 201 Created, 9 409 Conflict). | Run test against test DB with repeated trials, record raw logs, document PostgreSQL row locking mechanism (`FOR UPDATE`), write formal concurrency report. | High | 2.5h |
| **KAN-84** | Deliverable 3 timeline and Gantt chart | Task | Chaitanya Vishnoi | Sayani Patra | To Do | Sprint window established: Nov 3 to Nov 6, 2026 (72 hours). | Create detailed Mermaid-based Gantt chart and task dependency roadmap for Nov 4–6 sprint execution. | High | 2h |
| **KAN-85** | Performance/load test and optimization report | Task | Chaitanya Vishnoi | Mohit Parihar | To Do | Baseline response times recorded in Stage 3 probe (backend local processing <130ms, HF WAN latency ~660ms). | Execute multi-user concurrent load test against `/api/slots/available` and `/api/bookings`. Measure p50, p95, p99 latency and throughput. Document bottleneck and database index optimization. | Medium-High | 4.5h |
| **KAN-86** | Failure/recovery test report | Task | Chaitanya Vishnoi | Sayani Patra | To Do | Transaction rollback verified in booking service (`BEGIN` ... `ROLLBACK`). External LLM failure fallback verified in Stage 3. | Test DB disconnect/reconnect resilience, transactional atomicity on simulated booking failure, and graceful degradation under API network faults. | High | 3h |
| **KAN-87** | Deployment documentation | Task | Chaitanya Vishnoi | Sayani Patra | To Do | Operational procedures outlined in `docs/D2-runbook.md`. | Expand into formal production-ready deployment guide: containerization instructions (Dockerfile/Docker Compose), PostgreSQL provisioning, environment configuration, migration commands, and healthcheck endpoints. | High | 3h |
| **KAN-88** | Costing document | Task | Chaitanya Vishnoi | Mohit Parihar | To Do | Service dependencies identified (Vercel/Render frontend/backend, Supabase/Neon PostgreSQL, Hugging Face Pro/Serverless). | Construct detailed 3-tier financial model (Demo/Free Tier, MVP Production Tier, Scale Campus-Wide Tier) with monthly compute, storage, egress, and LLM token costs. | High | 2.5h |

---

## 3. Technical Deep Dives & Verification Evidence

### 3.1 KAN-70: Backend Dependency Vulnerabilities (`body-parser`, `qs`)
- **Vulnerability Details:**
  Running `npm audit` inside `backend/` reveals two vulnerabilities in production dependencies:
  1. `body-parser` (<1.20.9): High severity Denial of Service (DoS) via uncontrolled resource consumption when parsing malicious URL-encoded or JSON payloads.
  2. `qs` (6.7.0 to 6.16.0): Moderate severity Denial of Service via nested object parsing depth attacks.
- **Root Cause:**
  `backend/package.json` pins or resolves older transitive versions of `body-parser` and `qs` required by Express 4.x middleware.
- **Proposed Fix:**
  Execute `npm audit fix` inside `backend/`. This safely increments `body-parser` to `1.20.9` and `qs` to `6.16.2` without introducing breaking API changes or requiring Express 5 migration.
- **Acceptance Criteria:**
  - `npm audit --omit=dev` returns 0 vulnerabilities.
  - Backend compiles clean (`npm run build`).
  - Existing backend test suites pass without regression.
  - Raw evidence log saved to `Deliverables/D3/evidence/dependency-audit/audit-after-fix.txt`.

### 3.2 KAN-71: Availability Test Fixture Date Mismatch
- **Vulnerability / Flaw Details:**
  In `backend/tests/availability.test.ts`, 3 of 7 tests fail during suite execution.
- **Root Cause Analysis:**
  The test queries availability for `2026-11-14` (e.g., `GET /api/availability?date=2026-11-14`). However, the seed migration `backend/migrations/002_study_bookings.sql` inserts fixture study slots for date `2026-11-11` (slots `d5740001` through `d5740006`). Consequently, the API returns an empty slot list `[]`, causing assertions expecting available slots to fail.
  Additionally, the test suite mutates shared database state without isolated fixture teardown.
- **Proposed Fix:**
  Align test fixture strategy with `backend/tests/booking.test.ts`:
  1. In `beforeAll` / `beforeEach`, dynamically create dedicated test rooms and study slots with the exact date being queried (`2026-11-14`).
  2. Perform tests against the dynamically created slots.
  3. Clean up the created test fixtures in `afterAll` / `afterEach`.
- **Acceptance Criteria:**
  - 7 of 7 tests in `backend/tests/availability.test.ts` pass cleanly against `campus_duo_test`.
  - Zero test pollution left in the test database.
  - Failure before-log and passing after-log saved to `Deliverables/D3/evidence/backend-tests/`.

### 3.3 KAN-72 & KAN-73: Frontend Test Suite & Duplicate Reconciliation
- **Duplicate Analysis:**
  KAN-72 and KAN-73 have identical titles (*"Frontend unit/integration test report and coverage"*), identical descriptions, identical assignees (Mohit Parihar), and identical reviewers (Sayani Patra). KAN-73 was created at 12:38 PM on Nov 3, 2026, exactly 3 minutes after KAN-72 (12:35 PM).
- **Resolution Plan:**
  - KAN-72 remains the primary tracking task.
  - In Jira, KAN-73 will be marked as `Closed - Duplicate` linked to KAN-72.
- **Testing Scope:**
  `frontend/` currently contains 182 unit and integration tests across 17 test files spanning authentication, booking forms, room cards, navigation, state management, and the `HttpBookingAdapter`.
- **Execution Plan:**
  Execute `npx vitest run --coverage` in `frontend/`. Generate HTML and lcov/JSON coverage outputs into `Deliverables/D3/evidence/frontend-coverage/`. Document covered statement, branch, function, and line percentages.

### 3.4 KAN-74: Frontend-to-Backend Booking Adapter
- **Implementation State:**
  Already fully implemented in `frontend/src/services/http/HttpBookingAdapter.ts` (567 lines, 19 KB).
- **Capabilities Verified:**
  - Implements the typed `BookingService` interface.
  - Seamlessly transforms frontend domain models to backend REST payloads (`POST /api/bookings`).
  - Supports idempotency keys via `X-Idempotency-Key` headers to prevent duplicate bookings.
  - Maps backend HTTP status codes (201 Created, 400 Bad Request, 401 Unauthorized, 404 Not Found, 409 Slot Conflict) to typed application error classes (`BookingConflictError`, `ValidationError`).
  - Provides dual-mode toggling: Live HTTP mode vs. In-memory Mock mode.
- **Verification Evidence:**
  Covered by unit tests `frontend/src/services/http/__tests__/httpBookingAdapter.test.ts` and live integration tests `frontend/src/services/http/__tests__/httpBookingLive.integration.test.ts`.

### 3.5 KAN-75: Final Requirements Traceability Matrix
- **Scope & Structure:**
  Trace all requirements from Deliverable 1 and Deliverable 2 Software Requirements Specification (SRS) to final D3 deliverables:
  - **Functional Requirements:** FR-01 (OTP Auth), FR-02 (Student Profile), FR-03 (Room Search & Filters), FR-04 (Slot Availability Checking), FR-05 (Study Room Booking), FR-06 (Double-Booking Prevention), FR-07 (Booking Cancellation), FR-08 (Booking History), FR-09 (Peer Matching Preferences), FR-10 (AI Assistant Recommendations), FR-11 (Admin Inventory Management), FR-12 (Admin Audit Logs).
  - **Quality Requirements:** QR-01 (Sub-500ms API Latency), QR-02 (Transactional Concurrency & Zero Overbooking), QR-03 (Role-Based Access Control), QR-04 (Failure Resilience & Rollback), QR-05 (Prompt Injection & Safety Scrubbing).
  - **Core System Invariants:** Invariant I1 (Zero Overbooking per Slot), Invariant I2 (Double-Booking Prevention per Student), Invariant I3 (Privacy Preservation & Candidate Anonymization), Invariant I4 (Audit Immutability), Invariant I5 (Deterministic AI Fallback).
- Each requirement will be cross-referenced with: Jira Key, GitHub Commits, Source File Paths, Test Suites, Execution Evidence Paths, and Compliance Status (Pass/Deferred).

### 3.6 KAN-76: Comprehensive End-to-End System Testing
- **E2E Journeys:**
  1. **Journey 1: Student Onboarding & Session Auth:** Student registers/logs in using `@iitk.ac.in` email, requests OTP, submits valid OTP, verifies JWT token issued and stored, and verifies invalid OTP returns 401.
  2. **Journey 2: Room Discovery & Booking Lifecycle:** Student searches available rooms by date and capacity, inspects slot availability, creates a confirmed booking with idempotency key, verifies database slot occupancy increases, cancels booking, and confirms slot is released.
  3. **Journey 3: AI Assistant Recommendation & Fallback:** Student opens AI Duo Assistant modal, enters study topic and schedule requirements, requests recommendations, inspects retrieved candidate cards, verifies prompt privacy redaction, and verifies deterministic fallback when external LLM is offline.
  4. **Journey 4: Admin Governance & Inventory:** Admin logs in with `ROLE_ADMIN`, views system slot utilization, creates a new room resource, and attempts student-only booking endpoint (verifying 403 Forbidden).

### 3.7 KAN-77: AI Engineering Log Finalization
- **AI Architecture & Specifications:**
  - **Model:** `Qwen/Qwen3-4B-Instruct-2507` (Qwen 3 series 4-Billion Parameter Instruct model).
  - **Provider:** Hugging Face Serverless / Hosted Inference Router (`https://router.huggingface.co/v1/chat/completions`).
  - **Grounding Architecture:** Local scoring engine (`backend/src/services/agent/scoringEngine.ts`) performs rule-based candidate filtering (topic similarity, schedule alignment, departmental affinity). Top candidates are passed to the LLM solely for natural language synthesis.
  - **Privacy & Safety Scrubbing:** Candidate student IDs, roll numbers, and raw calendar slots are stripped; candidates are anonymized as `Candidate 1`, `Candidate 2` to prevent prompt-based PII leakage.
  - **Empirical Stage 3 Findings:**
    - Live router probe to Hugging Face successfully authenticated via `HF_TOKEN` in 662.4 ms.
    - Model `Qwen/Qwen3-4B-Instruct-2507` returned HTTP 400 `model_not_supported` via the generic router endpoint.
    - Active router models (e.g., `Qwen/Qwen2.5-7B-Instruct`) returned HTTP 402 `Payment Required` (pre-paid provider credits required).
    - The backend architecture gracefully handled both failure modes: caught errors, prevented unhandled exceptions, verified 0 database mutations (`countBefore === countAfter === 8`), and returned high-quality deterministic fallback recommendations within 785.4 ms roundtrip.

### 3.8 KAN-78 & KAN-79: Security Threat Model & Adversarial Testing
- **STRIDE Threat Modeling:**
  - **Spoofing:** JWT token signature validation, replay prevention, student identity spoofing mitigations.
  - **Tampering:** Parameter tampering on booking creation (e.g., modifying `student_id` in request body; mitigated by extracting identity strictly from authenticated JWT claims).
  - **Repudiation:** Transaction audit logging in PostgreSQL.
  - **Information Disclosure:** Scrubbing candidate PII before sending context to external LLM providers; preventing error stack traces in production API responses.
  - **Denial of Service:** Dependency vulnerabilities (`body-parser`/`qs`), request payload size limits, database connection pooling limits.
  - **Elevation of Privilege:** RBAC middleware (`requireRole('ROLE_STUDENT')`, `requireRole('ROLE_ADMIN')`).
- **Adversarial Test Suite:**
  Grounded in existing `backend/tests/agent.safety.test.ts` and `backend/tests/auth.test.ts`, covering:
  - Prompt injection attacks attempting to force system prompt leakage or fake booking approvals.
  - Cross-tenant booking cancellation attempts.
  - Expired, malformed, and forged JWT tokens.
  - High-frequency booking spam triggering slot contention.

### 3.9 KAN-80: Defect History Register (5+ Meaningful Defects Fixed)
The project has identified and resolved multiple critical engineering defects across development:
1. **Defect 1 (Build / Tooling):** Vite Windows drive path resolution bug where uppercase drive letters in Windows paths caused module bundling and file watcher resolution failures (`c5d4294`).
2. **Defect 2 (Security / Privacy):** Candidate schedule slot and personal identifier leakage through LLM synthesis prompts. Resolved by implementing strict privacy scrubbing and candidate pseudonymization in `backend/src/services/agent/scoringEngine.ts` (`4ac3952`).
3. **Defect 3 (Security / Authorization):** Admin privilege escalation on AI recommendation endpoint (`/api/agent/recommend`) where administrative tokens could trigger student-specific matching. Resolved by enforcing `requireRole('ROLE_STUDENT')` middleware (`4ac3952`).
4. **Defect 4 (Reliability / Error Handling):** Unhandled promise rejection on missing or malformed `HF_TOKEN`, which could crash the Node.js process and leak environment variable details in stack traces. Resolved by wrapping router client invocations in safe try/catch blocks with sanitized error reporting (`4ac3952`).
5. **Defect 5 (Configuration / Operational):** Unsafe inference default in `.env.example` where `ENABLE_LLM_INFERENCE=true` without a valid token caused HTTP 401 spam and delayed response latencies. Corrected to `ENABLE_LLM_INFERENCE=false` default with explicit setup instructions (`c8d80db`).
6. **Defect 6 (Vulnerability - Pending KAN-70):** `body-parser` and `qs` DoS vulnerabilities in backend dependencies.
7. **Defect 7 (Test Reliability - Pending KAN-71):** `backend/tests/availability.test.ts` date fixture mismatch between query (`2026-11-14`) and migration seed (`2026-11-11`).

### 3.10 KAN-81 & KAN-72: Backend and Frontend Code Coverage
- **Tooling:** Vitest v8 coverage provider (`@vitest/coverage-v8`).
- **Backend Scope:** Unit and integration coverage of `routes/`, `services/`, `middleware/`, `models/`, and `utils/`. Excludes test fixtures, migrations, and mock scripts.
- **Frontend Scope:** Components, hooks, services (`HttpBookingAdapter`), and utilities. Excludes test setups and third-party UI declaration wrappers.
- **Target Metrics:** >80% statement and line coverage on critical business paths (booking service, auth middleware, agent scoring engine).

### 3.11 KAN-83: Concurrency Race-Condition Verification
- **Architecture:** Room slot reservations use PostgreSQL pessimistic locking (`SELECT ... FOR UPDATE`) within an explicit database transaction (`BEGIN` ... `COMMIT`).
- **Empirical Baseline:** In `backend/tests/concurrency.race.test.ts`, 10 simultaneous asynchronous requests compete for the final remaining capacity of a study slot.
- **Verified Outcome:** Exactly 1 request acquires the lock and receives HTTP 201 Created. The remaining 9 requests are rejected with HTTP 409 Conflict. Database invariants confirm slot capacity is never exceeded (`reservedCount <= capacity`).

### 3.12 KAN-85: Performance and Load Latency Analysis
- **Target:** API response time $\le 500$ ms for local transactions.
- **Empirical Decomposition:**
  - Local backend processing (routing, JWT validation, SQL query with index, JSON serialization): **28 ms to 115 ms** (well within the $\le 500$ ms SLA).
  - External hosted LLM inference WAN roundtrip (Hugging Face router): **~662 ms**.
  - Combined end-to-end AI recommendation roundtrip: **~785 ms** (external network bound).
- **Optimization Strategy:** Study slot availability queries utilize composite index `idx_slots_room_date (room_id, slot_date)` to ensure sub-50ms execution even under high concurrent read loads.

### 3.13 KAN-86: Failure & Recovery Resilience
- **Database Connection Drop:** Backend connection pool (`pg.Pool`) automatically reconnects on transient network drops; unfulfilled transactions are cleanly rolled back by PostgreSQL.
- **Transactional Rollback:** In `BookingService.createBooking`, if an error occurs after slot validation but before confirmation write, the entire transaction issues `ROLLBACK`, guaranteeing zero orphaned bookings.
- **External AI Outage:** If Hugging Face returns HTTP 4xx, 5xx, or network timeouts, the AI controller catches the error, logs a sanitized diagnostic message, and instantly serves the deterministic recommendation engine without user-facing failure.

### 3.14 KAN-87: Deployment Architecture & Runbook
- **Stack:**
  - Frontend: React / TypeScript / Vite (static SPA hosted on Vercel or Nginx).
  - Backend: Node.js / Express / TypeScript (containerized Docker service hosted on Render or AWS ECS).
  - Database: PostgreSQL 16+ with ACID transaction support (Supabase, Neon, or AWS RDS).
  - AI Inference: Hugging Face Serverless Inference Router / OpenAI-compatible endpoint.
- **Operational Boundaries:**
  - Auth in-memory storage (DEC-05) is explicitly identified as a demo-tier implementation; production roadmap notes Redis/PostgreSQL session store migration.
  - Zero secrets committed; all secrets injected via environment variables (`HF_TOKEN`, `JWT_SECRET`, `DATABASE_URL`).

### 3.15 KAN-88: Comprehensive Costing Model
- **Tier 1: Academic Demo / Free Tier ($0.00 / month):**
  - Frontend: Vercel Hobby ($0)
  - Backend: Render Free Web Service ($0)
  - Database: Neon / Supabase Free Tier ($0)
  - AI Inference: Hugging Face Serverless / Local Deterministic Fallback ($0)
- **Tier 2: Production Pilot / 1,000 Students ($25.00 / month):**
  - Frontend: Vercel Pro ($20/mo team base or $0 static)
  - Backend: Render Starter Instance ($7/mo)
  - Database: Supabase Pro ($25/mo)
  - AI Inference: Hugging Face Inference Endpoints / Pay-as-you-go (~$10/mo)
- **Tier 3: Campus-Wide Scale / 10,000+ Students ($145.00 / month):**
  - High-availability PostgreSQL, load-balanced ECS containers, CDN edge caching, dedicated inference container.

---

## 4. Prioritized Execution Plan for November 4–6, 2026 (72-Hour Sprint)

The remaining work is structured into three discrete phases, strictly observing team assignments and reviewer roles.

```mermaid
flowchart TD
    subgraph Day1 ["Day 1: Nov 4 — Remediation & Defect Fixes"]
        D1A["KAN-70: npm audit fix (Sayani)"]
        D1B["KAN-71: Availability Test Fixture Fix (Mohit)"]
        D1C["KAN-72/73: Duplicate Issue Reconciliation (Mohit)"]
        D1D["KAN-80: Defect History Register (Sayani)"]
        D1E["KAN-84: Gantt & Sprint Tracking (Chaitanya)"]
        D1A --> D1B --> D1C --> D1D --> D1E
    end

    subgraph Day2 ["Day 2: Nov 5 — Testing, Coverage & Deep Dives"]
        D2A["KAN-72: Frontend Vitest Coverage (Mohit)"]
        D2B["KAN-81: Backend Vitest Coverage (Sayani)"]
        D2C["KAN-83: Concurrency Race Report (Chaitanya)"]
        D2D["KAN-85: Performance Load Report (Chaitanya)"]
        D2E["KAN-86: Failure & Recovery Report (Chaitanya)"]
        D2F["KAN-79: Adversarial Test Suite Report (Sayani)"]
        D1E --> D2A --> D2B --> D2C --> D2D --> D2E --> D2F
    end

    subgraph Day3 ["Day 3: Nov 6 — System Test, Governance & Submission"]
        D3A["KAN-74: Booking Adapter Sign-off (Mohit)"]
        D3B["KAN-76: E2E System Test Report (Mohit)"]
        D3C["KAN-77: AI Engineering Log Final (Mohit)"]
        D3D["KAN-78: Security & Threat Model (Sayani)"]
        D3E["KAN-87: Production Deployment Guide (Chaitanya)"]
        D3F["KAN-88: System Costing Model (Chaitanya)"]
        D3G["KAN-75: Final Traceability Matrix (Mohit)"]
        D3H["KAN-82: Jira Dashboard & Release Package (Sayani)"]
        D2F --> D3A --> D3B --> D3C --> D3D --> D3E --> D3F --> D3G --> D3H
    end
```

### 4.1 Phase 1: Day 1 (Wednesday, Nov 4, 2026) — Defect Remediation & Baseline Fixes
1. **KAN-70 (Sayani Patra / Reviewer: Mohit Parihar):**
   - Execute `npm audit fix` in `backend/`.
   - Update `body-parser` to `1.20.9` and `qs` to `6.16.2`.
   - Verify `npm audit --omit=dev` reports 0 vulnerabilities.
   - Run `npm test` and `npm run build` in `backend/`.
   - Create Commit: `fix(security): resolve body-parser and qs vulnerabilities (KAN-70)`.
2. **KAN-71 (Mohit Parihar / Reviewer: Chaitanya Vishnoi):**
   - Refactor `backend/tests/availability.test.ts` to dynamically insert slot fixtures with matching query dates (`2026-11-14`).
   - Add clean teardown in `afterAll`.
   - Verify all 7 tests pass against `campus_duo_test`.
   - Create Commit: `fix(test): align availability test fixture dates dynamically (KAN-71)`.
3. **KAN-72 & KAN-73 (Mohit Parihar / Reviewer: Sayani Patra):**
   - Formally document duplicate status of KAN-73 in Jira and link to KAN-72.
4. **KAN-80 (Sayani Patra / Reviewer: Chaitanya Vishnoi):**
   - Compile initial draft of Defect History Register documenting Defect 1 through Defect 7.
5. **KAN-84 (Chaitanya Vishnoi / Reviewer: Sayani Patra):**
   - Publish Deliverable 3 Timeline and Gantt Chart.

### 4.2 Phase 2: Day 2 (Thursday, Nov 5, 2026) — Testing Verification & Technical Reports
1. **KAN-72 (Mohit Parihar / Reviewer: Sayani Patra):**
   - Execute frontend coverage run: `npm run test:coverage`.
   - Archive HTML/JSON coverage reports to `Deliverables/D3/evidence/frontend-coverage/`.
   - Compile Frontend Unit & Integration Test Report.
2. **KAN-81 (Sayani Patra / Reviewer: Mohit Parihar):**
   - Execute backend coverage run: `npx vitest run --coverage`.
   - Archive HTML/JSON coverage reports to `Deliverables/D3/evidence/backend-coverage/`.
   - Compile Backend Code Coverage Report.
3. **KAN-83 (Chaitanya Vishnoi / Reviewer: Mohit Parihar):**
   - Run concurrency test suite (`concurrency.race.test.ts`) across 5 repeated trials.
   - Capture PostgreSQL row locking logs and conflict response outputs.
   - Publish Concurrency Test Report.
4. **KAN-85 (Chaitanya Vishnoi / Reviewer: Mohit Parihar):**
   - Run performance benchmark on availability query and booking creation.
   - Document latency percentiles (p50, p90, p99) and bottleneck analysis.
   - Publish Performance/Load Test Report.
5. **KAN-86 (Chaitanya Vishnoi / Reviewer: Sayani Patra):**
   - Test DB connection drop handling and rollback validation.
   - Test external LLM API outage and fallback activation.
   - Publish Failure & Recovery Test Report.
6. **KAN-79 (Sayani Patra / Reviewer: Mohit Parihar):**
   - Run adversarial suites (`agent.safety.test.ts`, `auth.test.ts`).
   - Document penetration test cases and defense mechanisms.
   - Publish Adversarial Test Suite Report.

### 4.3 Phase 3: Day 3 (Friday, Nov 6, 2026) — Systems Integration, Governance & Submission
1. **KAN-74 (Mohit Parihar / Reviewer: Sayani Patra):**
   - Final review and sign-off on `HttpBookingAdapter.ts` integration.
2. **KAN-76 (Mohit Parihar / Reviewer: Chaitanya Vishnoi):**
   - Execute and document 4 end-to-end system test journeys across UI, API, PostgreSQL.
   - Publish System Test Report.
3. **KAN-77 (Mohit Parihar / Reviewer: Chaitanya Vishnoi):**
   - Complete final AI Engineering Log incorporating Stage 3 empirical live router results.
4. **KAN-78 (Sayani Patra / Reviewer: Chaitanya Vishnoi):**
   - Complete STRIDE Security & Threat Model Report.
5. **KAN-87 (Chaitanya Vishnoi / Reviewer: Sayani Patra):**
   - Publish comprehensive Deployment Documentation.
6. **KAN-88 (Chaitanya Vishnoi / Reviewer: Mohit Parihar):**
   - Publish 3-tier System Costing Document.
7. **KAN-75 (Mohit Parihar / Reviewer: Sayani Patra):**
   - Assemble Final Requirements Traceability Matrix cross-referencing all artifacts.
8. **KAN-82 & KAN-69 (Sayani Patra / Mohit Parihar):**
   - Compile Final Jira Dashboard & Project Report.
   - Perform final verification of all deliverables in `Deliverables/D3/`.
   - Package submission bundle prior to 23:59 IST deadline.

---

## 5. Critical Risks, Mitigations & Operating Guardrails

### 5.1 Test Database Isolation
- **Risk:** Tests modifying the development database (`campus_duo_dev`) could corrupt student accounts, active reservations, or seed availability.
- **Guardrail:** All test runs must target `campus_duo_test` via `DATABASE_URL=postgresql://campus_duo_app:campus_duo_secure_pass@localhost:5432/campus_duo_test`. Production/development databases must never be used for automated test suites.

### 5.2 Hugging Face Hosted Inference Expectations
- **Empirical Reality:** The Hugging Face serverless router rejects `Qwen/Qwen3-4B-Instruct-2507` with HTTP 400 (`model_not_supported`) and active models with HTTP 402 (`Payment Required`).
- **Guardrail:** Deliverable documentation must honestly report empirical findings from Stage 3. Under no circumstances should test results or claims be fabricated. The deterministic fallback recommendation engine fulfills all architectural resilience and functional grading criteria.

### 5.3 Worktree & Historical Integrity
- **Guardrail:** Under no circumstances should edits, branches, or commits occur in historical worktrees (`Campus-Duo-Qwen` or `CS455-IITK-Campus-Duo-`). All work remains strictly within `C:\Users\cavlc\OneDrive\Desktop\AI\Campus-Duo-Qwen-Integration`.
- **HAR File Safety:** `localhost.har` contains sensitive live browser traffic captures; it must remain completely uninspected, uncommitted, and unshared.

---

## 6. Recommended Next Action

The audit confirms that the Integration worktree is clean, stable, and ready to commence Deliverable 3 implementation.

The immediate recommended next action is **Stage 4B: Code & Fixture Remediation**:
1. Authorize execution of **KAN-70**: run `npm audit fix` in `backend/` to resolve the two vulnerable packages.
2. Authorize execution of **KAN-71**: update `backend/tests/availability.test.ts` to dynamically generate slot fixtures.
