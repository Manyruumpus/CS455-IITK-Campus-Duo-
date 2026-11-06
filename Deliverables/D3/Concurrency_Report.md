# Deliverable 3 (D3) — Concurrency and Race-Condition Verification Report (KAN-83)

**Milestone:** Deliverable 3 Concurrency (KAN-83, QR-01, NFR-01)  
**Repository:** `C:\Users\cavlc\OneDrive\Desktop\AI\Campus-Duo-Qwen-Integration`  
**Test Suite:** `backend/tests/concurrency.race.test.ts`  
**Database Target:** PostgreSQL 17 on `localhost:5432` (`campus_duo_dev`)  
**Date:** November 5, 2026  
**Status:** FULLY VERIFIED — ZERO DUPLICATE BOOKINGS OBSERVED  

---

## 1. Concurrency Objective & Threat Scenario

In a campus study space reservation system, study tables have strict physical capacities (exactly 2 students per table). A critical failure mode is the **double-booking race condition**: when multiple students simultaneously attempt to book the final remaining slot on a given date and time.

### Correctness Invariant:
Under any number of concurrent booking requests for a single study space resource at slot `(resource_id, slot_date, time_slot)`:
1. Exactly one request must transition to `CONFIRMED`.
2. All competing requests must be rejected with HTTP 409 Conflict (`CONFLICT`).
3. Total confirmed database records for that slot must equal exactly 1.
4. Total database connections and test fixtures must cleanly terminate with zero leaked state.

---

## 2. Technical Enforcement Mechanism: PostgreSQL Partial Unique Index

Campus Duo enforces concurrency protection through a composite architectural pattern:

### 2.1 Schema-Level Constraint
In PostgreSQL migration `database/migrations/V005__bookings_and_idempotency.sql`:
```sql
CREATE UNIQUE INDEX booking_confirmed_resource_uk
ON campus_duo.booking (resource_id, slot_date, time_slot)
WHERE status = 'CONFIRMED';
```
*Why Partial Unique Index?*
Standard unique indexes prevent any past, cancelled, or rescheduled bookings from sharing a slot identifier. The partial unique index enforces uniqueness **only** across records where `status = 'CONFIRMED'`. When a student cancels or reschedules, their booking transitions to `CANCELLED`, automatically releasing the unique index constraint for that slot and permitting immediate re-booking without historical data loss.

### 2.2 Transaction Boundary & Error Mapping
In `backend/src/repository/bookingRepo.ts` and `src/middleware/errorHandler.ts`:
- Each reservation executes inside an atomic `BEGIN ... COMMIT` transaction.
- When two transactions commit concurrently, the second transaction triggers PostgreSQL unique constraint violation error code `23505` with constraint name `booking_confirmed_resource_uk`.
- The error handler intercepts code `23505` and translates it into HTTP 409 Conflict with code `"CONFLICT"` and user-friendly message `"Selected study space slot is already reserved"`.

---

## 3. Empirical Test Execution: 10-Client Race Condition

Executed via `backend/tests/concurrency.race.test.ts`:

### Test Setup:
- Table: `00000000-0000-0000-0000-00000000D521` (Table A1, PK Kelkar Library 2F).
- Target Slot: `2026-11-14`, `14:00-16:00`.
- Competitors: 10 concurrent requests dispatched via `Promise.all` across independent HTTP requests and separate database connections.
- Each request supplies a unique idempotency key.

### Observed Empirical Results Across Repeated Trials:

The 10-client concurrency race benchmark was executed across two verification stages, capturing six independent trials to ensure statistical repeatability:

#### Series A — Stage 4C Initial Concurrency Verification:
| Trial | Concurrent Requests | 201 Created | 409 Conflict | Confirmed DB Rows | Leaked Rows | Execution Duration |
|---|---|---|---|---|---|---|
| **Run 1** | 10 | 1 | 9 | 1 | 0 | 391 ms |
| **Run 2** | 10 | 1 | 9 | 1 | 0 | 390 ms |
| **Run 3** | 10 | 1 | 9 | 1 | 0 | 509 ms |

#### Series B — Stage 4D/4E Post-Remediation Re-Verification:
| Trial | Concurrent Requests | 201 Created | 409 Conflict | Confirmed DB Rows | Leaked Rows | Execution Duration |
|---|---|---|---|---|---|---|
| **Run 4** | 10 | 1 | 9 | 1 | 0 | 486 ms |
| **Run 5** | 10 | 1 | 9 | 1 | 0 | 424 ms |
| **Run 6** | 10 | 1 | 9 | 1 | 0 | 375 ms |

**Observed Aggregate Performance Range:** Across all six independent trials, execution duration ranged between **375 ms and 509 ms**, with a mean latency of **429.2 ms**. In 100% of trials (6/6), the invariant held strictly: exactly 1 booking succeeded, exactly 9 bookings collided and received HTTP 409 Conflict, exactly 1 row remained in PostgreSQL with status `'CONFIRMED'`, and 0 orphan records were leaked.

### Response Analysis:
- **Winning Request:** HTTP 201 Created, returning a confirmed booking record with status `"CONFIRMED"`.
- **Losing Requests (9/10):** HTTP 409 Conflict, returning:
  ```json
  {
    "error": {
      "code": "CONFLICT",
      "message": "Selected study space slot is already reserved",
      "requestId": "req-xxxx-xxxx"
    }
  }
  ```
- **Database Inspection Post-Test:**
  ```sql
  SELECT count(*) FROM campus_duo.booking 
  WHERE resource_id = '00000000-0000-0000-0000-00000000D521' 
    AND slot_date = '2026-11-14' 
    AND time_slot = '14:00-16:00' 
    AND status = 'CONFIRMED';
  -- Result: 1
  ```

---

## 4. Scope and Limitations

1. **Observed Concurrency vs Mathematical Proof:** This evidence confirms collision prevention under the tested 10-client concurrent scenario on PostgreSQL 17. It does not constitute formal mathematical verification of global serializability across multi-master distributed database clusters.
2. **Local Pool Boundary:** The test harness utilizes a connection pool size of 10. Under production workloads exceeding connection pool limits, additional queueing and connection timeout protections are enforced by `pg.Pool`.

---

## 5. Acceptance Status

**KAN-83 Status: FULLY MET**  
The implementation reliably prevents double-bookings under concurrent race conditions, translates database errors into clean HTTP 409 responses, and preserves database integrity with zero state leakage.
