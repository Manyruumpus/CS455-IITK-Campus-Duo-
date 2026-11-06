# KAN-79/KAN-81 Booking Service Test Note

Added `backend/tests/booking.service.test.ts` with 8 service-level unit tests
using local repository and transaction-boundary mocks. No PostgreSQL
connections, credentials, or application-server startup are used.

Coverage added:

- Invalid `endDate` rejects with the service's exact `VALIDATION_ERROR` and
  does not call the availability repository.
- Five parameterized malformed booking fields (`tableId`, `locationId`,
  `slotId`, `companionStudentId`, and `localDate`) each reject with the exact
  field-specific `VALIDATION_ERROR` before `getClient` or any write boundary.
- An unrelated `23505` constraint error and an unexpected `40001` SQLSTATE
  thrown by `insertBooking` are propagated as the identical synthetic error
  object, after the insert boundary is reached, rather than translated into
  the booking-specific conflict.

The test intentionally does not add a separate missing-`endDate` case: the
service contract treats `endDate` as required, but the distinct uncovered
branch is already represented by invalid `endDate` input. These mocked tests
prove service control flow and error translation only; they do not prove
PostgreSQL rollback or that real database rows remain unchanged.

Execution evidence is saved under
`required docs/deliverable-3/evidence/backend-tests/` after the isolated test
run. The isolated suite passed 8/8, and the combined backend checkpoint passed
53/53 tests across 8 files with no skipped tests. Combined evidence:
`required docs/deliverable-3/evidence/backend-tests/KAN-81-backend-full-suite-20261103-155332-168.json`.

These eight tests are mocked service tests. They complement, but do not replace,
the real PostgreSQL integration tests in `booking.test.ts`,
`booking.policy.test.ts`, and the availability suite. They do not prove real
database rollback or durable-row state.
