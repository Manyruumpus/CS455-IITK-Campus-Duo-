# Campus Duo

> **CS455 — Software Engineering Course Project**  
> **Final Deliverable Package (Deliverable 2 & Deliverable 3)**  
> **Indian Institute of Technology Kanpur (IITK)**

Campus Duo is an institutional platform designed for verified IIT Kanpur students to discover compatible study partners and reserve capacity-limited study spaces upon mutual study consent. It integrates deterministic, explainable compatibility matching with a strictly governed Agentic AI assistant (`qwen2.5vl:3b` via local Ollama or hosted Hugging Face router, with deterministic offline fallback).

The project is built around software engineering rigor: atomic PostgreSQL transactions, strict participant authorization, robust concurrency handling (guaranteeing zero double-bookings), rigorous PII redaction, full profile persistence, and 100% passing automated test coverage across 491 tests.

---

## Deliverables & Traceability Index

All project deliverables and engineering evidence are organized under the repository root and `Deliverables/` directory:

### Deliverable 1 (D1)
- [`Deliverables/Deliverable_0_Project_Proposal_Campus_Duo.md`](Deliverables/Deliverable_0_Project_Proposal_Campus_Duo.md): Initial project proposal and system scope.
- [`Deliverables/D1/`](Deliverables/D1/): SRS, architecture, baseline requirements, and project charter.

### Deliverable 2 (D2)
- [`Deliverables/D2/Agentic_AI_Integration_Report.md`](Deliverables/D2/Agentic_AI_Integration_Report.md): Bounded Agentic AI architecture, prompt propagation, local Ollama integration, grounding validation, and zero-mutation proof.
- [`Deliverables/D2/AI_Engineering_Log.md`](Deliverables/D2/AI_Engineering_Log.md): Complete engineering log entries (AIL-001 through AIL-009) detailing LLM interactions, human critiques, and prompt refinements.
- [`Deliverables/D2/API_Documentation.md`](Deliverables/D2/API_Documentation.md): Comprehensive OpenAPI-compliant specifications for Auth, Profile, Discovery, Booking, Admin, and Agent endpoints.
- [`Deliverables/D2/D2_Implementation_Summary.md`](Deliverables/D2/D2_Implementation_Summary.md): Architecture walkthrough of the core vertical slice.
- [`Deliverables/D2/Transactional_Demo_Guide.md`](Deliverables/D2/Transactional_Demo_Guide.md): Step-by-step verification guide for live demo flows.
- [`Deliverables/D2/Requirements_Traceability_D2.csv`](Deliverables/D2/Requirements_Traceability_D2.csv): D2 functional requirement mappings.

### Deliverable 3 (D3)
- [`Deliverables/D3/D3_Final_Project_Report.md`](Deliverables/D3/D3_Final_Project_Report.md): Executive summary, architectural review, and project post-mortem.
- [`Deliverables/D3/AI_Engineering_Log.md`](Deliverables/D3/AI_Engineering_Log.md): Consolidated AI engineering audit trail.
- [`Deliverables/D3/Testing_Report.md`](Deliverables/D3/Testing_Report.md): Multi-tiered automated test suite documentation (223 backend tests + 268 frontend tests = 491 total).
- [`Deliverables/D3/Defect_History.md`](Deliverables/D3/Defect_History.md): Register of 8 verified, resolved, and regression-tested defects (DEF-01 through DEF-08).
- [`Deliverables/D3/Final_Traceability_Matrix.csv`](Deliverables/D3/Final_Traceability_Matrix.csv): End-to-end traceability matrix mapping all FRs, NFRs, and D3 items to source code, tests, and Git commits.
- [`Deliverables/D3/Concurrency_Report.md`](Deliverables/D3/Concurrency_Report.md): 10-client parallel race verification proving zero double-booking under concurrency.
- [`Deliverables/D3/Security_Threat_Model.md`](Deliverables/D3/Security_Threat_Model.md): STRIDE threat model, authorization boundaries, and PII protection mechanisms.
- [`Deliverables/D3/Failure_Recovery_Report.md`](Deliverables/D3/Failure_Recovery_Report.md): 12-scenario fault injection and transaction rollback verification.
- [`Deliverables/D3/Performance_Report.md`](Deliverables/D3/Performance_Report.md): High-resolution loopback latency profiling for API routes.
- [`Deliverables/D3/Costing_Document.md`](Deliverables/D3/Costing_Document.md): 3-tier financial model (MVP, Scale, Enterprise) for cloud compute, DB, and LLM hosting.
- [`Deliverables/D3/Deployment_Guide.md`](Deliverables/D3/Deployment_Guide.md): Docker containerization, systemd services, and PostgreSQL production deployment runbook.
- [`Deliverables/D3/Project_Gantt.csv`](Deliverables/D3/Project_Gantt.csv) & [`Deliverables/D3/Jira_Project_Evidence.md`](Deliverables/D3/Jira_Project_Evidence.md): Commit-anchored timeline and Jira governance reconciliation.
- [`Deliverables/D3/Submission_Checklist.md`](Deliverables/D3/Submission_Checklist.md): Final verification checklist for D3 compliance.

