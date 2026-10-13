# Stage DB-03A — PostgreSQL Setup Plan

**Status:** READY FOR REVIEW — setup plan only; no installation, service change, database creation, role creation, dependency installation, or schema execution performed.

## 1. Decision and evidence boundary

PostgreSQL is the target engine for this implementation. This is a current DB-03A design decision based on the user's direction after DB-02 acceptance. It is not a historical `ARCH-AI-04` record, and no local file was found that proves instructor or team approval.

MongoDB remains the original proposal, documented in `Readme.md` and `required docs/main_proposal.md`. `required docs/02-architecture-and-design.md` ADR-004 described MongoDB versus PostgreSQL as an open evaluation. DB-03A changes the implementation direction without rewriting that historical evidence.

The target engine does not finalize these business policies:

- booking approval and mutation authority;
- whether pending partner approval creates a temporary hold;
- consent opt-out and block effects on existing connections/bookings;
- the concrete authentication/session mechanism;
- retention, deletion, and anonymization periods;
- conditional social messaging persistence.

These are **schema/workflow blockers**, not local setup blockers. The local setup blockers are obtaining PostgreSQL, selecting local credentials, and confirming a healthy local server.

## 2. Read-only environment inspection

Inspection was performed on Windows using PowerShell without changing files, services, containers, or databases.

| Check | Result | Interpretation |
|---|---|---|
| `psql.exe`, `postgres.exe`, `pg_ctl.exe`, `initdb.exe` on PATH | Not found | PostgreSQL command-line/server tools are not available through PATH |
| `C:\Program Files\PostgreSQL` | Not found | No standard native PostgreSQL installation was visible at this location |
| `C:\Program Files (x86)\PostgreSQL` | Not found | No standard 32-bit installation was visible at this location |
| PostgreSQL Windows services | No visible PostgreSQL services | No accessible registered PostgreSQL service was found |
| Docker CLI | Not found | Docker commands cannot currently be used |
| Docker Compose | Not available because Docker CLI is absent | Compose path is unavailable |
| Docker daemon service | `com.docker.service` exists but is `Stopped`, `Disabled` | Docker Desktop is not an actionable running setup path |
| TCP port 5432 | No visible TCP connection/listener | The port appeared unused at inspection time; this does not prove future server health |
| `C:\ProgramData\DockerDesktop` | Directory exists | This is not evidence that Docker CLI or a healthy daemon is installed |

A missing executable on PATH is not proof that PostgreSQL is absent. The additional standard installation-directory and service checks found no suitable accessible local PostgreSQL installation. Port inspection only reports socket occupancy; DB-03B must verify health with `psql` after installation.

## 3. Recommended setup path and version

### Selected path: native Windows PostgreSQL installation

Native installation is recommended because no usable PostgreSQL installation was found and Docker CLI/daemon support is unavailable. DB-03B should install the official PostgreSQL Windows distribution using a supported **PostgreSQL 18** major release. As of the task date, PostgreSQL 18 is the current stable major release and has the longest supported runway among current supported majors. The official versioning policy lists PostgreSQL 18 as supported and recommends the current minor release: <https://www.postgresql.org/support/versioning/>. Pin the exact installer/minor version used in DB-03B and record it in the environment log.

The version choice is a setup recommendation, not an application dependency lock. Minor releases should be kept current within PostgreSQL 18; major upgrades require a separately reviewed upgrade procedure.

### Rejected for this stage

- **Reuse existing local PostgreSQL:** not possible based on the accessible checks.
- **Docker Compose:** defer because Docker CLI is absent and the Docker service is stopped/disabled. Reconsider only after Docker is deliberately installed and started.

## 4. Proposed local names and storage

These names are proposals for DB-03B and can be changed before installation:

| Item | Proposed value | Notes |
|---|---|---|
| Database | `campus_duo_dev` | Local development database; do not use a superuser as the application runtime identity |
| Application role | `campus_duo_app` | Least-privilege runtime role; no ownership of migration objects |
| Migration role | `campus_duo_migrator` | Used only by migration commands; elevated schema privileges are limited to the database |
| Administrative role | Installer-created PostgreSQL administrator | Store separately; do not use it in application configuration |
| Service port | `5432` | Current inspection found no visible listener |
| Campus timezone | `Asia/Kolkata` | Logical model requirement; local server timezone should be explicitly verified |
| Proposed data directory | `C:\ProgramData\CampusDuo\PostgreSQL\18\data` | Persistent local data outside the repository; DB-03B must create it through the installer/initialization process |

Do not create these objects in DB-03A. Database and role creation belong to DB-03B.

## 5. Credential and configuration handling

- Never put passwords in this document, tracked files, SQL scripts, shell history, screenshots, or commit messages.
- Use placeholders such as `<POSTGRES_ADMIN_PASSWORD>`, `<CAMPUS_DUO_APP_PASSWORD>`, and `<CAMPUS_DUO_MIGRATOR_PASSWORD>` in planning material.
- Prefer Windows Credential Manager, a local user-secret facility, or an ignored developer-only environment file for local secrets.
- If a `.env` file is used later, add it to the repository's ignore configuration before writing credentials and keep a committed `.env.example` with placeholders only.
- Use separate credentials for the administrative, migration, and runtime roles.
- A future backend must obtain the actor from validated server context; database credentials do not replace application authorization.

