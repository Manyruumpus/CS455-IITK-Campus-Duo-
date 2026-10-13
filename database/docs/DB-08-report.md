# DB-08 Backup/Restore Preparation Report

## Scope

This report preserves the original DB-08 preparation status. Later user-provided
runtime results are recorded in
[`DB-08-runtime-checkpoint.md`](DB-08-runtime-checkpoint.md).

DB-08 prepares a PostgreSQL 18 custom-format backup workflow, a separately
approved restore check, and read-only scratch verification. It does not
connect to PostgreSQL or execute any database operation.

## Deliverables

- `scripts\Invoke-DB08Backup.ps1`
  - Fixed source `localhost:5432/campus_duo_dev`.
  - Explicit `campus_duo_migrator` backup identity.
  - Preparation-only without `-Execute`; execution also requires
    `-ConfirmSourceQuiescent`.
  - Private password prompt.
  - Custom-format `pg_dump`.
  - Archive path rejection for the repository and OneDrive.
  - No-overwrite protection.
  - Archive existence/size, `pg_restore --list`, SHA-256, and password-free
    metadata manifest checks.
  - Records `operator-confirmed-quiescent` consistency and observed fixture
    identities.
- `scripts\Invoke-DB08RestoreCheck.ps1`
  - Preparation-only by default.
  - Validates manifest source/format, archive size/hash, all 22 nonnegative
    counts, and administrator/role prerequisites before creating the target.
  - Requires `-Execute` for state-changing restore preparation.
  - Rejects the production database and existing scratch target.
  - Creates only `campus_duo_restore_check`, owned by
    `campus_duo_migrator`.
  - Creates a `template0` scratch database and uses `--no-password` and
    `--exit-on-error` while preserving owners and ACLs.
  - Stops on errors and never uses `--clean` or automatic drop.
- `tests\DB-08_restore_verification.sql`
  - Read-only scratch-target verification.
  - Uses transaction-local JSON count parameters without psql variables in
    dollar-quoted `DO` bodies.
  - Checks ownership, extension placement, exact successful V001–V008 history,
    all 22 backup-time counts and fixture identities.
  - Restore invokes a target-aware generated copy of the unchanged complete
    DB-07 privilege verifier.
- `docs\DB-08-backup-restore-runbook.md`
  - Proposed identities, commands, fresh-cluster role prerequisites, and
    separate scratch cleanup boundary.

## Explicit non-goals

Password hashes and global roles are not exported or automatically restored.
Same-cluster restores reuse existing roles. Fresh-cluster restore requires
separately reviewed role provisioning and private passwords. No existing
production data, grants, migrations, or executable DB-07 tests were changed.

## Historical preparation status

Backup creation: **NOT RUN**
Archive listing: **NOT RUN**
Restore: **NOT RUN**
Scratch verification: **NOT RUN**
Scratch cleanup: **NOT RUN**
Database connections/execution: **PAUSED**

Credentials are temporary process-environment exposure, not a secret vault.
Failed restores retain partial scratch databases for separately approved
inspection/cleanup and never label partial artifacts successful.

## Subsequent runtime checkpoint

The user subsequently reported the following execution evidence:

- Backup archive: `campus_duo_dev-20261013-164503.dump`.
- Stored under `C:\Users\mohit\CampusDuoBackups`.
- Archive listing, size, SHA-256, and password-free manifest creation passed.
- Restore into `campus_duo_restore_check` passed.
- All 22 business-table counts matched the backup manifest.
- Migration versions `001`–`008` and migration success checks passed.
- Ownership, `btree_gist` extension placement, selected DB-05 fixtures, and
  complete DB-07 effective privileges passed.
- Read-only verifiers reached final `ROLLBACK`.
- The scratch database was retained; cleanup remains **NOT RUN**.
- Consistency mode was `operator-confirmed-quiescent`, not an online snapshot.

These results are user-provided evidence and are not claimed as execution
performed by this assistant. Archive contents, credentials, and password
hashes are intentionally not recorded.
