# DB-06 Revision 2.3 — Unique Cursor Assertion Names

## Root cause

The cursor loop used `cursor_${($cursor.Name)}_...`. That expression did not
read the hashtable's `Name` property as intended, so every generated cursor
case had an empty query identity. The resulting identifiers collided as
`assert_cursor__timestamp_null`, and PostgreSQL rejected the second prepared
statement with `already exists`.

The loop now uses the actual property reference:

```powershell
$timestampCaseName = "cursor_$($cursor.Name)_timestamp_null"
$uuidCaseName = "cursor_$($cursor.Name)_uuid_null"
```

## Static preflight

The generator now maintains registries while producing SQL and rejects:

- empty assertion identifiers;
- duplicate assertion identifiers;
- duplicate prepared-statement names;
- duplicate `\gset` result prefixes;
- identifiers outside `[A-Za-z_][A-Za-z0-9_]*`;
- identifiers over PostgreSQL's 63-byte limit.

The expected generated inventory is exactly **70 assertions**:

| Category | Count |
|---|---:|
| Positive | 18 |
| Limit boundary | 40 |
| Incomplete cursor | 12 |
| **Total** | **70** |

The 12 cursor assertion names are:

```text
cursor_connections_timestamp_null
cursor_connections_uuid_null
cursor_bookings_timestamp_null
cursor_bookings_uuid_null
cursor_notifications_timestamp_null
cursor_notifications_uuid_null
cursor_receipts_timestamp_null
cursor_receipts_uuid_null
cursor_admin_reports_timestamp_null
cursor_admin_reports_uuid_null
cursor_audit_timestamp_null
cursor_audit_uuid_null
```

Prepared-statement names, `\gset` prefixes, `\if` variables, and PASS/FAIL
labels are all derived from the same validated assertion identifier.

## Supplied runtime evidence

The prior run passed 18 positive assertions, all 40 limit-boundary
assertions, and the first two incomplete-cursor assertions before the
prepared-statement collision. Remaining cursor checks and final completion
were not reached. PostgreSQL execution remains paused for this repair.

## Validation

Static assembly, PowerShell parsing, uniqueness/count preflight, whitespace,
scope, and migration-preservation checks passed. No query templates,
migrations, seeds, data, roles, or privileges were changed.
