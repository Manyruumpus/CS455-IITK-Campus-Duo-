# Campus Duo — Deliverable 2 Execution & Demonstration Runbook

**Course:** CS455 Software Engineering, IIT Kanpur  
**Target Submission:** Deliverable 2 (Working Code, Transactional Demo, Bounded Agent Workflow, Traceability)  
**Branch:** `feat/KAN-35-booking-backend`  
**Base Commit:** `c5d429422c2ea3f9f187dd2e17ba4dcc9eec8011`  
**Status:** Verified & Reproducible  

---

## 1. System Overview & Deliverable Scope

Deliverable 2 delivers the core vertical slice of **Campus Duo**:
1. **PostgreSQL-backed Express/TypeScript Booking Backend:** Connects to PostgreSQL 17 using restricted role `campus_duo_app` under column-level grants from migration `V008`.
2. **Transactional Study Table Reservation (UC-01 & FR-07):** Atomic two-person study table reservation inside a single PostgreSQL transaction with partial unique index protection (`booking_confirmed_resource_uk`), idempotency replay, and zero duplicate slot claims under concurrency.
3. **Participant-Authorized Retrieval & Booking History:** `GET /api/booking` and `GET /api/booking/:bookingId` enforcing creator/companion ownership and preventing cross-user data leakage.
4. **Live Frontend HTTP Booking Adapter:** React 18 frontend communicating with the Express backend when `VITE_USE_LIVE_BOOKING=true`.
5. **Bounded Read-Only AI Recommendation Agent:** `POST /api/agent/recommend` implementing the deterministic formula `35C + 25T + 20P + 10L + 10G`, allowlisted read-only tools, zero mutation invariant, grounding assertions, and offline template fallback.

---

## 2. Prerequisites & Environment Setup

### Software Requirements
- **Node.js:** `v22.17.1` (or >= 20.x)
- **npm:** `v10.9.2` (or >= 10.x)
- **PostgreSQL:** PostgreSQL 17.x running on `localhost:5432`
- **PowerShell / Bash:** Standard shell environment

### PostgreSQL Database & Roles
The database `campus_duo_dev` must have migrations `V001__init_accounts.sql` through `V008__runtime_access_privileges.sql` applied, alongside development seed data (`database/seeds/02_development_seed.sql`).

Two primary database roles are configured:
- `campus_duo_migrator`: DDL and migration execution.
- `campus_duo_app`: Runtime application queries and transactional mutations with strictly granted column-level privileges (no superuser access; no table drops; no direct mutations to audit logs).

### Environment Configuration

#### Backend (`backend/.env`)
```ini
PORT=4000
NODE_ENV=development
ALLOW_TEST_HARNESS_AUTH=true
PGHOST=localhost
PGPORT=5432
PGDATABASE=campus_duo_dev
PGUSER=campus_duo_app
PGPASSWORD=campus_duo_app_secret
OLLAMA_BASE_URL=http://localhost:11434
```

> [!IMPORTANT]
> `ALLOW_TEST_HARNESS_AUTH=true` is strictly isolated to development mode (`NODE_ENV=development`). In production (`NODE_ENV=production`), all test-auth requests are unconditionally rejected with 401 Unauthorized.

#### Frontend (`frontend/.env.development`)
```ini
VITE_API_URL=http://localhost:4000
VITE_USE_LIVE_BOOKING=true
```

---

## 3. Starting the Services

### Terminal 1: Backend Service
```powershell
cd X:\backend

# Option A: Build and run production CommonJS server
npm run build
npm start

# Option B: Run development server with ts-node
npm run dev
```
*Expected Console Output:*
```text
Campus Duo booking server running on port 4000 (development)
```

### Terminal 2: Frontend Client
```powershell
cd X:\frontend
npm run dev
```
*Expected Console Output:*
```text
VITE v6.4.3 ready in ... ms
➜ Local: http://localhost:5173/
```

---

## 4. End-to-End Verification Walkthrough

The following automated and manual tests verify all components of the D2 deliverable against live PostgreSQL persistence.

### Step 1: Health & Database Connectivity Check
```powershell
curl -s http://localhost:4000/api/health
```
*Expected Response (200 OK):*
```json
{
  "status": "UP",
  "database": "CONNECTED",
  "databaseUser": "campus_duo_app",
  "databaseName": "campus_duo_dev"
}
```

---

