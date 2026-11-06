# Deliverable 3 (D3) — Security Architecture & STRIDE Threat Model Report (KAN-78)

**Milestone:** Deliverable 3 Security & Threat Modeling (KAN-78, KAN-79)  
**Repository:** `C:\Users\cavlc\OneDrive\Desktop\AI\Campus-Duo-Qwen-Integration`  
**Date:** November 5, 2026  
**Auditor:** Quality Assurance & Security Engineering  
**Status:** COMPLETE — STRIDE THREAT MODEL & MITIGATION REGISTER VERIFIED  

---

## 1. Security Architecture & Threat Surface Overview

Campus Duo processes verified institutional identities, bilateral student matchmaking preferences, and capacity-limited room reservations. The architecture employs a defense-in-depth model across the user interface, API gateway, database engine, and external AI inference router.

### Trust Boundaries:
1. **Public Internet / Client Tier:** Untrusted. React web application running in student browsers.
2. **API & Business Logic Tier:** Express.js modular monolith running on Node.js 22.
3. **Data Tier:** PostgreSQL 17 database running with restricted application credentials (`campus_duo_app`).
4. **External Provider Tier:** Hugging Face Serverless Inference Router over HTTPS.

---

## 2. STRIDE Threat Model & Control Matrix (12 Core Security Domains)

| Threat Domain | STRIDE Category | Attack Surface | Verified Existing Control | Verification Evidence | Residual Risk | Engineering Recommendation |
|---|---|---|---|---|---|---|
| **1. Authentication & Session Handling** | Spoofing | `/api/auth/*` | `@iitk.ac.in` domain validation; 6-digit cryptographically random OTPs; 10-minute expiry; 3-attempt lockout; secure random session tokens. | `tests/auth.otp.test.ts` (24 tests passing); `tests/auth.lifecycle.test.ts` | Stolen bearer token before 24h expiration. | Implement sliding session expiration and device fingerprinting in production. |
| **2. Role Separation & Authorization** | Elevation of Privilege | `/api/admin/*` | Server-side `requireRole('ROLE_ADMIN')` middleware inspecting database-backed session claims; returns 403 Forbidden to students. | `tests/auth.lifecycle.test.ts` (student rejected with 403 on `/api/admin/summary`); UI role switcher buttons removed. | Compromised admin account credentials. | Enforce multi-factor authentication (MFA) for administrative roles. |
| **3. Booking Manipulation & Race Conditions** | Tampering | `/api/booking` | PostgreSQL partial unique index `booking_confirmed_resource_uk`; single `BEGIN ... COMMIT` transaction; companion authorization check. | `tests/concurrency.race.test.ts` (10 clients: 1 confirmed, 9 rejected); `tests/booking.lifecycle.test.ts` | Intentional high-frequency reservation denial-of-service. | Add per-user active booking quota limits (max 2 active bookings/day). |
| **4. Input Validation & SQL Injection** | Tampering | All REST routes | Parameterized SQL queries via `pg.query($1, ...)`; strict regex type checks on `courseCode` (`^[A-Za-z0-9-]+$`); prompt length limit (1,000 chars); limit bounds (1–50). | `tests/agent.safety.test.ts` (rejects `CS455; DROP TABLE`); zero raw SQL string interpolations across `repository/`. | Malformed Unicode homoglyph attacks in free-form text. | Introduce input normalization (Unicode NFKC) in validation middleware. |
| **5. Sensitive Student PII Exposure** | Information Disclosure | Matching & Agent APIs | Strict SQL view projections (`queries/03_study_candidates.sql`); exclusion of phone numbers, student roll numbers, and personal emails from API payloads. | `tests/agent.safety.test.ts` asserts absence of `@iitk.ac.in` and `roll_number` in recommendation JSON cards. | Identification via unique departmental course combination. | Enforce k-anonymity (minimum cohort size of 3 students for specialized electives). |
| **6. AI Prompt Injection** | Tampering / Elevation | `/api/agent/recommend` | Agent restricted to read-only database tools; zero write tools; pre/post database row count assertions prove zero mutations. | `tests/agent.safety.test.ts` (injection prompt claiming admin identity fails to create bookings or alter scores). | Prompt jailbreak altering purely subjective conversational tone. | Enforce strict output schema validation on LLM text responses. |
| **7. LLM Output Hallucination & Grounding** | Tampering | Agent explanations | Deterministic `ScoringEngine` computes scores; explanation reasons cross-checked against verified candidate facts (`connectiveWords` & `groundedVocabulary`). | `tests/agent.safety.test.ts` (rejects hallucinated explanations mentioning un-enrolled courses). | Plausible-sounding but ungrounded conversational fluff. | Reject LLM responses containing terms outside verified profile vocabulary. |
| **8. HF Credential Management** | Information Disclosure | Environment & Client | `HF_TOKEN` strictly loaded via backend `process.env`; excluded from frontend Vite bundles; `.env*` gitignored; sanitized error logs. | `backend/.env.example` verified in Commit B; `tests/huggingFaceLlmClient.test.ts` asserts token absence in error logs. | Accidental commit of live token by developers. | Integrate git pre-commit secret scanners (e.g., Gitleaks) into CI pipeline. |
| **9. API Abuse & Rate Limiting** | Denial of Service | Public endpoints | OTP challenge resend 60-second cooldown; attempt limits on OTP verification; connection pool limits (max 10 pool connections). | `tests/auth.otp.test.ts` (rejects resend within cooldown with 429). | Distributed volumetric HTTP flooding against public health endpoint. | Deploy reverse-proxy rate limiting (e.g. Nginx `limit_req` or Cloudflare WAF). |
| **10. Database Access Privileges** | Elevation of Privilege | PostgreSQL Connection | Principle of Least Privilege: application role `campus_duo_app` granted column-level DML only (`V008`); cannot drop tables or mutate audit logs. | `database/migrations/V008__runtime_access_privileges.sql`; application queries run under non-superuser role. | Leaked `campus_duo_app` credentials allow broad DML on user tables. | Enforce TLS connection encryption (`sslmode=require`) in production. |
| **11. Logging & Error Disclosure** | Information Disclosure | Error Handler | Global error handler intercepts errors, strips stack traces and SQL diagnostics, logs generic sanitized messages to clients. | `tests/health.test.ts` asserts 503 response does not leak internal error message; `tests/huggingFaceLlmClient.test.ts` clean logs. | Log file accumulation containing student email addresses. | Configure log rotation and PII masking on application logger stdout. |
| **12. Dependency Vulnerabilities** | Tampering / DoS | Node.js Packages | Remediated `body-parser@1.20.9` and `qs@6.16.2` in Commit C; zero production vulnerabilities detected via `npm audit --omit=dev`. | `STAGE4D_COMMIT_C_REPORT.md`; `npm audit --omit=dev` output clean. | Vulnerabilities in development tooling (`vitest`, `esbuild`, `tinypool`). | Pin exact package versions and run automated Dependabot security scans. |

---

## 3. Residual Security Risks & Hardening Plan

1. **Development Test Harness:** The development bypass header `X-Campus-Duo-Test-Actor` is explicitly deactivated in production (`NODE_ENV=production`). Production deployments must verify that `ALLOW_TEST_HARNESS_AUTH` is permanently disabled.
2. **Session Revocation:** Implement active session blacklisting in Redis or database table upon password change or account deactivation.
3. **Database SSL:** Enable enforced SSL certificate verification (`sslmode=verify-full`) between backend Node.js services and managed PostgreSQL instances.
