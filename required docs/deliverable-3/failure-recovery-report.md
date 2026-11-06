# Failure and Recovery Report

## Verified

- Booking rollback/failed-reschedule and idempotency behavior are covered by
  backend evidence and service tests.
- Health failure tests cover a mocked database boundary.
- A disposable PostgreSQL 18.6 cluster was verified as owned by
  `OMICRON\mohit`, bound only to `127.0.0.1:55432`, and separate from the
  shared PostgreSQL service on `127.0.0.1:5432`.
- The isolated cluster contains roles `campus_duo_migrator`,
  `campus_duo_app`, `campus_duo_admin_service`, and `campus_duo_worker`,
  database `campus_duo_dev`, migrations V001-V008, and synthetic seed data.
- Historical evidence
  `evidence/recovery/recovery-20261106-20261106-104151-204/` records a
  pre-outage booking, replay, 503, restart, and ECONNRESET. Earlier wrapper
  attempts under `evidence/recovery/KAN-86-recovery-*` are preserved as
  historical wrapper failures and are not system-recovery results.
- The completed approved exercise is
  `evidence/recovery/KAN-86-recovery-20261106-120945-805/`. It verified:
  - initial booking `201` and identical replay `200`;
  - HTTP `503` while only the isolated database was stopped;
  - post-restart health `UP` with `campus_duo_app` connected;
  - identical post-restart replay `200` with the original booking ID;
  - unchanged durable counts before/after restart: 1 booking, 2 active
    participants, 1 idempotency record, 1 successful audit event, and 1
    outbox event;
  - exact cleanup of the owned outbox, audit, idempotency, participant, and
    booking rows.
- Recorded local timing for this run is 138.2785 ms for stop command
  completion, 1,157.8673 ms for restart command completion, and health
  observed immediately after restart. These are synthetic local timings, not
  production SLOs.

## Limitations

- The exercise used a small synthetic seed and does not establish hosted or
  production-scale recovery behavior.
- Backup/restore scripts remain present under `database/scripts` and
  `database/tests`; they were not re-run in this checkpoint.
- No shared port 5432 process or session was stopped or modified.
