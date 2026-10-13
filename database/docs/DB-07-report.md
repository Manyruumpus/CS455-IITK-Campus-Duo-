# DB-07 Approved Runtime Access Implementation

## Status

The historical preparation status below describes the state before the
user-provided runtime checkpoint. The current checkpoint is recorded in
[`DB-07-runtime-checkpoint.md`](DB-07-runtime-checkpoint.md).

- **DB-07A:** Role bootstrap preparation complete; role creation and passwords
  were subsequently reported passed by the user.
- **DB-07B:** V008 explicit privilege migration prepared; migration **NOT
  was subsequently reported applied as schema version 008 by the user.
- **DB-07C:** Allowed/denied actual-role test preparation complete; tests
  were subsequently reported passed with final rollback by the user.

Current user-provided status: V008 applied and validated; runtime role
bootstrap, preflight, service logins, effective privilege verification, and
app/admin/worker access suites passed. Dedicated fixture cleanup committed
one report deletion and one outbox deletion. DB-05 manifest verification and
the DB-06 70-assertion regression also passed with final rollback.

Backend authentication and authorization: **BACKEND REQUIRED**.

## Evidence recorded

User-provided evidence records applied/validated V001–V008, DB-04 and DB-05
runtime checks, DB-06's final 70 assertion suite with rollback, and the DB-07
runtime checkpoint. Report and audit parse/binding checks executed.
Backend authentication/authorization, full pagination, and remaining nonempty
projection/redaction assertions remain pending.

## Implementation

`setup\03-runtime-roles.psql` provisions only the two new restricted service
identities and grants CONNECT/USAGE. It embeds no passwords and refuses
incompatible existing attributes or memberships. `tests\05_runtime_role_preflight.sql`
checks role attributes, memberships, database/schema access, no CREATE, and
migrator ownership boundaries.

`migrations\V008__runtime_access_privileges.sql` runs only as
`campus_duo_migrator`, verifies all roles, and grants explicit schema,
table-column, INSERT, UPDATE, and narrowly scoped DELETE privileges. It
creates no objects, changes no ownership, accesses no migration-history data,
and performs no business-data writes.

`tests\Invoke-DB07AccessTests.ps1` reads the actual DB-06 query templates,
assembles role-specific prepared executions, checks allowed reads, prepares
rollback-scoped allowed writes, and prepares expected privilege-denial tests.
The default is static assembly; `-Execute` is required for future login-based
execution.

The exact approved matrix is in `DB-07-access-matrix.md`. The role boundary is
explicit: all runtime roles are LOGIN/INHERIT, non-superuser, no-createdb,
no-createrole, no-replication, no-bypassrls, with no memberships. Only the
migrator owns schema objects and migration history. `campus_duo_app` receives
ordinary workflow columns, `campus_duo_admin_service` receives moderation and
resource-admin columns plus safe audit reads, and `campus_duo_worker` receives
outbox event reads and dispatch/retry updates only.

## Boundaries

`campus_duo_app` is not a browser identity. `campus_duo_admin_service` is
usable only after backend `ROLE_ADMIN` verification. The worker can update
only outbox dispatch/retry columns. Audit `details` is excluded from safe
admin reads and runtime identities have no audit UPDATE/DELETE/TRUNCATE.

## Revision 1 contract repairs

V008 remains **NOT APPLIED**. The ordinary app does not provision
`identity_subject`, `role`, `verification_status`, or `verified_at`; that
authentication-provider contract is deferred. Successor booking lineage is
INSERT-only, idempotency uses insert-final-outcome only, and audit linkage is
performed by backend `INSERT ... RETURNING audit_event_id` followed by report
linkage in one transaction. Producer outbox inserts omit worker-owned
dispatch state, and the worker query selects only due pending/failed work.

The bootstrap now requires a superuser administrator connected to
`campus_duo_dev` and uses one explicit transaction. Catalog verification is
systematic, and the actual-role runner contains rollback-scoped mutation
assertions plus isolated SQLSTATE 42501 denial checks.

DB-07 Revision 1.1 further repairs first-run role preflight by resolving only
existing runtime-role OIDs, aligns discovery and successor fixtures with the
DB-05 manifest, uses valid idempotency values, and adds separately committed
dedicated report/outbox fixtures with exact cleanup artifacts. These setup,
cleanup, and runtime actions remain **NOT RUN**.
Column grants are not row-level isolation. RLS and SECURITY DEFINER functions
remain deferred.

## Static checks and limitations

Passed static checks: PowerShell parsing, DB-07C source-template assembly and
allowed-write coverage,
V008 naming/order, object references against V001–V007, privilege-matrix
consistency, credential/broad-grant/safety scans, `git diff --check`, change
scope, and applied-migration preservation. The runtime actions are recorded
only as user-provided execution evidence; they were not executed by this
assistant. Backend authorization, full pagination, and remaining nonempty
projection/redaction assertions remain pending.

## Proposed execution identities

| Step | Identity |
|---|---|
| Provision new roles and private passwords | Cluster/database administrator |
| Role/access preflight | Administrator |
| Flyway info/validate/migrate V008 | `campus_duo_migrator` |
| Catalog privilege verification | Administrator or migrator review session |
| Ordinary allowed/denied tests | authenticated `campus_duo_app` |
| Admin allowed/denied tests | authenticated `campus_duo_admin_service` |
| Worker allowed/denied tests | authenticated `campus_duo_worker` |
| Backend actor/admin policy | backend service, **BACKEND REQUIRED** |
