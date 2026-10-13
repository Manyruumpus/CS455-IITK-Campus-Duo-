# DB-07 Revision 1 — Privilege Contract and Test Repairs

## Status

V008 remains prepared and **NOT APPLIED** according to `DB-07-report.md` and
the available recorded evidence. No role provisioning, password setup,
database connection, grant, migration, or actual-role test was performed.

## Repairs

- Bootstrap requires a superuser administrator connected to `campus_duo_dev`,
  validates the schema owner and prerequisite roles before writes, preserves
  incompatible settings/memberships, uses one explicit transaction, and
  rejects effective database/schema CREATE access.
- Ordinary app account provisioning is deferred. It has no INSERT privilege
  for `identity_subject`, `role`, `verification_status`, or `verified_at`;
  ordinary profile/account updates remain separate.
- Booking successor lineage is INSERT-only for
  `rescheduled_from_booking_id`; source cancellation with `RESCHEDULED`,
  authority, and longer-cycle checks remain backend responsibilities.
- Idempotency is explicitly insert-final-outcome only. No PENDING outcome
  update is claimed.
- Audit linkage is `INSERT ... RETURNING audit_event_id`, followed by report
  linkage in the same backend transaction. Runtime audit UPDATE/DELETE/
  TRUNCATE remains forbidden.
- Producers insert business-event columns only; defaults own outbox dispatch
  state. The worker alone updates dispatch/retry fields and selects due work.
- Allowed-write suites include rollback-scoped mutation assertions with
  affected-row and resulting-value checks. Denial tests verify SQLSTATE 42501.
- Catalog verification checks all business tables and runtime roles for
  ownership, memberships, database/schema CREATE, forbidden privileges,
  grant options, migration-history access, and worker boundaries.

## Static validation boundary

Run PowerShell parsing, source-template assembly, migration-order/reference,
credential/broad-grant, scope, and `git diff --check` validation before review.
PostgreSQL execution is intentionally outside this revision; generated
mutation fixtures fail clearly when required synthetic fixtures are absent.

Role provisioning: **NOT RUN**. Password setup: **NOT RUN**. Privilege
migration: **NOT APPLIED**. Actual-role access tests: **NOT RUN**.
Backend authorization: **BACKEND REQUIRED**.
