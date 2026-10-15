# Campus Duo — Deliverable 2 Execution & Demonstration Runbook

Please refer to the primary runbook located at:
[`docs/D2-runbook.md`](../docs/D2-runbook.md)

This runbook contains:
1. System Overview & Deliverable Scope
2. Prerequisites & Environment Setup (Node 22, npm 10, PostgreSQL 17 on localhost:5432)
3. Starting Backend and Frontend Services
4. Step-by-Step End-to-End Verification Walkthrough
   - `GET /api/health`
   - `GET /api/booking/locations`
   - `GET /api/booking/availability`
   - `POST /api/booking` (Transactional study table reservation)
   - 10-Client PostgreSQL Concurrency Race Test (`tests/concurrency.race.test.ts`)
   - `GET /api/booking/:bookingId` (Ownership authorization check)
   - `GET /api/booking` (Booking history)
   - `POST /api/agent/recommend` (Bounded AI Agent with deterministic formula 35C+25T+20P+10L+10G and template fallback)
5. Automated Test Suites Summary (49 backend tests, 217 frontend tests passing)
6. Deferred Architectural Decisions Register (`DEC-01`, `DEC-05`, `DEC-08`, `DEC-10/22`, `DEC-12`)
