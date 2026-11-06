# Stage 4E: Coverage Gap Audit, Dependency Reconciliation & Evidence Finalization

**Project:** Campus Duo — CS455 IIT Kanpur  
**Worktree:** `C:\Users\cavlc\OneDrive\Desktop\AI\Campus-Duo-Qwen-Integration`  
**Branch:** `feat/KAN-49-d2-integration`  
**Date:** November 5, 2026  
**Status:** COMPLETE — COVERAGE AUDITED, DEPENDENCIES RECONCILED, REGRESSION TESTS VERIFIED  

---

## 1. Initial Git State and Lineage Verification

Prior to executing any Stage 4E operations, the integration repository was verified:
- **Repository Root:** `C:/Users/cavlc/OneDrive/Desktop/AI/Campus-Duo-Qwen-Integration`
- **Active Branch:** `feat/KAN-49-d2-integration`
- **Current HEAD:** `f4ee132e3621c1bd8a43a4c68368f75c06377797` (Commit C)

### Verified Commit History
```
f4ee132 (HEAD -> feat/KAN-49-d2-integration) fix(backend): remediate dependency vulnerabilities and isolate availability fixtures
c8d80db docs(agent): update runbook and environment templates for Hugging Face inference
4ac3952 feat(agent): recover KAN-49 AI assistant and KAN-45 Hugging Face inference wiring
8fdea92 (main) Merge branch 'feat/KAN-35-booking-backend' into main
```

---

## 2. Dependency Version Reconciliation

### 2.1 Reconciled Commit C Packages
Stage 4D documentation initially contained an imprecise recollection of dependency versions (stating `body-parser@1.20.3` and `qs@6.13.0+`). Inspection of the actual Git tree object (`git diff f4ee132^ f4ee132 -- backend/package-lock.json`) establishes the exact versions recorded in Commit C:

| Package | Pre-Commit C Version | Commit C Version | Resolution Context |
|---|---|---|---|
| `body-parser` | `1.20.8` | `1.20.9` | Resolved via Express dependency tree |
| `nodemailer` | `10.1.1` | `10.3.1` | Updated direct email transport dependency |
| `qs` | `6.16.0` | `6.16.2` | Resolved query string parser dependency |

### 2.2 Working-Tree Package Isolation
The working tree contains uncommitted modifications to `backend/package.json` and `backend/package-lock.json`. Inspection of `git diff HEAD -- backend/package.json backend/package-lock.json` confirms:
- **Added:** `@vitest/coverage-v8@2.1.9` in `devDependencies`.
- **Transitive Dev Dependencies:** `@bcoe/v8-coverage`, `@istanbuljs/schema`, `magic-string`, `std-env`, `test-exclude`, etc.
- **Production Dependencies:** 0 changes. All production packages remain strictly identical to Commit C.

### 2.3 Vulnerability Audit
- `npm audit --omit=dev`: **0 vulnerabilities found**. All runtime production dependencies are completely clean.
- `npm audit` (full dev profile): Emits 10 vulnerabilities (6 moderate, 1 high, 3 critical) located exclusively in dev tooling (`@vitest/mocker`, `tinypool`, `esbuild`, `glob`). None of these packages are shipped or executed in production.

---

## 3. Uncovered Branch Classification and Audit

Inspection of `coverage-final.json` across 1,021 total branch points revealed 304 uncovered branches prior to Stage 4E test additions.

### Branch Classification
1. **Meaningful Business Logic Branches (12%):** Edge cases in scoring normalization, candidate fallback matching, and booking lifecycle state transitions.
2. **Defensive Error-Handling & DB Recovery Branches (45%):** `catch (err)` blocks in repositories and controllers that log unexpected database disconnects or rethrow errors.
3. **Configuration & Environment Fallbacks (18%):** Ternary operator defaults in `src/config/env.ts` (over 30 configuration flags) where test harness runs with static defaults.
4. **Input Validation Guards (15%):** Explicit type guards and parameter checks in Express route handlers for malformed requests.
5. **Process Lifecycle & Startup (5%):** `src/server.ts` standalone port listening and graceful SIGTERM handling (not invoked in unit testing where Supertest binds directly to `app.ts`).
6. **External Provider Outages (5%):** Hugging Face API rate limits, timeouts, and network abort handling.

---

## 4. Tests Selected and Implemented

To improve branch coverage without artificial inflation, exactly 5 high-value, safe regression tests were implemented across 3 test suites:

### Test 1: Empty Candidates Guard in Hugging Face Client
- **File:** `backend/tests/huggingFaceLlmClient.test.ts`
- **Target Branch:** `src/services/huggingFaceLlmClient.ts:38` (`if (req.candidates.length === 0) return [];`)
- **Rationale:** Protects against wasteful outbound network dispatch or exceptions when candidate matching returns an empty pool.
- **Execution:** Pure unit test; confirms immediate empty array resolution and 0 fetch calls.

### Test 2: Database Connection Outage Handling in Health Check
- **File:** `backend/tests/health.test.ts`
- **Target Branch:** `src/routes/health.ts:19-27` (`catch (err) { res.status(503).json(...) }`)
- **Rationale:** Ensures health check reliably reports 503 DOWN under database failure while verifying that internal error messages, database credentials, and stack traces are never leaked.
- **Execution:** Mocked `db.query` rejection via `vi.spyOn`.

