# DB-07 Runtime Access Runbook

## Runtime checkpoint status

The commands below were originally proposed for review and execution. The
user has since provided completion evidence for the DB-07 runtime checkpoint:
V008 applied as schema version 008; all eight migrations validated; role
bootstrap, preflight, and service logins passed; effective privilege
verification passed; app/admin/worker suites passed with final `ROLLBACK`;
dedicated cleanup deleted one report and one outbox row and committed; DB-05
manifest verification passed; and DB-06 regression passed all 70 assertions
with final `ROLLBACK`.

This is user-provided evidence, not assistant-executed output. Backend
authorization, full pagination, and remaining nonempty projection/redaction
assertions remain pending.

All commands below are proposed only. Do not execute them until the SQL,
roles, passwords, and target have been reviewed.

1. **Administrator role prerequisite review/provisioning** — connect as the
   cluster/database administrator to **`campus_duo_dev` only** and run
   `database\setup\03-runtime-roles.psql`. `postgres` is not an interchangeable
   target: the script validates the database, schema owner, existing roles, and
   effective CREATE boundary before its single transaction.
2. **Private password setup** — the administrator uses interactive `\password`
   for `campus_duo_admin_service` and `campus_duo_worker`. Passwords never
   belong in files, arguments, logs, or environment configuration.
3. **Role/access preflight** — as the administrator, run
   `psql -X -W -v ON_ERROR_STOP=1 -h localhost -p 5432 -U <administrator> -d campus_duo_dev -f database\tests\05_runtime_role_preflight.sql`.
4. **Flyway info/validate** — the runner uses the `-Action` parameter. As
   `campus_duo_migrator`, run:
   `& database\scripts\Invoke-CampusDuoFlyway.ps1 -Action info -FlywayPath 'C:\path\to\flyway.exe'`
   and then:
   `& database\scripts\Invoke-CampusDuoFlyway.ps1 -Action validate -FlywayPath 'C:\path\to\flyway.exe'`.
5. **V008 application** — after review, as `campus_duo_migrator`, run:
   `& database\scripts\Invoke-CampusDuoFlyway.ps1 -Action migrate -FlywayPath 'C:\path\to\flyway.exe' -ConfirmMigrate`.
6. **Effective privilege verification** — as the administrator or migrator
   review identity, run
   `psql -X -W -v ON_ERROR_STOP=1 -h localhost -p 5432 -U <reviewer> -d campus_duo_dev -f database\tests\06_privilege_catalog_verification.sql`.
7. **Dedicated fixtures** — stop any dispatcher that could consume
   `db07-fixture-outbox`, then as `campus_duo_migrator` run:
   `psql -X -W -v ON_ERROR_STOP=1 -h localhost -p 5432 -U campus_duo_migrator -d campus_duo_dev -f database\tests\07_db07_fixture_setup.sql`.
8. **Actual-role allowed/denied tests** — after private passwords exist, run
   `& powershell -NoProfile -ExecutionPolicy Bypass -File database\tests\Invoke-DB07AccessTests.ps1 -Execute`;
   each suite logs in as its own service role and validates `current_user` and
   `current_database()`.
9. **Fixture cleanup** — after all runtime suites and dispatcher isolation,
   as `campus_duo_migrator`, run:
   `psql -X -W -v ON_ERROR_STOP=1 -h localhost -p 5432 -U campus_duo_migrator -d campus_duo_dev -f database\tests\08_db07_fixture_cleanup.sql`.
10. **Regression checks** — as `campus_duo_migrator`, run the DB-06 read-only
   suite, followed by approved DB-05/DB-04 checks.

The runner's default mode only assembles temporary scripts. It accepts no
arbitrary command forwarding, checks native `psql` exit codes, enables
`ON_ERROR_STOP`, and removes generated files. `SET ROLE` or a superuser
simulation is not accepted as proof of authenticated service access.

Backend authentication, actor ownership, consent/block filtering, creator or
audited-admin booking authority, and `ROLE_ADMIN` validation remain
**BACKEND REQUIRED**.

The ordinary app has no account INSERT privilege for `identity_subject`,
`role`, `verification_status`, or `verified_at`; authentication-provider
provisioning is deliberately deferred. Idempotency is the supported
insert-final-outcome workflow, not a PENDING-then-update workflow. Audit
linkage is supplied by the backend: insert `audit_event`, capture its
`audit_event_id` with `RETURNING`, then insert or update the related report in
the same transaction. The worker query is dispatch-ready and filters future
`next_attempt_at`; claiming, retries, and concurrency remain worker/backend
responsibilities.
