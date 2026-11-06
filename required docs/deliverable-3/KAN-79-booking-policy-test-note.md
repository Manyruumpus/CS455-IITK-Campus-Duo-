# KAN-79/KAN-81 Booking Policy Test Note

Existing `booking.test.ts` coverage already exercises request validation,
self-booking, missing mutual STUDY connection, missing slot, duplicate and
idempotency conflicts, caller-identity protection, successful persistence, and
transaction rollback.

The new `booking.policy.test.ts` suite adds eight genuinely distinct tests:
missing required STUDY consent, active blocking, inactive companion eligibility,
nonexistent companion lookup, unavailable resource state, and table, location,
and date resource mismatches.
Each scenario starts from an otherwise valid owned fixture, asserts the exact
HTTP status and application error, and verifies that neither a booking nor an
idempotency record exists for the rejected operation. Fixture setup and
cleanup use only explicit IDs and the existing campus_duo_test/migrator guards.

Timing-boundary rejection is not implemented by `BookingService`; it validates
date format but does not compare booking time to location hours or current
time, so no timing test was added. The earlier missing migrator password was a
fixture-environment execution failure, not a production defect.

The initial failed run recorded one assertion mismatch in the
unavailable-resource case: the test expected “study table slot”, while
`BookingService` consistently returns “study slot or resource”. The fixture
did reach the intended `LOCKED_MAINTENANCE` resource-state branch; HTTP 409
and `CONFLICT` already matched. Because the message assertion failed first,
that run did not yet verify the following no-write assertion for this case.
The expected message now matches the exact production contract without
weakening the response or no-write checks.

The added policy test verifies a fresh, syntactically valid UUID is absent from
`campus_duo.user_account` before sending a real HTTP booking request. It
reaches the repository account lookup and passes with `403 FORBIDDEN` and
`Companion is not an active verified student`; no booking or idempotency rows
are written. The UUID is not inserted or added to cleanup because it remains
intentionally nonexistent.

The targeted policy suite passed 8/8 with exit code 0. The combined backend
checkpoint passed 53/53 tests across 8 files with no skipped tests. Evidence:
`required docs/deliverable-3/evidence/backend-tests/KAN-79-booking-policy-expanded-20261103-155332-168.json`
and
`required docs/deliverable-3/evidence/backend-tests/KAN-81-backend-full-suite-20261103-155332-168.json`.
These are real HTTP/PostgreSQL integration tests against the isolated fixture,
not mocked service tests.

The earlier missing migrator password was a fixture-environment failure during
an attempted combined run, not a production defect. The initial policy run
also had the unavailable-resource message mismatch; the initial failed policy
JSON was overwritten during the successful rerun and is not claimed as
preserved. The corrected exact production wording is now verified.

## Coverage-gap follow-up status

The previously proposed coverage-gap candidates are now covered as follows:

1. **Availability end-date validation** — covered by the mocked service suite
   with invalid `endDate`; a separate missing-`endDate` case remains
   unnecessary because the service contract requires the field.
2. **Booking payload validation** — covered by the five mocked service cases
   for `tableId`, `locationId`, `slotId`, `companionStudentId`, and
   `localDate`.
3. **Unknown companion** — covered by this real PostgreSQL policy test using a
   syntactically valid UUID absent from `user_account`.
4. **Unrelated insert failure propagation** — covered by the mocked service
   suite for an unrelated `23505` and an unexpected SQLSTATE.

The remaining route-only defensive branches are not prioritized:

- **Availability end-date validation** was formerly the main candidate; the
  service-level test now covers its invalid-date branch and asserts that the
  repository is not called.
- **Non-numeric `limit` fallback** remains a route default to `100`, without a
  distinct error contract.
- **Request-ID fallbacks** remain defensive `req-unknown` behavior; normal
  middleware supplies request IDs.

No additional test was added for `bookingService.ts` line 64. When fewer than
two reservations exist, the service preserves a non-`AVAILABLE` status from a
repository row; two or more reservations derive `OCCUPIED`. The current SQL
availability query filters rows to active `AVAILABLE` slots, making this a
defensive mapping rather than a reachable standard integration state.
