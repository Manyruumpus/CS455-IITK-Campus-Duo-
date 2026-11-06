# Deliverable 3 Coverage Report

## Backend

Source: `evidence/backend-coverage/current-full-suite-20261106-105802/` (KAN-81).

| Metric | Result |
|---|---:|
| Statements | 89.91% |
| Branches | 85.71% |
| Functions | 82.50% |
| Lines | 90.57% |

This current full-suite evidence belongs to KAN-81 and covers 9/9 test files
and 57/57 tests with exit code 0. The earlier post-review checkpoint remains
preserved as historical evidence.

The denominator is the backend TypeScript source selected by the Vitest V8 configuration. This report does not merge frontend mock coverage into backend percentages.

On 6 November 2026, the explicitly isolated mocked/unit subset passed 29/29 and produced a **subset-only** V8 result in the ignored local artifact `backend/coverage/coverage-summary.json`: statements 60.88%, branches 63.69%, functions 42.50%, and lines 61.88%. This is not comparable to the full 57-test checkpoint because database-backed suites were not executed.

## Frontend

On 6 November 2026, the frontend coverage run passed with 17 files and 182
tests. Native V8 artifacts are preserved at
`evidence/frontend-coverage/KAN-81-frontend-coverage-20261106-102240/`, including
`coverage-final.json`, `clover.xml`, and the HTML report.

| Metric | Result |
|---|---:|
| Statements | 57.34% (1900/3313) |
| Branches | 47.72% (1469/3078) |
| Functions | 43.35% (411/948) |
| Lines | 59.09% (1820/3080) |

The frontend scope remains mock-service/component focused; production API
integration is unavailable by design.

The matching local dev dependency `@vitest/coverage-v8@5.0.3` was installed
for the installed Vitest `5.0.3`; the frontend package lock was updated.

## Limitations

Coverage percentages do not prove browser layout, PostgreSQL restart recovery, production authentication, or load performance. Excluded/blocked areas are listed in `testing-report.md`.
