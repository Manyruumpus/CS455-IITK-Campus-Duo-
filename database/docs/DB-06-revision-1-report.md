# DB-06 Revision 1 — Query Correctness and Real Template Tests

## Issue-to-fix summary

- Timestamp-ordered lists now use cursor pairs matching their `ORDER BY`:
  timestamp plus UUID, with both values required or both absent.
- Candidate retrieval remains UUID-ordered source paging and is explicitly not
  presented as globally compatibility-ranked output.
- All bounded statements fail closed for null/invalid limits; availability
  also requires non-null, ordered date bounds.
- Private profile source mapping includes `profile_version` and
  `preferred_times`. Candidate source fields include location and goal inputs
  for backend-owned scoring without exposing private fields to the frontend.
- Discovery requires active viewer account and mode consent in addition to
  candidate consent, active blocks, self, and action filters.
- Notification count and admin resource summary are separate templates with
  independent prepared-statement signatures.
- Audit's default projection excludes unrestricted `details`.
- The smoke harness reads the actual query files, prepares each with explicit
  PostgreSQL types, executes them, and assembles row-count result assertions.

## Actual-template test mechanism

`tests/04_query_smoke_tests.ps1` is the reproducible assembler. It reads
`queries/*.sql`, removes only source comments and the terminal semicolon,
generates `PREPARE` and count-wrapper statements from that exact source, and
adds the shared fixture assertions from `04_query_smoke_tests.sql`. The
generated suite uses `BEGIN TRANSACTION READ ONLY` and final `ROLLBACK`.
The default mode assembles and statically validates only; `-Execute` is
required for a later authorized runtime test. No database operation was
performed for this revision.

The prepared statements cover private profile, independent consent, study and
social source pages, reciprocal connections, availability, booking history,
notifications/list and count, reporter receipts, admin reports/resources, and
audit. Runtime assertions requiring authenticated backend/admin context remain
backend-required and are not proven by a caller-supplied UUID or role.

## Public projection, audit, and workflow decisions

Study/social public projections remain distinct from backend-internal scoring
inputs. Social results expose only the approved public fields. Audit reads have
a safe default projection without unrestricted details; actor identity is not
treated as administrator identity. Cancellation/rescheduling is creator-owned
or an administrator override with an audit reason; the other participant is
read-only initially. Exactly two participants, completion-time/started-slot
rules, idempotency replay, and atomic workflow behavior remain backend-required.

## Concrete privilege boundary

The revised privilege proposal gives table/view/function responsibilities,
read/write columns, service roles, and backend authorization requirements.
It keeps migration, trusted application, admin path, audit insertion, and
outbox worker updates separate. No grants, roles, RLS, SECURITY DEFINER
functions, or grant migration were created.

## Files changed

- Updated query templates under `database/queries/`.
- Replaced `tests/04_query_smoke_tests.sql`.
- Added `tests/04_query_smoke_tests.ps1`.
- Updated `DB-06-query-contracts.md`, `DB-06-privilege-proposal.md`,
  `DB-06-report.md`, and `database/README.md`.

## Validation and limitations

Static checks are limited to source assembly, unsafe-statement scanning,
parameter/signature review, migration preservation, and diff whitespace.
PostgreSQL execution, query result assertions, grants, migrations, backend
integration, commits, and pushes remain **NOT RUN**. Deliberately corrupted
fixture tests remain pending.
