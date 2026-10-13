# DB-04C Two-Session Booking Conflict Test

**Status: NOT RUN.** These artifacts require five independent authenticated `psql` invocations and a migrated database. They are executable SQL, not comments-only instructions.

Run `03_concurrency_setup.sql` once as `campus_duo_migrator`; it stops before writes if any explicit fixture ID already exists and commits only the synthetic references. Start `03_concurrency_session_a.sql` in Session A. It inserts booking `...0104`, its participants, idempotency record, audit event, and outbox event, then pauses before `COMMIT`.

Start `03_concurrency_session_b.sql` in Session B while A is paused. B attempts booking `...0111` for the exact same `(table_id, location_id, slot_id, local_date)`. When B is visibly waiting on A's unique-resource conflict, press Enter in Session A. A commits. B must then catch SQLSTATE `23505` with constraint `booking_confirmed_resource_uk` and explicitly roll back. A lock timeout is not evidence that the uniqueness assertion passed.

Run `03_concurrency_verification.sql` after both sessions finish. It requires exactly one confirmed row for the exact resource, requires winner `...0104`, rejects loser `...0111`, and verifies the committed connection, idempotency, audit, and outbox fixture records. The audit/outbox assertion is limited to the rows inserted by Session A; backend workflow behavior remains **BACKEND REQUIRED**.

After review, run `03_concurrency_cleanup.sql`. It deletes only the explicit synthetic IDs, children before parents, and preserves unrelated records.