## 6. DB-03B prerequisites

Before installation:

1. Confirm approval to install PostgreSQL 18 and create a local Windows service.
2. Confirm the proposed names, data directory, and whether port `5432` is acceptable.
3. Obtain the official Windows installer through the approved distribution channel.
4. Choose and securely store administrator, migration-role, and application-role passwords.
5. Confirm sufficient disk space and permission to create `C:\ProgramData\CampusDuo\PostgreSQL\18\data`.
6. Keep the repository free of database binaries, data files, dumps, and credentials.

## 7. Exact PowerShell setup and verification commands

The following are **DB-03B commands to execute only after PostgreSQL 18 is installed**. They are shown for reproducibility and are not executed by DB-03A.

### 7.1 Verify binaries, service, and port

```powershell
$ErrorActionPreference = 'Stop'
$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
$env:Path = "$pgBin;$env:Path"

psql --version
postgres --version
pg_ctl --version
Get-Service -Name '*postgres*' |
  Select-Object Name, DisplayName, Status, StartType
Get-NetTCPConnection -LocalPort 5432 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress, LocalPort, State, OwningProcess
```

If the installer uses a different binary path or service name, record the actual values instead of silently assuming the defaults.

### 7.2 Verify server health and timezone

Use a securely supplied password or an approved credential helper; do not replace the placeholder with a tracked value:

```powershell
$env:PGHOST = '127.0.0.1'
$env:PGPORT = '5432'
$env:PGUSER = 'postgres'
$env:PGDATABASE = 'postgres'
# Supply PGPASSWORD only in a temporary local process environment if required.
# Remove it immediately after verification:
# $env:PGPASSWORD = '<POSTGRES_ADMIN_PASSWORD>'

psql -v ON_ERROR_STOP=1 -c "SELECT version();"
psql -v ON_ERROR_STOP=1 -c "SHOW server_version;"
psql -v ON_ERROR_STOP=1 -c "SHOW TimeZone;"
psql -v ON_ERROR_STOP=1 -c "SELECT current_database(), current_user, inet_server_addr(), inet_server_port();"

Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
```

### 7.3 Verify the application database and roles after creation

After DB-03B creates the proposed database and roles, verify without printing passwords:

```powershell
$env:PGDATABASE = 'campus_duo_dev'
$env:PGUSER = 'campus_duo_migrator'

psql -v ON_ERROR_STOP=1 -c "SELECT current_database(), current_user;"
psql -v ON_ERROR_STOP=1 -c "SELECT datname FROM pg_database WHERE datname = 'campus_duo_dev';"
psql -v ON_ERROR_STOP=1 -c "SELECT rolname, rolcanlogin, rolsuper FROM pg_roles WHERE rolname IN ('campus_duo_app', 'campus_duo_migrator');"
psql -v ON_ERROR_STOP=1 -c "SHOW TimeZone;"

Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
```

The commands intentionally do not create databases, roles, schemas, or tables. Creation and privilege verification belong to the approved DB-03B execution step.

## 8. Migration approach

Use version-controlled, forward-only SQL migrations executed by a backend-independent migration runner. **Flyway Community CLI** is the proposed runner because it is independent of the future backend framework, supports PostgreSQL, records migration history in the database, and can be invoked from CI or PowerShell.

Proposed later layout:

```text
database/
  migrations/
    V001__create_extensions_and_namespaces.sql
    V002__create_identity_and_profiles.sql
    V003__create_discovery_and_connections.sql
    V004__create_inventory_and_bookings.sql
    V005__create_safety_notifications_audit_outbox.sql
  config/
    flyway.example.toml
```

Dependency installation, migration-runner selection confirmation, executable SQL, and migration execution are deferred. DB-03C must first finalize unresolved booking and retention policies before writing physical migrations.

## 9. Booking history issue for DB-03C

Releasing current occupancy must not damage historical booking integrity. Before finalizing the PostgreSQL active-booking constraint, DB-03C must explicitly decide:

- whether backdated booking creation is permitted;
- whether a historical booking may claim a resource already represented by another historical booking;
- whether historical duplicate resource claims are rejected, quarantined, or retained as an audited correction;
- whether the active uniqueness rule applies only to future/current `CONFIRMED` rows or also to any historical status;
- how reschedule lineage and cancellation timestamps preserve the original claim.

The likely implementation direction is to keep immutable booking history and constrain only the approved current occupancy set, but this remains a schema-review decision. Do not use deletion or an occupancy release update to rewrite historical facts.

## 10. Next-stage file list

DB-03B should create or update only the following implementation artifacts after approval:

- `database/docs/DB-03B-environment-log.md`
- `database/config/flyway.example.toml` or the approved migration-runner equivalent
- an ignored local secrets/configuration file, never committed
- database/role initialization scripts only if approved and kept free of credentials

DB-03C should subsequently add reviewed migration files, physical constraints/indexes, and database tests. No backend framework or frontend integration is part of either setup stage.

## 11. User action required

Before DB-03B, approve the native PostgreSQL 18 path and confirm the proposed database/role names, data directory, port, and credential-storage method. Also confirm the unresolved business policies listed in Section 1 before DB-03C finalizes physical constraints.
