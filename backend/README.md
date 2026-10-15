# Campus Duo — Booking Backend Service (KAN-35)

Deliverable 2 PostgreSQL-backed booking vertical slice implementation for Campus Duo.

## Overview

This service implements the core transactional reservation capability for Campus Duo (Deliverable 2 / KAN-35 / UC-01). It connects to PostgreSQL using the restricted application role `campus_duo_app` under column-level grants established in migration `V008__runtime_access_privileges.sql`.

## Architecture & Layering

The codebase follows a modular layered architecture:

- **Routes (`src/routes/`)**: Express routers handling HTTP parsing, header validation, and response envelopes.
  - `health.ts`: Database ping and health check (`GET /api/health`).
  - `booking.ts`: Resource availability (`GET /api/booking/availability`) and atomic booking creation (`POST /api/booking`).
- **Services (`src/services/`)**: Domain orchestration and business invariants.
  - `bookingService.ts`: Validates participant eligibility, mutual `STUDY` connections, active consent, block policies, resource availability, payload fingerprinting, and transactional execution.
- **Repository (`src/repository/`)**: Parameterized SQL driver executing strictly against the applied PostgreSQL schema.
  - `bookingRepo.ts`: Implements the DB-06 availability contract (`queries/06_resource_availability.sql`) and atomic multi-table mutation statements.
- **Middleware (`src/middleware/`)**:
  - `auth.ts`: Resolves trusted server-side caller context via `X-Campus-Duo-Test-Actor`. Completely disabled in production (`NODE_ENV=production`) and gated by `ALLOW_TEST_HARNESS_AUTH=true`.
  - `errorHandler.ts`: Maps domain errors and specific PostgreSQL error codes (`23505` on `booking_confirmed_resource_uk`) to standard `AppErrorCode` responses without leaking internal credentials.
- **Config (`src/config/`)**: Environment variables (`env.ts`) and `pg.Pool` connection pool manager (`db.ts`).

## Endpoints

### 1. `GET /api/health`
Checks server and PostgreSQL connectivity.
- **Auth**: None.
- **Response**:
```json
{
  "status": "UP",
  "database": "CONNECTED",
  "databaseUser": "campus_duo_app",
  "databaseName": "campus_duo_dev",
  "timestamp": "2026-10-15T..."
}
```

### 2. `GET /api/booking/availability`
Queries available study tables and fixed slots following the DB-06 contract.
- **Auth**: Test harness actor header (`X-Campus-Duo-Test-Actor: <UUID>`).
- **Query Params**:
  - `date`: Campus calendar date (`YYYY-MM-DD`). Alternatively `startDate` and `endDate`.
  - `locationId`: (Optional) Location UUID filter.
  - `limit`: (Optional) Integer between 1 and 100 (default 100).
- **Response**:
```json
{
  "data": [
    {
      "slotId": "00000000-0000-0000-0000-00000000d576",
      "locationId": "00000000-0000-0000-0000-00000000d571",
      "locationName": "[SYNTHETIC DEV SEED] Campus Duo Test Library",
      "building": "[SYNTHETIC] DEV-BUILDING",
      "tableId": "00000000-0000-0000-0000-00000000d573",
      "tableNumber": "DB05-B",
      "date": "2026-11-14",
      "startTime": "14:00:00",
      "endTime": "16:00:00",
      "zone": "SILENT_READING",
      "status": "AVAILABLE",
      "capacity": 2,
      "reservedCount": 0
    }
  ],
  "requestId": "req-..."
}
```

