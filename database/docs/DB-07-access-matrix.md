# DB-07 Approved Runtime Access Matrix

This matrix records the approved SQL boundary. It is not proof of effective
privileges until role provisioning, V008, and actual-role tests are run.

## Roles

| Role | Login/inherit | Purpose | Membership |
|---|---|---|---|
| `campus_duo_migrator` | Existing login; owner | Flyway and schema ownership | No runtime use |
| `campus_duo_app` | Existing trusted login | Ordinary backend workflows | No memberships |
| `campus_duo_admin_service` | New LOGIN/INHERIT restricted role | Backend-admin moderation/resource path | No memberships |
| `campus_duo_worker` | New LOGIN/INHERIT restricted role | Outbox dispatch/retry | No memberships |

All runtime roles are `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`,
`NOREPLICATION`, and `NOBYPASSRLS`; none receives database/schema CREATE.

## Object and column matrix

| Object | App | Admin service | Worker |
|---|---|---|---|
| `user_account` | SELECT query fields; UPDATE approved account/profile fields; no INSERT provisioning of `identity_subject`, `role`, `verification_status`, or `verified_at` | SELECT `user_id,display_name,role,account_status` | None |
| `student_profile` | SELECT/INSERT/UPDATE profile fields; no delete | None | None |
| `profile_preferred_time` | SELECT/INSERT; DELETE replacement rows only | None | None |
| `course` | SELECT `course_id,code,name,department,active` | None | None |
| `profile_course` | SELECT/INSERT/UPDATE; DELETE replacement rows only | None | None |
| `social_interest` | SELECT active catalog fields | None | None |
| `profile_interest` | SELECT/INSERT/UPDATE; DELETE replacement rows only | None | None |
| `consent_record` | SELECT/INSERT/UPDATE state fields | None | None |
| `consent_history` | SELECT and append-only INSERT | None | None |
| `discovery_action` | SELECT/INSERT/UPDATE action fields | None | None |
| `connection` | SELECT/INSERT/UPDATE status/restriction fields | None | None |
| `block` | SELECT/INSERT/UPDATE active/revocation fields | None | None |
| `study_location` | SELECT public availability fields | SELECT/UPDATE resource fields | None |
| `study_table` | SELECT public availability fields | SELECT/UPDATE resource fields | None |
| `study_slot` | SELECT public availability fields | SELECT/UPDATE resource fields | None |
| `booking` | SELECT/INSERT/UPDATE lifecycle fields; no DELETE | SELECT/UPDATE approved admin override fields; no DELETE | None |
| `booking_participant` | SELECT/INSERT; UPDATE `removed_at`; no DELETE | None | None |
| `idempotency_record` | SELECT/INSERT final outcome only; no UPDATE/DELETE | None | None |
| `notification` | SELECT; INSERT trusted events; UPDATE `is_read,read_at` | INSERT approved admin events | None |
| `moderation_report` | SELECT receipt columns; INSERT submission columns; no UPDATE/DELETE | SELECT full moderation fields; UPDATE review fields | None |
| `audit_event` | INSERT approved safe columns only; no SELECT/UPDATE/DELETE | SELECT safe projection; INSERT approved safe columns | No access |
| `outbox_event` | INSERT `event_type,aggregate_type,aggregate_id,dedupe_key,payload,correlation_id`; dispatch state uses defaults | Same producer columns for approved admin events | SELECT event/dispatch fields; UPDATE only `status,attempts,next_attempt_at,dispatched_at` |
| `flyway_schema_history` | No access | No access | No access |

`details` is excluded from the admin audit grant. Column grants do not provide
row isolation: actor ownership, consent, blocks, creator/admin authority, and
validated administrator identity remain backend responsibilities.

Rescheduling is a backend-authorized transaction: successor INSERT may set
`rescheduled_from_booking_id`; established lineage is not UPDATE-granted.
The source cancellation reason must be `RESCHEDULED` while resource,
participants, and history are preserved. Audit linkage uses
`INSERT ... RETURNING audit_event_id` before report linkage in one transaction;
ordinary app audit SELECT remains forbidden.

No runtime role receives table-wide SELECT where that would defeat report,
audit, or identity confidentiality. Runtime audit writers receive no UPDATE,
DELETE, or TRUNCATE. Worker event payload and business tables are immutable to
the worker.