---

## System Architecture

Campus Duo implements a clean three-tier architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                       React Frontend                        │
│   (Vite + React Router + Tailwind CSS + Lucide Icons)      │
│  - ProfilePage (Course selection, study style, availability)│
│  - StudyDiscoveryPage (Deterministic ranking, match tags)   │
│  - BookingCalendar & SpaceViewer (Capacity-aware reserving) │
│  - StudentDashboard & AdminDashboard                        │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON API
┌──────────────────────────────▼──────────────────────────────┐
│                    Express.js Backend                       │
│  - Auth & RBAC Middleware (@iitk.ac.in OTP verification)    │
│  - Profile Router & Service (PostgreSQL-backed persistence)  │
│  - Scoring Engine (35% Course, 25% Time, 20% Style, etc.)   │
│  - Booking Service (Atomic reservation & capacity tracking) │
│  - Governed Agent Service (Read-only, identity redaction)   │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
┌──────────────▼──────────────┐┌──────────────▼───────────────┐
│     PostgreSQL Database     ││   AI Recommendation Engine   │
│ - campus_duo schema         ││ - Local Ollama (qwen2.5vl:3b)│
│ - Strict role isolation     ││ - Hugging Face Router API    │
│ - Partial unique indices    ││ - Offline Template Fallback  │
│ - Transactional integrity   ││ - Grounding & PII Redaction  │
└─────────────────────────────┘└──────────────────────────────┘
```

---

## Core Implemented Capabilities

1. **Email OTP Authentication & Authoritative RBAC:**
   - Restricted strictly to verified `@iitk.ac.in` email identities.
   - 6-digit challenge dispatch with 60-second cooldown and 3-attempt lockout.
   - Dual-role authorization: Student and Administrator contexts.

2. **Persistent Student Profiles & Catalog Normalization:**
   - Endpoints: `GET /api/profile/me`, `PUT /api/profile/me`.
   - Persists Study Style (`SOLO`, `DISCUSSION_HEAVY`, `QUIET_COWORKING`, `PEER_TEACHING`), Preferred Times (`MORNING`, `AFTERNOON`, `EVENING`, `LATE_NIGHT`), Preferred Locations, Goals, and Enrolled Courses.
   - Transparently normalizes course codes (handling both raw `CS455` and catalog-prefixed `DB05-CS455`).
   - Atomic sync with `campus_duo.profile_course` and `consent_record`.

3. **Deterministic Compatibility Scoring & Discovery:**
   - Compatibility score formula:
     $$S(u,v) = 0.35C + 0.25T + 0.20P + 0.10L + 0.10G$$
     *(Course, Availability, Study Style, Location, Goals).*
   - Strict eligibility filtering: excludes self, unconsented profiles, blocked pairs, or non-overlapping study modes.
   - Ties broken deterministically by enrollment count and user UUID order.

4. **Capacity-Aware Atomic Study Space Reservation:**
   - Atomic conditional transactions enforce exact capacity limits at the database engine level.
   - Rescheduling atomically releases existing seat and claims target seat in a single SQL transaction.
   - Concurrency race verified: 10 simultaneous threads competing for the last seat results in exactly 1 success (201) and 9 conflicts (409), with zero overbooking.

5. **Bounded Agentic AI Study Assistant:**
   - Endpoint: `POST /api/agent/recommend`.
   - Read-only invariant (Invariant I5): Agent cannot mutate database rows, book slots, modify profiles, or send unapproved messages.
   - Structured JSON response with candidate explanations, compatible times, and match justifications.
   - Multi-provider flexibility:
     - **Local Ollama Inference (`LLM_PROVIDER=ollama`):** Evaluated locally using `qwen2.5vl:3b` (~4.2s latency on NVIDIA RTX 3050 Laptop GPU, 4 GB VRAM).
     - **Cloud Hugging Face Inference (`LLM_PROVIDER=huggingface`):** Uses Hugging Face router completions.
     - **Deterministic Offline Fallback (`TemplateLlmClient`):** Immediately engages if LLM is unreachable or produces ungrounded claims, ensuring continuous system operation.
   - Rigorous Grounding Validator: Rejects any LLM explanation containing hallucinated course names, times, or ungrounded claims.

---

## Quickstart & Local Setup

### 1. Prerequisites
- **Node.js**: v20.x or higher
- **PostgreSQL**: v16.x or higher
- **Ollama** (optional, for local LLM inference): with `qwen2.5vl:3b` model installed

### 2. Database Initialization
Ensure PostgreSQL is running locally on port 5432, then apply migrations and baseline seeds:
```powershell
# Navigate to database directory
cd database

