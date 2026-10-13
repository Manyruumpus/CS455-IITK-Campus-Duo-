# DB-04A Revision 2 — Complete Migration Review and Repair

**Status:** READY FOR FINAL SQL AND RUNNER REVIEW. The seven migrations were reviewed and repaired as unapplied files. PostgreSQL syntax validation, extension installation, migration execution, and runtime tests remain NOT RUN.

## Repairs

| Issue | Evidence | Repair |
|---|---|---|
| Stored slot status included booking-derived `RESERVED` and `OCCUPIED` values | `database/migrations/V004__study_inventory.sql` | Restricted stored status to `AVAILABLE` and `LOCKED_MAINTENANCE`. Booking occupancy remains derived from `booking.status`. Frontend `RESERVED`/`OCCUPIED` values require adapter mapping. |
| Empty identity subjects could pass `NOT NULL` | `database/migrations/V002__identity_and_profiles.sql` | Added `user_account_identity_subject_not_blank_ck`. |
| Cancellation reason could be whitespace | `database/migrations/V005__bookings_and_idempotency.sql` | Required a nonblank reason for all cancelled rows. The backend must use `RESCHEDULED` for reschedule-source cancellations. |
| Audit safe reason, moderation review reason, notification text, and outbox identifiers lacked nonblank checks | `V006`, `V007` | Added named local checks while keeping nullable optional fields nullable. |
| UUID strategy and extension scope | `V001`, `V004`, DB-04A Revision 1 | Kept `pg_catalog.gen_random_uuid()`. Removed UUID-only `pgcrypto`; retained administrator-installed `btree_gist` in `public`. |

## Review conclusions

- Migration order is valid: identity before consent/discovery; inventory before bookings; audit before reports; outbox last.
- Composite foreign keys preserve table/location and slot/resource consistency.
- The booking resource index permits only one `CONFIRMED` row for `(table_id, local_date, slot_id)`. Historical `CANCELLED` and `COMPLETED` rows remain.
- Slot ranges are half-open and the active-table GiST exclusion constraint permits adjacent slots.
- `booking_participant` cardinality, mutual `STUDY` eligibility, current-time checks, creator/admin authorization, completion timing, and reschedule cycle prevention remain transactional/backend rules.
- Idempotency storage is actor-scoped. The backend must return/replay the stored outcome for the same fingerprint and reject the same key with a different fingerprint.
- Audit and outbox writes are structurally present but append-only/audit-write privileges and dispatcher behavior remain deferred.
- No migration grants business-table privileges to `campus_duo_app`; it retains only bootstrap `CONNECT` and schema `USAGE`.
- No operation modifies administrator-owned extensions.

## Runtime dependencies still pending

1. An administrator must inspect and, if absent, install `btree_gist` in `campus_duo_dev` schema `public`, outside Flyway migrations.
2. Flyway must be installed by the user.
3. Migrations must be validated and applied as `campus_duo_migrator`.
4. Database tests and backend workflow tests remain unexecuted.
