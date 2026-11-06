# Campus Duo — CS455 Deliverable 3 Submission Index

**Checkpoint:** 6 November 2026  
**Repository:** `Manyruumpus/CS455-IITK-Campus-Duo-`  
**Branch at checkpoint:** `fix/d3-backend-dependency-security`  
**HEAD at checkpoint:** `b9807f5e773892ce955bca417cc21ae68eb6e67e`  
**Worktree:** dirty; current-revision evidence is explicitly labeled.

This index maps the required submission areas to the strongest local evidence
available at this checkpoint. It does not claim live Jira state, hosted
deployment, performance measurements, or infrastructure recovery where those
were not executed.

| # | Requirement | Status | Primary artifact/evidence |
|---:|---|---|---|
| 1 | Unit, integration, system, adversarial testing | COMPLETE for selected API → PostgreSQL scope | Backend API → PostgreSQL system evidence plus unit/integration/adversarial evidence; frontend is mock-only and KAN-74 records the limitation |
| 2 | Code coverage | COMPLETE locally | `coverage-report.md`; current KAN-81 backend and frontend V8 artifacts |
| 3 | Concurrency | COMPLETE | `concurrency-report.md`; `evidence/backend-tests/booking-concurrency-isolated.json` |
| 4 | Security/threat model | PARTIAL | `security-threat-model.md` |
| 5 | Performance/load and optimization | PARTIAL | KAN-85 smoke/baseline/query-plan evidence at the tested 12-slot, 1/10-VU, 180-second scale; no optimization claim or representative-scale run |
| 6 | Failure/recovery | COMPLETE locally | `failure-recovery-report.md`; approved isolated outage/restart, reconnection, durable replay, audit/outbox, timing, and exact cleanup |
| 7 | Jira defect history | UNVERIFIED | `jira-status-report.md`; live Jira not locally verifiable |
| 8 | Five fixed defects | COMPLETE locally | `defect-evidence-register.md`; five independently supported strict local records |
| 9 | Costing | PARTIAL | `costing.md`; provider/region pricing remains pending |
| 10 | Timeline/Gantt | PARTIAL | `timeline-gantt.md`; status sequence, not a fully rendered Gantt |
| 11 | Deployment documentation | PARTIAL | `deployment-runbook.md`; local procedure, no hosted deployment proof |
| 12 | Requirements-to-Jira-to-GitHub-to-testing traceability | PARTIAL | `traceability-matrix.md`; PR #1 and PR #2 verified, Jira writes/statuses remain external |
| 13 | Jira dashboard/project report | UNVERIFIED | `jira-status-report.md`; draft layout only |
| 14 | AI Engineering Log | PARTIAL | `ai-engineering-log.md`; reconstructed local supplement |

## Current verification

- Frontend: 17 files, 182 tests passed; typecheck, lint, and production build
  passed on 6 November 2026.
- Backend build passed on 6 November 2026.
- Backend mocked/unit subset: 4 files, 29/29 passed.
- Backend isolated health integration: 1/1 passed with explicit
  `campus_duo_test` targeting.
- Full DB-backed backend rerun: 9/9 files and 57/57 tests passed with exit
  code 0; current evidence is preserved under
  `evidence/backend-tests/current-full-suite-20261106-105802/`.
- Frontend coverage: 17 files / 182 tests passed; 57.34% statements, 47.72%
  branches, 43.35% functions, 59.09% lines; native artifacts preserved.
- Performance: target verification, smoke, baseline, and read-only query-plan
  diagnostics passed at the tested 12-slot, 1/10-VU, 180-second scale. No
  optimization was implemented or claimed; the optional representative-scale
  diagnostic was not run.
- Recovery: approved isolated run passed with 503 outage behavior,
  post-restart health/reconnection, durable replay, audit/outbox counts,
  local timing, and exact cleanup at
  `evidence/recovery/KAN-86-recovery-20261106-120945-805/`.
- Normal startup: `npm start` launched `dist/src/server.js` and returned a
  healthy response on the isolated database; the deployment runbook now
  reflects the actual build output.
- Credential-free adversarial subset: 4 files and 29/29 tests passed.
  Database-backed policy tests remain credential-dependent; the earlier full
  backend checkpoint is the authoritative 57/57 result.

## External/manual actions still required

1. Run the final secure backend checkpoint manually after all changes.
2. Obtain authoritative Jira issue/dashboard/project evidence and apply the
   approved defect/status writes.
3. Provide the submission portal, authenticate, and upload the validated packet.
