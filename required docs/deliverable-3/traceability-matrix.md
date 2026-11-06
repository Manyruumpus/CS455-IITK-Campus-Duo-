# Final Traceability Matrix

The KAN mapping below is the live-verified mapping supplied by the user. It is
recorded locally without performing Jira writes. Legacy evidence filenames
retain historical KAN-79/KAN-81 labels where those files were already created;
the filename mismatch is explained rather than breaking references.

| Requirement | Jira | GitHub/commit | Test/evidence | Status |
|---|---|---|---|---|
| NFR-06 daily capacity model | KAN-85 | Performance harness files | `KAN-81-performance-load-report.md`; baseline is endpoint evidence, not a daily-capacity model | Partial |
| NFR-07 p95/throughput budgets | KAN-85 | Performance harness files | Smoke/baseline/query-plan evidence; numeric budget still requires approval | Partial |
| Booking adapter | KAN-74 | current worktree | Frontend remains mock-only; `UnavailableServiceAdapter` is explicit and no production adapter was added | Known limitation/future work |
| Requirements traceability | KAN-75 | current worktree | this matrix | Partial |
| Real system testing | KAN-76 | current worktree | API → PostgreSQL system evidence in `testing-report.md`, concurrency, recovery, and backend full-suite artifacts | Verified for selected API → PostgreSQL scope |
| Booking API implementation | KAN-74 | [PR #1](https://github.com/Manyruumpus/CS455-IITK-Campus-Duo-/pull/1), merged 15 October 2026 | backend booking API source and tests | Verified GitHub link |
| Booking conflict correctness | KAN-83 | [PR #2](https://github.com/Manyruumpus/CS455-IITK-Campus-Duo-/pull/2), commit `500f9e5d73e0a232113ba4ec27e643a53fd7a940` | `booking-concurrency-isolated.json` | Verified GitHub link |
| Availability correctness | KAN-71 | `b0db123` | `KAN-71-availability-fixed-run-*.json` | Verified |
| Runtime dependency security | KAN-70 | `b9807f5` | dependency before/after artifacts | Verified |
| Backend regression/coverage | KAN-81 | current dirty worktree; no remote link asserted | `evidence/backend-tests/current-full-suite-20261106-105802/`; `evidence/backend-coverage/current-full-suite-20261106-105802/` | Verified, 57/57 with current coverage |
| Frontend automated quality | KAN-72/KAN-73 | current worktree | 182 tests, typecheck, lint, build in this session | Verified locally |
| Adversarial tests | KAN-79 | current worktree | backend and mock-service adversarial cases | Partial |
| Security/threat model | KAN-78 | current worktree | `security-threat-model.md` | Partial |
| Five fixed defects | KAN-80 | current worktree | `defect-evidence-register.md` | Five strict local records; live Jira linkage unverified |
| Failure/restart recovery | KAN-86 | isolated loopback cluster | `failure-recovery-report.md`; `evidence/recovery/KAN-86-recovery-20261106-120945-805/` | Verified locally; production/hosted recovery not claimed |
| Deployment | KAN-87 | current worktree | `deployment-runbook.md` | Partial; local only |
| Costing | KAN-88 | current worktree | `costing.md` | Scenario estimate |
| Gantt | KAN-84 | current worktree | `timeline-gantt.svg` and `.csv` | Reconstructed/editable artifact |
| AI engineering log | KAN-77 | current worktree | `ai-engineering-log.md` | Reconstructed supplement |
| Jira dashboard/project report | KAN-82 | current worktree | `jira-status-report.md` | Mapping supplied; dashboard evidence pending |
