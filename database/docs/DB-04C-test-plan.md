# DB-04C — Verification and Test Plan

**Status:** READY FOR REVISED FILE REVIEW. All PostgreSQL and runtime tests are **NOT RUN**.

## Catalog verification

`tests/01_catalog_verification.sql` is read-only. It checks ordinary business/history tables and their owners; required key types, nullability, and defaults; the stored generated `study_slot.slot_range`; administrative slot status; complete composite resource FK source/target/actions; confirmed-resource and direct-successor index uniqueness, validity, keys, and predicates; exclusion operator OIDs resolved from complete argument types, its `conindid` GiST index, columns, and active predicate; actor-scoped idempotency key columns; outbox checks/indexes; and app privileges. Deparsed expressions use controlled normalization rather than assuming source formatting.

The app must retain only expected `CONNECT` and schema `USAGE`. The verification rejects `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, and `TRIGGER` on all business and migration-history tables, database/schema `CREATE`, and owner-role membership. No privileges are granted.

## Transactional integrity suite

`tests/02_transactional_integrity.sql` creates all fixtures and `pg_temp.campus_duo_expect_error(...)` inside one outer transaction and always ends with `ROLLBACK`. It requires an authenticated owner/migrator session; failed runs must leave fixtures uncommitted.

The suite contains **26** expected-error assertions covering required NULL values with SQLSTATE/column diagnostics, invalid roles/statuses/modes, duplicate identity/catalog/profile selections, self-actions, canonical connection ordering, missing references, mismatched location/table/slot/date tuples, overlapping and adjacent slots, confirmed-resource collisions, cancelled-resource reuse with source history retained, `RESCHEDULED` source lineage, completed timestamp coherence, self-lineage, duplicate successors, actor-scoped idempotency uniqueness, negative outbox attempts, and inconsistent dispatch timestamps. The helper always requires SQLSTATE; a NULL expected constraint/column means that diagnostic is intentionally not asserted. Stored idempotency uniqueness is separate from backend replay behavior.

## Two-session concurrency test

The executable artifacts are `03_concurrency_setup.sql`, `03_concurrency_session_a.sql`, `03_concurrency_session_b.sql`, `03_concurrency_verification.sql`, and `03_concurrency_cleanup.sql`; the companion runbook is `03_two_session_booking_conflict.md`.

Run setup once as `campus_duo_migrator`; it stops if its explicit fixture IDs exist, creates only synthetic references, and commits them. Start Session A, which inserts winner `...0104` and pauses before commit. Start Session B while A is paused; B attempts loser `...0111` for the same exact resource. When B is visibly waiting, promptly press Enter in A; Session B has a five-second lock timeout, so delayed confirmation is a failed test. B must catch SQLSTATE `23505` with `booking_confirmed_resource_uk`, not a lock timeout, then roll back. Verification requires exactly one confirmed row for the exact resource, winner presence, loser absence, and exact source/idempotency/audit/outbox references. Cleanup deletes only explicit IDs, children before parents.

The executable two-session run is **NOT RUN**. Audit/outbox claims are limited to the rows inserted and checked by these artifacts.

The rollback reschedule fixture uses a cancelled source and successor on the same slot. It verifies lineage-only behavior and direct-successor uniqueness; it does not claim resource-change behavior. Atomic reschedule authorization, target validation, source preservation on failure, and workflow ordering remain **BACKEND REQUIRED**.

## Backend-required workflow tests

The following remain **BACKEND REQUIRED**: mutual eligibility and consent/block restrictions; creator/admin authority; participant cardinality; started-slot and completion-time rules; atomic rescheduling and source preservation on target failure; replay and fingerprint conflict handling; atomic booking/audit/outbox workflow; profile projections/report confidentiality; operating-hours and resource deactivation.
