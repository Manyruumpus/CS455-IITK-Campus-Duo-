# Jira Update Drafts — 6 November 2026

No external Jira writes were performed because this CLI has no Jira connector.
The following is the exact write list for manual application, with evidence
paths and status changes limited to verified claims.

## Create five child defects under KAN-69

Create each as a bug linked to parent KAN-69. Set status to the project’s
verified fixed/closed equivalent only after attaching the listed evidence and
the real commit/PR link; otherwise leave it in the project’s review state.

1. **Runtime dependency vulnerabilities**
   - Evidence: `evidence/dependency-audit/backend-production-before.json`,
     `evidence/dependency-audit/backend-production-after-compatible-fix.json`
   - Fix reference: local commit `b9807f5`; no remote link asserted.
2. **Availability fixtures depended on seed dates**
   - Evidence: `evidence/backend-tests/KAN-71-availability-fixed-run-1.json`,
     `evidence/backend-tests/KAN-71-availability-fixed-run-2.json`
   - Fix reference: local `b0db123`; no remote link asserted.
3. **Concurrency fixture cleanup could overlap runs**
   - Evidence: `evidence/backend-tests/booking-concurrency-isolated.json`
   - Fix reference: [PR #2](https://github.com/Manyruumpus/CS455-IITK-Campus-Duo-/pull/2),
     commit `500f9e5d73e0a232113ba4ec27e643a53fd7a940`.
4. **Test target and credential safety was weak**
   - Evidence: `evidence/backend-tests/current-full-suite-20261106-105802/`,
     `evidence/backend-tests/current-health-isolated-20261106.json`,
     `evidence/backend-tests/current-mocked-unit-check-20261106.json`
   - Fix reference: current dirty worktree; final commit/PR link pending.
5. **Normal/performance launcher selected the wrong built entry point**
   - Evidence: historical `app.stderr.log` failure under the KAN-85 smoke
     evidence; passing smoke, baseline, recovery, and normal-start health
     evidence; `evidence/recovery/KAN-86-recovery-20261106-120945-805/`
   - Fix reference: current dirty worktree; final commit/PR link pending.

The spaced-process-argument defect is independently supported under KAN-85 and
must not be counted as one of these five KAN-69 children or merged with the
entry-point defect.

## Duplicate closure

- **KAN-72 / KAN-73:** close one as duplicate of the surviving frontend-testing
  issue, using the project’s actual duplicate workflow. Comment:
  “Duplicate frontend-testing tracking item. Retain the surviving issue as the
  authoritative record; the Deliverable 3 local evidence is 17 files / 182
  tests with typecheck, lint, build, and frontend coverage under
  `required docs/deliverable-3/evidence/frontend-coverage/`.”
- Do not close both issues and do not mark either Done solely from local
  documentation.

## Evidence-backed status updates

- **KAN-74:** leave open/limited; frontend production adapter is not
  implemented. Record this as a known limitation/future work item.
- **KAN-76:** mark verified only for the selected API → PostgreSQL system scope,
  with `testing-report.md` and backend/recovery evidence attached.
- **KAN-79:** mark verified only for the executed adversarial/backend scope;
  do not imply browser or production-authentication coverage.
- **KAN-81:** attach backend 57/57 and coverage artifacts; mark local evidence
  verified.
- **KAN-82:** leave open; no dashboard was created.
- **KAN-85:** attach smoke, baseline, and query-plan evidence; state no
  optimization was implemented and the result is limited to the tested scale.
- **KAN-86:** attach isolated recovery evidence; state hosted recovery is not
  claimed.
- **KAN-87:** attach local deployment evidence; do not mark hosted deployment
  complete.
- **KAN-88:** attach dated assumptions and calculations; do not represent them
  as provider quotations or actual spend.

## KAN-85 — performance/load

**Draft update:** Target verification, smoke, 180-second baseline, and
read-only availability query-plan diagnostics passed. Baseline evidence is
preserved at the recorded native and wrapper paths. The plan shows 0.113 ms,
72 shared hits, zero reads, and no concrete bottleneck on the 12-slot
synthetic fixture. No optimization was implemented; the unchanged comparison
wrapper is intentionally not being run as an optimization experiment.

## KAN-86 — recovery

**Draft update:** An isolated loopback PostgreSQL outage returned HTTP 503,
the disposable cluster restarted, and application logs recorded the expected
connection reset. The approved follow-up then verified post-restart health,
durable booking, replay/idempotency, audit/outbox counts, 1,157.8673 ms local
restart-command timing, and exact cleanup. This remains local synthetic
evidence; hosted/production recovery is not claimed.
