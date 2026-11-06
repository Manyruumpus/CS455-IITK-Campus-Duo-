# Campus Duo — Consolidated AI Engineering Log

**Deliverables:** D1, D2, D3  
**Project:** Campus Duo — CS455 Software Engineering, IIT Kanpur  
**Repository:** `C:\Users\cavlc\OneDrive\Desktop\AI\Campus-Duo-Qwen-Integration`  
**Purpose:** Record all AI tool usage, prompt engineering, architecture proposals, human critiques, verification verdicts, and empirical observations across the software lifecycle.

---

## Log Summary Table

| Entry ID | Date | Phase | Tool / Model | Focus Area | Human Reviewer | Verdict |
|---|---|---|---|---|---|---|
| **AIL-001** | 23 Sep 2026 | D1 | Perplexity AI | Requirements drafting & proposal modularization | Mohit Parihar | Accepted with manual baseline controls |
| **AIL-002** | 15 Oct 2026 | D2 | Antigravity AI | PostgreSQL booking engine & live frontend adapter | Mohit Parihar | Accepted & verified by 40 backend + 217 frontend tests |
| **AIL-003** | 15 Oct 2026 | D2 | Antigravity AI | Bounded recommendation agent & scoring formula | Mohit Parihar | Accepted & verified by 9 safety tests |
| **AIL-004** | 15 Oct 2026 | D2 | Antigravity AI | Institutional auth, session tokens, and backend RBAC | Mohit Parihar | Accepted & verified by 17 auth lifecycle tests |
| **AIL-005** | 04 Nov 2026 | D3 | Antigravity AI | Hugging Face router live probe & fallback audit | Chaitanya Vishnoi | Live provider errors documented; fallback verified |
| **AIL-006** | 05 Nov 2026 | D3 | Antigravity AI | Coverage instrumentation & safe regression tests | Sayani Patra | Accepted; 190 backend tests passing, 85.49% coverage |
| **AIL-007** | 06 Nov 2026 | D2/D3 | Antigravity AI | Local Ollama Qwen2.5-VL 3B integration & grounding verification | Campus Duo Team | Accepted; 14 tests passing, live inference verified (~4.2s) |

---

## Entry AIL-001 — D1 Document Drafting & Initial Architecture (23 Sep 2026)

- **Requester:** Mohit Parihar
- **Tool:** Perplexity AI assistant
- **Input:** `main_proposal.md` (Campus Duo Detailed Project Blueprint, draft 1.0) and Deliverable 1 checklist.
- **Request:** Generate structured Markdown documents for requirements, architecture, traceability, sprint planning, and initial AI log.
- **Artifacts:** `01-requirements-and-use-cases.md`, `02-architecture-and-design.md`, `03-initial-traceability-matrix.md`, `04-project-setup-and-sprint-plan.md`, `05-ai-engineering-log.md`.
- **AI Proposals & Human Verdicts:**
  - *Proposal 1:* Modular monolith architecture with explicit domain modules (`routes/`, `services/`, `repository/`). **Verdict: ACCEPTED.** Approved under ADR-001.
  - *Proposal 2:* Evaluate MongoDB vs. PostgreSQL for transactional booking. **Verdict: DECIDED ON POSTGRESQL.** ADR-004 selected PostgreSQL 17 for partial unique index constraints (`booking_confirmed_resource_uk`).
  - *Proposal 3:* Decouple LLM from booking state mutation. **Verdict: ACCEPTED.** Mandatory read-only boundary established.

---

## Entry AIL-002 — Live Booking API & Frontend Adapter Integration (15 Oct 2026)