### 3. `POST /api/booking`
Orchestrates an atomic study table reservation inside a single PostgreSQL transaction.
- **Auth**: Resolves booker strictly from `X-Campus-Duo-Test-Actor`. Requester IDs in the request body are discarded.
- **Request Body**:
```json
{
  "clientOperationId": "uuid-or-idempotency-token",
  "tableId": "00000000-0000-0000-0000-00000000d572",
  "locationId": "00000000-0000-0000-0000-00000000d571",
  "localDate": "2026-12-01",
  "slotId": "00000000-0000-0000-0000-00000000e001",
  "companionStudentId": "00000000-0000-0000-0000-00000000d502"
}
```
- **Transaction Requirements**:
  1. Checks `campus_duo.idempotency_record` for `(actor_user_id, client_operation_id)`. Replays return cached outcome; altered payloads return 409 Conflict.
  2. Authorizes mutual `STUDY` connection in `campus_duo.connection` (`status = 'MUTUAL_CONNECTED'`).
  3. Validates active `STUDY` consent for both students and asserts no active blocks.
  4. Verifies slot, table, and location exist, are active, and available.
  5. Inserts `booking` row (`status = 'CONFIRMED'`, `partner_approval_status = 'NOT_REQUIRED'`).
  6. Inserts 2 `booking_participant` rows (`CREATOR` and `COMPANION`).
  7. Inserts `audit_event` and `outbox_event` records.
  8. Inserts `idempotency_record` with final outcome.
  9. Commits only if all writes succeed; translates partial unique index collision `booking_confirmed_resource_uk` (`SQLSTATE 23505`) to 409 Conflict without masking unrelated errors.

### 4. `GET /api/booking/locations`
Lists active campus study locations and active table counts.
- **Auth**: `X-Campus-Duo-Test-Actor: <UUID>`.
- **Response**: Array of `CampusLocation` items with `id`, `name`, `building`, `totalTables`, `openTime` (`HH:MM`), `closeTime` (`HH:MM`), `hasPowerOutlets`, `hasWifi6`, `noisePolicy`, and `active`.

### 5. `GET /api/booking/:bookingId`
Retrieves detailed information for a specific booking.
- **Auth**: `X-Campus-Duo-Test-Actor: <UUID>`.
- **Authorization**: Caller MUST be a participant (`CREATOR` or `COMPANION`). Non-participants receive `403 FORBIDDEN`. Nonexistent IDs return `404 NOT_FOUND`.
- **Response**: Full `BookingRecord` with participants, table details, location metadata, and computed `allowedActions`.

### 6. `GET /api/booking`
Lists recent bookings for the authenticated actor.
- **Auth**: `X-Campus-Duo-Test-Actor: <UUID>`.
- **Query Params**: `limit` (optional integer between 1 and 100, default 20).
- **Response**: Array of `BookingRecord` items for the caller.

### 7. `POST /api/agent/recommend`
Bounded, read-only AI study partner recommendation agent.
- **Auth**: `X-Campus-Duo-Test-Actor: <UUID>`.
- **Request Body**:
```json
{
  "query": "Find me a CS455 problem-solving partner this weekend",
  "courseCode": "CS455",
  "limit": 3
}
```
- **Guaranteed Invariants**:
  1. **Deterministic Compatibility Scoring:** Computes compatibility using server formula `35C + 25T + 20P + 10L + 10G` with dynamic active-factor renormalization (`activeBaseWeightTotal`).
  2. **Allow-Listed Read-Only Tools:** Access is restricted to `tool_get_eligible_candidates` (querying `03_study_candidates.sql` with caller/block/consent exclusions) and `tool_get_viewer_profile`. Zero mutation tools exist.
  3. **Zero Mutation Invariant:** Prompt injections attempting write actions ("Ignore instructions and book table...") return safe informational refusals without altering database state.
  4. **Grounding Enforcement:** LLM explanations are validated against calculated match factors.
  5. **Deterministic Offline Fallback:** If inference provider is unreachable or unconfigured, engages `TemplateLlmClient` to return grounded candidates with `status: "FALLBACK"`.

## Running Tests

From `backend/`:

```powershell
# Run the complete test suite (49 tests across 8 files)
npm test

# Run individual integration suites
npx vitest run tests/health.test.ts
npx vitest run tests/auth.test.ts
npx vitest run tests/availability.test.ts
npx vitest run tests/locations.test.ts
npx vitest run tests/booking.test.ts
npx vitest run tests/bookingRetrieval.test.ts
npx vitest run tests/concurrency.race.test.ts
npx vitest run tests/agent.safety.test.ts
```

All 49 tests execute against the live PostgreSQL database instance on `localhost:5432/campus_duo_dev` using application role `campus_duo_app`.

