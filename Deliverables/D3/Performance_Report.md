# Deliverable 3 (D3) — Performance and Latency Analysis Report (KAN-85)

**Milestone:** Deliverable 3 Performance Engineering (KAN-85, QR-01, NFR-06, NFR-07)  
**Repository:** `C:\Users\cavlc\OneDrive\Desktop\AI\Campus-Duo-Qwen-Integration`  
**Date:** November 5, 2026  
**Auditor:** Infrastructure & Performance Engineering  
**Status:** **PARTIALLY MET** (Local API benchmarks meet $\le 500$ms SLA; Multi-user load testing deferred)

---

## 1. Performance Objective & Scope

This report audits system latency and responsiveness for Campus Duo against **Requirement QR-01 (API Response Latency $\le 500$ ms)**. It evaluates endpoint execution times across 150 benchmark samples under repeatable local conditions and establishes an explicit delineation between local backend execution and external Hugging Face cloud latency.

---

## 2. Benchmark Environment & Methodology

- **Host Environment:** Windows 11 Enterprise (x64), Intel Core processor.
- **Node.js Runtime:** `v22.17.1` (V8 engine).
- **Database Engine:** PostgreSQL 17 on `localhost:5432` with connection pooling (`pg.Pool`, max 20 connections).
- **Measurement Tool:** High-precision Node timer (`process.hrtime.bigint()`, sub-millisecond accuracy) measuring complete loopback HTTP request-response cycles.
- **Warm-Up Protocol:** 5 warm-up requests executed per endpoint prior to sampling to eliminate V8 JIT compilation and database connection acquisition spikes.
- **Sample Distribution:** 150 total measured iterations across 4 core endpoints.

---

## 3. Empirical Latency Measurements

| Endpoint | Method | Operation Type | Samples | Min (ms) | Mean (ms) | Median (ms) | p95 (ms) | Max (ms) | SLA Target | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `/api/booking/availability` | `GET` | Derived slot occupancy & table lookup | 50 | 2.94 | **3.73** | 3.67 | **4.73** | 5.54 | $\le 500$ ms | **PASS (105x margin)** |
| `/api/booking` | `GET` | Authenticated student history & relations | 50 | 4.36 | **5.07** | 5.03 | **5.90** | 6.12 | $\le 500$ ms | **PASS (84x margin)** |
| `/api/booking` | `POST` | ACID Transactional booking (lock, audit, outbox) | 20 | 8.97 | **12.12** | 10.67 | **37.82** | 37.82 | $\le 500$ ms | **PASS (13x margin)** |
| `/api/agent/recommend` | `POST` | AI Assistant (Deterministic Fallback Mode) | 30 | 286.06 | **304.23** | 299.25 | **338.66** | 386.99 | $\le 500$ ms | **PASS (1.5x margin)** |

---

## 4. Architectural Analysis & Key Latency Findings

### 4.1 Read Endpoints (Availability & Booking History)
- `GET /api/booking/availability` achieves an exceptional **3.73 ms mean** (p95: 4.73 ms) due to indexed joins across `study_slot`, `study_location`, and partial index scans on `campus_duo.booking`.
- `GET /api/booking` achieves **5.07 ms mean** (p95: 5.90 ms), resolving participant identities and computed cancellation permissions without latency degradation.

### 4.2 Write Transaction (`POST /api/booking`)
- Creating a study space reservation involves a 12-step transactional workflow (validating companion status, verifying mutual STUDY consent, acquiring table lock, inserting booking row guarded by `booking_confirmed_resource_uk`, inserting dual participant tuples, writing audit log, and dispatching outbox record).
- Despite 12 sequential SQL statements inside a single `BEGIN ... COMMIT` block, execution achieves an average of **12.12 ms** (p95: 37.82 ms).

### 4.3 Deterministic AI Fallback (`POST /api/agent/recommend`)
- When running in fallback mode, the agent queries candidate pools via `03_study_candidates.sql`, executes the 5-factor scoring engine, normalizes missing attributes, and synthesizes explanation cards in **304.23 ms mean** (p95: 338.66 ms).

---

## 5. Delineation: Local System Latency vs External Cloud WAN Latency

A fundamental operational distinction exists between local system execution and external third-party AI inference:

```
[Local Architecture: Mean 3.73ms – 304.23ms] ────► [External HF Cloud WAN: 660ms – 20,000ms]
  • Database query: 2-5ms                            • Internet WAN routing: 120-200ms
  • Scoring engine: 8-15ms                           • HF serverless queueing: 200-800ms
  • Express pipeline: 1-3ms                          • LLM generation: 300-1,500ms
                                                     • Timeout ceiling: 20,000ms
```

During Stage 3 live router verification:
- External network round-trip time to Hugging Face was measured at **662.4 ms**.
- Total client round-trip time was **785.4 ms**.
- If Hugging Face is unreachable or slow, the application's 20-second timeout (`HF_TIMEOUT_MS=20000`) will exceed the 500ms SLA before fallback engages. In production, reducing `HF_TIMEOUT_MS` to 2,000ms ensures fallback engages within acceptable response budgets.

---

## 6. Scope Limitations & Honest Assessment

1. **Absence of Distributed Concurrent Load Testing:** Benchmarks were collected sequentially across 150 requests under local loopback conditions. While 10-client concurrency was separately verified for correctness in KAN-83, a distributed multi-user load test (e.g. 100 concurrent virtual users sustained over 10 minutes via k6 or JMeter) was not executed.
2. **Acceptance Classification:** Because distributed load testing under saturated conditions remains unverified, KAN-85 is designated **PARTIALLY MET**.
