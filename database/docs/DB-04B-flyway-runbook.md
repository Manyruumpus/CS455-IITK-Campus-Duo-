# DB-04B — Flyway Configuration and PowerShell Runner

**Status:** READY FOR REVISED FILE REVIEW. Installation, database connections, migrations, and tests are **NOT RUN**.

## Selected tooling and evidence

Flyway version and PostgreSQL support remain **UNVERIFIED**. The prior `11.15.0` value is only a proposed baseline, not runtime evidence. Confirm the selected artifact, checksum, and PostgreSQL support before downloading:

- https://documentation.red-gate.com/flyway/release-notes
- https://documentation.red-gate.com/flyway/reference/configuration
- https://documentation.red-gate.com/flyway/reference/configuration/environments-namespace
- https://documentation.red-gate.com/flyway/reference/configuration/flyway-namespace/flyway-execute-in-transaction-setting

The official environments documentation confirms the plural `[environments.<name>]` namespace, connection settings and `schemas` as environment settings, nested `[environments.<name>.flyway]` overrides, and the singular `environment` selector.

## Configuration

`database/config/flyway.toml` targets `localhost:5432/campus_duo_dev`, uses `campus_duo_migrator`, manages only `campus_duo`, stores history as `campus_duo.flyway_schema_history`, and uses `database/migrations`.

- `[flyway].environment = "default"` selects the explicit environment.
- `[environments.default]` contains URL, user, and schemas.
- `[environments.default.flyway]` contains `defaultSchema`, `table`, `locations`, `createSchemas = false`, `cleanDisabled = true`, `baselineOnMigrate = false`, validation/strict naming, `outOfOrder = false`, `mixed = false`, and the documented `executeInTransaction = true`.
- No password is stored in TOML.

The bootstrap-created schema is required. Inspect `btree_gist` as an administrator before later execution; do not install extensions through Flyway. Do not run migrations as `postgres`, because V001 requires `campus_duo_migrator`.

## Runner safety

The runner preserves the action allowlist (`info`, `validate`, `migrate`, `catalog`) and the `-ConfirmMigrate` gate. It resolves paths from `$PSScriptRoot`, passes native arguments as an array for paths containing spaces, explicitly passes `-environment=default`, checks both native exit codes and invocation exceptions, and restores the prior process password in `finally`.

Before Flyway actions it rejects inherited `FLYWAY_*` and `ENVIRONMENTS_DEFAULT_*` settings other than `FLYWAY_PASSWORD`, preventing documented higher-precedence values from redirecting the target or user. The intended target remains explicit in TOML and the catalog command: `localhost:5432/campus_duo_dev`, `campus_duo_migrator`.

Passwords are prompted interactively and never passed as command arguments or printed. The process-scoped `FLYWAY_PASSWORD` variable is temporary exposure for the child process, not secure-vault storage; use a protected terminal and do not capture transcripts. PowerShell parser success does not prove native invocation success.

## Deferred execution commands

These are instructions only and were not executed:

```powershell
$runner = 'C:\Users\mohit\OneDrive\Desktop\sem 7\CS455\Entire working\database\scripts\Invoke-CampusDuoFlyway.ps1'
$flyway = 'C:\path\to\flyway.cmd'
& $runner -Action info -FlywayPath $flyway
& $runner -Action validate -FlywayPath $flyway
# Review info and validate before:
& $runner -Action migrate -FlywayPath $flyway -ConfirmMigrate
& $runner -Action catalog -PsqlPath 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
```

TOML structural parsing can confirm syntax and expected values, but cannot prove that a selected Flyway binary recognizes every setting. Flyway runtime parsing and execution remain deferred.

The runner does not install Flyway, install extensions, grant application privileges, execute tests, or change services. `campus_duo_app` is not used for migrations.
