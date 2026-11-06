# Deliverable 3 Evidence Index

**As of:** 6 November 2026  
**Repository:** `Manyruumpus/CS455-IITK-Campus-Duo-`  
**Worktree:** dirty; unrelated frontend/generated command-like artifacts are intentionally excluded.

## Verified

- Backend: 57/57 tests across 9/9 files passed with exit code 0; current evidence is in `evidence/backend-tests/current-full-suite-20261106-105802/`.
- Backend coverage (KAN-81): statements 89.91%, branches 85.71%, functions 82.50%, lines 90.57%; see `evidence/backend-coverage/current-full-suite-20261106-105802/`.
- Frontend: 17 files, 182 tests passed on 3 November 2026; typecheck, lint, and production build passed in this session.
- Backend build passed in this session.
- Current backend mocked/unit subset: 29/29 passed; isolated health integration:
  1/1 passed with explicit `campus_duo_test` targeting. Current evidence is in
  `evidence/backend-tests/current-mocked-unit-check-20261106.json` and
  `evidence/backend-tests/current-health-isolated-20261106.json`.
- Dependency before/after artifacts: `evidence/dependency-audit/`.
- Concurrency and availability evidence: `evidence/backend-tests/booking-concurrency-isolated.json`, `KAN-71-availability-fixed-run-1.json`, and `KAN-71-availability-fixed-run-2.json`.

## Partial or blocked

- Real performance provisioning, smoke, and baseline: verified with native evidence; no optimization was implemented or claimed.
- Browser/system integration: frontend defaults to mock services or an unavailable production adapter; no browser binary was installed and no real UI-to-PostgreSQL journey is claimed.
- PostgreSQL restart recovery: verified on the isolated loopback cluster; hosted/production recovery is not claimed.
- Jira dashboard/project status, live issue links, and Jira-GitHub integration: repository state is unverified and no external writes were made.
- Existing draft packet preserved as `submission-packet-20261106.zip`.
- Verified replacement packet: `submission-packet-20261106-replacement.zip`;
  checksum: `submission-packet-20261106-replacement.zip.sha256`.

## Reports

| Artifact | Scope |
|---|---|
| `testing-report.md` | Unit, integration, system, adversarial scope and results |
| `coverage-report.md` | Backend coverage denominators and frontend test scope |
| `concurrency-report.md` | Real PostgreSQL booking race evidence |
| `security-threat-model.md` | Threats, controls, residual risks |
| `KAN-81-performance-load-report.md` | Harness, baseline, query-plan findings, and bounded follow-up |
| `failure-recovery-report.md` | Isolated recovery evidence and limitations |
| `defect-evidence-register.md` | Supported defect/weakness history |
| `costing.md` | Local sunk cost, hosted cost assumptions, unverified estimates |
| `timeline-gantt.md` | Actual evidence dates and remaining planned work |
| `deployment-runbook.md` | Local setup, migration, startup and rollback procedure |
| `traceability-matrix.md` | Requirement → Jira → GitHub → test → evidence |
| `jira-status-report.md` | External-record status and no-write limitation |
| `ai-engineering-log.md` | Deliverable 3 AI activity supplement |
