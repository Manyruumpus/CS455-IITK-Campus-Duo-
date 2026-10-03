# Campus Duo — Project Setup, Initial Backlog and Sprint Plan

**Deliverable:** 1 | **Status:** Setup plan; verify each checkbox before claiming completion  
**Baseline:** `main_proposal.md` | **Last updated:** 23 September 2026  
**Project owner/team:** TBD | **Jira project key:** TBD

## 1. Project links and setup evidence

- Proposal-listed repository: [CS455-IITK-Campus-Duo](https://github.com/Manyruumpus/CS455-IITK-Campus-Duo-).
- Proposal-listed Jira workspace: [Campus Duo Jira](https://mohitpariharsworkspace-43776135.atlassian.net/?continue=https%3A%2F%2Fmohitpariharsworkspace-43776135.atlassian.net%2Fwelcome%2Fsoftware%3FprojectId%3D10000&atlOrigin=eyJpIjoiN2VmYmNkODIwNTdhNDFmYzkyYjgxYzFhMzFkNDVhZGIiLCJwIjoiamlyYS1zb2Z0d2FyZSJ9).


| Item | Required action | Evidence to record | State |
|---|---|---|---|
| Proposal authorization | Confirm instructor approval and any scope change. | Approval reference/date. | Unverified |
| GitHub ownership | Confirm correct repository, members, default branch and permissions. | Repository URL, screenshot or access test/date. | Unverified |
| Jira project | Confirm correct project key, board, issue types and workflow. | Direct project URL, key, board screenshot/date. | Unverified |
| Staff access | Invite instructor/assigned TAs to appropriate GitHub and Jira roles; confirm acceptance. | Names/roles and confirmation date, no credentials. | Unverified |
| Jira–GitHub link | Install/configure the supported integration and authorize repository. | Jira development panel shows real branch/commit/PR linked by actual issue key. | Unverified |
| Repo layout | Add `Deliverables/`, application dirs and reviewed contributing guidance. | Commit/PR reference. | Unverified |
| Branch policy | Decide issue-key branch/commit conventions and PR reviewer. | Repository rule or contributing document link. | Unverified |
| CI | Set test/lint/coverage workflow when code exists. | Workflow run link; not required to claim now. | Planned |
| Submission | Upload D1 to Hello IITK and commit documents in `Deliverables/` before deadline. | Submission receipt and commit SHA. | Pending |

**How to verify Jira–GitHub integration:** create a real Jira issue, use its confirmed issue key in a test branch/commit or PR, then check that the issue's Development panel links the expected GitHub artifact. Record actual key/URL and who checked it. Merely installing an app is not proof of working integration.

## 2. Initial Jira backlog

`BL-*` are temporary document IDs; create real Jira issues with priority, story points/estimate and named assignee after the team agrees. Suggested order captures dependencies, not proof of work.

| Plan ID | Type / priority | Issue to create | Done when | Dependencies |
|---|---|---|---|---|
| BL-01 | Story / Must | Verify student email and protect student APIs. | FR-01 acceptance tests pass. | Verification provider choice. |
| BL-02 | Story / Must | Student/admin route RBAC and resource authorization. | FR-02 and NFR-02 denial tests pass. | BL-01. |
| BL-03 | Story / Must | Profiles, discovery opt-in and block filtering. | FR-03 tests pass. | BL-01. |
| BL-04 | Story / Must | Deterministic candidate score and permitted reasons. | FR-04 fixtures pass. | BL-03; score map sign-off. |
| BL-05 | Story / Must | Mutual likes, single active match and safe retry. | FR-05 tests pass. | BL-01, BL-03. |
| BL-06 | Story / Must | Admin-managed space/table/slot lifecycle. | FR-06 tests pass. | BL-02; slot policy. |
| BL-07 | Story / Must | DB uniqueness and book slot with idempotency. | FR-07 race passes on intended DB. | BL-05, BL-06; ADR-004. |
| BL-08 | Story / Must | Atomic versioned reschedule. | FR-08 conflict/failure tests pass. | BL-07. |
| BL-09 | Story / Must | Idempotent cancellation and slot release. | FR-09 retry/rebooking tests pass. | BL-07. |
| BL-10 | Story / Must | Agent with read-only tool allow-list and privacy tests. | FR-10 tests pass. | BL-04, BL-05, BL-06. |
| BL-11 | Task / Must | LLM outage fallback and failure injection. | FR-11 tests pass. | BL-04, BL-10. |
| BL-12 | Task / Must | Audit/outbox with redacted metadata. | FR-12 tests pass. | BL-07 and policy decisions. |
| BL-13 | Story / Must | Reporting, blocking and moderation review. | FR-13 tests pass. | BL-02, BL-03. |
| BL-14 | Story / Should | Optional match-only messaging. | FR-14 tests pass, only if scheduled. | BL-05. |
| BL-15 | Epic / Could | Social mode: separate approval and scope. | New requirements approved; otherwise defer. | None; out of MVP. |
| BL-16 | Task / Must | CI, coverage, load and concurrency harness. | Executed runs and thresholds documented. | Implementation milestones. |
| BL-17 | Task / Should | UI accessibility/usability checklist. | Agreed criteria checked. | UI flow available. |
| BL-18 | Spike / Must | Choose database and validate transactional deployment. | ADR-004 signed with race/failure test plan and cost. | Before BL-07. |
| BL-19 | Task / Must | Finalize D1 docs, diagrams, traceability and AI log. | Reviewed and submitted files plus submission receipt. | Instructor approval and decisions. |

Recommended Jira issue fields: issue key, story, linked FR/NFR IDs, priority, owner, estimate, acceptance criteria, status, dependency, and links to PR/tests. Create epic(s) for Identity/Discovery, Booking, Admin/Safety, Agent and Quality as helpful; no fake keys.

## 3. Initial sprint plan

**Planning status:** proposal, not a claimed active Jira sprint.  
**Suggested Sprint 0:** D1 planning/architecture through 26 September 2026, 11:59 PM local time.  
**Suggested Sprint 1:** first implementation slice after D1, ending before D2 on 15 October 2026. Team must set actual dates, capacity and ownership in Jira.

| Sprint | Goal | Proposed issue scope | Exit evidence |
|---|---|---|---|
| Sprint 0 | Approved, testable baseline and working project tracking. | BL-19, BL-18 planning, create backlog issues, verify integration and access. | Reviewed D1 Markdown, ADR/open decisions, actual Jira backlog, staff access and integration proof. |
| Sprint 1 | First end-to-end authenticated discovery/match and safe booking skeleton. | BL-01, BL-02, BL-03, BL-04, BL-05, BL-06, BL-07, BL-18; commit only capacity that team can estimate. | Reviewed PRs and passing unit/integration/race tests on selected DB; remaining tasks carried forward transparently. |
| Next sprint | Safe booking lifecycle, agent and security/failure evidence. | BL-08 through BL-13, BL-16 and selective BL-17. | Demonstrable tests/links; plan revised based on actual velocity. |

**Capacity/ownership table (fill at planning):**

| Person | Availability (hours) | Assigned Jira keys | Estimate | Confirmation |
|---|---:|---|---:|---|
| TBD | TBD | TBD | TBD | TBD |

**Cadence:** planning → short check-ins with Jira updates → PR review by another teammate → review/demo against acceptance criteria → retrospective and carryover. Only mark done on evidence; link each completed issue to its branch, reviewed PR and passing test. D1 date and D2 date are from the proposal and should be rechecked against announcements.

## 4. Decisions and readiness checklist

- [ ] Instructor approval captured; team and TA access accepted.
- [ ] Jira direct project URL/key, board and real initial issues captured.
- [ ] Jira–GitHub link verified by an issue-key artifact in Jira Development panel.
- [ ] ADR-004 database choice signed after hosting/transaction feasibility check.
- [ ] Scoring maps, slot duration, booking authority, cancellation/block policy and target metrics approved.
- [ ] Each sprint issue has owner, estimate, acceptance criteria and dependencies.
- [ ] D1 deliverables committed to repository and submitted through required channel.

**Evidence / decision log:** TBD. Add actual URLs, dates and reviewers here after verification.