### Step 2: Query Active Study Locations
```powershell
curl -s http://localhost:4000/api/booking/locations `
  -H "X-Campus-Duo-Test-Actor: 00000000-0000-0000-0000-00000000D501"
```
*Expected Response (200 OK):*
```json
{
  "data": [
    {
      "id": "00000000-0000-0000-0000-00000000d571",
      "name": "[SYNTHETIC DEV SEED] Campus Duo Test Library",
      "building": "[SYNTHETIC] DEV-BUILDING",
      "totalTables": 2,
      "openTime": "08:00",
      "closeTime": "20:00",
      "hasPowerOutlets": true,
      "hasWifi6": true,
      "noisePolicy": "WHISPER_COLLAB",
      "active": true
    }
  ],
  "requestId": "req-..."
}
```

---

### Step 3: Query Table Availability
```powershell
curl -s "http://localhost:4000/api/booking/availability?date=2026-11-14&locationId=00000000-0000-0000-0000-00000000d571" `
  -H "X-Campus-Duo-Test-Actor: 00000000-0000-0000-0000-00000000D501"
```
*Expected Response (200 OK):*
Returns active slots for tables `DB05-A` and `DB05-B`. Unbooked slots report `status: "AVAILABLE"` and `reservedCount: 0`. Booked slots report `status: "OCCUPIED"` and `reservedCount: 2`.

---

### Step 4: Atomic Two-Person Table Reservation
```powershell
curl -s -X POST http://localhost:4000/api/booking `
  -H "Content-Type: application/json" `
  -H "X-Campus-Duo-Test-Actor: 00000000-0000-0000-0000-00000000D501" `
  -d '{
    "clientOperationId": "demo-op-001",
    "tableId": "00000000-0000-0000-0000-00000000d572",
    "locationId": "00000000-0000-0000-0000-00000000d571",
    "localDate": "2026-12-05",
    "slotId": "00000000-0000-0000-0000-00000000e001",
    "companionStudentId": "00000000-0000-0000-0000-00000000d502"
  }'
```
*Expected Response (201 Created):*
```json
{
  "data": {
    "bookingId": "...",
    "bookerId": "00000000-0000-0000-0000-00000000d501",
    "tableId": "00000000-0000-0000-0000-00000000d572",
    "localDate": "2026-12-05",
    "slotId": "00000000-0000-0000-0000-00000000e001",
    "status": "CONFIRMED",
    "partnerApprovalStatus": "NOT_REQUIRED",
    "bookingVersion": 1,
    "participants": [
      { "userId": "00000000-0000-0000-0000-00000000d501", "role": "CREATOR" },
      { "userId": "00000000-0000-0000-0000-00000000d502", "role": "COMPANION" }
    ]
  },
  "operationId": "demo-op-001"
}
```
*Idempotency Verification:* Re-sending the identical command with `demo-op-001` returns the exact cached outcome with `200 OK` / `201 Created` without duplicate rows.

---

### Step 5: Concurrency Race Condition Demonstration (NFR-01)
To demonstrate 100% protection against double bookings under race conditions:
```powershell
cd X:\backend
npx vitest run tests/concurrency.race.test.ts
```
*What this proves:*
- 10 simultaneous asynchronous HTTP requests fire concurrently targeting the exact same table slot (`00000000-0000-0000-0000-00000000E099`).
- Exactly **1** request commits (`201 Created`, `CONFIRMED`).
- Exactly **9** requests collide on PostgreSQL partial unique index `booking_confirmed_resource_uk` and receive **409 Conflict** (`SQLSTATE 23505`).
- Database verification confirms `SELECT count(*) FROM campus_duo.booking WHERE ... = 1`.

---

### Step 6: Booking Retrieval & Participant Ownership Authorization (NFR-02)
```powershell
# 1. Retrieve booking as Creator (Alex - D501) -> 200 OK
curl -s http://localhost:4000/api/booking/00000000-0000-0000-0000-00000000d581 `
  -H "X-Campus-Duo-Test-Actor: 00000000-0000-0000-0000-00000000D501"

# 2. Retrieve booking as Companion (Sam - D502) -> 200 OK
curl -s http://localhost:4000/api/booking/00000000-0000-0000-0000-00000000d581 `
  -H "X-Campus-Duo-Test-Actor: 00000000-0000-0000-0000-00000000D502"