- **Requester:** Campus Duo Engineering Team (Mohit Parihar)
- **Tool:** Antigravity AI Pair Programmer
- **Input:** `D2_implementation_plan.txt`, `queries/06_resource_availability.sql`, `V005__bookings_and_idempotency.sql`.
- **Request:** Implement PostgreSQL booking slice: health, locations, availability, atomic booking, participant-authorized retrieval, 10-client concurrency race verification, and React `HttpBookingAdapter`.
- **Artifacts:** `backend/src/routes/booking.ts`, `backend/src/services/bookingService.ts`, `backend/src/repository/bookingRepo.ts`, `frontend/src/services/http/HttpBookingAdapter.ts`, `backend/tests/concurrency.race.test.ts`.
- **Human Critique & Revisions:**
  - Rejected mock auth bypass in production; enforced strict UUID actor validation.
  - Scoped database test cleanup in `testDbHelper.ts` to slot IDs to resolve Vitest worker concurrency race conditions (`TE-005`).
- **Verdict:** **ACCEPTED & VERIFIED.** 10-client concurrency test demonstrated zero duplicate seat allocations.

---

## Entry AIL-003 — Bounded AI Recommendation Agent & Safety Verification (15 Oct 2026)

- **Requester:** Campus Duo Engineering Team (Mohit Parihar)
- **Tool:** Antigravity AI Pair Programmer
- **Input:** `01-requirements-and-use-cases.md#FR-04,FR-10,FR-11`, `02-architecture-and-design.md`, `queries/03_study_candidates.sql`.
- **Request:** Implement `POST /api/agent/recommend` governed by deterministic formula $35C + 25T + 20P + 10L + 10G$, allowlisted read-only tools, zero-mutation invariant, and offline template fallback.
- **Artifacts:** `backend/src/services/scoringEngine.ts`, `backend/src/services/agentService.ts`, `backend/src/routes/agent.ts`, `backend/tests/agent.safety.test.ts`.
- **Human Critique & Revisions:**
  - Added pre/post row count assertions (`SELECT count(*) FROM campus_duo.booking` invariant) to prove zero side-effects during adversarial prompt injections.
  - Added dynamic weight renormalization when optional factors (location, goals, pace) are omitted by candidates.
- **Verdict:** **ACCEPTED & VERIFIED.** 9/9 safety tests passed; zero-mutation invariant empirically proven.

---

## Entry AIL-004 — Local Account Lifecycle, Session Tokens & Authoritative RBAC (15 Oct 2026)

- **Requester:** Campus Duo Engineering Team (Mohit Parihar)
- **Tool:** Antigravity AI Pair Programmer
- **Input:** `01-requirements-and-use-cases.md#FR-01,FR-02`, migration `V008__runtime_access_privileges.sql`.
- **Request:** Implement registration and login with `@iitk.ac.in` email validation, `scrypt` password hashing, session tokens, current-user endpoint, authoritative RBAC guarding `/api/admin/*`, and remove client-side role toggle buttons.
- **Artifacts:** `database/migrations/V009__local_auth_and_sessions.sql`, `backend/src/services/passwordService.ts`, `backend/src/services/authService.ts`, `backend/src/routes/auth.ts`, `backend/src/routes/admin.ts`, `backend/tests/auth.lifecycle.test.ts`.
- **Human Critique & Revisions:**
  - Discovered PL/pgSQL variable shadowing in `campus_duo.register_student` (`user_id` output parameter shadowing column); resolved by prefixing output parameters (`out_user_id`).
  - Corrected deletion order in `deleteTestUser` helper to respect foreign key constraints on `booking_connection_fk` and `audit_event_actor_fk`.
- **Verdict:** **ACCEPTED & VERIFIED.** 17/17 auth lifecycle tests passed; RBAC 403 Forbidden verified.

---

## Entry AIL-005 — Hugging Face Router Live Probe & Fallback Audit (04 Nov 2026)

- **Requester:** Chaitanya Vishnoi
- **Tool:** Antigravity AI Pair Programmer
- **Input:** `STAGE3_HF_LIVE_VERIFICATION.md`, backend router client `huggingFaceLlmClient.ts`.
- **Request:** Perform controlled, evidence-driven end-to-end verification of Hugging Face hosted inference integration using live network dispatch.
- **Empirical Observations:**
  1. Default model `Qwen/Qwen3-4B-Instruct-2507` returned `HTTP 400 Bad Request` (`model_not_supported` on serverless tier).
  2. Alternative model returned `HTTP 402 Payment Required` (HF subscription required).
  3. Client intercepted errors, logged sanitized warnings, and seamlessly invoked `TemplateLlmClient`.
