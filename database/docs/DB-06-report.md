# DB-06 Report — Query Contracts and Application-Access Preparation

Revision 1 corrections are recorded in [`DB-06-revision-1-report.md`](DB-06-revision-1-report.md).
Revision 2 result-assertion corrections are recorded in [`DB-06-revision-2-report.md`](DB-06-revision-2-report.md).
Revision 2.1 read-only prepared assertions are recorded in [`DB-06-revision-2.1-report.md`](DB-06-revision-2.1-report.md).
Revision 2.2 safe LIMIT repairs are recorded in [`DB-06-revision-2.2-report.md`](DB-06-revision-2.2-report.md).
DB-07 records the approved runtime-access implementation and privilege-test
preparation; SQL execution remains deferred.

## Evidence recorded

The following are user-provided runtime results, not executed by this assistant:

- V001–V007 applied and validated.
- Catalog verification passed.
- Transactional integrity suite passed.
- Two-session uniqueness assertion, verification, and cleanup passed.
- DB-05 initial seed execution and verification passed.
- DB-05 rerun produced `INSERT 0 0` for every insert.
- DB-05 manifest assertions and verification passed on rerun.
- All 13 source query statements were prepared and executed; fixture assertions
  passed and the suite reached final `ROLLBACK` (user-provided evidence).
- Results were manually reviewed against DB-05 fixtures (user-provided
  evidence). Automated assertions on source-query results remain pending.
- Revision 2.1 replaces temporary-table result checks with query-scoped
  prepared CTE assertions; runtime validation remains pending.

Deliberately corrupted-fixture tests were not claimed as executed. Negative conflict tests remain pending.

## Query coverage

Created eleven parameterized query templates covering private profile, consent, study/social candidate source data, connections, availability, participant booking history, notifications, reporter receipts, administrator report/resource reads, and administrator-safe audit reads. Each documents parameters, mappings, authorization prerequisites, filtering, pagination, ordering, indexes, and empty-result behavior.

Candidate scoring remains backend-owned. The approved demo formula is documented without introducing a new SQL ranking policy.

## Transaction and privilege preparation

`DB-06-query-contracts.md` documents ordered write responsibilities for profile, consent, discovery/connection, booking, cancellation, rescheduling, moderation, and notification read-state operations, including idempotency, locks/version checks, audit/outbox atomicity, and error mapping.

`DB-06-privilege-proposal.md` separates migration, trusted application, admin service, and worker responsibilities. No grants, roles, RLS policies, SECURITY DEFINER functions, or grant migration were created.

## Smoke tests

`tests/04_query_smoke_tests.ps1` assembles and prepares the actual query files with explicit PostgreSQL types; `tests/04_query_smoke_tests.sql` supplies shared read-only fixture assertions. It distinguishes SQL filtering from backend authentication/authorization and includes unrelated-actor empty-result cases.

## Static validation and limitations

- Applied migrations unchanged.
- Query files contain no `SELECT *`.
- Query files use positional parameters and bounded limits.
- Query files contain no `INSERT`, `UPDATE`, `DELETE`, `GRANT`, `CREATE ROLE`, or `SECURITY DEFINER`.
- Smoke-test file uses `BEGIN TRANSACTION READ ONLY` and final `ROLLBACK`.
- Static source assembly: **NOT RUN**; runtime query tests: **NOT RUN**.
- Runtime query tests and automated source-result assertions: **NOT RUN**.
- Nonempty report/audit projection and full pagination tests: **NOT RUN**; pending fixtures.
- Static assembly and PowerShell parser checks for Revision 2.1: **PASSED**.
- Supplied Revision 2.1 runtime evidence: all 18 positive assertions and
  study NULL/zero-limit checks passed; the negative study limit failed with
  `ERROR: LIMIT must not be negative`; subsequent checks were not executed.
- Full-suite success remains pending.
- Database connections, grants, new migrations, backend/API code, frontend integration, commits, and pushes: **NOT RUN**.

Static checks do not prove PostgreSQL parsing, query plans, authorization, RLS behavior, prepared-statement binding, or backend response mapping.
