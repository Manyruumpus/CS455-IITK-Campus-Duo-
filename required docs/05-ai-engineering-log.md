# Campus Duo — AI Engineering Log

**Deliverable:** 1 | **Status:** Initial log; team review pending  
**Purpose:** Record actual AI involvement in requirements and architecture, critiques, edits and evidence. Never present generated text as a completed implementation, human review, or test result.  
**Owner:** TBD | **Last updated:** 23 September 2026

## Entry AIL-001 — D1 document drafting

| Field | Record |
|---|---|
| Date | 23 September 2026 (user's local date). |
| Requester | Mohit Parihar; other team members not specified. |
| Tool | Perplexity AI assistant. Model/version not provided; do not invent. |
| Input | `main_proposal.md` (Campus Duo Detailed Project Blueprint, draft 1.0) and screenshot of the Deliverable 1 checklist. |
| User request (abridged, not verbatim) | Generate separate Markdown documents from the proposal so all required D1 topics are covered, merging related topics as useful, before coding starts. |
| Generated artifact(s) | `01-requirements-and-use-cases.md`, `02-architecture-and-design.md`, `03-initial-traceability-matrix.md`, `04-project-setup-and-sprint-plan.md`, `05-ai-engineering-log.md`. |
| AI-generated suggestions | Modular monolith and transactional booking boundary; fixed two-person table slots; deterministic scoring and read-only agent; conditional MongoDB versus PostgreSQL evaluation. Most were already present as proposal ideas and were organized/expanded into D1 documents, not invented as implemented features. |
| AI limitations observed | Output cannot verify instructor approval, Jira/GitHub integration, real staff access, database transaction hosting, team assignment or actual test outcomes. Proposed slot policies, scoring maps and NFR latency thresholds still need decisions. |
| Immediate editorial control | Drafts mark unverified items as pending and keep evidence columns blank. No claim of tests, implementation, approved architecture or completed integrations. |
| Human review status | Pending; team must verify against course brief, proposal, security policy and platform feasibility. |
| Final acceptance/rejection | Pending reviewer name/date and edits; do not mark accepted merely because files were generated. |

For exact prompt/output provenance, retain the conversation or approved export according to course/privacy rules; this abridged entry alone does not reproduce a verbatim transcript.

## Three AI suggestions for critical evaluation

These are review candidates **from this drafting session and proposal baseline**, not claims of three independently completed LLM experiments. Fill human verdicts with actual reviews.

| ID | Suggestion | Why useful | Risk / challenge | Required validation | Human verdict |
|---|---|---|---|---|---|
| AI-01 | Use a modular monolith with explicit domain modules. | Low deployment overhead and direct booking transaction boundary for a course prototype. | Modules may become tightly coupled without interface and ownership rules. | Team code-structure review; ADR-001 approval. | Pending. |
| AI-02 | Use MongoDB unique partial active-slot index with transactions, but decide only after comparing PostgreSQL. | Storage constraint can guard concurrent claims; transactions protect multi-record transitions. | Intended MongoDB hosting may lack needed transaction setup; index alone does not guarantee atomic reschedule/audit. | ADR-004 spike on actual deployment: concurrent insert, cancellation race, failed reschedule and estimated costs. | Pending. |
| AI-03 | Keep LLM agent read-only and ground its replies in server-calculated scores/reason codes. | Retains usefulness of natural language without delegating booking/permissions to untrusted text. | Prompt injection, leakage, hallucinated explanation and outages remain possible. | Tool allow-list, authorization, malicious-profile, redaction and outage tests. | Pending. |

## Required future entries

For each meaningful AI-assisted engineering activity, add one entry with: date; tool/model as actually known; exact or securely referenced prompt and input version; output artifact/commit; specific suggestion; human critique (correctness, privacy, feasibility and course compliance); edits; accepted/rejected/modified decision with reviewer/date; resulting test or issue reference. Redact credentials and personal data from archived prompts.

| Entry | Date | Prompt/output reference | Critique and changes | Reviewer | Decision/evidence |
|---|---|---|---|---|---|
| AIL-002 | TBD | TBD | TBD | TBD | TBD |
| AIL-003 | TBD | TBD | TBD | TBD | TBD |

**Review rule:** an AI-produced draft does not constitute proof of integration, test execution, project approval or a teammate's critical evaluation.
