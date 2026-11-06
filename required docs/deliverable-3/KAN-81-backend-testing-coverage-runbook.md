# KAN-81 Backend Testing and Coverage Runbook

## Required environment

Run the backend suites against the isolated `campus_duo_test` database. The
application uses the restricted `campus_duo_app` role; test fixture setup and
cleanup use `campus_duo_migrator` and require the private
`CAMPUS_DUO_MIGRATOR_PASSWORD` environment variable. Never commit or print
credentials.

The test helper refuses migrator writes unless the active connection reports
`campus_duo_test`. Health assertions also require `campus_duo_test` and
`campus_duo_app`.

## Full regression and coverage command

From `backend`:

```powershell
node .\node_modules\vitest\vitest.mjs run --coverage
```

Equivalent npm command:

```powershell
npm test -- --coverage
```

Reports are written under `backend\coverage\`, including text output,
HTML, JSON, JSON summary, and LCOV reports. The V8 coverage configuration
includes all `src/**/*.ts` files, including files without direct test coverage.

## Verified 57-test checkpoint

The current 6 November 2026 full checkpoint passed 57/57 tests across 9/9
files with exit code 0 and no skipped tests shown. Native test output and
metadata are preserved at
`required docs/deliverable-3/evidence/backend-tests/current-full-suite-20261106-105802/`;
matching native V8 coverage is preserved at
`required docs/deliverable-3/evidence/backend-coverage/current-full-suite-20261106-105802/`.
The current aggregate is 89.91% statements, 85.71% branches, 82.50%
functions, and 90.57% lines. This evidence is associated with KAN-81.
The earlier missing-credential attempt remains historical environment
evidence only and is not a current blocker.

The historical verified backend checkpoint passed 57/57 tests across 9 files
with exit code 0 and no skipped tests. It includes 32 genuinely new tests beyond the
original 25: 12 error-handler, 8 booking-policy, 8 booking-service, one
audit-metadata, and 3 health-failure tests.
The policy tests and existing booking/availability suites use real HTTP routes
and PostgreSQL fixtures; the error-handler and booking-service additions use
mocked boundaries and synthetic errors. Coverage evidence is stored at:

- `required docs/deliverable-3/evidence/backend-tests/KAN-79-booking-policy-expanded-20261103-155332-168.json`
- `required docs/deliverable-3/evidence/backend-tests/KAN-81-backend-full-suite-20261103-155332-168.json`
- `required docs/deliverable-3/evidence/backend-coverage/KAN-81-full-20261103-155332-168/`
- `required docs/deliverable-3/evidence/backend-tests/KAN-79-booking-audit-suite-20261103-160736-858.json`
- `required docs/deliverable-3/evidence/backend-tests/KAN-81-backend-full-suite-20261103-161623-976-47bb4f90.json`
- `required docs/deliverable-3/evidence/backend-coverage/KAN-81-full-20261103-161623-976-47bb4f90/`

Historical, non-paired coverage artifact (not part of the successful
checkpoint):

- `required docs/deliverable-3/evidence/backend-coverage/KAN-81-full-20261103-160736-858/`

Coverage comparison:

| Metric | Original | Latest |
|---|---:|---:|
| Statements | 83.60% | 89.91% |
| Branches | 74.69% | 85.71% |
| Functions | 82.50% | 82.50% |
| Lines | 84.16% | 90.57% |

`errorHandler.ts` and `bookingRepo.ts` are 100% across all four metrics.
`bookingService.ts` is 98.75% for statements/lines, 98.68% for branches, and
100% for functions.
`health.ts` is now 100% across all four metrics.

The initial policy expectation/message mismatch was corrected without changing
production code. Its failed JSON was overwritten and is not claimed as
preserved. The missing-credential combined-run failure was an environment
fixture failure, not a production defect. Its overwritten JSON
`KAN-81-backend-full-suite-20261103-160736-858.json` is excluded from the
successful-report list. The matching
`KAN-81-full-20261103-160736-858/` coverage snapshot is retained only as a
historical preserved artifact; it is not a valid matching successful
JSON/coverage pair.

## Deliverable requirement matrix

| Requirement | Existing evidence | Remaining gap |
|---|---|---|
| UC-01 / FR-07: valid booking and one active reservation per resource | Real booking persistence, conflict/idempotency tests, resource mismatch policy tests, and the 10-request `concurrency.race.test.ts` evidence | The race assertions verify exactly one `201`, nine `409` conflicts, zero other responses, exactly one confirmed PostgreSQL booking row, and two participant rows for the winner. They do not independently verify every audit/outbox row for all rejected requests or provide load/latency measurements. |
| UC-01: validation, mutual eligibility, consent, blocking, resource checks | Real PostgreSQL policy suite; 8/8 targeted and included in the 57/57 checkpoint | Cancellation, rescheduling, stale versions, and future-booking lifecycle are outside the implemented booking route/test scope. |
| UC-01: duplicate retry and database-failure safety | Existing integration idempotency/rollback tests plus mocked unrelated SQLSTATE propagation | Mocked propagation does not prove PostgreSQL rollback; a database-outage/restart recovery test remains. |
| FR-12: redacted audit metadata and correlation ID | Executed audit test verifies the implemented allowlisted booking metadata, original-request correlation, and one unchanged `BOOKING_CREATED` event after replay | It does not establish general redaction/leakage coverage across workflows, a full independent audit-query matrix, or complete FR-12 compliance. |
| FR-01/FR-02: identity verification and role authorization | Health role/database assertions and test-auth route coverage | No complete student-to-admin authorization-abuse test or production identity-provider verification flow. |
| NFR-05: at least 80% backend coverage target | Latest aggregate coverage is above 80% for statements, branches, and lines | This is a coverage target, not proof that all functional requirements or frontend modules are complete. |
| Failure/recovery and concurrency demonstrations | Booking rollback test, 10-request PostgreSQL race, and current evidence artifacts | DB outage, server interruption, reschedule/cancel recovery, and load/latency measurements remain. |

The 10-request race was part of the latest 57-test checkpoint; its durable
post-race PostgreSQL checks are the confirmed-booking count and the winning
booking's participant count described above.

The actual Deliverable 3 instructions or grading rubric remain unavailable;
this runbook records repository requirements and observed evidence only, not a
substitute rubric or a claim of complete deliverable compliance.

## Current dependency and evidence status

Backend Vitest and `@vitest/coverage-v8` are installed at `5.1.0`; the
frontend Vitest and matching `@vitest/coverage-v8` are installed at `5.0.3`.
The verified
`npm audit` result is zero vulnerabilities. The 57-test and coverage results
above are the latest recorded checkpoint.

The missing-credential attempt overwrote
`KAN-81-backend-full-suite-20261103-160736-858.json`; that filename is not
claimed as successful 54-test evidence. Terminal output and preserved
historical coverage
snapshots are tracked separately from JSON reports, and only the explicitly
preserved snapshot paths above are treated as coverage evidence. Health
failure/recovery coverage is mocked dependency recovery only; real PostgreSQL
restart recovery and pool reconnection remain unverified.

Known limitations: this runbook does not recreate or migrate databases, and
database-backed suites require the isolated test database and valid private
credentials to be prepared separately. The shared `testDbHelper` cleanup
continues to use the prefixes and slot IDs supplied by each existing suite;
it is not a general fixture-ownership or broad-environment cleanup mechanism.
Current callers use disjoint prefix ranges (`test-booking-%`,
`test-rollback-%`, and `test-race-%`) and distinct slot IDs, so no direct
cross-suite fixture overlap was identified. The remaining broad-prefix risk
should be addressed in a separate focused follow-up by replacing prefix
discovery with explicit owned operation and fixture IDs.
