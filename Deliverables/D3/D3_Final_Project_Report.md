# Deliverable 3 (D3) — Final Project Report

**Course:** CS455 Software Engineering, Fall 2026  
**Institution:** Indian Institute of Technology Kanpur (IITK)  
**Project:** Campus Duo — Peer Study Matching & Capacity-Aware Table Booking  
**Milestone:** Deliverable 3: Final Testing, Security, Performance, Costing, Deployment & Reliability  
**Submission Deadline:** November 6, 2026 at 23:59:59 IST  
**Authoritative Worktree:** `C:\Users\cavlc\OneDrive\Desktop\AI\Campus-Duo-Qwen-Integration`  
**Git Branch:** `feat/KAN-49-d2-integration`  
**Current HEAD SHA:** `f4ee132e3621c1bd8a43a4c68368f75c06377797` (Commit C)  
**Project Team:** Mohit Parihar, Chaitanya Vishnoi, Sayani Patra  

---

## 1. Executive Summary

Deliverable 3 concludes the formal software engineering verification, testing, security auditing, performance profiling, financial costing, and operational documentation for the **Campus Duo** system.

Over an intensive multi-sprint cycle, the team has:
1. Resolved two critical technical defects in Commit C (`f4ee132`): remediated high-severity dependency vulnerabilities in `body-parser` and `qs` (KAN-70) and isolated availability test fixtures with dynamic runtime dates (KAN-71).
2. Instrumented machine-readable code coverage using `@vitest/coverage-v8@2.1.9` (KAN-81). Statements (85.49%), Lines (85.49%), and Functions (96.09%) comfortably exceed the 80% D3 threshold, while Branch coverage reached 70.23% (partially met due to defensive database disconnect handlers).
3. Verified strict PostgreSQL concurrency guarantees (KAN-83): 10 concurrent competing requests for the same study table produced exactly 1 confirmed booking (HTTP 201) and 9 conflicts (HTTP 409) with zero database corruption or duplicate claims.
4. Audited system performance (KAN-85) across core endpoints, measuring sub-10ms p95 latencies for read APIs (Availability: 4.73ms, Booking History: 5.90ms) and 37.82ms p95 for atomic database writes.
5. Formally verified 12 failure and recovery scenarios (KAN-86), demonstrating transaction rollback, auth token revocation, and seamless deterministic fallback during Hugging Face inference provider disruptions.
6. Compiled a comprehensive STRIDE threat model (KAN-78), an adversarial test suite (KAN-79), an authentic 5-defect history register (KAN-80), a defensible 3-tier costing model (KAN-88), a reproducible deployment runbook (KAN-87), and an end-to-end bidirectional traceability matrix (KAN-75).

---

## 2. Requirement-Level Acceptance Status Overview

Across the 20 tracked D3 Jira issues (KAN-69 to KAN-88):

