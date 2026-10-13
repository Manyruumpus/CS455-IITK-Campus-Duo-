# DB-06 Revision 2.2 — Safe LIMIT Expressions

## Supplied partial runtime evidence

The supplied Revision 2.1 run passed all 18 positive assertions and the study
NULL/zero-limit checks, then failed on the negative study limit with:

```text
ERROR: LIMIT must not be negative
```

The subsequent boundary checks were not executed. Full-suite success remains
pending.

## Repair

All ten bounded source templates now retain their existing fail-closed
`WHERE` predicates and use a safe `CASE` expression in `LIMIT`. Invalid
NULL, zero, negative, and above-maximum values now produce `LIMIT 0` rather
than reaching PostgreSQL's negative-limit error.

| Query | Limit parameter | Maximum |
|---|---:|---:|
| Study candidates | `$6` | 50 |
| Social candidates | `$4` | 50 |
| Connections | `$3` | 50 |
| Resource availability | `$4` | 100 |
| Booking history | `$3` | 50 |
| Notifications | `$4` | 50 |
| Reporter receipts | `$2` | 50 |
| Administrator report queue | `$2` | 50 |
| Administrator resource summary | `$2` | 100 |
| Administrator audit | `$3` | 50 |

The source query outputs, signatures, ordering, cursor predicates, filtering,
seed data, roles, privileges, and migrations were preserved.

## Static validation

Static assembly, PowerShell parsing, whitespace, change-scope, and migration
preservation checks are required before the next runtime rerun. PostgreSQL
execution remains **NOT RUN** for this repair.
