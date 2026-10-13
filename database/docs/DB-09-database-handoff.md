# DB-09 Database Handoff

## Handoff status

This document records the reviewed database implementation and operational
handoff. The DB-07 and DB-08 runtime results referenced here are user-provided
evidence. No new database execution was performed while finalizing this
handoff.

## Verified baseline

- PostgreSQL design and local target: `localhost:5432/campus_duo_dev`.
- Schema: `campus_duo`.
- Applied and validated migrations: V001–V008.
- Runtime roles:
  - `campus_duo_migrator`
  - `campus_duo_app`
  - `campus_duo_admin_service`
  - `campus_duo_worker`
- DB-07 role bootstrap, preflight, service logins, effective privilege
  verification, and all three runtime-role suites passed.
- DB-05 verification passed.
- DB-06 regression passed all 70 assertions and final `ROLLBACK`.
- DB-08 backup, archive checks, restore, and read-only scratch verification
  passed according to the user-provided runtime checkpoint.
- Scratch database `campus_duo_restore_check` is retained; cleanup is not run.

## Setup and execution order

1. Confirm the target is `campus_duo_dev` and the schema is owned by
   `campus_duo_migrator`.
2. Confirm the PostgreSQL 18 extension prerequisite and required roles.
3. Run Flyway `info` and inspect the pending/applied migration state. A strict
   standalone `validate` can reject a database with pending migrations, so
   resolve any validation errors before continuing.
4. Run Flyway `migrate` as `campus_duo_migrator`; migration validates while
   permitting pending migrations. Do not run application
   migrations as `postgres`.
5. Run standalone Flyway `validate` again after migration application and
   resolve any reported errors.
6. Run read-only catalog and privilege verification.
7. Apply reviewed DB-05 seed operations and run the manifest verifier.
8. Run the dedicated DB-07 fixture setup, isolate the dispatcher for the
   entire access-test window, then run the actual-role suites with final
   `ROLLBACK`.
9. After the suites, perform separately approved dedicated fixture cleanup.
10. Create backup artifacts only under an approved external path using the
    operator-confirmed quiescent workflow.
11. Restore only into an explicitly approved scratch database and run the
    read-only verifier.

Existing scripts and runbooks define the exact commands. No production
database drop, automatic cleanup, or source replacement is part of this
handoff.

## Role boundaries

`campus_duo_migrator` owns the schema objects, migration history, and approved
migration/seed operations. It is not an application request identity.

`campus_duo_app` has ordinary workflow privileges through explicit
column-level grants. It has no sensitive account-provisioning fields, no audit
reads, no migration-history access, and only the approved profile-selection
deletes.

`campus_duo_admin_service` handles approved moderation/resource workflows and
safe audit projections. It may perform approved audit `INSERT` operations and
safe audit `SELECT` operations, but it is denied audit `UPDATE`, `DELETE`, and
`TRUNCATE` privileges and is denied `details` column `SELECT` access.

`campus_duo_worker` reads outbox work and updates only `status`, `attempts`,
`next_attempt_at`, and `dispatched_at`. It has no business-table access.

These database roles do not replace backend authentication, actor
authorization, ownership checks, consent/block policy, or `ROLE_ADMIN`
validation.

## Migrations and schema

V001–V007 establish the schema, identity/profile, consent/connection,
inventory, booking/idempotency, moderation/notification/audit, and
transactional-outbox structures. V008 applies the reviewed runtime privilege
contract. Applied migration files are preserved byte-for-byte and must remain
under Flyway control.

The migration history must show successful versions `001` through `008`.
Future schema changes require a new reviewed migration; direct production
edits are not part of the handoff.

## Query contracts

DB-06 provides parameterized query templates for private profile and consent
data, discovery and connections, availability, booking history,
notifications, reporter receipts, admin moderation/resource reads, and safe
audit reads. DB-07 added the worker outbox query. Query contracts define
projections, filters, pagination ordering, limits, indexes, and authorization
prerequisites.

The templates do not implement backend authentication or final actor-policy
authorization. Full pagination traversal and remaining nonempty
projection/redaction assertions remain pending.

## Write-transaction responsibilities

Application write workflows must:

- authenticate the caller before selecting the runtime role;
- enforce actor ownership and approved admin authority in backend code;
- use the documented consent/block and connection rules;
- use optimistic version checks and resource/slot consistency checks;
- preserve cancellation and rescheduling history;
- create successor bookings with source linkage and participants;
- use insert-final-outcome idempotency as documented;
- insert audit and outbox records atomically with the business mutation;
- capture admin audit IDs with `RETURNING` where report linkage is required;
- commit only after all assertions and dependent writes succeed;
- map expected SQLSTATE failures without weakening database constraints.

The database grants enforce structural boundaries; they do not prove the
complete backend workflow or authorization policy.

## Test and verification inventory

- DB-04 catalog, transactional-integrity, and concurrency artifacts.
- DB-05 manifest and seed verification.
- DB-06 70-assertion regression suite with final `ROLLBACK`.
- DB-07 preflight, dedicated fixture setup, complete effective privilege
  verification, and app/admin/worker access suites with final `ROLLBACK`;
  dispatcher isolation covered the test window and fixture cleanup was
  separately approved.
- DB-08 custom-format backup, archive listing, manifest, restore, ownership,
  extension, migration, row-count, fixture, and target-aware privilege
  verification.

The DB-08 scratch database is retained for separately approved cleanup. The
backup uses an operator-confirmed quiescent workflow: source writers,
migrations, tests, and dispatchers remain stopped during dump and metadata
collection. Synchronized online dump/metadata snapshots remain deferred.

## Backup and restore procedure

Use `scripts\Invoke-DB08Backup.ps1` with `-Execute` and
`-ConfirmSourceQuiescent` as `campus_duo_migrator`. Store the archive and
password-free metadata outside the repository and OneDrive. Stop source
writers, migrations, tests, and dispatchers for the entire dump and metadata
collection.

Use `scripts\Invoke-DB08RestoreCheck.ps1` with `-Execute` as a reviewed
superuser administrator. It refuses `campus_duo_dev`, refuses an existing
scratch target, creates only `campus_duo_restore_check` from `template0`,
preserves owners/ACLs, stops on errors, and never automatically drops a
partial scratch database.

Same-cluster restore reuses existing roles. Fresh-cluster restore requires
separately reviewed role provisioning and private passwords. Password hashes,
global roles, archive contents, and secrets are not part of this handoff.

## Remaining limitations

- Backend authentication and authorization remain required.
- Actor ownership, admin authority, consent/block enforcement, and workflow
  policy remain backend responsibilities.
- Full pagination traversal remains pending.
- Remaining nonempty projection and redaction assertions remain pending.
- Online synchronized snapshot capability remains deferred.
- Scratch cleanup remains pending and separately approved.
- Retention/anonymization policy, authentication/session provider decisions,
  and conditional messaging remain unresolved policy items.

## Review boundary

This handoff is review-ready for the database implementation and operational
procedures. It does not authorize production changes, cleanup, credential
changes, or backend release decisions.
