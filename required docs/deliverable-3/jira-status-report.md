# Jira Dashboard and Project Status Report

## Supplied live mapping

The following KAN associations were supplied as live-verified by the user and
are recorded here without external writes:

| Key | Area |
|---|---|
| KAN-72 / KAN-73 | duplicate frontend-testing tasks |
| KAN-74 | booking adapter |
| KAN-75 | traceability |
| KAN-76 | system testing |
| KAN-77 | AI engineering log |
| KAN-78 | security |
| KAN-79 | adversarial tests |
| KAN-80 | five-defect history |
| KAN-81 | backend coverage |
| KAN-82 | dashboard/project report |
| KAN-83 | concurrency |
| KAN-84 | Gantt |
| KAN-85 | performance/load/optimization |
| KAN-86 | recovery |
| KAN-87 | deployment |
| KAN-88 | costing |

Existing evidence filenames containing KAN-79/KAN-81 are preserved because
they are historical artifacts. The traceability matrix maps their current
meaning to the supplied issue associations without renaming or breaking paths.

## Repository-verifiable status

The repository contains planning Jira labels and local defect references, but no verified live Jira issue export, dashboard configuration, project key confirmation, or Jira-GitHub Development-panel evidence. No Jira writes were performed.

Read-only GitHub inspection verified two related development records:
[PR #1](https://github.com/Manyruumpus/CS455-IITK-Campus-Duo-/pull/1),
merged 15 October 2026, titled `feat(booking): implement PostgreSQL booking API`;
and [PR #2](https://github.com/Manyruumpus/CS455-IITK-Campus-Duo-/pull/2),
merged 15 October 2026, titled `test(KAN-36): isolate booking concurrency tests`,
with head commit `500f9e5d73e0a232113ba4ec27e643a53fd7a940`. This confirms
GitHub history for backend/concurrency work but does not verify the
corresponding Jira issues or any other local `KAN-*` reference.

## Draft dashboard layout

| Gadget/report | Data needed |
|---|---|
| Defects by status/severity | Live project key and issue statuses |
| Requirements traceability | Actual issue keys linked to requirements |
| Sprint burn-up | Actual sprint dates, estimates and assignees |
| GitHub development links | Real issue-key branch/commit/PR links |
| Test evidence | Evidence paths and execution timestamps |

## Required human/external actions

Use the supplied mapping for read-only reconciliation, verify issue status and
dashboard gadgets from a Jira export or connector response, and attach the
evidence paths only after approval. No Jira write has been performed. Do not
treat local `KAN-*` filenames or `BL-*` planning IDs as independent proof of
live issue state.

## Prepared local drafts

`jira-drafts-20261106.md` contains approval-gated draft updates for KAN-80
(five locally supported defect records), KAN-85 (passing baseline and
query-plan findings with no optimization claim), and KAN-86 (isolated outage
and verified post-restart evidence with local-synthetic limitations). These are local
drafts only; no external issue, status, comment, or dashboard was changed.
