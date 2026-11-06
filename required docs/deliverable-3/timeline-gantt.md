# Timeline and Gantt Evidence

Actual dates below come from repository evidence; unexecuted work is marked pending rather than backdated.

The rendered artifact is `timeline-gantt.svg`; its editable source is
`timeline-gantt.csv`. Owners are marked `not recorded` where the repository
does not preserve an authoritative assignment. Rows marked reconstructed are
planning reconstruction, not native project-management exports.

| Work | Dates | Owner | Dependencies | Status |
|---|---|---|---|---|
| Booking API and concurrency isolation | 14–15 Oct 2026 | not recorded | booking implementation | Fixed and evidenced |
| Dependency remediation | 3 Nov 2026 | not recorded | dependency audit | Fixed and audited |
| Availability fixture isolation | 3 Nov 2026 | not recorded | backend fixtures | Fixed and evidenced |
| Backend post-review tests/coverage | 3 Nov 2026 | not recorded | backend implementation | Verified historical checkpoint |
| Frontend quality and coverage | 6 Nov 2026 | Copilot-assisted, user-controlled | frontend test suite | Verified locally |
| Performance/load/optimization | 6 Nov 2026 | not recorded | credentials, target database | Baseline/query-plan verified; optimization not implemented |
| Isolated PostgreSQL recovery | 6 Nov 2026 | Copilot-assisted, approved | recovery cluster, interruption approval | Verified locally; hosted/production recovery not claimed |
| Jira/dashboard/traceability synchronization | 6 Nov 2026 | not recorded | Jira read/export access | Mapping supplied; external evidence pending |
| Submission packaging | 6 Nov 2026, 23:59 deadline | not recorded | all evidence reconciliation | Pending approval |

## Remaining sequence

```text
Credentials + target preflight
        -> migration validation
        -> smoke + baseline
        -> query-plan review (no justified optimization)
        -> isolated outage/restart verification
        -> final external Jira/GitHub evidence and submission review
```

