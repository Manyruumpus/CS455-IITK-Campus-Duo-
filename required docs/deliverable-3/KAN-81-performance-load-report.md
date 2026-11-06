# KAN-81 / KAN-85 Performance and Load Baseline

**Status:** KAN-85 target verification, smoke, baseline, and read-only
query-plan diagnostics passed. The baseline is preserved unchanged. No
optimization was implemented, and the unchanged comparison wrapper must not be
run as an optimization experiment.

On 6 November 2026, `node` and `k6` were available. PostgreSQL was reachable
on `127.0.0.1:5432` but required an administrator credential for the
read-only target probe. `psql` was not on `PATH` but exists at
`C:\Program Files\PostgreSQL\18\bin\psql.exe`. Flyway Community Edition
13.10.0 is available at
`C:\Users\mohit\Tools\flyway-13.10.0\flyway.cmd`, although it is not on
`PATH`. The target was subsequently verified read-only at
`127.0.0.1:5432/campus_duo_perf_20261103` with eight valid Flyway migrations,
expected ownership, and application-role access. Smoke, baseline, and
The submitted result is intentionally limited to the tested 12-slot fixture,
1-VU smoke, and 10-VU/180-second baseline. No endpoint optimization is
claimed; the query-plan finding is valid only for that scale.

## Authoritative requirements

The applicable requirements are:

- **NFR-06, `required docs/01-requirements-and-use-cases.md:140`:**
  “Capacity baseline: 100 daily active users and 250 core
  transactions/day or documented equivalent.”
- **NFR-07, `required docs/01-requirements-and-use-cases.md:141`:**
  “Set p95 latency and throughput budgets with environment, dataset and
  concurrency before load testing.”

The proposal also requires realistic mixed read/write workload, latency
percentiles, throughput, bottleneck diagnosis, and before/after optimization
evidence (`required docs/main_proposal.md:199`). NFR-06 specifies daily
capacity, not a peak requests-per-second or concurrency target. NFR-07 does
not specify numeric p95/throughput budgets; any numeric acceptance threshold
used by the harness is provisional until approved.

## Prepared experiment

The harness measures the real `GET /api/booking/availability` route through a
dedicated local Node process and a disposable PostgreSQL database. The route
requires development-only `X-Campus-Duo-Test-Actor` authentication; the
fixture creates one synthetic active, verified student and twelve owned
available slots on one owned location. The k6 script validates HTTP 200,
response shape, request-ID format, and the presence of every expected slot.
Malformed JSON, missing slots, wrong status/data, and empty/wrong responses
increment `availability_correctness_failures` and fail the k6 threshold.

Workload profiles:

| Profile | Stages | Classification |
|---|---|---|
| `smoke` | 1 VU ramp for 5 seconds, hold 10 seconds, ramp down 5 seconds | Bounded harness validation assumption; not a requirement |
| `baseline` | 1 VU/30 seconds, 5 VUs/60 seconds, 10 VUs/60 seconds, ramp down 30 seconds | Staged experiment assumption; not a requirement |

The profiles are intentionally bounded and are not a claim that the system
meets NFR-06. Daily volume and peak load are separate: NFR-06 requires a
capacity model of 250 core transactions/day for 100 DAU, while these profiles
measure endpoint behavior under selected concurrent VUs. A future mixed
workload must map requests to that daily model before acceptance.

The script uses a separate bounded warm-up invocation, then a separate measured
invocation; warm-up output is stored separately and excluded from measured
percentiles, rate, errors, and correctness totals. The measured smoke phase is
20 seconds before graceful ramp-down. There is no think time or explicit pacing:
each VU loops as soon as its prior request completes, so achieved RPS is an
observed result rather than implied by VU count.

The KAN-85 smoke checkpoint passed with native evidence at
`evidence/performance/availability-KAN-85-smoke-20261106-111657-658/` and
wrapper evidence at
`evidence/performance-smoke/KAN-85-smoke-20261106-111657-658/`. Its measured
phase used 1 VU for approximately 20 seconds and produced 12,041 requests at
602.023 requests/second, average duration 1.26199 ms, p50 1.3307 ms, p95
2.5309 ms, zero HTTP failures, zero correctness failures, and 48,164 passed
checks. Warm-up results are preserved separately and are not included here.
The pre-change smoke summary did not request p99; `availability-k6.js` now
requests avg/min/med/max/p90/p95/p99 so the baseline and later comparison runs
use equivalent reporting.

