# Deliverable 3 Testing Report

## Backend

The post-review backend checkpoint reports 57 tests across 9 files, including availability, booking policy/service, audit, error handling, health failure, and real PostgreSQL concurrency coverage. The authoritative successful evidence is `evidence/backend-tests/KAN-81-backend-post-review-20261103-162511-954-05681db0.json`; the overwritten `KAN-81-backend-full-suite-20261103-160736-858.json` is not used as success evidence.

On 6 November 2026, `Set-Location backend; npm run build` passed. The isolated mocked/unit subset (`auth.test.ts`, `errorHandler.test.ts`, `booking.service.test.ts`, and `health.failure.test.ts`) passed **29/29**. The health integration test passed **1/1** when `PGDATABASE=campus_duo_test` and `PGUSER=campus_duo_app` were explicitly set.

On 6 November 2026, the current full DB-backed checkpoint passed **9/9 test files and 57/57 tests**, with no skipped tests shown and exit code 0. Native output and metadata are preserved at `evidence/backend-tests/current-full-suite-20261106-105802/`; matching native V8 coverage is preserved at `evidence/backend-coverage/current-full-suite-20261106-105802/`. Aggregate coverage is **89.91% statements, 85.71% branches, 82.50% functions, and 90.57% lines**. The earlier missing-credential attempt remains preserved as historical environment evidence and is not a current blocker.

## Frontend

On 6 November 2026, `Set-Location frontend; npm test -- --coverage`
passed with **17 files and 182 tests**. V8 coverage was **57.34% statements,
47.72% branches, 43.35% functions, and 59.09% lines**; native artifacts are
preserved under `evidence/frontend-coverage/KAN-81-frontend-coverage-20261106-102240/`.
`npm run typecheck` and `npm run build` passed. `npm run lint` passed with
three warnings emitted by generated coverage helper files. These tests
exercise the deterministic mock/demo service boundary, not a live backend.

## System and adversarial scope

The supplied system-test definition for this deliverable is **API → PostgreSQL**.
The backend integration and concurrency evidence therefore provide the system
scope: HTTP/API behavior, persisted booking state, conflict handling,
replay/idempotency, audit/outbox effects, and recovery against PostgreSQL.
The frontend is explicitly mock-only for this checkpoint. Its default
production path returns `UnavailableServiceAdapter`; no frontend API adapter or
browser journey was added. This is recorded as a known KAN-74 limitation and
future-work item rather than represented as completed system evidence.

The backend API has a development-only `X-Campus-Duo-Test-Actor` path;
production identity verification is not claimed. Adversarial coverage includes
actor format/eligibility, authorization, consent/blocking, validation,
replay/idempotency and safe errors through the backend tests and frontend
mock-service tests. Prompt-injection testing is not applicable because no
agent tool execution surface exists.

## Evidence classification

| Area | Result |
|---|---|
| Backend unit/integration | Verified by post-review evidence |
| Current backend mocked/unit subset | Verified, 29/29 on 6 November 2026 |
| Current isolated health integration | Verified, 1/1 against explicit `campus_duo_test` target |
| Current full DB-backed backend suite | Verified, 9/9 files and 57/57 tests |
| Backend real PostgreSQL concurrency | Verified, 10-request race; see concurrency report |
| Frontend unit/component | Verified, 182/182 |
| Browser visual/system | Not required for the selected API → PostgreSQL system scope; not executed |
| Frontend-to-backend journey | Known KAN-74 limitation: frontend remains mock-only; no adapter added |
| PostgreSQL restart recovery | Verified on isolated loopback cluster: 503 during outage, post-restart health/reconnection, durable replay, audit/outbox counts, timing, and exact cleanup |
| Performance/load | Smoke and baseline passed; optimization not implemented; representative-scale follow-up pending |
