# KAN-79/KAN-81 Health Failure Test Note

Added `backend/tests/health.failure.test.ts` with three mocked-boundary tests
using the real `/api/health` route and the shared Express application instance:

- A rejected database query returns the implemented `503` DOWN response,
  excludes synthetic SQL, credential-like markers, and stack text, and emits
  a middleware-generated `X-Request-Id`.
- Successive rejected queries each return controlled failure responses and
  invoke the database dependency separately.
- A rejected query followed by the exact successful row shape
  (`current_user`, `current_database`) recovers on the next request without
  recreating the application, and the dependency is queried again.

The route catches database errors locally, so these cases correctly assert
`503` rather than the centralized error handler's `500 INTERNAL_ERROR`. The
route body has no `requestId`; request correlation is exposed through the
`X-Request-Id` response header. These mocked tests establish route-level
failure/recovery handling and safe response shape only. They do not establish
real PostgreSQL restart recovery, pool reconnection, durability, or network
failure behavior.

The isolated suite passed 3/3 with exit code 0. Evidence:
`required docs/deliverable-3/evidence/backend-tests/KAN-79-health-failure-20261103-161131367.json`.
An earlier run failed before executing tests because the initial Vitest mock
factory referenced a top-level mock before initialization; that test setup
issue was corrected with `vi.hoisted`. The failed setup evidence remains at
`required docs/deliverable-3/evidence/backend-tests/KAN-79-health-failure-20261103-161110896.json`.

The verified full backend checkpoint subsequently passed 57/57 tests across
9 files with exit code 0. Health recovery here is mocked dependency recovery
only; real PostgreSQL restart recovery and pool reconnection remain
unverified. The health endpoint now has 100% statements, branches, functions,
and lines coverage in the full report.

The latest full-suite evidence is
`required docs/deliverable-3/evidence/backend-tests/KAN-81-backend-full-suite-20261103-161623-976-47bb4f90.json`,
with coverage snapshot
`required docs/deliverable-3/evidence/backend-coverage/KAN-81-full-20261103-161623-976-47bb4f90/`.
An attempted missing-credential run overwrote
`KAN-81-backend-full-suite-20261103-160736-858.json`; that filename is not
claimed as successful 54-test evidence. The earlier terminal result and
preserved coverage distinction remains: terminal output is separate from
JSON evidence, and coverage snapshots are only treated as evidence when
explicitly preserved.
