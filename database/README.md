# Campus Duo Database Work Area

This directory contains database planning and implementation artifacts. DB-01 recorded requirements from the existing frontend and course documents. DB-02 reconciles those requirements into a decision register, logical model, and engine-neutral ERD; it still contains no executable schema or implementation.

## Stage status

- **DB-01:** Requirements audit — [`docs/DB-01-requirements-audit.md`](docs/DB-01-requirements-audit.md)
- **DB-02:** Decision reconciliation and logical design — [`docs/DB-02-decision-register.md`](docs/DB-02-decision-register.md), [`docs/DB-02-logical-model.md`](docs/DB-02-logical-model.md), [`docs/DB-02-erd.md`](docs/DB-02-erd.md)
- **DB-03A:** PostgreSQL decision and local environment readiness — [`docs/DB-03-postgresql-setup-plan.md`](docs/DB-03-postgresql-setup-plan.md)
- **DB-03B:** PostgreSQL bootstrap preparation — [`setup/01-bootstrap.psql`](setup/01-bootstrap.psql), [`setup/02-verify.sql`](setup/02-verify.sql), [`docs/DB-03B-environment-log.md`](docs/DB-03B-environment-log.md)
- **DB-03C:** PostgreSQL physical schema plan — [`docs/DB-03C-physical-schema-plan.md`](docs/DB-03C-physical-schema-plan.md)
- **DB-04A Revision 2:** Complete migration review and repair — [`docs/DB-04A-revision-2-review.md`](docs/DB-04A-revision-2-review.md)
- **DB-04B:** Flyway configuration and PowerShell runner — [`config/flyway.toml`](config/flyway.toml), [`scripts/Invoke-CampusDuoFlyway.ps1`](scripts/Invoke-CampusDuoFlyway.ps1), [`docs/DB-04B-flyway-runbook.md`](docs/DB-04B-flyway-runbook.md)
- **DB-04C:** Verification and test preparation — [`docs/DB-04C-test-plan.md`](docs/DB-04C-test-plan.md), [`tests/01_catalog_verification.sql`](tests/01_catalog_verification.sql), [`tests/02_transactional_integrity.sql`](tests/02_transactional_integrity.sql), and executable concurrency artifacts under [`tests/`](tests/)
- **DB-04 runtime checkpoint:** User-provided completion evidence — [`docs/DB-04-runtime-checkpoint.md`](docs/DB-04-runtime-checkpoint.md)
- **DB-05:** Reference and development seed implementation — [`docs/DB-05-report.md`](docs/DB-05-report.md), [`docs/DB-05-seed-manifest.md`](docs/DB-05-seed-manifest.md), and SQL under [`seeds/`](seeds/)
- **DB-05 Revision 1:** Complete manifest and consent-history repair — [`docs/DB-05-revision-1-report.md`](docs/DB-05-revision-1-report.md), shared assertions in [`seeds/00_manifest_assertions.sql`](seeds/00_manifest_assertions.sql)
- **DB-06:** Query contracts and application-access preparation — [`docs/DB-06-report.md`](docs/DB-06-report.md), [`docs/DB-06-query-contracts.md`](docs/DB-06-query-contracts.md), [`docs/DB-06-privilege-proposal.md`](docs/DB-06-privilege-proposal.md), and templates under [`queries/`](queries/)
- **DB-06 Revision 1:** Query correctness and real-template smoke-test preparation — [`docs/DB-06-revision-1-report.md`](docs/DB-06-revision-1-report.md), [`tests/04_query_smoke_tests.ps1`](tests/04_query_smoke_tests.ps1)
- **DB-06 Revision 2:** Actual query-result assertions — [`docs/DB-06-revision-2-report.md`](docs/DB-06-revision-2-report.md)
- **DB-06 Revision 2.1:** Read-only prepared result assertions — [`docs/DB-06-revision-2.1-report.md`](docs/DB-06-revision-2.1-report.md)
- **DB-06 Revision 2.2:** Safe LIMIT expressions — [`docs/DB-06-revision-2.2-report.md`](docs/DB-06-revision-2.2-report.md)
- **DB-07:** Approved runtime access implementation and privilege-test preparation — [`docs/DB-07-report.md`](docs/DB-07-report.md), [`docs/DB-07-access-matrix.md`](docs/DB-07-access-matrix.md), [`docs/DB-07-runtime-access-runbook.md`](docs/DB-07-runtime-access-runbook.md)
- **DB-07 Revision 1:** Privilege contract and test repairs — [`docs/DB-07-revision-1-report.md`](docs/DB-07-revision-1-report.md)
- **DB-07 Revision 1.1:** Concrete bootstrap and fixture repairs — [`docs/DB-07-revision-1.1-report.md`](docs/DB-07-revision-1.1-report.md)
- **DB-07 runtime checkpoint:** User-provided completion evidence — [`docs/DB-07-runtime-checkpoint.md`](docs/DB-07-runtime-checkpoint.md)
- **DB-08:** Backup/restore preparation — [`docs/DB-08-report.md`](docs/DB-08-report.md), [`docs/DB-08-backup-restore-runbook.md`](docs/DB-08-backup-restore-runbook.md), [`scripts/Invoke-DB08Backup.ps1`](scripts/Invoke-DB08Backup.ps1), [`scripts/Invoke-DB08RestoreCheck.ps1`](scripts/Invoke-DB08RestoreCheck.ps1)
- **DB-08 runtime checkpoint:** User-provided backup/restore evidence — [`docs/DB-08-runtime-checkpoint.md`](docs/DB-08-runtime-checkpoint.md)
- **DB-09 database handoff:** Reviewed; database phase complete for the documented tested scope — [`docs/DB-09-database-handoff.md`](docs/DB-09-database-handoff.md)

