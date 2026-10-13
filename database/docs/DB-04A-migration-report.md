# Stage DB-04A — PostgreSQL Migration Implementation Report

**Status:** READY FOR SQL REVIEW — migration and test files drafted; PostgreSQL execution and tooling installation paused.

## Revision 1 — native UUID correction

All migration UUID defaults now call `pg_catalog.gen_random_uuid()`. The search found no other `pgcrypto`-dependent function, so the `pgcrypto` prerequisite and documentation were removed. `btree_gist` remains a separate administrator-installed prerequisite in schema `public`; V004 resolves its GiST operator classes through `SET search_path = campus_duo, public`. No test fixture used a UUID-generation function.

## 1. Decisions recorded

DB-04A records the following as **user-approved MVP policies**, distinct from historical proposal evidence and not evidence of instructor/team approval:

- Auto-confirm a booking only after backend validation of both participants, eligibility, and a mutual `STUDY` connection.
- Allow the creator to cancel/reschedule; keep the other participant read-only initially; require an audit reason for admin override.
- Omit pending approval and temporary holds. Only `CONFIRMED` occupies a resource.
- Complete bookings only after the slot ends; reject new bookings for already-started slots in backend workflow.
- Preserve historical booking rows. Rescheduling creates a successor, marks the source `CANCELLED` with reason `RESCHEDULED`, preserves source resource/participants, and leaves the source unchanged if the target claim fails.
- Make the transactional outbox mandatory for approved consequential events; dispatcher implementation is later.
- Defer `auth_session`, `conversation`, and `message`.
- Apply consent/block ineligibility to new discovery/actions and new bookings involving the affected pair; preserve history and allow cancellation; revalidate rescheduling.
- Use account/resource deactivation initially; automated deletion/anonymization remains disabled.

These decisions update the status of earlier open/provisional records. MongoDB remains the historical original proposal; PostgreSQL remains the current implementation decision. No `ARCH-AI-04` record or instructor/team approval evidence was created.

## 2. Files created or updated

Created:

- `database/migrations/V001__schema_conventions.sql`
- `database/migrations/V002__identity_and_profiles.sql`
- `database/migrations/V003__consent_connections_and_blocks.sql`
- `database/migrations/V004__study_inventory.sql`
- `database/migrations/V005__bookings_and_idempotency.sql`
- `database/migrations/V006__moderation_notifications_and_audit.sql`
- `database/migrations/V007__transactional_outbox.sql`
- `database/tests/01_catalog_verification.sql`
- `database/tests/02_transactional_integrity.sql`
- `database/tests/03_two_session_booking_conflict.md`
- `database/docs/DB-04A-migration-report.md`

Updated:

- `database/README.md`
- `database/docs/DB-02-decision-register.md`
- `database/docs/DB-03C-physical-schema-plan.md`

No PostgreSQL command, Flyway installation, dependency installation, backend code, frontend integration, commit, or push was performed.

## 3. Tables, constraints, indexes, and dependencies

| Migration | Tables/objects | Main dependency |
|---|---|---|
| `V001` | prerequisite validation for `campus_duo_migrator`, `campus_duo`, and `btree_gist` | DB-03B bootstrap; `btree_gist` must be installed separately in `public` |
| `V002` | `user_account`, `student_profile`, preferred times, courses, profile courses, interests, profile interests | `V001` |
| `V003` | consent current/history, discovery actions, connections, blocks | `V002` |
| `V004` | locations, tables, fixed slots | `V001` and inventory identifiers |
| `V005` | bookings, participants, idempotency records | `V003` and `V004` |
| `V006` | audit events, moderation reports, notifications | `V002`; audit is created before the report FK |
| `V007` | transactional outbox | `V001`; aggregate references are intentionally polymorphic |

Important physical rules:

- Production IDs use `uuid DEFAULT pg_catalog.gen_random_uuid()`; no `pgcrypto` extension is required.
- Relationship tables retain composite primary keys.
- Location/table and table/slot consistency use composite foreign keys.
- Booking references the complete `(slot_id, table_id, location_id, local_date)` resource identity.
- `study_slot.slot_range` is a generated half-open `[start,end)` `tsrange`.
- `study_slot_no_overlap_excl` uses `btree_gist` and permits adjacent slots. V004 uses `SET search_path = campus_duo, public`, so the extension's operator classes installed in `public` are available to the exclusion constraint.
- `booking_confirmed_resource_uk` is the single partial unique index on `(table_id, local_date, slot_id)` for `status = 'CONFIRMED'`.
- Direct booking successor lineage is limited to one successor by a unique partial index and rejects self-lineage.
- Idempotency is unique on `(actor_user_id, operation_type, client_operation_id)` and stores a request fingerprint.
- All business objects are created by `campus_duo_migrator`; no blanket application grants are added.

