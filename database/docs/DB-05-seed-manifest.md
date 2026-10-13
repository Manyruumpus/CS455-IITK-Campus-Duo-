# DB-05 Seed Manifest

## Classification and source evidence

The inspected frontend files are mock/demo sources, not an authoritative IITK catalog:

- `frontend/src/mocks/store.ts`
- `frontend/src/mocks/index.ts`
- `frontend/src/services/mock/MockBookingService.ts`
- `frontend/src/types/index.ts`

No authoritative IITK course, interest, location, or inventory dataset was found in the inspected repository. Therefore `database/seeds/01_reference_seed.sql` intentionally inserts no shared reference rows. It validates the target and commits a documented no-op rather than presenting fictional data as official.

All courses, interests, users, locations, tables, slots, bookings, notification text, and relationship data in `02_development_seed.sql` are explicitly synthetic development fixtures.

## Development namespace

Every DB-05 development identifier uses the UUID-shaped namespace `00000000-0000-0000-0000-00000000D5xx`, separate from DB-04 test fixtures and frontend mock string IDs.

| Area | IDs |
|---|---|
| Users | `...D501`–`...D503` |
| Courses | `...D511`–`...D512` |
| Interests | `...D521`–`...D522` |
| Consent records | `...D531`–`...D536` |
| Consent history | `...D541`, `...D542`–`...D547` (7 events) |
| Reciprocal actions | `...D551`–`...D552` |
| Connection | `...D561` |
| Location and tables | `...D571`–`...D573` |
| Slots | `...D574`–`...D576` |
| Bookings | `...D581`–`...D582` |
| Idempotency records | `...D591`–`...D592` |
| Notification | `...D5A1` |

## Dataset

- Three fictional student accounts and profiles.
- Two fictional courses and two fictional interests.
- Independent STUDY and SOCIAL consent records, with consent history.
- Reciprocal STUDY `LIKE` actions and one canonical matching connection.
- One fictional location, two tables, and three non-overlapping slots.
- One `CONFIRMED` booking and one `CANCELLED` booking retaining cancellation history for a future reservation; it is not a past study visit.
- Exactly two participants on each booking.
- Two actor-scoped idempotency records referencing the bookings.
- One synthetic notification row.
- No authentication sessions, credentials, contact data, or dispatchable outbox events.

Slot dates are computed from `CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'` only when the corresponding slot is first inserted. Existing slot dates are not updated on rerun; cancellation history and resources are preserved. Creation/update timestamps and notification creation time are intentionally not asserted; critical identities, states, relationships, consent event times, and booking resource fields are asserted.

## Rerun and conflict behavior

The write script is a strict seed replay, not a data refresh. It uses explicit IDs and conflict handling for intended keys. Matching existing rows are preserved; existing rows with different critical meaning fail the transaction instead of being silently accepted. Natural-key collisions under another ID fail through schema unique constraints. No existing rows are updated or deleted, and user-modified records are never reset.

`00_manifest_assertions.sql` is read-only and does not control transactions. It is included by `02_development_seed.sql` before `COMMIT` and by `03_seed_verification.sql` inside its read-only transaction. It checks 3 users, 3 profiles, 2 courses, 2 interests, 3 course joins, 3 interest joins, 6 consent rows, 7 consent-history rows, 2 discovery actions, 1 connection, 1 location, 2 tables, 3 slots, 2 bookings, 4 participant rows, 2 idempotency records, 1 notification, and no dispatchable outbox work for synthetic prefixes/aggregate IDs. Verification ends with `ROLLBACK`; authorization, backend eligibility, dispatch, and atomic workflow behavior remain backend-required concerns.

## Proposed execution order

Run later as `campus_duo_migrator`, after reviewing the SQL:

```text
psql -X -W -v ON_ERROR_STOP=1 -h localhost -p 5432 -U campus_duo_migrator -d campus_duo_dev -f database\seeds\01_reference_seed.sql
psql -X -W -v ON_ERROR_STOP=1 -h localhost -p 5432 -U campus_duo_migrator -d campus_duo_dev -f database\seeds\02_development_seed.sql
psql -X -W -v ON_ERROR_STOP=1 -h localhost -p 5432 -U campus_duo_migrator -d campus_duo_dev -f database\seeds\03_seed_verification.sql
```

These commands are proposed only. Seed execution is **NOT RUN**.
