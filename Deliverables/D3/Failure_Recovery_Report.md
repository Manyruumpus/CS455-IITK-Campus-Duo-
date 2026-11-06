# Deliverable 3 (D3) — Failure and Recovery Test Report (KAN-86)

**Milestone:** Deliverable 3 Reliability Engineering (KAN-86, QR-04, NFR-04)  
**Repository:** `C:\Users\cavlc\OneDrive\Desktop\AI\Campus-Duo-Qwen-Integration`  
**Date:** November 5, 2026  
**Auditor:** Quality Assurance & Resilience Engineering  
**Status:** FULLY VERIFIED (12 Dedicated Failure Scenarios Documented & Passing)  

---

## 1. Reliability Objectives & Failure Philosophy

Campus Duo is designed to degrade gracefully during infrastructure, transactional, network, and provider outages. Under no circumstance should a failure cause:
- State corruption or double-booking.
- Credential or internal database error leakage.
- Unhandled HTTP 500 server crashes.
- Permanent denial of service for unaffected features.

---

## 2. 12 Verified Failure and Recovery Scenarios

| Scenario ID | Subsystem | Injected Fault / Failure Event | System Detection & Recovery Behavior | User / Client Impact | Test File / Evidence |
|---|---|---|---|---|---|
| **FAIL-01** | Auth | Expired or forged Bearer session token | `authMiddleware` queries session; fails lookup; returns 401. | HTTP 401 `UNAUTHENTICATED`. Session cleared. | `tests/auth.lifecycle.test.ts` |
| **FAIL-02** | RBAC | Student accesses `/api/admin/*` | `requireRole('ROLE_ADMIN')` checks session role claim; rejects immediately. | HTTP 403 `FORBIDDEN`. No admin data disclosed. | `tests/auth.lifecycle.test.ts` |
| **FAIL-03** | Health | PostgreSQL connection drops / rejects query | `GET /api/health` catch handler intercepts connection drop; returns 503. | HTTP 503 `DOWN`, database marked `DISCONNECTED`. Zero password leaks. | `tests/health.test.ts` |
| **FAIL-04** | Input | Malformed courseCode or negative limit | Express route parameter validation detects regex/type failure; returns 400. | HTTP 400 `VALIDATION_ERROR` with explanatory message. | `tests/agent.safety.test.ts` |
| **FAIL-05** | Booking | Competing simultaneous slot booking | Partial unique index `booking_confirmed_resource_uk` throws code `23505`. | HTTP 409 `CONFLICT`. Slot capacity preserved for winning student. | `tests/concurrency.race.test.ts` |
| **FAIL-06** | Booking | Injected crash during participant insertion | Database transaction executes `ROLLBACK`; all partial writes undone. | HTTP 500 `INTERNAL_ERROR`. Database row count unchanged. | `tests/booking.test.ts` |
| **FAIL-07** | AI | HF router returns HTTP 400 `model_not_supported` | Client catches HTTP 400; logs warning; invokes `TemplateLlmClient`. | HTTP 200 with `status: "FALLBACK"`. Valid match cards shown. | `STAGE3_HF_LIVE_VERIFICATION.md` |
| **FAIL-08** | AI | HF router returns HTTP 402 `Payment Required` | Client catches HTTP 402; logs warning; invokes `TemplateLlmClient`. | HTTP 200 with `status: "FALLBACK"`. Uninterrupted service. | `STAGE3_HF_LIVE_VERIFICATION.md` |
| **FAIL-09** | AI | External provider timeout (exceeding `HF_TIMEOUT_MS`) | `AbortController` triggers abort event; client throws request failed; triggers fallback. | HTTP 200 with `status: "FALLBACK"`. Client does not hang indefinitely. | `tests/huggingFaceLlmClient.test.ts` |
| **FAIL-10** | AI | Malformed or non-JSON response from LLM | Client JSON parser throws; caught by client; triggers deterministic fallback. | HTTP 200 with `status: "FALLBACK"`. System does not crash on malformed AI text. | `tests/huggingFaceLlmClient.test.ts` |
| **FAIL-11** | AI | LLM hallucinates candidate label not in request | `validateExplanations` checks candidate map; detects unknown ID; rejects response. | HTTP 200 with `status: "FALLBACK"`. Hallucinations discarded. | `tests/agent.safety.test.ts` |
| **FAIL-12** | AI | Candidates match without overlapping courses/times | `TemplateLlmClient` synthesizes baseline general compatibility text. | HTTP 200 OK with clean explanation text. | `tests/agent.safety.test.ts` |

---

## 3. Database Connection Recovery Model

### Connection Pool Re-acquisition
Campus Duo utilizes `pg.Pool` with default keep-alive and reconnection semantics:
- When a database connection drops during query execution, the individual query fails and triggers a sanitized HTTP 503 response (`FAIL-03`).
- The pool marks the damaged client as dead and purges it from the pool.
- On subsequent incoming requests, `pg.Pool` automatically attempts to establish a fresh TCP connection to PostgreSQL without requiring an API server restart.
- **Verification Note:** Transparent mid-query socket resumption is not supported (and would violate transaction isolation); recovery occurs automatically on subsequent HTTP requests.

---

## 4. Acceptance Status

**KAN-86 Status: FULLY MET**  
All 12 failure modes have been demonstrated through unit tests, mock injections, and live WAN probe observations. The system exhibits high fault tolerance, reliable rollback atomicity, and zero credential exposure.