## Scope boundary

The current frontend uses TypeScript service contracts and in-memory mock stores. Those contracts are implementation evidence, not proof of durable persistence or final business-policy approval. Database work must preserve the documented privacy, consent, mutual-match, booking-concurrency, moderation, and audit invariants while resolving the open decisions listed in DB-02.

PostgreSQL 18.6, its executable location, service, host, port, and administrative connectivity were supplied by the user for DB-03B. The bootstrap, role passwords, verification, and authenticated project-role connections are now recorded as completed user-provided evidence; the actual server data directory remains unverified. Local evidence documents MongoDB as the original proposal and PostgreSQL as an alternative; no local `ARCH-AI-04` or instructor/team approval record was found. For this implementation, PostgreSQL is now the current project design decision, based on the user's direction in DB-03A. This is an implementation decision, not historical `ARCH-AI-04` evidence.

The remaining unresolved policies are limited to the concrete authentication/session provider, retention periods and automated anonymization, and conditional messaging. DB-04A records the approved MVP booking, consent/block, lifecycle, outbox, and historical-reschedule decisions separately from historical proposal evidence. Stored slot status is administrative only (`AVAILABLE` or `LOCKED_MAINTENANCE`); frontend `RESERVED` and `OCCUPIED` values are derived adapter projections.

DB-04A records the user-approved MVP policies for auto-confirmed bookings, creator-only mutations with audited admin override, confirmed-only occupancy, historical/reschedule preservation, mandatory transactional outbox, deferred session/messaging tables, consent/block effects, and account/resource deactivation. The SQL is written but has not been executed; Flyway installation, migration execution, privilege grants, and tests remain deferred.

DB-04 Revision 3 repairs the Flyway environment TOML namespaces, read-only catalog definition checks, rollback-only test helper, deterministic fixture IDs, and executable two-session artifacts. Database/tool execution remains **NOT RUN**.

The user has supplied completed DB-04 runtime evidence; it is recorded separately and is not claimed as assistant-executed output. DB-05 seed execution remains **NOT RUN**. The reference seed is intentionally a documented no-op because no authoritative IITK catalog source was found. The development seed contains only clearly labeled synthetic records and uses a separate UUID namespace.

The user has supplied DB-05 initial seed, rerun, and manifest-verification completion evidence. Those results are recorded in `docs/DB-05-report.md`; deliberately corrupted-fixture tests remain pending and were not claimed. User-provided DB-06 evidence records the final 70 assertion suite and rollback. Nonempty report/audit projection and redaction, full pagination, backend authentication/authorization, and runtime privilege verification remain pending. DB-07 Revision 1 repairs the target-safe bootstrap, sensitive account boundary, successor lineage, producer/worker outbox split, systematic catalog checks, and rollback-scoped mutation/denial suites; role provisioning, password setup, migration application, database connections, grants, and runtime tests remain paused.

