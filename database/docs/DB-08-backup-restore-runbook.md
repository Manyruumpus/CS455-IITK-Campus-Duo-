# DB-08 Backup and Restore Runbook

## Status and safety boundary

DB-08 preparation is complete, with later user-provided runtime evidence
recorded in [`DB-08-runtime-checkpoint.md`](DB-08-runtime-checkpoint.md).
The original preparation-only status below is retained as historical context.
The scripts require explicit execution switches where they can change state.
No script drops a
database, uses `--clean`, modifies `campus_duo_dev`, or automatically removes
the scratch database.

The verified prerequisite checkpoint is user-provided: V001–V008 were applied
and validated; DB-07 privilege verification and all three runtime-role suites
passed; dedicated fixtures were cleaned up; DB-05 verification passed; and all
70 DB-06 regression assertions passed.

## Role prerequisites

The backup script uses the explicit `campus_duo_migrator` identity. Its private
password is entered interactively and is exposed only through temporary
process-scoped `PGPASSWORD` plumbing. The archive and metadata are written
outside the repository and OneDrive, and existing files are never overwritten.

For a same-cluster restore, the existing roles are reused:
`campus_duo_migrator`, `campus_duo_app`, `campus_duo_admin_service`, and
`campus_duo_worker`. For a fresh cluster, role provisioning and private
password setup require a separately reviewed administrator procedure.
DB-08 exports no password hashes and does not automatically restore global
roles.

## Proposed backup command

Run only after explicit approval, as `campus_duo_migrator`, with a private
password prompt:

```powershell
& powershell -NoProfile -ExecutionPolicy Bypass -File `
  database\scripts\Invoke-DB08Backup.ps1 `
  -PgDumpPath 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe' `
  -PgRestorePath 'C:\Program Files\PostgreSQL\18\bin\pg_restore.exe' `
  -PsqlPath 'C:\Program Files\PostgreSQL\18\bin\psql.exe' `
  -BackupPath (Join-Path $env:USERPROFILE 'CampusDuoBackups\campus_duo_dev-20261013.dump') `
  -Execute -ConfirmSourceQuiescent
```

The source is fixed to `localhost:5432/campus_duo_dev`. The script uses
PostgreSQL custom format, requires operator-confirmed source quiescence, rejects
repository/OneDrive paths and overwrites,
checks archive existence and size, runs `pg_restore --list`, computes SHA-256,
and writes a password-free `.metadata.json` manifest with backup-time row
counts and observed selected DB-05 fixture identities. Stop all source writers,
migrations, tests, and dispatchers throughout dump and metadata collection.
The manifest records `consistency_mode = operator-confirmed-quiescent`.
This is not a synchronized online snapshot; that feature is deferred.

The user reported successful execution using archive
`campus_duo_dev-20261013-164503.dump` stored under
`C:\Users\mohit\CampusDuoBackups`. The path is recorded for operational
identity only; archive contents and credentials are not documented.

## Proposed restore command

Restore requires an explicit `-Execute` switch and uses `postgres` as the
administrator identity. It refuses `campus_duo_dev`, refuses an existing
`campus_duo_restore_check`, creates only that new scratch database owned by
`campus_duo_migrator`, and restores with owners and ACLs preserved. It stops on
errors and does not pass `--clean` or perform an automatic drop:

```powershell
& powershell -NoProfile -ExecutionPolicy Bypass -File `
  database\scripts\Invoke-DB08RestoreCheck.ps1 `
  -ArchivePath (Join-Path $env:USERPROFILE 'CampusDuoBackups\campus_duo_dev-20261013.dump') `
  -ManifestPath (Join-Path $env:USERPROFILE 'CampusDuoBackups\campus_duo_dev-20261013.dump.metadata.json') `
  -AdminUser 'postgres' `
  -Execute
```

The restore verifier runs as a read-only transaction against
`campus_duo_restore_check`. It checks schema and table ownership, `btree_gist`
placement, migration history through V008, selected backup-time row counts,
all 22 backup-time row counts, selected DB-05 identities, and approved
effective privilege boundaries by running a target-aware generated copy of the
unchanged DB-07 verifier. Archive listing is not treated as restore proof.

## Scratch cleanup

Scratch cleanup is a separate approved action. Inspect the database first,
obtain approval, and drop only `campus_duo_restore_check` using an
administrator-controlled command. DB-08 does not provide or invoke automatic
cleanup.

## Limitations

Historically, no backup, restore, archive listing, or scratch verification had
been executed when this runbook was authored. Later user-provided evidence
reports successful backup and restore verification; scratch cleanup remains
**NOT RUN**. Credentials are temporary process-environment exposure, not a
secret vault. Failed restores retain any partial scratch database for separate
approved inspection/cleanup; partial artifacts are never reported as
successful. A successful restore test does not validate application
behavior, backend authorization, full pagination, or pending nonempty
projection/redaction assertions.