The KAN-85 baseline checkpoint passed with native evidence at
`evidence/performance/availability-KAN-85-baseline-20261106-112650-493/` and
wrapper evidence at
`evidence/performance-baseline/KAN-85-baseline-20261106-112650-493/`. Excluding
warm-up, the measured phase ran for 180 seconds, reached 10 VUs, produced
277,931 requests at 1,544.055 requests/second, average latency 2.46153 ms,
p50 2.3239 ms, p95 4.2965 ms, and p99 5.04207 ms. HTTP failures and
correctness failures were both zero; 1,111,724 checks passed; exit code was
0; and exact fixture cleanup completed.

Baseline provenance captured the Git revision
`b9807f5e773892ce955bca417cc21ae68eb6e67e`, Node v24.12.0, k6 v2.3.0,
the explicit target and launcher paths, workload stages, thresholds, summary
statistics, and a dirty-worktree file-status snapshot. Per-file source/config
hashes were not captured before the run, so no retrospective clean-source hash
claim is made.

The script currently uses a **provisional** `p(95)<1000ms` threshold for
availability requests and zero HTTP/correctness failures. NFR-07 also requires
a throughput budget, but none is specified. The proposed minimum throughput
criterion is **pending approval**; it must be selected for the measured phase
after observing the achieved rate and agreeing whether a request-rate or
transaction-rate budget is appropriate. It must not be presented as an NFR.
The zero-failure criteria are harness integrity requirements; the 1000 ms
latency value is not specified by NFR-07 and must be approved or replaced
before claiming requirement compliance. p50, p95, p99, achieved rate, counts,
errors, correctness failures, timeouts, and dropped iterations are collected
from the k6 summary/JSON output.

## Isolation and prerequisites

`backend/scripts/performance/availability-fixture-setup.sql` and
`availability-fixture-cleanup.sql` reject `campus_duo_dev` and
`campus_duo_test`, require `campus_duo_migrator`, and use a per-run manifest
of fresh UUIDs plus an ownership identifier. Setup is transactional and
rejects collisions. Cleanup is authorized only after setup returns
successfully, revalidates ownership and exact IDs, and leaves data in place
when setup outcome is ambiguous. Cleanup failures remain visible.
`Invoke-AvailabilityPerformanceBaseline.ps1` preflights both roles and starts
the app with that database and `campus_duo_app`; it sanitizes database
credential environment variables before launching k6.

The performance-only `loopback-server.js` imports the built exported
`createApp`, binds the real app to `127.0.0.1`, writes a readiness file with
the actual address, and closes the real pool during orderly shutdown.
This launcher differs from `server.ts` only in explicit loopback binding and
readiness/shutdown orchestration; production source is unchanged.

Migrations V001–V008 require the existing `campus_duo_migrator` owner,
`btree_gist` in `public`, and the existing runtime-role model; the reviewed
SQL does not hard-code `campus_duo_dev` as the migration target. Database
creation still requires an administrator because the migrator role has
`NOCREATEDB`. Apply reviewed migrations and verify the disposable database
before running the wrapper. Confirm `k6` v2.3.0, `psql`, and Flyway are
available on PATH before execution; availability is an execution prerequisite,
not a recorded performance result.

## Recorded baseline and diagnostic results

| Field | Result |
|---|---|
| Run ID / evidence path | `KAN-85-baseline-20261106-112650-493`; native and wrapper paths above |
| Git revision/worktree state | `b9807f5e...`; dirty-worktree snapshot captured |
| Node/k6/PostgreSQL versions | Node v24.12.0; k6 v2.3.0; PostgreSQL target verified at 127.0.0.1:5432 |
| Machine characteristics | Not captured |
| Fixture size and target database | 12 slots; `campus_duo_perf_20261103` |
| Warm-up result | Preserved separately and excluded |
| Measured duration/profile | 180 seconds / baseline |
| Requests/achieved rate | 277,931 / 1,544.055 requests/second |
| p50/p95/p99 | 2.3239 / 4.2965 / 5.04207 ms |
| HTTP errors/timeouts | 0 |
| Correctness failures | 0; 1,111,724 checks passed |
| Dropped iterations | None reported |
| Bottleneck/query-plan evidence | `evidence/performance-diagnostics/KAN-85-diagnostic-20261106-113804-868/`; no concrete bottleneck justified |
| Optimization and equivalent repeat | No optimization implemented; comparison intentionally deferred |

The read-only EXPLAIN artifact reports **0.113 ms** execution, **72 shared
buffer hits**, zero shared reads, and no temporary I/O. The plan uses a
sequential scan of `study_slot` because the synthetic relation is tiny,
followed by nested-loop joins and indexed lookups on location, table, and
confirmed booking rows. The booking lookup uses
`booking_confirmed_resource_uk` and executes 12 times with zero matching
rows. The root estimate is 1 row versus 12 actual rows; this is a small-fixture
statistics effect, not evidence of a production bottleneck. The index artifact
also confirms the relevant location/date/status and booking-resource indexes.

