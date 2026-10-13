# DB-05 Report — Reference and Development Seed Implementation

## 1. DB-04 evidence recorded

`DB-04-runtime-checkpoint.md` records the supplied DB-04 runtime results as user-provided evidence. Historical DB-04 reports remain unchanged. The assistant did not reproduce those runtime checks.

## 2. Classification

No authoritative IITK reference dataset was found in the inspected repository. Frontend mocks are synthetic implementation evidence only. The reference seed is therefore a documented no-op. Fictional catalog values and all development relationships are isolated in the development seed.

## 3. Implementation

Created:

- `seeds/01_reference_seed.sql`
- `seeds/00_manifest_assertions.sql`
- `seeds/02_development_seed.sql`
- `seeds/03_seed_verification.sql`
- `docs/DB-05-seed-manifest.md`
- `docs/DB-04-runtime-checkpoint.md`
- `docs/DB-05-report.md`

The development seed uses a dedicated UUID namespace, explicit target checks, one transaction, exact IDs, independent consent, reciprocal study matching, non-overlapping inventory, confirmed and cancelled future-reservation history, two participants per booking, actor-scoped idempotency references, and synthetic notification content. The shared read-only manifest assertions are called before commit and from the verifier, covering every seeded key and critical value with null-safe comparisons, consent chronology, participant membership, and synthetic outbox aggregate IDs. It does not insert outbox work, authentication sessions, passwords, identity-provider secrets, or real contact information.

## 4. Rerun behavior

This is a strict seed replay, not a refresh. Matching existing rows are preserved; critical mismatches raise an exception and roll back. Natural-key collisions under another ID fail through schema uniqueness. There are no updates, blanket destructive operations, cleanup deletes, or resets. Creation timestamps and already-seeded slot dates are intentionally preserved or allowed to vary as documented in the manifest.

## 5. Static validation

Static review performed after implementation:

- Migration files remain unchanged by the DB-05 patch.
- Seed files use `\set ON_ERROR_STOP on`.
- Write scripts have explicit transactions and target checks.
- Verification uses `BEGIN TRANSACTION READ ONLY`, `SET LOCAL`, and final `ROLLBACK`.
- DB-05 IDs are UUID-shaped and separate from DB-04/frontend fixture namespaces.
- No password, session, secret, or dispatchable-outbox seed statements were found.
- No `TRUNCATE`, broad `DELETE`, or `DROP` statement was added.
- Shared assertion file contains no transaction-control or data-write statement.
- Consent history contains seven explicit-timestamp events, including Alex SOCIAL grant-before-revoke and Jordan initial opt-out `UPDATED`.
- Runtime SQL execution is **NOT RUN**.

The static checks do not prove PostgreSQL execution, enum/check compatibility beyond source inspection, or backend authorization/workflow behavior.

## 6. Proposed next step

After SQL review, execute the three seed files in manifest order as `campus_duo_migrator`, then run the read-only verifier. Installation, connections, migration changes, seed execution, commits, pushes, and backend/frontend integration remain outside this stage.

## 7. Review decisions

The missing authoritative reference source is the only deliberate data decision requiring review. No official IITK catalog data was invented.

## DB-05 completion evidence

The user supplied the following runtime results after this report's original static-only stage: initial seed execution and verification passed; rerun produced `INSERT 0 0` for every insert; manifest assertions and verification passed on rerun. These are recorded as user-provided evidence, not commands executed by this assistant. Deliberately corrupted-fixture tests were not executed or claimed; negative conflict tests remain pending.