| Jira Key | Topic / Deliverable | Status | Primary Evidence / Location |
|---|---|---|---|
| **KAN-69** | D3 Umbrella Coordination & Release Packaging | **FULLY MET** | Release package compiled under `Deliverables/D3/` |
| **KAN-70** | Dependency Vulnerability Remediation | **FULLY MET** | Commit `f4ee132`, `npm audit --omit=dev` shows 0 vulnerabilities |
| **KAN-71** | Availability Test Fixture Date Isolation | **FULLY MET** | Commit `f4ee132`, 7/7 tests passing in `availability.test.ts` |
| **KAN-72** | Frontend Unit/Integration Testing | **FULLY MET** | 245 frontend tests passing across 26 test suites |
| **KAN-73** | Duplicate of KAN-72 | **N/A (CLOSED)** | Formally resolved as duplicate ticket |
| **KAN-74** | Frontend HTTP Booking Adapter | **FULLY MET** | `HttpBookingAdapter.ts` verified by 27 unit & live integration tests |
| **KAN-75** | Final Bidirectional Traceability Matrix | **FULLY MET** | `Final_Traceability_Matrix.csv` mapping 100% of requirements |
| **KAN-76** | System & E2E Acceptance Testing | **FULLY MET** | `tests/acceptance.e2e.test.ts` (22 comprehensive journeys passing) |
| **KAN-77** | AI Engineering Log Final Update | **FULLY MET** | `Deliverables/D2/AI_Engineering_Log.md` covering entries AIL-001 to AIL-006 |
| **KAN-78** | Security & STRIDE Threat Model Report | **FULLY MET** | `Deliverables/D3/Security_Threat_Model.md` covering 12 threat domains |
| **KAN-79** | Adversarial Safety Suite & Injection Audit | **FULLY MET** | 16 tests in `agent.safety.test.ts`, zero-mutation invariant proven |
| **KAN-80** | Defect History (5+ Meaningful Defects Fixed) | **FULLY MET** | `Deliverables/D3/Defect_History.md` documenting 6 verified defects |
| **KAN-81** | Backend Coverage Report & Instrumentation | **PARTIALLY MET** | Statements 85.49%, Lines 85.49%, Funcs 96.09%, Branches 70.23% (Target 75%) |
| **KAN-82** | Final Jira Dashboard & Project Report | **FULLY MET** | `Deliverables/D3/Jira_Project_Evidence.md` and sprint audit |
| **KAN-83** | Concurrency & Race Condition Report | **FULLY MET** | `Deliverables/D3/Concurrency_Report.md`, 10-client trial verified |
| **KAN-84** | Project Timeline & Gantt Chart | **FULLY MET** | `Deliverables/D3/Project_Gantt.csv` with commit-anchored timeline |
| **KAN-85** | Performance & Latency Benchmark Report | **PARTIALLY MET** | Endpoint latency benchmarks completed; heavy distributed load test deferred |
| **KAN-86** | Failure & Recovery Test Report | **FULLY MET** | `Deliverables/D3/Failure_Recovery_Report.md` (12 scenarios verified) |
| **KAN-87** | Deployment Runbook & Operational Guide | **FULLY MET** | `Deliverables/D3/Deployment_Guide.md` (Docker Compose & migration steps) |
| **KAN-88** | 3-Tier Costing & Cloud Resource Model | **FULLY MET** | `Deliverables/D3/Costing_Document.md` (Free, MVP, Scale campus tiers) |

---

## 3. Subsystem Health & Key Findings

### 3.1 Concurrency & Double-Booking Protection
Campus Duo's core value proposition is capacity-limited study space reservation without seat collisions. The PostgreSQL partial unique index `booking_confirmed_resource_uk` enforces that only one active booking can exist per `(resource_id, slot_date, time_slot)` where `status = 'CONFIRMED'`. Concurrency trials with 10 competing clients resulted in exactly 1 successful booking (201) and 9 conflict rejections (409) with zero database corruption.

### 3.2 Bounded AI Assistant & Fallback Integrity
The AI recommendation assistant (`POST /api/agent/recommend`) integrates Hugging Face hosted router inference with the deterministic compatibility formula \(35C + 25T + 20P + 10L + 10G\). Empirical probes revealed external provider limitations (HTTP 400 `model_not_supported` on free serverless tier, HTTP 402 subscription requirement). The system's offline template synthesizer (`TemplateLlmClient`) was validated to seamlessly handle provider errors, ensuring uninterrupted recommendations without leaking credentials or throwing unhandled 500 errors.

### 3.3 Code Coverage & Quality Metrics
190 automated tests pass cleanly across 15 backend suites. Statement coverage stands at **85.49%** (exceeding the 80% D3 requirement). Branch coverage reached **70.23%**. An in-depth audit confirmed that the remaining uncovered branches consist of defensive database crash catch handlers and configuration default fallbacks; attempting to artificially force 75% via mock spam was deliberately avoided to preserve test maintainability.

---

## 4. D3 Submission Sign-Off & Verification

All deliverables have been consolidated into `Deliverables/D3/` alongside complete test logs, Git commit objects, and machine-readable traceability tables.

**Final Recommendation:** Proceed with final review and project submission.