# Apply schema migrations (as superuser / postgres)
psql -U postgres -d postgres -f migrations/01_schema_init.sql

# Seed development catalog & test peers
psql -U postgres -d campus_duo_dev -f seeds/02_development_seed.sql
```

### 3. Backend Configuration & Startup
```powershell
cd backend
npm install

# Configure backend/.env
# PORT=4000
# DATABASE_URL=postgresql://campus_duo_app:campus_duo_dev_pwd@localhost:5432/campus_duo_dev
# LLM_PROVIDER=ollama
# OLLAMA_HOST=http://localhost:11434
# OLLAMA_MODEL=qwen2.5vl:3b

# Start backend dev server
npm run dev
```

### 4. Local Ollama AI Setup
To run local LLM inference:
```powershell
# Pull and test the Qwen model
ollama pull qwen2.5vl:3b
ollama run qwen2.5vl:3b

# Check endpoint availability
curl http://localhost:11434/api/tags
```

### 5. Frontend Startup
```powershell
cd frontend
npm install

# Start Vite development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Automated Verification & Test Suites

The project includes 491 automated tests across 46 test suites, achieving 100% pass rate:

### Backend Test Execution (Vitest)
```powershell
cd backend

# Run all backend test suites
npx vitest run

# Run specific integration suites
npx vitest run tests/profile.lifecycle.test.ts tests/scoringEngine.test.ts tests/ollamaLlmClient.test.ts
npx vitest run tests/concurrency.race.test.ts tests/agent.safety.test.ts
```

### Frontend Test Execution (Vitest)
```powershell
cd frontend

# Run all frontend unit and component tests
npm test

# Run profile and auth persistence tests
npx vitest run src/tests/profileServiceSelection.test.ts src/tests/auth.persistence.test.tsx
```

---

## Engineering Team & Jira Governance

- **Repository:** [https://github.com/Manyruumpus/CS455-IITK-Campus-Duo-](https://github.com/Manyruumpus/CS455-IITK-Campus-Duo-)
- **Jira Board:** [Campus Duo Jira Workspace](https://mohitpariharsworkspace-43776135.atlassian.net/)
- **Target Branches:** `feat/KAN-49-d2-integration` → `main`
- **Course:** CS455 Software Engineering, Department of Computer Science & Engineering, IIT Kanpur.