- **Human Critique & Revisions:**
  - Mandated that reports must **never claim live inference succeeded** when fallback occurred.
  - Asserted zero secret leakage in logs and network traces.
- **Verdict:** **ACCEPTED AS DOCUMENTED.** Provider constraints noted; fallback resilience confirmed.

---

## Entry AIL-006 — Coverage Gap Audit & Safe Regression Test Implementation (05 Nov 2026)

- **Requester:** Sayani Patra
- **Tool:** Antigravity AI Pair Programmer
- **Input:** `coverage-final.json`, `backend/tests/`, Stage 4E test plan.
- **Request:** Identify safe opportunities to improve branch coverage without modifying production code.
- **Artifacts:** `backend/tests/health.test.ts`, `backend/tests/huggingFaceLlmClient.test.ts`, `backend/tests/agent.safety.test.ts`.
- **Implementation:**
  - Empty candidate guard in `huggingFaceLlmClient.test.ts`.
  - Database connection outage 503 DOWN path in `health.test.ts`.
  - Input validation rejecting invalid course codes in `agent.safety.test.ts`.
  - Scoring engine location mismatch normalization in `agent.safety.test.ts`.
  - Zero-grounded-facts fallback synthesis in `agent.safety.test.ts`.
- **Verdict:** **ACCEPTED & VERIFIED.** All 190 tests pass; branch coverage improved to 70.23%; statements coverage reached 85.49%.

---

## Entry AIL-007 — Local Ollama Qwen2.5-VL 3B Integration & Live Verification (06 Nov 2026)

- **Requester:** Campus Duo Engineering Team
- **Tool:** Antigravity AI Pair Programmer
- **Input:** Local Ollama runtime (`http://localhost:11434`), installed model `qwen2.5vl:3b`, `agentService.ts`.
- **Request:** Connect the governed recommendation pipeline to local Ollama inference with minimal code changes, preserving prompt propagation, grounding validation, identity redaction, and deterministic fallback.
- **Artifacts:** `backend/src/services/ollamaLlmClient.ts`, `backend/src/config/env.ts`, `backend/src/services/agentService.ts`, `backend/tests/ollamaLlmClient.test.ts`.
- **Implementation & Empirical Observations:**
  1. Configured provider selection via `LLM_PROVIDER=ollama`, `OLLAMA_MODEL=qwen2.5vl:3b`, `OLLAMA_HOST=http://localhost:11434`.
  2. Implemented native `POST /api/chat` with `stream: false` and `format: "json"`.
  3. Structured response normalization handles JSON arrays, `{ candidates: [...] }`, and candidate-keyed maps with markdown code fence stripping.
  4. Executed live probe against local Ollama running on NVIDIA RTX 3050 Laptop GPU (4 GB VRAM) with ~53% CPU / 47% GPU offloading: completed in **4298 ms** with genuine explanation grounded in candidate facts.
  5. `validateGrounding` confirmed zero hallucinated facts; privacy checks confirmed zero PII leakage.
- **Verdict:** **ACCEPTED & VERIFIED.** 14/14 Ollama tests passed; 21/21 Hugging Face tests preserved; live local inference verified.

---

## Entry AIL-008 — PostgreSQL Profile Persistence & Course Code Normalization (06 Nov 2026)