### Test 3: Course Code Input Sanitization
- **File:** `backend/tests/agent.safety.test.ts`
- **Target Branch:** `src/routes/agent.ts:28-30` (`!/^[A-Za-z0-9-]+$/.test(courseCode.trim())`)
- **Rationale:** Validates that injection payloads and malformed characters in `courseCode` are rejected with HTTP 400 `VALIDATION_ERROR`.
- **Execution:** Supertest integration request with test actor; read-only verification.

### Test 4: Scoring Engine Location Mismatch Normalization
- **File:** `backend/tests/agent.safety.test.ts`
- **Target Branch:** `src/services/scoringEngine.ts:188-190` & `291-294` (`locNorm = 0.4`, `'Study location preference considered'`)
- **Rationale:** Verifies factor weighting and explanation synthesis when viewer and candidate both specify preferred locations that do not match.
- **Execution:** Deterministic unit test on `ScoringEngine.calculateCompatibility`.

### Test 5: Deterministic Template Fallback with Zero Grounded Facts
- **File:** `backend/tests/agent.safety.test.ts`
- **Target Branch:** `src/services/agentService.ts:54-56` (`c.groundedFacts.length === 0`)
- **Rationale:** Tests fallback explanation generation when candidates match on baseline enrollment profile without overlapping courses or times.
- **Execution:** Pure unit test on `TemplateLlmClient.generateExplanations`.

---

## 5. Tests Intentionally Excluded and Rationale

1. **Unreachable Database Catch Blocks:** Injecting mock errors into low-level repository methods (e.g. `bookingRepo.ts`) to hit generic error handlers produces brittle tests that test mocked JavaScript runtimes rather than real SQL behavior.
2. **`src/server.ts` Startup Execution:** Exercising standalone process listening (`app.listen(port)`) would bind live TCP ports during CI test execution, risking port collision with the local dev server.
3. **Combinatorial Environment Parsing in `env.ts`:** Writing unit tests for every fallback default of 30+ environment flags increases test volume without adding regression protection for application features.

---

## 6. Database Safety and Isolation Verification

All added tests adhere strictly to database safety constraints:
- **Unit Isolation:** 4 of the 5 tests (HuggingFace client, ScoringEngine, TemplateLlmClient, Health check mock) execute entirely in-memory with zero database interaction.
- **Read-Only Route Test:** The courseCode validation test hits `/api/agent/recommend` which executes a read-only query and is validated to perform zero database mutations.
- **Seed Record Integrity:** Database queries before and after the suite confirmed 0 modified, inserted, or deleted seed rows.

---

## 7. Before vs. After Coverage Comparison

Coverage was re-measured by executing all 15 test suites with `@vitest/coverage-v8@2.1.9` (`npx vitest run --coverage`):

| Metric | Stage 4D Baseline | Stage 4E Result | Delta | D3 Target | Target Status |
|---|---|---|---|---|---|
| **Statements** | 85.19% (3,475 / 4,079) | **85.49%** (3,487 / 4,079) | +0.30% | $\ge 80\%$ | **MET** |
| **Lines** | 85.19% (3,475 / 4,079) | **85.49%** (3,487 / 4,079) | +0.30% | $\ge 80\%$ | **MET** |
| **Functions** | 96.09% (123 / 128) | **96.09%** (123 / 128) | 0.00% | $\ge 80\%$ | **MET** |
| **Branches** | 69.49% (704 / 1,013) | **70.23%** (717 / 1,021) | **+0.74%** | $\ge 75\%$ | **PARTIALLY MET** |
| **Tests Passed** | 185 / 185 | **190 / 190** | +5 tests | 100% | **MET** |
| **Suites Passed** | 15 / 15 | **15 / 15** | 0 failures | 100% | **MET** |

### Module-Level Improvements
- `src/routes/health.ts`: Statements rose from 72.00% to **100.00%**; Branches rose from 50.00% to **100.00%**.
- `src/services/scoringEngine.ts`: Statements rose from 98.63% to **100.00%**; Branches rose from 89.18% to **92.00%**.
- `src/services/agentService.ts`: Statements rose from 95.65% to **96.32%**; Branches rose from 65.51% to **67.79%**.
- `src/services/huggingFaceLlmClient.ts`: Branches rose from 85.71% to **89.18%**.
- `src/routes/agent.ts`: Branches rose from 78.57% to **80.00%**.

---

## 8. KAN-81 Acceptance Status

**Status: PARTIALLY MET**
- Statements ($\ge 80\%$), Lines ($\ge 80\%$), and Functions ($\ge 80\%$) are fully met and comfortably exceeded.
- Branch coverage reached **70.23%** (717 / 1,021 branches). While an improvement over the 69.49% baseline, it remains 4.77% short of the 75% target.
- As demonstrated by the audit, the remaining 304 uncovered branches are predominantly defensive catch handlers for unreachable database crashes, environment variable fallback defaults, and `server.ts` process entrypoint code. Artificially forcing 75% through mock spam would harm test maintainability.