The diagnostic fixture contained 12 owned slots and observed 24
`study_slot` rows before filtering. It is intentionally not representative of
production scale, and no index, pool-size, or cache change is justified from
this result. A future optional diagnostic could use a separate disposable
synthetic dataset of **50 locations × 20 tables × 14 days × 16 slots =
224,000 slots**, with approximately **22,400 confirmed bookings** (10% of
slots). These are explicitly labeled workload assumptions, not requirements.
This diagnostic was not executed and contributes no submitted performance
result.

## Next runnable procedure

1. Verify the shared roles already exist with an administrator, without
   altering their passwords, privileges, or attributes. Ensure the
   administrator can create one database and install `btree_gist`; the
   migrator can own the `campus_duo` schema; and Flyway is available.
2. From `backend`, run `npm run build`. Ensure `node`, `psql`, and k6 v2.3.0
   are installed separately and available on PATH.
3. From the repository root, prepare only the allowlisted database. The
   script refuses an existing target and does not drop or overwrite:

   ```powershell
   .\backend\scripts\performance\Invoke-Prepare-PerformanceDatabase.ps1 `
     -PerformanceDatabase campus_duo_perf_20261103
   ```

   It creates the database as `campus_duo_migrator`, installs `btree_gist`
   as an administrator, creates the migrator-owned `campus_duo` schema before
   Flyway, and runs Flyway with an explicit target URL rather than the
   development `flyway.toml` URL. Flyway history/checksums are preserved; the
   script does not manually replay migrations.
   
   The first attempted provisioning exposed a bootstrap issue: the database
   and extension were created, but `campus_duo` was absent while Flyway had
   `createSchemas=false` and history configured inside that schema, producing
   SQLSTATE `3F000`. That failed attempt is preserved as historical evidence.
   The target was subsequently verified read-only at
   `127.0.0.1:5432/campus_duo_perf_20261103` with owner
   `campus_duo_migrator`, eight successfully validated Flyway migrations, and
   application-role access. No destructive repair or blind migration replay
   was performed.

   Once the read-only diagnostic has passed every named structural check and
   the target's provenance has been confirmed, the separate initialized-empty
   history path is explicitly enabled with:

   ```powershell
   .\backend\scripts\performance\Invoke-Prepare-PerformanceDatabase.ps1 `
     -PerformanceDatabase campus_duo_perf_20261103 `
     -ResumeInitializedEmptyHistory
   ```

   This path re-queries the live target, reuses the compatibility evaluator,
   requires three interactive `YES` confirmations, preserves the existing
   empty Flyway table/indexes, and then runs normal versioned Flyway
   migrations. It is not enabled by `-ResumePartialTarget`.

   If resume reports `history state 'present:0'`, do not rerun it blindly.
   Run the read-only diagnostic instead:

   ```powershell
   .\backend\scripts\performance\Invoke-Diagnose-PerformanceDatabase.ps1 `
     -PerformanceDatabase campus_duo_perf_20261103
   ```

   The diagnostic reports the actual target identity, schema and ownership,
   extension state, application versus extension-owned objects, history
   relation type/owner/columns/constraints/indexes/rows/entries, and a
   structural initialized-but-unmigrated candidate result. That result does
   not establish provenance: an empty history table alone cannot prove that
   this database belongs to the experiment or that migrations were never
   applied and removed. The additional resume state remains disabled until
   the diagnostic output is reviewed and explicitly confirmed.

   A subsequent provisioning attempt did not produce a performance
   measurement: Flyway was invoked from the `database` working directory
   with an invalid relative migration location, so it validated zero
   migrations and reported the schema up to date; the script then reached
   an application-access check without an initialized `campus_duo_app`
   credential. This is recorded as a provisioning failure, not successful
   migration or performance evidence. The corrected script resolves the
   migration directory from its own location, requires V001-V008 to be
   present, fails on missing locations, verifies the complete successful
   history set and required application tables, and prompts separately
   for the application-role password before access validation.
4. The repository-root smoke and baseline wrappers were run manually:

   ```powershell
   .\Run-PerformanceSmoke.ps1
   ```

   The wrapper interactively requests the two disposable-role passwords,
   performs both database/role preflights, creates the exact fixture, starts
   the dedicated app on port 4400, runs k6, writes a unique evidence
   directory, stops only its app process, and attempts exact fixture cleanup.
5. Review the generated `run-metadata.json`, `k6-summary.json`,
   `k6-metrics.json`, app logs, and correctness/threshold outcome. The
   comparison wrapper is reserved for a changed implementation and is not an
   optimization experiment for the unchanged source.

The wrapper uses the loopback-only performance launcher, not `server.ts`.
Provisioning, smoke, baseline, and query-plan diagnostics are verified. No
optimization comparison should be run without a changed implementation and
equivalent workload evidence.
