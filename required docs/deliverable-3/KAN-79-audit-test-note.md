# KAN-79/KAN-81 Audit Metadata Test Note

Added one real HTTP/PostgreSQL integration test to
`backend/tests/booking.test.ts` using a newly owned test slot and the existing
`campus_duo_test`/migrator guards.

The test verifies the implemented FR-12 booking path without inventing fields
or event types:

- A successful booking creates exactly one `BOOKING_CREATED` audit row with
  the schema-backed actor ID/role, `BOOKING` target and booking ID, `SUCCESS`
  outcome, operation ID, and the exact service safe reason.
- Each application-generated request ID follows the middleware contract and
  matches its own response `requestId`. The creation response ID exactly
  matches the persisted audit `correlation_id`; an idempotent retry receives
  a fresh request ID because request IDs identify HTTP requests, while
  `clientOperationId` identifies the logical booking operation.
- The persisted `details` column is `NULL`, and the exact row-shape assertion
  demonstrates the allowlisted metadata currently written by the repository.
  This is not a general redaction proof because no sensitive marker is
  introduced on this booking path.
- An identical idempotency replay returns the stored booking and does not
  create a second `BOOKING_CREATED` audit row. The original audit row is
  re-read after replay and its correlation ID and other immutable metadata
  remain unchanged; it is not rewritten to the replay request ID.

The existing rollback test was not duplicated: it already proves no audit row
persists after a later transaction failure. No rejected-request audit
requirement is specified or implemented, so none is claimed.

The first audit-suite execution failed at the incorrect assertion that the
replay response would reuse the creation request ID. The generated failed JSON
is preserved at
`required docs/deliverable-3/evidence/backend-tests/KAN-79-booking-audit-suite-20261103-160246-501.json`.
The corrected audit suite passed 11/11, and the complete backend suite passed
54/54 across 8 files with exit code 0. Evidence:

- `required docs/deliverable-3/evidence/backend-tests/KAN-79-booking-audit-suite-20261103-160736-858.json`
- `required docs/deliverable-3/evidence/backend-tests/KAN-81-backend-full-suite-20261103-160736-858.json`
- `required docs/deliverable-3/evidence/backend-coverage/KAN-81-full-20261103-160736-858/`

The 29 new tests are beyond the original 25-test baseline. Coverage is
unchanged from the prior checkpoint: statements 90.57%, branches 87.65%,
functions 82.50%, and lines 91.25%.

The test does not establish complete FR-12 compliance, general redaction
across other workflows, or a full audit query/leakage review. The actual
Deliverable 3 rubric remains unavailable.
