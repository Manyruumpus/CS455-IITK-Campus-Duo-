# Campus Duo — Commit B Audit: Documentation & Environment Configuration Review

**Audit Location:** `C:\Users\cavlc\OneDrive\Desktop\AI\Campus-Duo-Qwen-Integration`  
**Target Files:** `backend/.env.example`, `docs/D2-runbook.md`  
**Date:** November 4, 2026  
**Auditor:** Antigravity (AI Assistant / Pair Programmer)  
**Readiness Decision:** **READY WITH MINOR FIXES**  

---

## 1. Repository Identity and Verified Git State

- **Absolute Repository Root:** `C:/Users/cavlc/OneDrive/Desktop/AI/Campus-Duo-Qwen-Integration`
- **Active Branch:** `feat/KAN-49-d2-integration`
- **Current HEAD SHA:** `4ac395279cbe469520682dc47ee4329d242642ed` (short: `4ac3952`)
- **Parent Commit:** `8fdea9297d0c6c4a40cc5c9351bcf383f01c1d76`
- **Branch Tracking:** No upstream configured. Branch exists only locally; no remote push has occurred.
- **Pre-Audit Working-Tree Status:**
  ```text
   M backend/.env.example
   M docs/D2-runbook.md
  ?? PROJECT_HANDOFF.md
  ?? localhost.har
  ```
- **Post-Audit Working-Tree Status:** Exactly identical (with the single permitted addition of this audit document, `COMMIT_B_REVIEW.md`).

---

## 2. Detailed Findings: `backend/.env.example`

### 2.1 Hugging Face Configuration Evaluation
The addition to `backend/.env.example` documents the environment variables introduced in Commit A (`backend/src/config/env.ts`):
```ini
# Hugging Face hosted inference (KAN-45)
ENABLE_LLM_INFERENCE=true
HF_MODEL_ID=Qwen/Qwen3-4B-Instruct-2507
HF_TIMEOUT_MS=20000
HF_TOKEN=your_token_here
```

**Strengths:**
- Variable names (`ENABLE_LLM_INFERENCE`, `HF_MODEL_ID`, `HF_TIMEOUT_MS`, `HF_TOKEN`) match `backend/src/config/env.ts` exactly.
- Default model identifier (`Qwen/Qwen3-4B-Instruct-2507`) matches `DEFAULT_HF_MODEL_ID`.
- Timeout value (`20000`) matches `DEFAULT_HF_TIMEOUT_MS` and satisfies the $[1000, 30000]$ bounds.
- Token value is a generic placeholder (`your_token_here`). No real tokens, secrets, or internal URLs are exposed.

**Discrepancies & Operational Risks:**
1. **Unsafe Default (`ENABLE_LLM_INFERENCE=true`):**
   - In `backend/src/config/env.ts`, inference defaults to disabled unless explicitly set to `'true'`.
   - In `docs/D2-runbook.md` (line 53), the runbook instructs:
     ```ini
     # Optional Hugging Face hosted inference. Keep disabled unless backend secrets
     # and inference-provider credits are configured outside source control.
     ENABLE_LLM_INFERENCE=false
     ```
   - Setting `ENABLE_LLM_INFERENCE=true` alongside placeholder `HF_TOKEN=your_token_here` in `.env.example` means that if a new developer copies `.env.example` to `.env`, the backend detects a non-empty token string (`"your_token_here"`), attempts outbound requests to `https://router.huggingface.co`, and immediately receives HTTP 401 Unauthorized errors before falling back.
   - *Recommendation:* Set `ENABLE_LLM_INFERENCE=false` in `.env.example` (matching the runbook), and comment out `HF_TOKEN` with `# HF_TOKEN=`.

