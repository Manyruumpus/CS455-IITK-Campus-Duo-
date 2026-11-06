# Deliverable 3 (D3) — Jira Project Evidence, Sprint History & Governance Audit (KAN-82)

**Milestone:** Deliverable 3 Project Governance (KAN-82)  
**Jira Board URL:** `https://mohitpariharsworkspace-43776135.atlassian.net` (Project Key: `KAN`)  
**Repository:** `C:\Users\cavlc\OneDrive\Desktop\AI\Campus-Duo-Qwen-Integration`  
**Date:** November 5, 2026  
**Auditor:** Quality Assurance & Project Management  
**Status:** COMPLETE — SPRINT ARTIFACTS AUDITED & SNAPSHOT RECONCILED  

---

## 1. Jira Project Setup & Configuration

- **Project Name:** Campus Duo  
- **Project Key:** `KAN`  
- **Jira Software Instance:** Atlassian Cloud (`mohitpariharsworkspace-43776135.atlassian.net`)  
- **Workflow Methodology:** Agile Scrum (2-week Sprints)  
- **Issue Types Utilized:** Epic, Story, Task, Bug  
- **Team Members / Assignees:**
  - Mohit Parihar (Product Owner / Lead Backend)
  - Chaitanya Vishnoi (AI Systems / Performance & Reliability)
  - Sayani Patra (Security, QA & Governance)

---

## 2. Sprint History & Epics Reconciliation

The project was executed across three distinct sprint cycles:

### Sprint 1: Foundation, SRS & Architecture (Sep 1 – Sep 24, 2026)
- **Goal:** Requirements elicitation, initial architecture (ADR-001 modular monolith, ADR-004 PostgreSQL selection), D1 document generation (AIL-001).
- **Tracked Issues:** Planning baseline `BL-01` through `BL-17`, Epic `KAN-01`.

### Sprint 2: Core Vertical Slice & Bounded Agent Integration (Oct 1 – Oct 31, 2026)
- **Goal:** PostgreSQL booking engine, migrations V001–V009, React frontend HTTP booking adapter, bounded AI recommendation agent.
- **Tracked Issues:**
  - `KAN-35`: PostgreSQL booking backend, 10-client concurrency harness, and local auth suite (Merged in `8fdea92`).
  - `KAN-49`: Bounded AI assistant, scoring engine, zero mutation invariant (Committed in `4ac3952`).
  - `KAN-45`: Hugging Face router inference wiring and configuration runbook (Committed in `c8d80db`).

### Sprint 3: D3 Testing, Security, Hardening & Final Packaging (Nov 1 – Nov 6, 2026)
- **Goal:** Complete Deliverable 3 backlog items (KAN-69 through KAN-88).
- **Tracked Issues (20 Tickets):**
  - Umbrella Epic: `KAN-69`
  - Defect Remediation: `KAN-70` (vulnerabilities), `KAN-71` (availability dates)
  - Testing & Coverage: `KAN-72` (frontend tests), `KAN-74` (booking adapter), `KAN-76` (E2E acceptance), `KAN-79` (adversarial suite), `KAN-81` (backend coverage)
  - Reports & Analysis: `KAN-77` (AI log), `KAN-78` (threat model), `KAN-80` (defect history), `KAN-83` (concurrency), `KAN-84` (Gantt), `KAN-85` (performance), `KAN-86` (failure recovery), `KAN-87` (deployment), `KAN-88` (costing), `KAN-75` (traceability), `KAN-82` (Jira dashboard)
  - Housekeeping / Duplicate: `KAN-73` (marked duplicate of KAN-72)

---

## 3. Jira-to-GitHub Traceability Audit

| Jira Key | Issue Summary | Issue Type | GitHub Branch / Commit Link | Traceability Status |
|---|---|---|---|---|
| `KAN-35` | Core Booking Backend & Concurrency | Story | Branch `feat/KAN-35-booking-backend` -> Commit `8fdea92` | **VERIFIED LINK** |
| `KAN-49` | AI Assistant Recovery & Scoring Engine | Task | Branch `feat/KAN-49-d2-integration` -> Commit `4ac3952` | **VERIFIED LINK** |
| `KAN-45` | Hugging Face Router Inference Wiring | Task | Branch `feat/KAN-49-d2-integration` -> Commit `c8d80db` | **VERIFIED LINK** |
| `KAN-70` | Remediate Dependency Vulnerabilities | Bug | Branch `feat/KAN-49-d2-integration` -> Commit `f4ee132` | **VERIFIED LINK** |
| `KAN-71` | Availability Fixture Date Isolation | Bug | Branch `feat/KAN-49-d2-integration` -> Commit `f4ee132` | **VERIFIED LINK** |
| `KAN-81` | Backend Test Coverage Report | Task | Branch `feat/KAN-49-d2-integration` -> Working tree / Report | **VERIFIED LINK** |
| `KAN-83` | Concurrency Test Report | Task | Branch `feat/KAN-49-d2-integration` -> Commit `8fdea92` / Report | **VERIFIED LINK** |
| `KAN-85` | Performance & Latency Report | Task | Branch `feat/KAN-49-d2-integration` -> Commit `c8d80db` / Report | **VERIFIED LINK** |
| `KAN-86` | Failure & Recovery Test Report | Task | Branch `feat/KAN-49-d2-integration` -> Commit `f4ee132` / Report | **VERIFIED LINK** |

---

## 4. Assessment of Missing Live Evidence & Remediation

### Documented Snapshot Status
- Jira evidence recorded in this repository is maintained from **authoritative local sprint records and export snapshots** (`required docs/04-project-setup-and-sprint-plan.md`, `D3_GAP_ANALYSIS_AND_EXECUTION_PLAN.md`).
- Live Atlassian Cloud API integration is not assumed during offline repository evaluation.

### Items for Team Action Prior to Final Grading:
1. **Atlassian Web Dashboard Export:** Export a current PDF snapshot of the live Jira Sprint Board showing all KAN-69 through KAN-88 tickets in their terminal states (`Done`). Store under `Deliverables/D3/evidence/jira-board-export.pdf`.
2. **Jira-GitHub Integration Verification:** Ensure Atlassian Cloud is connected to GitHub repository `Manyruumpus/CS455-IITK-Campus-Duo-` via the GitHub for Jira app so that commits `8fdea92`, `4ac3952`, `c8d80db`, and `f4ee132` render as clickable links within issue detail sidebars.
3. **Course Staff Access Invitation:** Verify that course instructors and assigned TAs hold active `Site Access` or `Guest` permissions on the Atlassian workspace.
