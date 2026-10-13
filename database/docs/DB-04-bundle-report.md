# DB-04 Bundle Report

**Status:** READY FOR REVISED FILE REVIEW. Database/tool execution is **NOT RUN**.

## Revision 3 repairs

- Moved Flyway connection settings into `[environments.default]`, placed `schemas` there, placed Flyway settings in `[environments.default.flyway]`, explicitly selected `default`, and changed the transaction setting to documented `executeInTransaction = true`.
- Replaced the invalid `c.relisunique` lookup with `pg_index`; catalog verification now checks ordinary-table owners, exact key definitions, generated `slot_range`, composite FK arrays/actions, index validity/keys/predicates, exclusion operators/predicate, idempotency keys, outbox checks/indexes, and all app privilege/role-membership restrictions.
- Replaced unsupported `CREATE TEMP FUNCTION` with `CREATE FUNCTION pg_temp.campus_duo_expect_error(...)`; all calls use `pg_temp.campus_duo_expect_error(...)` inside one outer transaction ending in `ROLLBACK`.
- Dedicated the self-lineage fixture to an unoccupied resource and gave important fixtures explicit IDs. Cancellation/rebooking and `RESCHEDULED` lineage are separate.
- Added 26 executable expected-error assertions covering the database-enforced test-plan gaps.
- Replaced the comments-only race test with setup, Session A, Session B, verification, and narrowly scoped cleanup SQL artifacts. The two-session run remains **NOT RUN**.
- Hardened the PowerShell wrapper against conflicting inherited target settings, native invocation exceptions, exit-code failures, path-with-spaces issues, and password leakage in arguments/logs.

## Approved boundaries preserved

`createSchemas = false`, `cleanDisabled = true`, `baselineOnMigrate = false`, strict naming/validation, `executeInTransaction = true`, `campus_duo` ownership/history placement, no new privileges, no credentials in configuration, and the approved confirmed-resource, cancellation/history, reschedule, idempotency, and outbox policies remain unchanged.

Backend eligibility, authority, completion-time enforcement, replay semantics, and atomic workflow behavior remain **BACKEND REQUIRED**. Stored idempotency uniqueness is tested independently.
