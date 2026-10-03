# Campus Duo — Initial Requirements Traceability Matrix

**Deliverable:** 1 | **Status:** Planned links, not execution evidence  
**Source:** `01-requirements-and-use-cases.md`, `02-architecture-and-design.md`  
**Last updated:** 23 September 2026 | **Owner:** TBD

Each row maps a requirement to a user story, design element, proposed Jira backlog item and future test. `TBD` is intentional: use actual Jira keys, PRs and results only after they exist. The backlog labels below are local planning IDs (`BL-xx`), **not Jira issue keys**.

| Requirement | Story | Architecture/design | Backlog | Planned verification | Actual Jira key | PR/commit | Test ID/result |
|---|---|---|---|---|---|---|---|
| FR-01 | US-01 | Auth and identity | BL-01 | Allowed-domain verification; unverified denial | TBD | TBD | TBD / Not run |
| FR-02 | US-01, US-07 | RBAC and admin guard | BL-02 | Student request to admin API denied | TBD | TBD | TBD / Not run |
| FR-03 | US-02, US-08 | Profile and safety | BL-03 | Hidden/blocked bilateral exclusion | TBD | TBD | TBD / Not run |
| FR-04 | US-03 | Scoring strategy, safe projections | BL-04 | Hand-computed scores, missing data, tie/reasons | TBD | TBD | TBD / Not run |
| FR-05 | US-04 | Match module | BL-05 | Reciprocal likes, repeat-like idempotence | TBD | TBD | TBD / Not run |
| FR-06 | US-07 | Admin inventory | BL-06 | Add/disable; unsafe removal blocked | TBD | TBD | TBD / Not run |
| FR-07 | US-05 | Booking unique active claim, ADR-004 | BL-07 | Simultaneous final-slot race; one durable claim | TBD | TBD | TBD / Not run |
| FR-08 | US-06 | Booking transaction/version | BL-08 | Target conflict/stale version preserves source | TBD | TBD | TBD / Not run |
| FR-09 | US-06 | Booking cancellation/outbox | BL-09 | Repeat cancel; slot rebooked once | TBD | TBD | TBD / Not run |
| FR-10 | US-09 | Agent allow-list and tool authorization | BL-10 | Injection cannot invoke write tool/private lookup | TBD | TBD | TBD / Not run |
| FR-11 | US-09 | Non-LLM fallback | BL-11 | Simulated inference outage keeps core workflows | TBD | TBD | TBD / Not run |
| FR-12 | US-10 | Audit/outbox | BL-12 | State transitions logged without secrets | TBD | TBD | TBD / Not run |
| FR-13 | US-08, US-10 | Safety/moderation | BL-13 | Report review permission and block effect | TBD | TBD | TBD / Not run |
| FR-14 | TBD (optional) | Messaging module only if approved | BL-14 | Unmatched send/read denied | TBD | TBD | TBD / Not run |
| FR-15 | TBD (deferred) | Separate future consent model | BL-15 | New approved scope and tests | TBD | TBD | TBD / Deferred |
| NFR-01 | US-05 | DB constraint, ADR-004 | BL-07 | Repeated concurrency tests with DB inspection | TBD | TBD | TBD / Not run |
| NFR-02 | US-01, US-07 | RBAC, booking ownership | BL-02 | Unauthorized and cross-user API tests | TBD | TBD | TBD / Not run |
| NFR-03 | US-03, US-09 | Safe projection, redaction | BL-10 | Hidden data absent in cards, agent and logs | TBD | TBD | TBD / Not run |
| NFR-04 | US-05, US-09 | Transaction failure path, fallback | BL-11 | DB/LLM failure injection | TBD | TBD | TBD / Not run |
| NFR-05 | All MVP stories | CI/testing plan | BL-16 | Coverage report; justify exclusions | TBD | TBD | TBD / Not run |
| NFR-06 | US-03, US-05 | Load-test harness | BL-16 | 100 DAU/250 transactions/day baseline model | TBD | TBD | TBD / Not run |
| NFR-07 | US-03, US-05 | Performance budget TBD | BL-16 | p95 and throughput under agreed workload | TBD | TBD | TBD / Not run |
| NFR-08 | US-10 | Audit/outbox | BL-12 | Event correlation/retention test | TBD | TBD | TBD / Not run |
| NFR-09 | US-05, US-06 | Fixed slots and timezone | BL-07 | Boundary-date and slot-identity checks | TBD | TBD | TBD / Not run |
| NFR-10 | All UI stories | UI review checklist | BL-17 | Approved accessibility checks | TBD | TBD | TBD / Not run |

## Maintenance rules

1. Confirm the actual Jira project key; create issues and replace `BL-xx` with real keys in the corresponding column while retaining planning labels if useful.
2. Link Jira issue → branch with key → commit(s) → reviewed PR → automated test ID → run/result. Only mark a row verified after evidence exists.
3. Changes to a requirement update story, architecture/ADR, issue and tests together; record date and reviewer.
4. At minimum maintain real end-to-end evidence for critical FR-01 through FR-13 as implementation proceeds; do not fabricate completed results in Deliverable 1.

**Review/sign-off:** TBD.