## 4. Extension requirements

`V001` does not install extensions. It validates that `btree_gist` exists in schema `public` for UUID equality and range exclusion. UUID generation uses the native `pg_catalog.gen_random_uuid()` function, so `pgcrypto` is not a migration prerequisite and is not referenced by the remaining migration/test files.

This keeps extension installation as an explicit administrator/setup action and avoids assuming that the migration role can modify the bootstrap-owned `public` schema. If `btree_gist` is absent or installed outside `public`, migration execution must stop with the diagnostic from `V001`; UUID generation has no extension prerequisite.

## 5. Frontend mappings

- `userId`, `bookingId`, `tableId`, `slotId`, `connectionId`, `reportId`, and notification IDs map from opaque frontend strings to production UUIDs in the backend adapter; mock fixture IDs are not production keys.
- `StudyPreferences` maps to `student_profile` and `profile_preferred_time`.
- Course and interest arrays map to normalized join tables.
- Independent study/social consent maps to `consent_record` plus `consent_history`.
- Actions and mutual connections map to `discovery_action` and `connection`; pending viewer buckets remain derived.
- `StudyTableSlot` is an availability projection; `reservedCount`, time windows, names, allowed actions, dashboard totals, scores, reasons, and unread counts are derived.
- Booking requests map to `booking`, `booking_participant`, and `idempotency_record`.
- Notification, report, receipt, and audit response types are authorized projections.
- Agent results are not persisted as a mandatory source table.

## 6. Database-enforced versus deferred workflow rules

Database constraints enforce identifiers, required values, local enum/value checks, canonical pair ordering, self-action/block/report rejection, relationship uniqueness, composite resource references, slot overlap, confirmed-resource uniqueness, idempotency uniqueness, and historical foreign-key retention.

Future transactional/backend code must enforce actor resolution, verified/active accounts, mutual `STUDY` eligibility, consent/block effects, creator/admin mutation authority, admin audit reasons, two distinct participants, participant/connection consistency, started-slot rejection, completion-after-end, reschedule target-then-source ordering, cancellation idempotency, resource deactivation safety, and outbox insertion/dispatch. No current-time or cross-table business rule is encoded as a `CHECK`.

Append-only audit behavior is not fully privilege-enforced yet. A later narrow audit-write path must prevent ordinary application updates/deletes and provide only approved insert capability.

## 7. Test coverage and actual execution status

| Test artifact | Coverage | Status |
|---|---|---|
| `tests/01_catalog_verification.sql` | Required tables, exclusion constraint, partial confirmed index, complete booking resource FK, catalog listing | **NOT RUN** |
| `tests/02_transactional_integrity.sql` | Synthetic valid fixtures with rollback; documented null/invalid values, missing/mismatched references, duplicate pairs, self-actions, overlap/adjacency, booking collision, released reuse, lineage, and idempotency cases | **NOT RUN** |
| `tests/03_two_session_booking_conflict.md` | Two-session final-slot race, unique conflict, winner/loser reconciliation, race variants | **NOT RUN** |
| Static `git diff --check` | Documentation/SQL whitespace validation | **PASS** |

No database execution has occurred in DB-04A. Test files intentionally remain unexecuted.

## 8. Risks, blockers, and SQL-review order

Review in this order:

1. Confirm extensions are installed in `public` and accessible to the migrator-owned schema.
2. Review V001 prerequisite behavior and Flyway transactional execution.
3. Review composite foreign keys and the generated half-open slot range/exclusion constraint in V004.
4. Review V005 booking status, partial unique occupancy index, participant cardinality workflow, and successor lineage.
5. Review V006 report/audit dependency and sensitive-field handling.
6. Review V007 outbox dedupe/status semantics.
7. Review application privilege grants separately; current migrations intentionally grant none.
8. Execute catalog, rollback, and two-session tests only after SQL review.

Known blockers for execution:

- `btree_gist` installation state has not been verified in DB-03B; its installation remains a separate administrator action before migration execution.
- Flyway is not installed/configured.
- Application privilege strategy and narrow audit-write path remain pending.
- Backend workflow/authorization code is not implemented.
- Concrete authentication/session provider and retention periods remain deferred.

**Next stage:** DB-04B should install/configure the approved migration runner, verify extensions, execute migrations as `campus_duo_migrator`, run the tests, and record actual results.
