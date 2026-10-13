# DB-07 Revision 1.1 — Concrete Bootstrap and Fixture Repairs

## Status

This report preserves the historical static-preparation status at the time
Revision 1.1 was authored. It is superseded for runtime completion by the
user-provided evidence in [`DB-07-runtime-checkpoint.md`](DB-07-runtime-checkpoint.md).

This revision is static preparation only. Database connections, role
provisioning, password setup, V008 application, grants, fixture setup,
fixture cleanup, and runtime access tests remain **NOT RUN**.

V008 remains **NOT APPLIED** according to the recorded DB-07 evidence.
V001–V007, DB-05 seeds, and the DB-06 query templates and 70-assertion suite
were not changed.

## Corrected bootstrap preflight

`setup\03-runtime-roles.psql` now checks the target database, administrator
identity, migrator-owned schema, and required existing roles before writes.
For each new runtime role it first looks up `pg_roles.oid`; absent roles are
skipped during pre-creation effective-privilege checks, so first-run
provisioning works when both roles are absent. Existing roles are checked for
restricted attributes, memberships, and effective schema `CREATE` using the
resolved OID. Post-creation checks continue to use effective database/schema
privilege checks. Incompatible existing roles fail without repair.

The four static-reviewed bootstrap scenarios are: both roles absent, one role
present, both compatible, and one incompatible. They were not runtime-tested.

## Corrected runtime fixtures

- Discovery action `D551` is the recorded Alex-to-Sam STUDY `LIKE` fixture;
  mutation verifies actor, target, and mode before update.
- Preferred-time replacement uses valid `LATE_NIGHT` and creates its own
  rollback-only row because the DB-05 seed has no preferred-time rows.
- Successor booking selects `D576` from `study_slot` and derives table,
  location, and date from that row. It therefore uses table `D573`, not the
  incorrect `D572`/`D576` combination.
- Source booking `D581` is changed to `CANCELLED` with reason `RESCHEDULED`;
  the successor is inserted with the derived resource, linked to `D581`, and
  receives creator and companion participants.
- Idempotency uses permitted `CREATE_BOOKING`, DB-07-specific operation and
  fingerprint values, and JSONB response reference
  `{"bookingId":"DB07-ROLLBACK"}`. Final fields are asserted.
- Notification assertions require `is_read` and non-null `read_at`.
- Consent-history append coverage is executable and rollback-scoped.

## Dedicated committed fixtures

`tests\07_db07_fixture_setup.sql` creates only:

| Identifier | Object | Purpose |
|---|---|---|
| `D7A1` | `moderation_report` | Dedicated admin review/linkage target |
| `D7B1` | `outbox_event` | Dedicated worker retry target |

The setup requires `campus_duo_migrator` on `campus_duo_dev`, checks exact
synthetic users and identifier collisions, and commits only these fixtures.
The dispatcher must be stopped or isolated from `db07-fixture-outbox` before
setup and runtime tests. `tests\08_db07_fixture_cleanup.sql` removes only
the exact report, outbox event, and any DB-07 admin audit event targeting the
dedicated report, in foreign-key-safe order.

## Admin audit linkage

The admin mutation verifies the dedicated report identity, inserts an audit
event with `RETURNING audit_event_id`, updates the report with that ID in the
same transaction, and asserts the report link plus safe audit fields. Audit
`details` is neither selected nor granted. The entire suite ends in
`ROLLBACK`.

## Effective privilege verification

`tests\06_privilege_catalog_verification.sql` validates the
`campus_duo_dev` target, migrator ownership of every business table, runtime
memberships, database/schema `CREATE`, table ownership, forbidden
`TRUNCATE`, `REFERENCES`, `TRIGGER`, and `MAINTAIN`, approved app profile
selection `DELETE` boundaries, migration-history read/write prohibitions,
app audit-SELECT denial, admin `details` denial, worker outbox-only access,
grant options, and unintended future default privileges. It uses
`has_any_column_privilege` for column-capable forbidden operations and
column-level checks for sensitive account and booking-lineage boundaries.

## Static validation boundary

Static checks cover PowerShell parsing, runner assembly, fixture identifier
references, seed/migration value consistency, successor slot/resource
consistency, null-safe assertions, privilege boundary checks, credential and
broad-grant scans, `git diff --check`, and V001–V007 hash preservation.
These checks do not prove PostgreSQL execution or authenticated runtime
behavior.

Role provisioning: **NOT RUN**  
Password setup: **NOT RUN**  
Privilege migration: **NOT APPLIED**  
Dedicated fixture setup: **NOT RUN**  
Actual-role access tests: **NOT RUN**  
Dedicated fixture cleanup: **NOT RUN**  
Backend authorization and dispatcher isolation: **BACKEND REQUIRED**

## Subsequent runtime checkpoint

The user subsequently reported that V008 was applied as schema version 008,
all eight migrations validated, runtime role bootstrap/preflight/service
logins passed, effective privilege verification passed, and all app/admin/
worker access suites passed with final `ROLLBACK`. Dedicated cleanup deleted
one report and one outbox row and committed. DB-05 manifest verification and
the DB-06 70-assertion regression passed with final `ROLLBACK`.

These are later user-provided execution results, not claims about the
historical Revision 1.1 static-only state. Backend authorization, full
pagination, and remaining nonempty projection/redaction assertions remain
pending.
