# DB-04 Revision 4 Report

**Status:** READY FOR TARGETED REVIEW. Installation, PostgreSQL connections, migrations, and tests are **NOT RUN**.

## Issue-to-fix report

| Identified issue | Revision 4 repair |
|---|---|
| Flyway used an unsupported/incorrect legacy transaction key. | Replaced it with documented `executeInTransaction = true` under `[environments.default.flyway]`; safety settings and target remain unchanged. |
| Primary-key columns were expected nullable by the verifier. | Set required nullability to `true` for all primary-key expectations, including `user_account.user_id`, `study_slot.slot_id`, and `booking.booking_id`. |
| Catalog lookups reused aliases/variables and did not fail immediately on missing rows. | Used distinct catalog aliases and PL/pgSQL names; every required `SELECT INTO` is followed immediately by `IF NOT FOUND`. Nullable comparisons use `IS DISTINCT FROM`. |
| Exclusion verification used bare `regoperator` casts and `conbin`. | Resolves UUID equality and `tsrange` overlap from `pg_operator` with complete argument types, compares actual operator OIDs, follows `pg_constraint.conindid`, and checks the supporting valid GiST index and `pg_index.indpred`. |
| Structural checks assumed exact deparser formatting. | Uses structural metadata and narrow whitespace/cast/outer-parenthesis normalization for defaults, generated `slot_range`, partial-index predicates, and outbox predicates. |
| Expected-error diagnostics treated unset fields as ordinary values. | Normalizes empty diagnostics with `NULLIF`; SQLSTATE is always required; NULL expected constraint/column means “not asserted”; supplied diagnostics require exact matches. |
| Session A prompt was unnamed and timing guidance was insufficient. | Uses `\prompt 'Press Enter to commit Session A: ' commit_a` and documents the five-second bounded wait; timeout is a failed test. |
| Reschedule documentation implied a resource-change test. | Labels the current same-slot source/successor case as lineage-only; resource-change and atomic workflow behavior remain **BACKEND REQUIRED**. |

## Static checks

- PowerShell parser: **PASS**; runner body not executed.
- TOML structural parsing: **PASS** with the already available Python TOML parser.
- TOML setting scan: **PASS**; `executeInTransaction = true` is present and the legacy transaction key is absent from active configuration.
- Catalog-reference scan: **PASS**; `pg_index`, `pg_operator`, `pg_constraint.conindid`, `pg_index.indpred`, `IS DISTINCT FROM`, and immediate `FOUND` checks present.
- Expected-error assertion count: **26**.
- Stale executable-token scan: **PASS**; no `CREATE TEMP FUNCTION` or `relisunique`.
- Whitespace check: **PASS** for the Revision 4 patch with `git diff --check`.
- `database/.gitignore`: preserved; credential file remains ignored and was not read.

Static TOML parsing verifies syntax and expected values only. It does not prove that a selected Flyway binary recognizes the setting. Static SQL review does not prove PostgreSQL runtime correctness.

## Flyway evidence and unresolved question

Official Redgate environment documentation confirms `[environments.<name>]`, environment connection settings, nested environment Flyway settings, and the singular environment selector:

<https://documentation.red-gate.com/flyway/reference/configuration/environments-namespace>

The official `executeInTransaction` setting documentation identifies the boolean transaction-execution setting and its Flyway configuration namespace:

<https://documentation.red-gate.com/flyway/reference/configuration/flyway-namespace/flyway-execute-in-transaction-setting>

The selected Flyway release and PostgreSQL support remain **UNVERIFIED**. No Flyway artifact, checksum, installation, `flyway -version`, PostgreSQL connection, migration, or compatibility test was performed. `executeInTransaction` is the documented setting used in the selected configuration shape, but binary recognition remains a runtime check.

## Remaining runtime checks

Flyway installation/version/support verification, extension inspection, `info`, `validate`, migration execution, catalog verification, rollback integrity tests, and concurrency execution remain **NOT RUN**. Backend eligibility, authority, atomic rescheduling, resource-change behavior, completion-time enforcement, replay behavior, and workflow atomicity remain **BACKEND REQUIRED**.

**READY FOR TARGETED REVIEW.**