2. **Uncommented Database Override (`DATABASE_URL`):**
   - In HEAD (`8fdea92`), line 31 was commented:
     `# DATABASE_URL=postgresql://campus_duo_app:cs455@127.0.0.1:5432/campus_duo_dev`
   - In the modified file, it is uncommented:
     `DATABASE_URL=postgresql://campus_duo_app:cs455@127.0.0.1:5432/campus_duo_dev`
   - In `backend/src/config/db.ts`:
     `const poolConfig = config.db.connectionString ? { connectionString: config.db.connectionString } : { host: ..., port: ... }`
   - *Issue:* When `DATABASE_URL` is active, any local adjustments a developer makes to `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, or `PGPASSWORD` (lines 24–28) are silently ignored because `connectionString` takes precedence.
   - *Recommendation:* Re-comment `DATABASE_URL` with `#` so discrete `PG*` variables remain authoritative for local setups.

3. **Uncommented SMTP Defaults:**
   - Lines 17–21 uncomment `SMTP_HOST=smtp.iitk.ac.in` and `SMTP_PORT=587` with empty `SMTP_USER` and `SMTP_PASS`.
   - In `backend/src/config/env.ts`, `EMAIL_TRANSPORT=auto` switches from in-memory to SMTP if `SMTP_HOST` is defined. For local offline testing, an uncommented `SMTP_HOST` without credentials causes delivery failures if `EMAIL_DELIVERY_REQUIRED=true`.
   - *Recommendation:* Re-comment SMTP provider overrides as in baseline HEAD.

---

## 3. Detailed Findings: `docs/D2-runbook.md`

### 3.1 Review of Diff
The runbook diff contains exactly two focused modifications:
1. **Section 1.2 (Environment Configuration, lines 51–56):**
   - Replaced obsolete `OLLAMA_BASE_URL=http://localhost:11434` with:
     ```ini
     # Optional Hugging Face hosted inference. Keep disabled unless backend secrets
     # and inference-provider credits are configured outside source control.
     ENABLE_LLM_INFERENCE=false
     # HF_TOKEN is backend-only and must be supplied through secret management.
     # HF_MODEL_ID=Qwen/Qwen3-4B-Instruct-2507
     # HF_TIMEOUT_MS=20000
     ```
2. **Section 4.3 (Step 7: AI Assistant Verification, line 287):**
   - Updated offline safety invariant description from "When Ollama/external LLM is offline..." to:
     `When Hugging Face inference is disabled, unconfigured, or unavailable, the endpoint returns grounded candidate cards with status FALLBACK rather than exposing provider errors.`

### 3.2 Integrity of Existing D2 Documentation
- **Preservation:** All database role configurations, migrations (`V001`–`V009`), booking endpoints, transactional outbox instructions, concurrency race tests, and admin verification steps remain 100% intact.
- **Ollama References:** Completely excised. Zero occurrences of `Ollama` remain in `docs/D2-runbook.md` or anywhere in `src/`.
- **Reproducibility:** A developer reading the runbook can immediately understand that Hugging Face inference is optional, how to supply secrets via `HF_TOKEN`, and what response format to expect during local fallback.
- **Minor Improvement Note:** In Step 7 (Verification curl), the sample payload uses `{"courseCode": "CS455", ...}`. Adding a note that `DB05-CS455` is the exact seed catalog code clarifies why the raw endpoint query returns alternative candidates when querying without the `DB05-` prefix.

---

## 4. Cross-File Consistency Audit

| Area | Implementation (`env.ts` / `huggingFaceLlmClient.ts` / `agentService.ts`) | Environment Template (`backend/.env.example`) | Documentation (`docs/D2-runbook.md`) | Consistency Assessment |
|---|---|---|---|---|
| **Default Inference State** | Disabled (`false`) by default | **`true` (Unsafe default)** | **`false` (Safe default)** | **MISMATCH:** `.env.example` has `ENABLE_LLM_INFERENCE=true`. Should be `false`. |
| **Model Selection** | `Qwen/Qwen3-4B-Instruct-2507` | `Qwen/Qwen3-4B-Instruct-2507` | `Qwen/Qwen3-4B-Instruct-2507` | **Consistent** |
| **Timeout Bounds** | 20,000 ms (clamped $1000..30000$) | 20,000 ms | 20,000 ms | **Consistent** |
| **Missing-Token Handling** | Triggers fallback without network call | Placeholder `your_token_here` | Instructs supplying via secret management | **Consistent** (when disabled by default) |
| **Privacy / Grounding** | Anonymizes candidates to `candidate_1` | N/A | Documents grounding assertions | **Consistent** |
| **Error Sanitization** | Provider errors suppressed; sanitized generic message | N/A | Documents fallback rather than provider error leakage | **Consistent** |

