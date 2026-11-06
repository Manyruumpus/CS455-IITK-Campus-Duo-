# Campus Duo — Deliverables 2 & 3 Final Submission Readiness Checklist

**Course:** CS455 Software Engineering, IIT Kanpur  
**Project:** Campus Duo  
**Submission Deadline:** November 6, 2026, 23:59:59 IST  
**Audit Date:** November 5, 2026  
**Auditor:** Quality Assurance & Project Governance  
**Status:** READY FOR SUBMISSION (All Mandatory Deliverables Complete & Audited)  

---

## 1. Deliverable 2 (D2) Acceptance Checklist

| # | D2 Requirement Description | Compliance Status | Verified Evidence Location |
|---|---|---|---|
| 1 | Working GitHub repository with implementation code | **FULLY MET** | Git tree on `feat/KAN-49-d2-integration` (Commits `8fdea92`, `4ac3952`, `c8d80db`, `f4ee132`). |
| 2 | Governed Agentic AI assistant integration | **FULLY MET** | `backend/src/routes/agent.ts`, `backend/src/services/agentService.ts`, `backend/src/services/scoringEngine.ts`. |
| 3 | README and API documentation | **FULLY MET** | `Readme.md`, `backend/README.md`, `Deliverables/D2/API_Documentation.md`. |
| 4 | Consolidated AI Engineering Log | **FULLY MET** | `Deliverables/D2/AI_Engineering_Log.md` (Entries AIL-001 through AIL-006). |
| 5 | Jira sprint board and development history | **FULLY MET** | `Deliverables/D3/Jira_Project_Evidence.md`, sprint plan in `required docs/04`. |
| 6 | Jira issues linked to branches, commits, PRs | **FULLY MET** | `Deliverables/D3/Final_Traceability_Matrix.csv` (KAN-35, KAN-49, KAN-45). |
| 7 | Evidence of peer code reviews | **FULLY MET** | `Deliverables/D2/Peer_Review_Evidence.md` (Internal peer reviews PR-001 to PR-004 documented; formal external TA review pending). |
| 8 | Updated requirements traceability matrix | **FULLY MET** | `Deliverables/D2/Requirements_Traceability_D2.csv` (All 9 deliverable artifacts tracked; functional FR-03 flagged as partially met per DEC-08). |
| 9 | Core transactional workflow demonstration | **FULLY MET** | `Deliverables/D2/Transactional_Demo_Guide.md` (10-step curl verification script). |

### D2 Deliverable & Scope Reconciliation:
- **Deliverable Package Status:** All 9 required D2 deliverable artifacts are 100% complete and verified on disk.
- **Functional Requirements Scope Reconciliation:** While the D2 deliverable artifact package is complete, functional requirement **FR-03 (Bilateral Blocking / Student Privacy Controls)** is **PARTIALLY MET**. The database schema (`campus_duo.student_block`) and query filtering are implemented in backend migrations, but end-user blocking management UI was formally deferred under architectural decision **DEC-08/D3** to prioritize core booking concurrency and OTP authentication.
- **Peer Review Status:** Internal team peer code reviews (PR-001 through PR-004) are complete and documented in `Peer_Review_Evidence.md`; external course/TA evaluation checkmarks remain pending course evaluation.
- **D2 Outcome:** **READY FOR SUBMISSION WITH EXPLICIT SCOPE RECONCILIATION**

---

## 2. Deliverable 3 (D3) Acceptance Checklist

| # | D3 Requirement Description | Compliance Status | Verified Evidence Location |
|---|---|---|---|
| 1 | Unit, integration, system, and adversarial test reports | **FULLY MET** | `Deliverables/D3/Testing_Report.md` (190 backend + 245 frontend tests passing). |
| 2 | Machine-readable code coverage report | **PARTIALLY MET** | `Deliverables/D3/Coverage_Report.md` (Statements: 85.49% [MET], Branches: 70.23% [PARTIALLY MET]). |
| 3 | Concurrency race-condition test report | **FULLY MET** | `Deliverables/D3/Concurrency_Report.md` (10 concurrent clients: 1 confirmed, 9 rejected). |
| 4 | Security architecture & STRIDE threat model report | **FULLY MET** | `Deliverables/D3/Security_Threat_Model.md` (12 security domains analyzed). |
| 5 | Performance & latency benchmark report | **PARTIALLY MET** | `Deliverables/D3/Performance_Report.md` (Sub-10ms read APIs [MET]; multi-user load test deferred). |
| 6 | Failure & recovery test report | **FULLY MET** | `Deliverables/D3/Failure_Recovery_Report.md` (12 failure scenarios verified). |
| 7 | Defect history in Jira | **FULLY MET** | `Deliverables/D3/Defect_History.md` (KAN-70, KAN-71, KAN-80 defect mapping). |
| 8 | Five or more meaningful defects fixed | **FULLY MET** | `Deliverables/D3/Defect_History.md` (6 verified defect case studies with before/after logs). |
| 9 | System costing & financial architecture document | **FULLY MET** | `Deliverables/D3/Costing_Document.md` (Parameterized 3-tier financial model). |
| 10 | Project timeline and Gantt chart | **FULLY MET** | `Deliverables/D3/Project_Gantt.csv` (Commit-anchored milestone timeline). |
| 11 | Production deployment documentation & runbook | **FULLY MET** | `Deliverables/D3/Deployment_Guide.md` (Docker Compose, migrations, health monitoring). |
| 12 | Final requirements-to-Jira-to-testing matrix | **FULLY MET** | `Deliverables/D3/Final_Traceability_Matrix.csv` (100% bidirectional traceability). |
| 13 | Final Jira dashboard & project governance report | **FULLY MET** | `Deliverables/D3/Jira_Project_Evidence.md` (Sprint history & ticket audit). |
| 14 | AI Engineering Log final update | **FULLY MET** | `Deliverables/D2/AI_Engineering_Log.md` (Updated with entries AIL-005 & AIL-006). |

### D3 Summary:
- **Requirements Total:** 14
- **Fully Met:** 12 (85.7%)
- **Partially Met:** 2 (14.3%) — KAN-81 (Branch coverage 70.23% vs 75% target) & KAN-85 (Distributed multi-user load test deferred; local benchmarks meet 500ms SLA).
- **Not Met:** 0
- **D3 Outcome:** **HIGH-QUALITY SUBMISSION READINESS WITH DOCUMENTED ACCEPTED TRADE-OFFS**

---

## 3. Explicit Inventory of Partially Met Requirements & Justifications

1. **KAN-81 (Branch Coverage: 70.23% vs 75% Target):**
   - *Technical Justification:* Statements (85.49%), Lines (85.49%), and Functions (96.09%) all comfortably surpass the 80% threshold. The remaining 4.77% branch gap is composed of defensive exception catches (unthrown database socket drops) and environment fallback ternaries. Artificially forcing 75% via mock spam was deliberately avoided to maintain high code quality and test integrity.
2. **KAN-85 (Distributed Heavy Load Testing):**
   - *Technical Justification:* All local API benchmarks exhibit sub-10ms read latencies and 37ms write latencies, far exceeding the $\le 500$ ms target. A sustained 100-user distributed load test across a cluster was not executed due to local single-instance testing constraints, and is documented honestly rather than simulated with fabricated data.
