# DB-04 Runtime Checkpoint

This checkpoint records runtime results supplied by the user after the DB-04 Revision 4.1 review. These are **user-provided results**, not commands executed by this assistant.

| Checkpoint item | Supplied result |
|---|---|
| Migrations | V001–V007 applied successfully to `campus_duo` |
| Schema version | `007` |
| Flyway validation | Passed |
| Catalog verifier | Passed |
| Transactional integrity suite | Completed with final `ROLLBACK` |
| Concurrency winner | Session A committed winner booking ending in `...0104` |
| Concurrency loser | Session B asserted the expected resource uniqueness conflict |
| Concurrency verification | Passed |
| Synthetic cleanup | Explicit cleanup completed and committed |
| PostgreSQL | 18.6 at `localhost:5432` |
| Flyway | Community 13.10.0 |
| Extension | `btree_gist` 1.8 in `public` |
| Data directory | `C:\Program Files\PostgreSQL\18\data` |

No database connection, migration, seed, or test execution was performed by this assistant during DB-05. DB-05 seed runtime checks remain **NOT RUN**.
