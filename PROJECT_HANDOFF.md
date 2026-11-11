# Campus Duo — Consolidated Project Handoff & Technical Baseline
**Authoritative Development Workspace:** `C:\Users\cavlc\OneDrive\Desktop\AI\Campus-Duo-Qwen-Integration`  
**Date:** November 4, 2026  
**Status:** Audit Verified & Ready for Staged AI Verification and D3 Execution  

---

## 1. Project Overview & Worktree Configuration

The project consists of a full-stack campus collaboration platform (React + Vite frontend, Express + TypeScript backend, PostgreSQL 17 database) with a bounded, privacy-preserving AI Study Assistant.

All three local workspaces share a single underlying Git object repository hosted at `C:\Users\cavlc\OneDrive\Desktop\^^\Acads\cs455\project\CS455-IITK-Campus-Duo-\.git`:

| Repository / Worktree | Absolute Path | Branch | HEAD SHA | Status / Purpose |
|---|---|---|---|---|
| **Integration Worktree** *(Sole Source of Truth)* | `C:\Users\cavlc\OneDrive\Desktop\AI\Campus-Duo-Qwen-Integration` | `feat/KAN-49-d2-integration` | `8fdea92` | **Authoritative workspace** for all future AI recovery, Hugging Face live testing, D3 deliverables, and commits. |
| **Original KAN-49 Worktree** | `C:\Users\cavlc\OneDrive\Desktop\AI\Campus-Duo-Qwen` | `feat/KAN-49-ai-assistant-integration` | `8cd26d4` | **Read-only historical reference.** Older branch without D2 booking commits. Retain untouched. |
| **Original D2 Worktree** | `C:\Users\cavlc\OneDrive\Desktop\^^\Acads\cs455\project\CS455-IITK-Campus-Duo-` | `main` | `8fdea92` | **Read-only historical reference.** Contains baseline D1/D2 artifacts. Retain untouched. |

---

## 2. AI Assistant Architecture & Implementation Inventory (KAN-49 / KAN-45)

The AI Assistant implements read-only study partner recommendation with deterministic scoring ($35C + 25T + 20P + 10L + 10G$) and grounded LLM explanation generation.

### Component Inventory in Integration Worktree

1. `backend/src/routes/agent.ts` *(Modified, uncommitted)*
   - Route: `POST /api/agent/recommend`
   - Authorization: `testAuthMiddleware` (supports Bearer tokens & dev actor headers) + `requireRole('ROLE_STUDENT')`.
   - Validation: Strict input constraints on `courseCode` (regex, $\le 32$ chars), `prompt` ($\le 1000$ chars), and `limit` ($1..50$).

2. `backend/src/services/agentService.ts` *(Modified, uncommitted)*
   - Allow-listed Read Tools: `tool_get_eligible_candidates` (queries `03_study_candidates.sql`) and `tool_get_viewer_profile` (queries `01_private_account_profile.sql`).
   - Grounding Assertion: `validateGrounding` server-side validator rejects unknown candidate labels, ungrounded tokens, or hallucinated course entities.
   - Fallback Engine: Gracefully falls back to offline `TemplateLlmClient` if LLM is disabled, unconfigured, times out, or fails grounding.

3. `backend/src/services/scoringEngine.ts` *(Modified, uncommitted)*
   - Implements $35C + 25T + 20P + 10L + 10G$ with exact active weight renormalization when optional factors (Style, Pace, Location, Goals) are omitted.
   - Privacy Invariant: Exact schedule slots (`preferredTimes`), emails, and roll numbers are never exposed in explanation strings.

4. `backend/src/services/huggingFaceLlmClient.ts` *(Untracked)*
   - Target Provider: Hosted Hugging Face Inference API (`https://router.huggingface.co/v1/chat/completions`).
   - Model ID: `Qwen/Qwen3-4B-Instruct-2507`.
   - Privacy Guard: Maps candidates to anonymous tokens (`candidate_1`, `candidate_2`) containing only normalized score and grounded facts. Real UUIDs and names are never sent to external networks.
   - Error Sanitization: Catch block redacts all network error bodies and URLs to prevent credential leakage.

5. `backend/src/config/env.ts` *(Modified, uncommitted)*
   - Variables: `ENABLE_LLM_INFERENCE` (boolean, default `false`), `HF_TOKEN`, `HF_MODEL_ID` (default `Qwen/Qwen3-4B-Instruct-2507`), `HF_TIMEOUT_MS` ($1000..30000$, default $20000$).
   - Safety Guard: If `ENABLE_LLM_INFERENCE=true` but `HF_TOKEN` is missing, marks `configurationIssue` and disables network calls before execution.

6. `frontend/src/services/http/HttpAgentAdapter.ts` *(Untracked)*
   - Client adapter connecting to `/api/agent/recommend`.
   - Sends student `sessionToken` as Bearer token; handles status mapping (`COMPLETED`, `FALLBACK`), course filtering, and field sanitization.

7. `frontend/src/features/student/StudyDiscoveryPage.tsx` *(Modified, uncommitted)*
   - Full student UI integration with `Ask AI Assistant` modal form, loading indicator, deterministic fallback badge, and alternative recommendations view.

---

## 3. Test Verification & Evidence

All test suites executed during this audit passed with zero errors:

| Suite / Test File | Command | Target / Scope | Result | Evidence |
|---|---|---|---|---|
| **HF Client Unit** | `npx vitest run tests/huggingFaceLlmClient.test.ts` | Backend LLM Adapter & Sanitization | **18 / 18 Passed** (1.29s) | Mocks, redaction, and error handling verified. |
| **Agent Safety Suite** | `npx vitest run tests/agent.safety.test.ts` | Backend Read-Only Invariants & RBAC | **13 / 13 Passed** (11.19s) | DB invariant verified (0 booking mutations). |
| **Frontend Agent Suite** | `npx vitest run src/tests/agent.integration.test.ts` | Frontend HTTP Adapter & Sanitization | **9 / 9 Passed** | Bearer auth and response parsing verified. |
| **Service Selection** | `npx vitest run src/tests/serviceSelection.test.ts` | Mock vs Live Service Switching | **5 / 5 Passed** | Dynamic adapter wiring verified. |
| **Backend Typecheck** | `npx tsc --noEmit` | Backend TypeScript Compiler | **Clean (Exit 0)** | Zero type errors. |
| **Frontend Typecheck**| `npm run typecheck` | Frontend TypeScript Compiler | **Clean (Exit 0)** | Zero type errors. |

---

## 4. Production Limitations & DEC-05 Notice

- **DEC-05 Architectural Boundary:** Institutional IITK CC SSO / LDAP / OAuth is deferred pending institute infrastructure approval. Authentication operates via local `@iitk.ac.in` email verification with scrypt hashing and session tokens.
- **Session Restoration:** Browser refresh currently resets in-memory React auth context (`useState<UserSession | null>`). No token is stored in `localStorage` or `sessionStorage`. For live demonstrations, either maintain the active tab session or sign in using the local login/OTP flow or demo role switcher.
- **Backend Logout:** The backend endpoint `POST /api/auth/logout` revokes tokens in PostgreSQL; the frontend UI logout handler currently clears client-side state and should be wired to call the backend route in D3.

---

## 5. Jira Reconciliation & D3 Work Items

Based on the baseline snapshot `Jira (5).csv` (87 issues: 35 Done, 14 In Progress, 38 To Do):

### AI Assistant Issues (Epic KAN-49)
- `KAN-21`, `KAN-45`, `KAN-46`, `KAN-47`, `KAN-48`, `KAN-49`, `KAN-50`, `KAN-51`: Fully implemented in code in the Integration worktree; verified with mock tests and safety suites. Ready for staged commit and live verification.

### Deliverable 3 Audit Findings (Epic KAN-69, Deadline Nov 6, 2026)
- **KAN-72 & KAN-73 Anomaly:** Genuine duplicate issues created 3 minutes apart (12:35 PM vs 12:38 PM on Nov 3, 2026) with identical descriptions. Recommend closing KAN-73 as duplicate of KAN-72.
- **KAN-70 (Security Defect):** `npm audit` confirms high-severity `body-parser` and moderate `qs` DoS vulnerabilities in backend dependencies. Needs `npm audit fix` / package bump.
- **KAN-71 (Test Fixture Defect):** `backend/tests/availability.test.ts` queries date `2026-11-14` whereas seed migration `002_study_bookings.sql` seeds slots for `2026-11-11`. Needs fixture alignment.
- **KAN-74 (Booking Adapter):** `HttpBookingAdapter.ts` (19KB) is already implemented and tested in the Integration worktree.

---

## 6. Execution Plan for Next Coding Session

1. **Commit Recovered AI Work:**
   In `C:\Users\cavlc\OneDrive\Desktop\AI\Campus-Duo-Qwen-Integration`:
   ```bash
   git add backend/src/services/huggingFaceLlmClient.ts backend/tests/huggingFaceLlmClient.test.ts frontend/src/services/http/HttpAgentAdapter.ts frontend/src/tests/agent.integration.test.ts backend/src/config/env.ts backend/src/routes/agent.ts backend/src/services/agentService.ts backend/src/services/scoringEngine.ts backend/tests/agent.safety.test.ts frontend/src/config/features.ts frontend/src/features/student/StudyDiscoveryPage.tsx frontend/src/services/index.ts frontend/src/services/mock/MockStudySocialServices.ts frontend/src/tests/serviceSelection.test.ts frontend/src/tests/stage05.test.tsx docs/D2-runbook.md
   git commit -m "feat(agent): recover KAN-49 AI assistant and KAN-45 Hugging Face inference wiring"
   ```

2. **Conduct Live Hugging Face Inference Test:**
   Provide valid `HF_TOKEN` securely via environment:
   ```bash
   $env:ENABLE_LLM_INFERENCE="true"
   $env:HF_TOKEN="<your_token>"
   npx vitest run tests/huggingFaceLlmClient.test.ts
   ```
   Execute a single authenticated test request with actor Alex (`DB05-CS455`) and capture sanitized response evidence (`status: COMPLETED`).

3. **Resolve D3 Defects (KAN-70, KAN-71):**
   - Align availability test fixture date to match seed data.
   - Run dependency audit fix for `body-parser` and `qs`.

4. **Generate D3 Reports & Traceability Matrix (KAN-72, KAN-75 - KAN-88):**
   - Run full coverage generation (`vitest --coverage`).
   - Execute concurrency, security, and performance benchmarks.
