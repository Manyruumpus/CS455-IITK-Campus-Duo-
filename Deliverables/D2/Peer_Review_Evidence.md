# Campus Duo — Peer Code Review Evidence & Audit

**Course:** CS455 Software Engineering, IIT Kanpur  
**Milestone:** Deliverable 2 & Deliverable 3 Review Evidence  
**Worktree:** `C:\Users\cavlc\OneDrive\Desktop\AI\Campus-Duo-Qwen-Integration`  
**Date:** November 5, 2026  
**Status:** INTERNAL TEAM PAIR-REVIEW DOCUMENTED; FORMAL GITHUB PR TA APPROVALS PENDING  

---

## 1. Review Policy and Governance

In accordance with CS455 requirements, all non-trivial code modifications must be reviewed and approved by at least one teammate other than the author before merging to protected branches (`main`).

### Author & Reviewer Roles within Team
- **Mohit Parihar:** Lead Developer (Booking Backend, Adapter, Concurrency Harness).
- **Chaitanya Vishnoi:** Performance & Infrastructure Engineer (HF Inference Wiring, Failure Scenarios, Lineage Audit).
- **Sayani Patra:** Quality Assurance & Security Engineer (Dependency Remediation, Threat Model, Coverage Analysis).

---

## 2. Documented Peer Review Records

### Review Record PR-001: Booking Engine & Concurrency Harness
- **Branch:** `feat/KAN-35-booking-backend`
- **Merge Commit:** `8fdea9297d0c6c4a40cc5c9351bcf383f01c1d76`
- **Author:** Mohit Parihar
- **Reviewer:** Sayani Patra
- **Review Focus:**
  - Verifying partial unique index `booking_confirmed_resource_uk` definition in migration `V005`.
  - Auditing `backend/tests/concurrency.race.test.ts` for real PostgreSQL connection pool concurrency.
  - Ensuring non-participant users receive HTTP 403 Forbidden on `GET /api/booking/:bookingId`.
- **Outcome:** **APPROVED.** Merged into `main` after resolving test fixture isolation race conditions in `testDbHelper.ts` (`TE-005`).

### Review Record PR-002: Bounded AI Assistant & Scoring Engine (Commit A)
- **Branch:** `feat/KAN-49-d2-integration`
- **Commit:** `4ac395279cbe469520682dc47ee4329d242642ed`
- **Author:** Chaitanya Vishnoi
- **Reviewer:** Mohit Parihar
- **Review Focus:**
  - Enforcing zero-mutation invariant: validating that `agentService.ts` contains only read-only database tools.
  - Ensuring formula $35C + 25T + 20P + 10L + 10G$ correctly renormalizes base weights when profile attributes are omitted.
  - Ensuring token and credentials are not logged.
- **Outcome:** **APPROVED.** 15 files accepted. Verified by 16 tests in `agent.safety.test.ts`.

### Review Record PR-003: Hugging Face Runbook & Environment Audit (Commit B)
- **Branch:** `feat/KAN-49-d2-integration`
- **Commit:** `c8d80dbeee2a74c398480358d5d82ac3055b1695`
- **Author:** Chaitanya Vishnoi
- **Reviewer:** Sayani Patra
- **Review Focus:**
  - Verified that `backend/.env.example` contains only placeholder values (`ENABLE_LLM_INFERENCE=false`, `HF_TOKEN=`, etc.) and zero live tokens.
  - Verified `docs/D2-runbook.md` instructions for local testing without cloud dependencies.
- **Outcome:** **APPROVED.** Audit report recorded in `COMMIT_B_FINAL_REVIEW.md`.

### Review Record PR-004: Dependency Remediation & Fixture Isolation (Commit C)
- **Branch:** `feat/KAN-49-d2-integration`
- **Commit:** `f4ee132e3621c1bd8a43a4c68368f75c06377797`
- **Author:** Sayani Patra
- **Reviewer:** Chaitanya Vishnoi
- **Review Focus:**
  - Checking `package-lock.json` resolution for `body-parser@1.20.9` and `qs@6.16.2` to eliminate DoS vulnerabilities.
  - Verifying `availability.test.ts` dynamic date generation relative to runtime (`new Date()`).
- **Outcome:** **APPROVED.** Audit report recorded in `STAGE4B_REMEDIATION_REPORT.md` and `STAGE4D_COMMIT_C_REPORT.md`.

---

## 3. Gap Analysis: Missing External Evidence

While internal peer review and pair programming were consistently executed across all stages:
1. **GitHub PR Web Interface Approvals:** Formal GitHub web UI pull-request approval green checkmarks are not permanently archived in local Git clone metadata.
2. **External TA / Instructor Review:** Formal course staff code review feedback has not yet been received prior to D3 grading.

### Action Plan to Obtain External Verification:
1. Team lead to invite course instructors and TAs to GitHub repository `CS455-IITK-Campus-Duo-` with triage/read permissions.
2. Export pull request review threads from GitHub web UI and store PDFs in `Deliverables/D3/evidence/peer-reviews/`.
