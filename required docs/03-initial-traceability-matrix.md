# Campus Duo — Requirements Traceability Matrix

**Deliverable:** 2 | **Status:** Verified Execution Evidence (D2 Vertical Slice & Bounded Agent)  
**Source:** `01-requirements-and-use-cases.md`, `02-architecture-and-design.md`, `docs/test_evolution.md`  
**Last updated:** 15 October 2026 | **Branch:** `feat/KAN-35-booking-backend`

Each row maps a requirement to a user story, design element, proposed Jira backlog item and verified test. The backlog labels below are local planning IDs (`BL-xx`) alongside confirmed Jira keys.

| Requirement | Story | Architecture/design | Backlog | Planned verification | Actual Jira key | PR/commit | Test ID/result |
|---|---|---|---|---|---|---|---|
| FR-01 | US-01 | Auth and identity | BL-01 | Allowed-domain verification; OTP ownership challenge; local registration | KAN-35 | `feat/KAN-35-booking-backend` | `backend/tests/auth.test.ts` (6 tests) + `backend/tests/auth.lifecycle.test.ts` (18 tests) + `backend/tests/auth.otp.test.ts` (20 tests including concurrency) + `backend/tests/acceptance.e2e.test.ts` (Flow 1) + `frontend/src/tests/auth.otp.ui.test.tsx` (3 tests) + `frontend/src/tests/auth.local.test.tsx` (8 tests) — PASS |
| FR-02 | US-01, US-07 | RBAC and admin guard | BL-02 | Student request to admin API denied (403); UI role toggle removed | KAN-35 | `feat/KAN-35-booking-backend` | `backend/tests/auth.lifecycle.test.ts` (403 Forbidden on `/api/admin/summary`) + `backend/tests/admin.inventory.test.ts` (RBAC) + `backend/tests/acceptance.e2e.test.ts` (Flows 1 & 7) + `frontend/src/tests/auth.local.test.tsx` — PASS |
| FR-03 | US-02, US-08 | Profile and safety | BL-03 | Hidden/blocked bilateral exclusion | TBD | TBD | Course/profile retrieval verified via `usePrivateProfile()`; editing & bilateral block/report deferred — PARTIAL (D2 Retrieval PASS / D3 Management DEFERRED) |
| FR-04 | US-03 | Scoring strategy, safe projections | BL-04 | Hand-computed scores, missing data, tie/reasons | KAN-35 | `feat/KAN-35-booking-backend` | `backend/tests/agent.safety.test.ts` (Formula 35C+25T+20P+10L+10G, missing data renormalization) — PASS |
| FR-05 | US-04 | Match module | BL-05 | Reciprocal likes, repeat-like idempotence | KAN-35 | `feat/KAN-35-booking-backend` | `backend/tests/discovery.test.ts` (5 tests: directional isolation, reciprocal like connection, booking enablement) + `backend/tests/acceptance.e2e.test.ts` (Flow 2) + `frontend/src/tests/discovery.live.test.ts` (2 tests) — PASS |
| FR-06 | US-07 | Admin inventory | BL-06 | Add/disable; unsafe removal blocked; table count reconciliation | KAN-35 | `feat/KAN-35-booking-backend` | `backend/tests/admin.inventory.test.ts` (27 tests: RBAC 401/403/200, location create/deactivate, table auto-numbering & deactivation, slot overlap rejection 409, operating hours validation, count reconciliation) + `backend/tests/acceptance.e2e.test.ts` (Flow 7) — PASS |
| FR-07 | US-05 | Booking unique active claim, ADR-004 | BL-07 | Simultaneous final-slot race; one durable claim; dynamic occupancy | KAN-35 | `feat/KAN-35-booking-backend` | `backend/tests/booking.test.ts` (10 tests) + `backend/tests/concurrency.race.test.ts` (10 clients: 1 201, 9 409) + `backend/tests/availability.test.ts` (7 tests) + `backend/tests/acceptance.e2e.test.ts` (Flow 3) — PASS |
| FR-08 | US-06 | Booking transaction/version | BL-08 | Target conflict/stale version preserves source | KAN-35 | `feat/KAN-35-booking-backend` | `backend/tests/booking.lifecycle.test.ts` (16 tests: target conflict preserves source intact, atomic replacement creation, single successor limit, companion 403) + `backend/tests/acceptance.e2e.test.ts` (Flow 6) + `frontend/src/tests/booking.lifecycle.ui.test.tsx` (4 tests: modal dialog flow, slot selection, mutation execution, companion read-only) + `frontend/src/tests/httpBookingAdapter.test.ts` (27 tests) — PASS |
| FR-09 | US-06 | Booking cancellation/outbox | BL-09 | Repeat cancel; slot rebooked once | KAN-35 | `feat/KAN-35-booking-backend` | `backend/tests/booking.lifecycle.test.ts` (16 tests: atomic cancellation, repeat cancel idempotency, outbox collision safety, freed slot immediately rebookable, companion 403 rejection, admin cancel) + `backend/tests/acceptance.e2e.test.ts` (Flows 4 & 5) + `frontend/src/tests/booking.lifecycle.ui.test.tsx` (4 tests) + `frontend/src/tests/httpBookingAdapter.test.ts` (27 tests) — PASS |
| FR-10 | US-09 | Agent allow-list and tool authorization | BL-10 | Injection cannot invoke write tool/private lookup | KAN-35 | `feat/KAN-35-booking-backend` | `backend/tests/agent.safety.test.ts` (9 tests: zero mutations, read-only tools) — PASS |
| FR-11 | US-09 | Non-LLM fallback | BL-11 | Simulated inference outage keeps core workflows | KAN-35 | `feat/KAN-35-booking-backend` | `backend/tests/agent.safety.test.ts` (Deterministic TemplateLlmClient fallback) — PASS |
| FR-12 | US-10 | Audit/outbox & authentic dashboard | BL-12 | State transitions logged without secrets; dynamic dashboard inventory | KAN-35 | `feat/KAN-35-booking-backend` | `backend/tests/booking.test.ts` (Audit & outbox) + `frontend/src/tests/dashboard.authentic.test.tsx` (2 tests: authentic reservations, courses, CC-101 no slots) — PASS |
| FR-13 | US-08, US-10 | Safety/moderation | BL-13 | Report review permission and block effect | TBD | TBD | TBD / Not run (D3) |
| FR-14 | TBD (optional) | Messaging module only if approved | BL-14 | Unmatched send/read denied | TBD | TBD | TBD / Deferred (DEC-08) |
| FR-15 | TBD (deferred) | Separate future consent model | BL-15 | New approved scope and tests | TBD | TBD | TBD / Deferred (DEC-01) |
| NFR-01 | US-05 | DB constraint, ADR-004 | BL-07 | Repeated concurrency tests with DB inspection | KAN-35 | `feat/KAN-35-booking-backend` | `backend/tests/concurrency.race.test.ts` (10 clients) + `frontend/src/tests/httpBookingLive.integration.test.ts` (5 clients) — PASS |
| NFR-02 | US-01, US-07 | RBAC, booking ownership | BL-02 | Unauthorized and cross-user API tests | KAN-35 | `feat/KAN-35-booking-backend` | `backend/tests/bookingRetrieval.test.ts` (11 tests: creator/companion read, 403 non-participant) — PASS |
| NFR-03 | US-03, US-09 | Safe projection, redaction | BL-10 | Hidden data absent in cards, agent and logs | KAN-35 | `feat/KAN-35-booking-backend` | `backend/tests/agent.safety.test.ts` (03_study_candidates.sql projection redaction) — PASS |
| NFR-04 | US-05, US-09 | Transaction failure path, fallback | BL-11 | DB/LLM failure injection | KAN-35 | `feat/KAN-35-booking-backend` | `backend/tests/booking.test.ts` (Rollback) + `backend/tests/agent.safety.test.ts` (LLM failure fallback) — PASS |
| NFR-05 | All MVP stories | CI/testing plan | BL-16 | Coverage report; justify exclusions | KAN-35 | `feat/KAN-35-booking-backend` | Full test execution (157 backend tests passing across 14 files, 245 frontend tests passing across 26 files cleanly); empirical line coverage report blocked on Windows junction path special characters (`^^`) — PARTIAL (Infrastructure Blocked) |
| NFR-06 | US-03, US-05 | Load-test harness | BL-16 | 100 DAU/250 transactions/day baseline model | TBD | TBD | TBD / Not run (D3) |
| NFR-07 | US-03, US-05 | Performance budget TBD | BL-16 | p95 and throughput under agreed workload | TBD | TBD | TBD / Not run (D3) |
| NFR-08 | US-10 | Audit/outbox | BL-12 | Event correlation/retention test | KAN-35 | `feat/KAN-35-booking-backend` | `backend/tests/booking.test.ts` (Transactional outbox_event & audit_event verification) — PASS |
| NFR-09 | US-05, US-06 | Fixed slots and timezone | BL-07 | Boundary-date and slot-identity checks | KAN-35 | `feat/KAN-35-booking-backend` | `backend/tests/availability.test.ts` (7 tests: date format, bounds) — PASS |
| NFR-10 | All UI stories | UI review checklist | BL-17 | Approved accessibility checks | KAN-35 | `feat/KAN-35-booking-backend` | `frontend/src/tests/` (Input, Button, Dialog accessibility tests passing) — PASS |

## Maintenance rules

1. Confirm the actual Jira project key; create issues and replace `BL-xx` with real keys in the corresponding column while retaining planning labels if useful.
2. Link Jira issue → branch with key → commit(s) → reviewed PR → automated test ID → run/result. Only mark a row verified after evidence exists.
3. Changes to a requirement update story, architecture/ADR, issue and tests together; record date and reviewer.
4. At minimum maintain real end-to-end evidence for critical FR-01 through FR-13 as implementation proceeds; do not fabricate completed results in Deliverable 1.

**Review/sign-off:** TBD.