The user has now supplied DB-07 runtime checkpoint evidence: V008 was applied as schema version 008, all eight migrations validated, runtime role bootstrap/preflight/service logins passed, effective privilege verification passed, app/admin/worker suites passed with final rollback, dedicated fixtures were cleaned up and committed, DB-05 manifest verification passed, and the DB-06 regression passed all 70 assertions with final rollback. This evidence is recorded in `docs/DB-07-runtime-checkpoint.md`; it is user-provided and is not claimed as assistant-executed output. Backend authorization, full pagination, and remaining nonempty projection/redaction assertions remain pending.

DB-08 backup/restore preparation was completed as static preparation, and the user has subsequently supplied runtime evidence for backup creation, archive checks, restore, and read-only scratch verification. The scratch database remains retained; cleanup is **NOT RUN**. The later evidence is recorded separately in `docs/DB-08-runtime-checkpoint.md`. DB-09 handoff documentation has been reviewed, and the database phase is complete for the documented tested scope. Backend authorization, full pagination, and remaining nonempty projection/redaction assertions remain pending for backend preparation.

## DB-05 proposed execution order

After SQL review, run as `campus_duo_migrator` against `campus_duo_dev`: `seeds\01_reference_seed.sql`, then `seeds\02_development_seed.sql`, then the read-only `seeds\03_seed_verification.sql`. The scripts must not be run against production or as `postgres`. These are proposed commands only; installation, database connections, seed execution, commits, pushes, and application integration remain paused.

## DB-04 migration execution boundary

Migrations are Flyway-compatible and must run later as `campus_duo_migrator` against `campus_duo_dev`. They validate the bootstrapped schema owner and preserve the existing database/schema; they do not drop or replace objects. The application role retains only its bootstrap `CONNECT` and schema `USAGE` privileges until a separate privilege review.

Execution order is administrator extension inspection, Flyway `info`, Flyway `validate`, explicit Flyway `migrate`, read-only catalog verification, transactional rollback tests, and the documented two-session race test. Do not run migrations as `postgres`, as V001 requires `campus_duo_migrator`. See [`docs/DB-04B-flyway-runbook.md`](docs/DB-04B-flyway-runbook.md).

## DB-03B execution order

Run the password-free bootstrap as `postgres` while initially connected to the `postgres` database. It stops before writes if `campus_duo_migrator`, `campus_duo_app`, or `campus_duo_dev` already exists:

```powershell
$psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
& $psql -X -W -v ON_ERROR_STOP=1 -h localhost -p 5432 -U postgres -d postgres -f 'database\setup\01-bootstrap.psql'
if ($LASTEXITCODE -ne 0) {
    throw "Campus Duo bootstrap failed with exit code $LASTEXITCODE. No recovery or reuse was attempted."
}
```

Set passwords only in an interactive `psql` session. They are entered at terminal prompts and do not belong in SQL files, PowerShell commands, environment variables, documentation, or messages:

```powershell
& $psql -X -W -h localhost -p 5432 -U postgres -d campus_duo_dev
```

At the `psql` prompt, run each command and enter the password only when prompted:

```text
\password campus_duo_migrator
\password campus_duo_app
\q
```

The new roles need passwords before password-authenticated login verification can succeed. Then run the read-only verification script as the administrator:

```powershell
& $psql -X -W -v ON_ERROR_STOP=1 -h localhost -p 5432 -U postgres -d campus_duo_dev -f 'database\setup\02-verify.sql'
if ($LASTEXITCODE -ne 0) {
    throw "Campus Duo bootstrap verification failed with exit code $LASTEXITCODE."
}
```

Run separate authenticated connection checks for both project roles. These commands prompt for the selected role's password and do not print it:

```powershell
& $psql -X -W -v ON_ERROR_STOP=1 -h localhost -p 5432 -U campus_duo_migrator -d campus_duo_dev -c "SELECT current_user, current_database();"
if ($LASTEXITCODE -ne 0) {
    throw "campus_duo_migrator authenticated connection failed with exit code $LASTEXITCODE."
}

& $psql -X -W -v ON_ERROR_STOP=1 -h localhost -p 5432 -U campus_duo_app -d campus_duo_dev -c "SELECT current_user, current_database();"
if ($LASTEXITCODE -ne 0) {
    throw "campus_duo_app authenticated connection failed with exit code $LASTEXITCODE."
}
```

Finally, run the read-only data-directory check from [`docs/DB-03B-environment-log.md`](docs/DB-03B-environment-log.md) and record its result without recording credentials.
