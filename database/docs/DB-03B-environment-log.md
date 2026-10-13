# Stage DB-03B — PostgreSQL Environment Log

**Status:** DB-03B execution evidence recorded; actual data-directory verification remains pending.

## 1. Scope

DB-03B prepared a password-free local bootstrap for the Campus Duo PostgreSQL database. The user supplied successful execution results for the bootstrap, privilege verification, and authenticated project-role connections. No business table, dependency, backend, or frontend change was executed by this stage.

## 2. User-provided installation verification

The following results were supplied by the user and are recorded as verification evidence. They were not independently re-run by DB-03B.

| Item | Supplied result |
|---|---|
| PostgreSQL client/server version | 18.6 |
| PostgreSQL executable directory | `C:\Program Files\PostgreSQL\18\bin` |
| Host | `localhost` |
| Port | `5432` |
| Windows service | `postgresql-x64-18`, Running |
| Administrative connection | Authenticated connection as `postgres` to database `postgres` succeeds |

The actual PostgreSQL server data directory has not yet been verified.

## 3. Bootstrap targets

| Object | Target |
|---|---|
| Database | `campus_duo_dev` |
| Owner/migration role | `campus_duo_migrator` |
| Future application role | `campus_duo_app` |
| Project schema | `campus_duo` |
| Host/port | `localhost:5432` |

Both roles are created as `LOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION`, and `NOBYPASSRLS`. The migrator owns the database and project schema. The application role receives only database `CONNECT` and project-schema `USAGE` during bootstrap. Business object privileges belong to later migrations.

## 4. Execution evidence

- **COMPLETED — USER-PROVIDED:** `database/setup/01-bootstrap.psql`
- **COMPLETED — USER-PROVIDED:** private passwords set for `campus_duo_migrator` and `campus_duo_app`
- **COMPLETED — USER-PROVIDED:** `database/setup/02-verify.sql`; all checks passed
- **COMPLETED — USER-PROVIDED:** authenticated connection as `campus_duo_migrator` to `campus_duo_dev`
- **COMPLETED — USER-PROVIDED:** authenticated connection as `campus_duo_app` to `campus_duo_dev`
- **PENDING USER VERIFICATION:** actual PostgreSQL server data-directory check

The scripts fail closed if either target role or the target database already exists. They do not drop, alter, or reuse existing objects.

## 5. Data-directory verification

Run this read-only command as an authenticated PostgreSQL administrator after confirming connectivity:

```powershell
$psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
& $psql -X -W -v ON_ERROR_STOP=1 -h localhost -p 5432 -U postgres -d postgres -c "SHOW data_directory;"
if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL data-directory verification failed with exit code $LASTEXITCODE."
}
```

Record the returned path here after user execution. Do not assume the path from the installer or DB-03A proposal.

**Actual data directory:** `PENDING USER VERIFICATION`

## 6. Result recording

The bootstrap, role attributes, permissions, ownership, and authenticated connections are recorded above from user-provided execution evidence. After the remaining check, record the exact PostgreSQL server data directory. Do not record passwords or connection secrets.
