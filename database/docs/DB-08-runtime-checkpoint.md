# DB-08 Runtime Checkpoint

## Evidence source and scope

The results in this document are user-provided execution evidence. They are
recorded as reported and are not claimed as execution performed by this
assistant. No database execution, commits, or pushes were performed while
closing this documentation checkpoint.

## Reported backup evidence

- Archive: `campus_duo_dev-20261013-164503.dump`.
- Storage location: `C:\Users\mohit\CampusDuoBackups`.
- Archive listing passed.
- Archive size validation passed.
- SHA-256 validation passed.
- Password-free metadata manifest creation passed.

## Reported restore and verification evidence

- Restore into `campus_duo_restore_check` passed.
- All 22 business-table row counts matched the backup manifest.
- Migration versions `001`–`008` were present.
- Migration success checks passed.
- Schema/table ownership checks passed.
- `btree_gist` extension placement check passed.
- Selected DB-05 fixture identity checks passed.
- Complete DB-07 effective privilege verification passed.
- Read-only verifiers reached final `ROLLBACK`.

## Retained scratch state

The scratch database `campus_duo_restore_check` was retained after
verification. Scratch cleanup is **NOT RUN** and remains a separately approved
operation. No cleanup command or password is recorded here.

## Consistency boundary

The reported backup used:

```text
consistency_mode = operator-confirmed-quiescent
```

This is not evidence of a synchronized online snapshot. Source writers,
migrations, tests, and dispatchers were required to remain stopped during
dump and metadata collection. Online snapshot capability remains deferred.

## Confidentiality boundary

This checkpoint does not record archive contents, credentials, password
prompts, password hashes, or manifest secrets.
