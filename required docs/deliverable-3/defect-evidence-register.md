# Defect and Weakness Evidence Register

Only supported cases are listed; harness mistakes and unexecuted hypotheses are excluded.

| Case | Impact | Before/reproduction | Fix/retest evidence | Jira/Git reference |
|---|---|---|---|---|
| Runtime dependency vulnerabilities | High security exposure | Dependency audit baseline showed vulnerable runtime packages | Dependency patch and after-audit artifacts | KAN-70, `b9807f5` |
| Availability tests depended on seed dates | Medium false failures | Valid tests requested 2026-11-14 while seeded slots were 2026-11-11 | Owned deterministic fixture, date/location isolation, retained seven tests | KAN-71, `b0db123` |
| Booking concurrency cleanup could overlap fixtures | High test contamination risk | Shared/prefix cleanup could remove another run’s rows | Disjoint fixture ranges and scoped cleanup evidence | KAN-36, `500f9e5` |
| Test target/credential safety was weak | High data-integrity risk | Tests could point at development DB or run without explicit migrator credential | Exact `campus_duo_test`/role guards and fail-closed password checks | Current helper changes; post-review evidence |
| Performance provisioning accepted zero migrations | High false-success risk | Relative Flyway location resolved to `database\\database\\migrations`, then app password was unset | Absolute path, V001–V008 inventory, fail-on-missing, history/table completion checks, separate app password | Current performance harness changes; runtime retest pending |
| Performance/normal launcher used the wrong built entry point | Smoke checkpoint could not load the application because the build emitted `backend\\dist\\src\\app.js`, while the launcher/import and normal `npm start` path targeted `dist\\app.js`/`dist\\server.js` | Pre-fix `app.stderr.log` records `Cannot find module ...\\backend\\dist\\server.js`; `loopback-server.js` now imports `../../dist/src/app` and `../../dist/src/config/db`; `backend/package.json` now starts `dist/src/server.js`; smoke, baseline, recovery, and a fresh `npm start` health check passed | KAN-85; current dirty worktree; native smoke/baseline/recovery evidence |
| Performance launcher split a spaced script path | Smoke checkpoint could not start the application from this repository path; Node received `C:\Users\mohit\OneDrive\Desktop\sem` instead of the complete launcher path | `Start-Process -ArgumentList $launcher` reproduced the split; explicit quoting now preserves the launcher boundary; credential-free regression evidence is written under `evidence/performance/process-argument-regression/` | KAN-85 |
| Runtime privilege boundary | High authorization impact | Broad/implicit access would violate migration/runtime separation | V008 explicit role/table grants and privilege verification scripts | V008, DB-07 evidence |

The wrong-entry-point and spaced-argument records are independent defects:
the first selects a nonexistent build artifact, while the second changes
argument tokenization before Node starts. They are not double-counted. The
performance provisioning defect is also separate. Five strict local defect
records are now supported for KAN-80 when the first four historical records
are combined with the wrong-entry-point record; the spaced-argument record is
an additional KAN-85 harness defect. Live Jira status and external linkage
remain unverified.