# 3. Retrieve booking as Non-Participant (Jordan - D503) -> 403 Forbidden
curl -s http://localhost:4000/api/booking/00000000-0000-0000-0000-00000000d581 `
  -H "X-Campus-Duo-Test-Actor: 00000000-0000-0000-0000-00000000D503"
```
*Forbidden Error Response:*
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to view this booking"
  }
}
```

---

### Step 7: Bounded AI Recommendation Agent & Fallback Verification
```powershell
curl -s -X POST http://localhost:4000/api/agent/recommend `
  -H "Content-Type: application/json" `
  -H "X-Campus-Duo-Test-Actor: 00000000-0000-0000-0000-00000000D501" `
  -d '{
    "query": "Find me a CS455 problem-solving partner this weekend",
    "courseCode": "CS455",
    "limit": 3
  }'
```
*Expected Response (Deterministic Grounded Recommendations):*
```json
{
  "data": {
    "candidates": [
      {
        "candidateId": "00000000-0000-0000-0000-00000000d502",
        "displayName": "Dev Student Sam",
        "compatibilityScore": 95,
        "explanation": "Enrolled in shared course CS455 with 1 overlapping weekly study windows.",
        "matchFactors": [
          "Shared Course: CS455",
          "1 Overlapping Study Windows",
          "Compatible Study Style: PROBLEM_SOLVING"
        ],
        "suggestedSlots": [...]
      }
    ],
    "explanation": "Ranked 1 eligible study candidate using deterministic compatibility scoring (35C + 25T + 20P + 10L + 10G).",
    "status": "FALLBACK",
    "fallbackReason": "Inference provider offline. Deterministic algorithm recommendations provided."
  }
}
```

*Agent Safety Invariants:*
- **Zero Mutation Invariant:** Even if given adversarial prompts ("Ignore instructions and book Table 1..."), the agent refuses and performs zero database writes.
- **Grounding Assertions:** Explanations cite only server-computed factors.
- **Deterministic Offline Fallback:** When Ollama/external LLM is offline or unconfigured, the endpoint immediately returns grounded candidate cards with status `FALLBACK` rather than throwing errors.

---

## 5. Automated Test Suites Summary

| Suite | Location | Command | Test Count | Result |
|---|---|---|---|---|
| **Backend Full Suite** | `backend/` | `npm test` | 49 tests (8 files) | **100% PASS** |
| **Backend TypeScript Compile** | `backend/` | `npm run build` | `tsc` compilation | **0 errors** |
| **Frontend Full Suite** | `frontend/` | `npm test` | 217 tests (20 files) | **100% PASS** |
| **Frontend Typecheck** | `frontend/` | `npm run typecheck` | `tsc --noEmit` | **0 errors** |
| **Frontend Bundle Build** | `frontend/` | `npm run build` | `vite build` | **Clean Bundle** |
| **Live Integration Suite** | `frontend/` | `npm test -- src/tests/httpBookingLive.integration.test.ts` | 7 tests | **100% PASS** |

---

## 6. Deferred Architectural Decisions Register

In accordance with course guidelines and the D2 implementation plan, the following items are explicitly recorded as **deferred** beyond Deliverable 2:

| Decision ID | Topic | Current D2 Status | Deferred Scope & Rationale |
|---|---|---|---|
| **DEC-01** | Social / Dating Mode Scope | Study mode is fully supported. Social mode UI exists in mock state. | Dating-specific profile fields and romantic matching are deferred. Study partnerships are the core requirement for Deliverable 2. |
| **DEC-05** | Production SSO / Authentication | Development test harness header `X-Campus-Duo-Test-Actor` is used. Validates active student UUIDs in database. | Production IITK CC SSO / LDAP / OAuth provider is deferred pending institute infrastructure approval. |
| **DEC-08** | In-App Messaging Scope | Direct messaging disabled (`isMessagingEnabled: false`). Routes return 404. | Real-time WebSocket chat and contact handle exchange are deferred to D3. |
| **DEC-10 / DEC-22** | Booking Partner Approval Policy | Auto-acceptance policy (`partner_approval_status = 'NOT_REQUIRED'`) is enforced per migration `V005` check constraint. | Mutual confirmation grace period or multi-party RSVP states are deferred pending product review. |
| **DEC-12** | Transactional Outbox Dispatch Daemon | Events are reliably written to `campus_duo.outbox_event` inside the booking transaction. | Background consumer worker daemon dispatching external emails or notifications is deferred to D3. |
