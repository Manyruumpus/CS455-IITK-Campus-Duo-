# DB-05 Revision 1 — Complete Manifest and Consent-History Repair

## Repairs

- Added `seeds/00_manifest_assertions.sql` as a read-only shared assertion file. It does not begin, commit, or roll back transactions and contains no writes.
- Included the shared assertions with `\ir` in the development seed before `COMMIT` and in the verification script inside `BEGIN TRANSACTION READ ONLY`.
- Replaced partial checks with exact manifest validation for every DB-05 seeded identity, profile, catalog row, join row, consent row, history event, discovery action, connection, location, table, slot, booking, participant, idempotency record, and notification.
- Added null-safe critical-value comparisons and documented intentionally variable timestamps and preserved first-run slot dates.
- Added Alex's missing SOCIAL `GRANTED` history event using `D547`, before `D542` revocation.
- Set all seven consent-history `occurred_at` values explicitly. Jordan's never-granted SOCIAL state is represented by `UPDATED` with an initial consent-state capture source.
- Strengthened outbox checks to include synthetic booking/connection aggregate IDs as well as `db05-` dedupe/correlation identifiers.
- Kept the seed as a strict replay: matching rows are preserved, critical mismatches fail before commit, and no existing row is updated or reset.
- Corrected documentation to describe the cancelled row as retained cancellation history for a future reservation.
- Revision 1.1 also asserts each history row's exact source, scopes profile-join mismatch checks to DB-05 users while requiring `enrollment_status = 'ACTIVE'`, and validates both discovery actions' exact actor/target pairs.

## Updated manifest counts

| Record group | Expected records |
|---|---:|
| User accounts | 3 |
| Student profiles | 3 |
| Courses | 2 |
| Interests | 2 |
| Profile-course joins | 3 |
| Profile-interest joins | 3 |
| Consent records | 6 |
| Consent history | 7 |
| Discovery actions | 2 |
| Connections | 1 |
| Locations | 1 |
| Tables | 2 |
| Slots | 3 |
| Bookings | 2 |
| Booking participants | 4, exactly 2 per booking |
| Idempotency records | 2 |
| Notifications | 1 |
| Synthetic dispatchable outbox work | 0 |

## Static-only validation

- Shared assertion transaction-control/write scan: **PASS**
- Seed structure and stale-token scans: **PASS**
- Applied migrations V001–V007: unchanged
- Seed execution and runtime validation: **NOT RUN**

Revision 1.1 static checks also compare shared assertion expectations with the development seed insert values and preserve both existing `\ir` call sites.

Static checks do not prove PostgreSQL parser, constraint, or runtime behavior. Database connections, seed execution, backend/frontend changes, migrations, grants, commits, and pushes remain paused.
