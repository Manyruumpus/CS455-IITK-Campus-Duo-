# Deliverable 3 Checkpoint Provenance

**Timestamp:** 6 November 2026, local checkpoint  
**Branch:** `fix/d3-backend-dependency-security`  
**HEAD:** `b9807f5e773892ce955bca417cc21ae68eb6e67e`  
**Worktree:** dirty; uncommitted source, tests, scripts, reports, and evidence
remain present.

## Commands and outcomes

| Command/scope | Outcome |
|---|---|
| `Set-Location backend; npm run build` | PASS |
| `Set-Location frontend; npm test` | PASS, 17 files / 182 tests |
| `Set-Location frontend; npm test -- --coverage` | PASS, 17 files / 182 tests; 57.34% statements, 47.72% branches, 43.35% functions, 59.09% lines |
| `Set-Location frontend; npm run typecheck` | PASS |
| `Set-Location frontend; npm run lint` | PASS; generated coverage output excluded |
| `Set-Location frontend; npm run build` | PASS; Vite chunk-size warning |
| Backend mocked/unit subset | PASS, 4 files / 29 tests |
| Backend health with explicit `campus_duo_test` | PASS, 1 test |
| Backend full coverage checkpoint | PASS; 9 files, 57/57 tests, exit code 0; 89.91% statements, 85.71% branches, 82.50% functions, 90.57% lines; evidence preserved under `evidence/backend-tests/current-full-suite-20261106-105802/` and `evidence/backend-coverage/current-full-suite-20261106-105802/` |
| Frontend coverage | PASS; native V8 report preserved under `evidence/frontend-coverage/KAN-81-frontend-coverage-20261106-102240/` |
| Performance target probe | BLOCKED; PostgreSQL requires administrator credential |
| Performance provisioning | BLOCKED; migrator/administrator/application credentials not entered |
| Performance compatibility/helper static checks | PASS |

## Tool availability

- Node: available, `v24.12.0`
- k6: available
- PostgreSQL server: reachable at `127.0.0.1:5432` but credential-gated
- psql: installed at `C:\Program Files\PostgreSQL\18\bin\psql.exe`, not on PATH
- Flyway: available at `C:\Users\mohit\Tools\flyway-13.10.0\flyway.cmd`; version 13.10.0
- Docker: not available
- PostgreSQL isolated-cluster binaries: `initdb`, `pg_ctl`, `createdb`, and
  `createuser` available under the PostgreSQL 18 installation

## Evidence limitations

Historical successful test and coverage artifacts do not contain a source
commit identifier. They are retained as historical evidence and are not
relabelled as clean-HEAD results. No secrets, `.env` values, external Jira
state, hosted deployment state, or Perplexity conversations were inspected.

## Read-only GitHub evidence

GitHub read access verified merged PR
`https://github.com/Manyruumpus/CS455-IITK-Campus-Duo-/pull/2`, titled
`test(KAN-36): isolate booking concurrency tests`, and commit
`500f9e5d73e0a232113ba4ec27e643a53fd7a940`. The local branch HEAD was not
present on GitHub under that SHA, so local worktree changes remain
unpublished/unverified externally.
