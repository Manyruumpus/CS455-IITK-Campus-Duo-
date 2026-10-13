# DB-06 Revision 2.1 — Read-Only Prepared Result Assertions

## Previously supplied runtime evidence

The following remains user-provided evidence from the prior revision, not
execution performed here: all 13 source query statements were prepared and
executed; fixture assertions passed; the suite reached final `ROLLBACK`; and
results were manually reviewed against DB-05 fixtures. Automated result
assertions, nonempty report/audit mappings, and full pagination tests were
pending and remain unexecuted for this repair.

## Repair summary

The query harness now builds read-only assertion wrappers directly from the
source bodies in `database/queries`. It no longer creates temporary tables,
persistent helpers, or result relations, and it never substitutes values into
source placeholders.

Each wrapper:

1. retains the source body's `$n` placeholders;
2. uses the source statement's exact prepared PostgreSQL parameter types;
3. places the source body in a query-scoped `source_rows` CTE;
4. returns exactly one `passed` boolean derived with `(predicate) IS TRUE`;
5. executes through `\gset` and checks the value with `\if`;
6. raises a PostgreSQL exception on false or NULL, preserving
   `ON_ERROR_STOP`.

The entire generated suite uses one `BEGIN TRANSACTION READ ONLY` and one
final `ROLLBACK`. No source query, migration, seed, role, or privilege was
changed.

## Assertion coverage

The harness generates 18 positive result assertions:

| Area | Assertions |
|---|---:|
| Private profile and consent | 3 |
| Study/social candidates | 2 |
| Connections for Alex, Sam, Jordan | 3 |
| Availability | 1 |
| Booking history and direct-access boundaries | 4 |
| Notifications and unread count | 4 |
| Admin resource summary | 1 |
| **Total** | **18** |

The positive assertions consume source-query CTE results. They require exactly
one Alex private-profile row, profile version `1`, exactly one course
containing D511, exactly one interest containing D521, and independent STUDY
`true`/SOCIAL `false` consent. Study candidates require both Sam and Jordan,
exclude Alex, and contain no duplicate user IDs without assuming the database
has no other candidates. Connections assert D561 for Alex and Sam and exclude
it for Jordan without rejecting unrelated Jordan connections.

Booking assertions check D581/D582 states, exactly two intended participant
members with creator/companion roles, and Jordan's inability to retrieve
either booking by direct ID. Notification assertions check recipient
boundaries and the actual unread-count value. Availability and the
future-date-sensitive admin resource summary retain the DB-05 expectations:
D574 has reserved count `2`, D575/D576 have `0`, and the seed location has
two tables and one future confirmed booking when executed.

The harness also generates 40 fail-closed limit checks: NULL, zero, negative,
and maximum-plus-one at each statement's documented limit position. It
generates 12 incomplete-cursor checks: timestamp NULL with UUID supplied and
timestamp supplied with UUID NULL for each composite cursor statement.
Optional booking ID remains NULL for booking limit/cursor checks.

## Report and audit boundary

Report and audit statements retain prepared parse/binding execution. Nonempty
projection, redaction, and complete multi-page traversal assertions remain
pending until suitable fixtures exist. Empty results do not prove backend
authentication, administrator authorization, RLS, or redaction.

## Static validation and runtime boundary

Static assembly and PowerShell parser checks passed. The generated mechanism
was not connected to PostgreSQL for this revision. Runtime validation,
grants, new migrations, backend/frontend changes, commits, and pushes remain
**NOT RUN**.

## Proposed runtime command

After explicit approval, run as the owner/migrator test identity:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\database\tests\04_query_smoke_tests.ps1 -Execute -PsqlPath 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -DbHost localhost -Port 5432 -Database campus_duo_dev -User campus_duo_migrator
```

This command is proposed only and was not run.
