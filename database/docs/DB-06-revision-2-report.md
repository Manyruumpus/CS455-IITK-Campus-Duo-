# DB-06 Revision 2 — Actual Query-Result Assertions

## Supplied runtime evidence

The following is user-provided evidence, not execution performed by this
assistant:

- All 13 source query statements were prepared and executed.
- Fixture assertions passed and the suite reached final `ROLLBACK`.
- Results were manually reviewed against DB-05 fixtures.
- Automated assertions on source-query results remain pending.
- Nonempty report/audit mappings and full pagination tests remain pending.

## Harness repair

`tests/04_query_smoke_tests.ps1` still assembles every SQL body directly from
`database/queries`. It now:

1. prepares and executes each source statement with its documented binding;
2. materializes each bound source body into a temporary result relation;
3. generates `DO` assertion blocks over those returned columns and JSON
   aggregates, rather than querying base tables as substitutes;
4. checks the required DB-05 identities, consent, candidates, connections,
   availability, bookings/participants, notification recipient boundaries,
   unread count, and admin resource summary;
5. checks null limits and incomplete timestamp/UUID cursor pairs fail closed.

The main suite remains `BEGIN TRANSACTION READ ONLY` with `ON_ERROR_STOP` and
final `ROLLBACK`. Temporary files are removed in `finally`; native `psql`
exit status is checked when `-Execute` is explicitly supplied.

## Coverage and limits

Study assertions require D502 and D503 while excluding D501 and duplicate
user rows. Social discovery must be empty for Alex because SOCIAL consent is
false. Connections, participant-authorized booking history, direct booking-ID
denials, recipient notification boundaries, and the unread count are asserted
from query-result relations. Availability asserts D574 reserved_count `2` and
D575/D576 reserved_count `0`. Admin resource expectations are date-sensitive:
the seeded location must still have its future confirmed booking when runtime
execution occurs; the seed is not refreshed by the harness.

Report and audit statements retain parse/binding execution. Nonempty
projection, redaction, and complete pagination assertions remain pending
until suitable fixtures exist. Empty results do not prove authorization or
redaction. Backend authentication, admin authorization, and application
privileges are not proven by a caller-supplied UUID or role.

## Validation

Static source assembly/parsing checks only were run for this revision.
Database execution, grants, new migrations, backend/frontend integration,
commits, and pushes remain **NOT RUN**. Applied V001–V007 and seed records
remain unchanged.

## Proposed runtime command

After explicit approval, execute as the owner/migrator test identity:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\database\tests\04_query_smoke_tests.ps1 -Execute -PsqlPath 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -DbHost localhost -Port 5432 -Database campus_duo_dev -User campus_duo_migrator
```

The command is proposed only and was not run for DB-06 Revision 2.