---

## 5. Security & Credential Safety Findings

1. **No Secret Leakage in Tracked Changes:**
   - Both `backend/.env.example` and `docs/D2-runbook.md` were scanned.
   - Zero real API keys, Hugging Face bearer tokens, scrypt password hashes, or session tokens exist.
   - `PGPASSWORD=cs455` is the public standard credential documented in course setup guidelines.
2. **Untracked Sensitive Artifact (`localhost.har`):**
   - `localhost.har` remains untracked in the root directory.
   - It was not staged in Commit A and must not be staged in Commit B.

---

## 6. HAR & Repository Hygiene Recommendation

### Current Situation
- `localhost.har` is an untracked HTTP Archive dump from developer browser sessions.
- Root `.gitignore` ignores `.env`, `node_modules/`, `coverage/`, and editor files, but has **no entry for HAR files**.

### Proposed Ignore Rule
```gitignore
# HTTP archive network dumps
*.har
```

### Scope & Trade-offs
- **Rule:** `*.har`
- **Scope:** Ignores any `.har` file across all repository directories.
- **Safety:** HAR files are diagnostic browser network recordings that contain session headers, cookies, and tokens. They are never valid application source code.
- **Trade-off:** Zero downside. Wildcard `*.har` prevents accidental leakage by any developer or tool in the future.
- *Action:* Recommend committing this `.gitignore` update as part of housekeeping or Commit B.

---

## 7. Outstanding Validation Gaps

1. **Live Hugging Face Authenticated Request:**
   - The Hugging Face client adapter has been thoroughly tested with mocked responses (18 tests) and local database safety tests (13 tests).
   - Live external request verification against `router.huggingface.co` using an active token has not yet been executed.
2. **Offline Local `.env` Verification:**
   - Confirming that copying `.env.example` to `.env` with `ENABLE_LLM_INFERENCE=false` boots the backend cleanly with zero network warnings.

---

## 8. Proposed Commit B Boundary & Specific Corrections

### Recommended Readiness Status: **READY WITH MINOR FIXES**

### Specific Fixes Required Prior to Committing Commit B:
1. In `backend/.env.example`:
   - Change line 34 from `ENABLE_LLM_INFERENCE=true` to `ENABLE_LLM_INFERENCE=false` (matching `docs/D2-runbook.md`).
   - Change line 37 from `HF_TOKEN=your_token_here` to `# HF_TOKEN=` (or keep placeholder clearly commented so developers know inference won't initiate until configured).
   - Re-comment line 31: `# DATABASE_URL=postgresql://campus_duo_app:cs455@127.0.0.1:5432/campus_duo_dev` to prevent overriding discrete `PG*` variables.
   - Re-comment lines 17–21 for `SMTP_*` settings.

### Proposed Commit B Specification (After Fixes Applied)
- **Commit Message:**
  ```text
  docs(agent): update runbook and environment templates for Hugging Face inference
  ```
- **File List (2 files):**
  - `backend/.env.example`
  - `docs/D2-runbook.md`
- *(Optional 3rd file if authorized: `.gitignore` containing `*.har`)*

---

## 9. Final Execution & Safety Confirmation

- **Files Staged:** 0
- **Files Committed:** 0
- **Files Pushed:** 0
- **Files Deleted:** 0
- **Files Modified:** 0 (This audit produced only the new file `COMMIT_B_REVIEW.md`).
- **Protected Files:** `PROJECT_HANDOFF.md`, `D2_implementation_plan.txt`, `Deliverables/D1/`, and both historical worktrees were left completely untouched.

---
*(End of Audit Report)*