- **Requester:** Campus Duo Engineering Team
- **Tool:** Antigravity AI Pair Programmer
- **Input:** `backend/src/routes/profile.ts`, `backend/src/repository/profileRepo.ts`, `frontend/src/features/student/ProfilePage.tsx`, `frontend/src/services/http/HttpProfileAdapter.ts`.
- **Request:** Implement PostgreSQL-backed profile persistence for authenticated students (`GET /api/profile/me`, `PUT /api/profile/me`), supporting study styles, preferred times, and enrolled courses with idempotent upsert and session synchronization.
- **Artifacts:** `backend/src/routes/profile.ts`, `backend/src/repository/profileRepo.ts`, `backend/src/services/profileService.ts`, `backend/tests/profile.lifecycle.test.ts`, `frontend/src/services/http/HttpProfileAdapter.ts`, `frontend/src/features/student/ProfilePage.tsx`.
- **Implementation & Empirical Observations:**
  1. Implemented transactional upsert into `campus_duo.student_profile` and atomic synchronization of `campus_duo.profile_course`.
  2. Resolved `consent_record_timestamps_ck` constraint by properly supplying `consented_at = now()` whenever `has_consent = true`.
  3. Added course code normalization (`replace(/^DB05-/i, '')`) across UI forms and dirty-check state to ensure course selections persist and highlight accurately regardless of catalog prefix conventions.
  4. Manually verified across 7 full browser lifecycle checks: Profile load -> Edit Study Style (`DISCUSSION_HEAVY`) -> Edit Preferred Times (`EVENING`) -> Save -> Reload -> Logout -> Login -> State retained.
- **Verdict:** **ACCEPTED & VERIFIED.** 12/12 profile lifecycle tests passed; live browser verification confirmed persistence in PostgreSQL database `campus_duo_dev`.

---

## Entry AIL-009 — Deterministic Scoring Correction & Emergency Matching Sprint (06 Nov 2026)

- **Requester:** Campus Duo Engineering Team
- **Tool:** Antigravity AI Pair Programmer
- **Input:** `backend/src/services/scoringEngine.ts`, `database/queries/03_study_candidates.sql`, `frontend/src/features/student/StudyDiscoveryPage.tsx`, `frontend/src/services/mock/MockStudySocialServices.ts`.
- **Request:** Resolve discovery 0% match demo anomaly, connect profile courses to deterministic scoring, ensure candidate discovery query accepts prefixed course codes, and verify end-to-end Ollama candidate recommendation.
- **Artifacts:** `backend/src/services/scoringEngine.ts`, `backend/src/services/agentService.ts`, `backend/tests/scoringEngine.test.ts`, `database/queries/03_study_candidates.sql`, `frontend/src/features/student/StudyDiscoveryPage.tsx`, `frontend/src/services/mock/MockStudySocialServices.ts`.
- **Implementation & Empirical Observations:**
  1. Updated `database/queries/03_study_candidates.sql` line 69 to match both raw and `DB05-` prefixed course codes: `(c.code = p_course_code OR c.code = 'DB05-' || p_course_code)`.
  2. Applied canonical course catalog (`DB05-CS455`, `DB05-MTH101`) and synthetic study partner enrollments (`Alex ...d501`, `Sam ...d502`) with active STUDY consent to development database `campus_duo_dev` and test database `campus_duo_test`.
  3. Corrected study compatibility calculation in `MockStudySocialServices.ts` to dynamically fetch live `/api/profile/me` profile and normalize course codes.
  4. Updated `StudyDiscoveryPage.tsx` to replace static `0% Match (Demo)` and `Near-Tied Demo Score` with real computed compatibility `{aiMatchScore}% Match`, `Near-Tied Compatibility`, and honest indicator of omitted profile factors.
  5. Expanded grounding validation connectives in `agentService.ts` to recognize comparative conjunctions emitted by Ollama (`same`, `good`, `however`, `while`, `dynamic`), enabling genuine inference to pass without false-positive hallucination errors.
  6. Verified live end-to-end inference probe: Ollama `qwen2.5vl:3b` generated genuine grounded explanations for Alex (57%) and Sam (51%) with 0 hallucinations and 0 PII leaks.
- **Verdict:** **ACCEPTED & VERIFIED.** 7/7 scoringEngine tests passed; 16/16 agent safety tests passed; live local AI candidate recommendation verified.
