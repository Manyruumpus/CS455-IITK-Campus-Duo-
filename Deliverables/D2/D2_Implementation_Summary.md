# Deliverable 2 (D2) — Implementation Summary & Verification

**Project:** Campus Duo — CS455 Software Engineering Course Project, IIT Kanpur  
**Worktree:** `C:\Users\cavlc\OneDrive\Desktop\AI\Campus-Duo-Qwen-Integration`  
**Target Milestone:** Deliverable 2: Working Implementation, Agentic AI, and Sprint Execution  
**Authoritative Branch:** `feat/KAN-49-d2-integration` (and base `feat/KAN-35-booking-backend`)  
**Status:** FULLY IMPLEMENTED & VERIFIED  

---

## 1. System Overview & Deliverable Scope

Deliverable 2 establishes the end-to-end working implementation of **Campus Duo**, enabling verified IIT Kanpur students to authenticate via institutional email OTP, discover compatible peers, and atomically reserve capacity-limited study spaces under strict PostgreSQL concurrency control.

### Core Implemented Capabilities
1. **Institutional Authentication & Account Lifecycle (FR-01, FR-02):**
   - `@iitk.ac.in` email domain restriction enforced at database, API, and UI layers.
   - Real-time 6-digit OTP delivery (local simulated/file transport in dev, SMTP transport in production).
   - Secure memory-hard password hashing using `node:crypto` `scrypt` with random 16-byte salt.
   - Cryptographically random session tokens (`campus_duo.session`) with expiry enforcement.
2. **Authoritative Role-Based Access Control (RBAC):**
   - Role separation between `ROLE_STUDENT` and `ROLE_ADMIN`.
   - Administrative inventory management (`/api/admin/*`) guarded by server-side middleware returning HTTP 403 Forbidden to non-admin actors.
   - Client-side role toggle buttons removed from navigation headers; UI dynamically adapts to session claims.
3. **Transactional Study Table Reservation (FR-07, FR-08, FR-09, UC-01):**
   - Atomic reservation of 2-person study tables inside a single PostgreSQL transaction (`BEGIN ... COMMIT`).
   - Hard concurrency guarantees via PostgreSQL partial unique index `booking_confirmed_resource_uk` on `(resource_id, slot_date, time_slot)` where `status = 'CONFIRMED'`.
   - Concurrency race tests prove zero duplicate seat allocations under 10 simultaneous requests.
   - Atomic cancellation and atomic rescheduling with rollback protection on target slot collision.
4. **Governed Agentic AI Assistant (FR-04, FR-10, FR-11):**
   - Bounded recommendation agent at `POST /api/agent/recommend`.
   - Multi-factor deterministic compatibility score: \(35C + 25T + 20P + 10L + 10G\) with automatic weight renormalization for omitted factors.
   - Read-only database query tools (`tool_get_viewer_profile`, `tool_get_eligible_candidates`). Zero-mutation invariant empirically proven against adversarial prompt injection.
   - Offline deterministic template synthesizer (`TemplateLlmClient`) providing seamless fallback during inference outages.
5. **Full-Stack Integration:**
   - React 18 + TypeScript frontend with live HTTP adapter (`frontend/src/services/http/HttpBookingAdapter.ts`).
   - Express 4.x TypeScript modular monolith backend connecting to PostgreSQL 17 using restricted role `campus_duo_app`.

---

## 2. Git Commit Traceability

The implementation spans three verified milestones in Git history:

| Commit SHA | Milestone / Type | Summary / Deliverable Evidence |
|---|---|---|
| `8fdea9297d0c6c4a40cc5c9351bcf383f01c1d76` | Base D2 Integration Merge | Merged `feat/KAN-35-booking-backend`: full PostgreSQL booking engine, migrations V001–V009, 10-client concurrency race harness, and local auth suite. |
| `4ac395279cbe469520682dc47ee4329d242642ed` | Commit A: AI Assistant Recovery | Recovered KAN-49 AI assistant and KAN-45 Hugging Face inference router wiring across 15 approved source and test files. |
| `c8d80dbeee2a74c398480358d5d82ac3055b1695` | Commit B: Configuration & Runbook | Updated `backend/.env.example` and `docs/D2-runbook.md` with documented Hugging Face configuration and runtime procedures. |

---

## 3. Test Verification Baseline & Evolution

D2 capabilities are verified by automated test suites whose depth evolved across the D2 integration and D3 hardening milestones:

- **D2 Merge Baseline (Commit `8fdea92` / Runbook Baseline):**
  - Backend: 7 test files, 49 tests passing.
  - Frontend: 21 test files, 217 tests passing.
  - Concurrency: 10-client race condition verified (1 confirmed, 9 conflict).

- **Current Hardened Baseline (Post-D3 KAN-71 & KAN-81 Expansion):**
  - **Backend Test Suites:** 15 test files, 190 tests passing (100% pass rate).
  - **Backend Statements Coverage:** 85.49% (3,487 / 4,079 statements, exceeding the 80% target).
  - **Backend Concurrency Race Verification:** 10 concurrent requests yield exactly 1 confirmed booking (HTTP 201) and 9 conflicts (HTTP 409).
  - **Frontend Test Suites:** 26 test files, 245 tests passing cleanly with zero typecheck errors.
  - **Combined Total:** 435 automated tests passing across the full-stack repository.

---

## 4. Verification Evidence Artifacts

1. Primary execution runbook: [`docs/D2-runbook.md`](file:///C:/Users/cavlc/OneDrive/Desktop/AI/Campus-Duo-Qwen-Integration/docs/D2-runbook.md)
2. Agent integration report: [`Deliverables/D2/Agentic_AI_Integration_Report.md`](file:///C:/Users/cavlc/OneDrive/Desktop/AI/Campus-Duo-Qwen-Integration/Deliverables/D2/Agentic_AI_Integration_Report.md)
3. API specifications: [`Deliverables/D2/API_Documentation.md`](file:///C:/Users/cavlc/OneDrive/Desktop/AI/Campus-Duo-Qwen-Integration/Deliverables/D2/API_Documentation.md)
4. AI Engineering Log: [`Deliverables/D2/AI_Engineering_Log.md`](file:///C:/Users/cavlc/OneDrive/Desktop/AI/Campus-Duo-Qwen-Integration/Deliverables/D2/AI_Engineering_Log.md)
5. Requirements Traceability: [`Deliverables/D2/Requirements_Traceability_D2.csv`](file:///C:/Users/cavlc/OneDrive/Desktop/AI/Campus-Duo-Qwen-Integration/Deliverables/D2/Requirements_Traceability_D2.csv)
6. Transactional Demo Guide: [`Deliverables/D2/Transactional_Demo_Guide.md`](file:///C:/Users/cavlc/OneDrive/Desktop/AI/Campus-Duo-Qwen-Integration/Deliverables/D2/Transactional_Demo_Guide.md)
