# Campus Duo — Architectural Decision Register (ADR)

**Document Version**: 3.2.0-stage08-implemented
**Status**: Stage 08 Complete Mock Study-Table Booking Workflow Reconciled

---

## 1. Decision Provenance & Tier Summary

| Decision ID | Area | Decision Title | Status | Approval Source / Provenance |
| :--- | :--- | :--- | :--- | :--- |
| **DEC-01** | Social Scope | Friendship vs Dating Categorization | **UNRESOLVED / OPEN** | Stakeholder directive: Generic clubs and hobby interest tags only. Dating-specific scope strictly deferred. |
| **DEC-02** | Scope Baseline | Dual Study Matching & Social Connections | **USER-APPROVED** | User prompt baseline: Course matching AND consent-first social networking. |
| **DEC-03** | Booking Model | Canonical Two-Person Study-Table Reservations | **PROVISIONAL PROPOSAL** | Team baseline: `capacity: 2` enforced across all table matrices. |
| **DEC-04** | AI Scope | Frontend Recommendation Presentation & Boundaries | **USER-APPROVED** | User prompt: Frontend displays transparent reasoning factors; zero autonomous booking authority. |
| **DEC-05** | Identity Provider| Campus Identity Protocol & Endpoint Integration | **UNRESOLVED / OPEN** | **Amended (Stage 02 Repair)**: Copy neutralized to *"Authentication integration pending"*. No claims of IITK CC SSO, LDAP, OAuth, or JWT issuance. |
| **DEC-06** | Eligibility | First-Year Student Orientation Policy | **UNRESOLVED / OPEN** | Awaiting campus student senate guidance. |
| **DEC-07** | Social Taxonomy | Profile Interest Tag Categorization | **PROVISIONAL PROPOSAL** | Initial 4-category taxonomy used as configurable proposal. |
| **DEC-08** | Communications | In-App Direct Chat vs Handle Exchange | **UNRESOLVED / OPEN** | **Amended (Stage 02 Repair)**: Contact handle disclosure is unapproved; fixtures are fictional with pending-policy labels. Direct chat is feature-flagged (`VITE_ENABLE_MESSAGING`) and excluded from production navigation. |
| **DEC-09** | Moderation & Opt-out | Connection Persistence on Social Discovery Revocation | **UNRESOLVED / OPEN** | **Amended (Stage 02 Repair)**: Whether existing connections remain accessible after discovery opt-out is an open decision. Opting out pauses discovery feeds without silently deleting connections. |
| **DEC-10** | Booking Workflow | Multi-Party RSVP Grace Period | **UNRESOLVED / OPEN** | Awaiting booking stage requirements. |
| **DEC-11** | Booking Policy | Advance Reservation Windows & Session Limits | **PROVISIONAL PROPOSAL** | **Amended (Stage 02 Repair)**: 7-day windows and 2-hour limits removed from standard policy notices and classified strictly as demonstration assumptions. QR preview explicitly states it is not a valid reservation or check-in credential. |
| **DEC-12** | Privacy & Data | Account Deletion Retention & Anonymization | **UNRESOLVED / OPEN** | Awaiting IITK campus data retention guidelines. |
| **DEC-13** | Isolation | Environment Flag Isolation & Demo Showcase | **USER-APPROVED** | Added in Stage 02 Repair: Default production strictly disables demo authentication and preview routes, showing an honest unavailable state. Demo showcase requires explicit configuration and renders a persistent visible identification banner. |
| **DEC-19** | Social Ranking | Grounded Reasons & Deterministic Social Ordering | **PROVISIONAL PROPOSAL** | No numeric social compatibility score. Grounded shared-interest reasons derived from stored public data; deterministic ordering (shared-interest count desc, then displayName asc). Existing unsupported social scores removed/labelled demo-only pending an approved social-ranking spec. |
| **DEC-20** | Social Actions | Independent Social Like, Round Pass & Demo-Store Hide | **PROVISIONAL PROPOSAL** | Social Like creates one-sided `PENDING_SENT` → reciprocal `MUTUAL_CONNECTED` exclusively under mode `SOCIAL`, never `STUDY`, never study-booking eligibility; repeated Like idempotent. `PASS` scoped to a discovery round; `HIDE` persists in the demo store until full demo reset (not permanent production persistence). Study and social action stores remain mode-isolated. Blocking/ineligibility enforced in mock service at read and mutation time, in both directions. |
| **DEC-21** | Connections | Like-Derived Connection Views | **PROVISIONAL PROPOSAL** | Stage 07 derives outgoing/incoming/mutual views from existing STUDY/SOCIAL Like records with stable mode-specific IDs. One-sided visibility is demo-only; participant authorization and public/private projection boundaries are enforced. Reject, withdraw, disconnect, expiry, and post-opt-out/block visibility remain unresolved. |
| **DEC-22** | Booking | Canonical Eligibility and Mock Booking Workflow | **PROVISIONAL PROPOSAL** | Stage 08 uses one reciprocal-STUDY-Like resolver for connection summaries, companion eligibility, creation, and rescheduling. Resource conflicts are authoritative in the mock service. Creator/admin mutation authority and AUTO_APPROVED_DEMO remain demo policy; seven-day windows, cutoffs, overlap, block/disconnect effects, and database concurrency remain unresolved. |
| **DEC-23** | Notifications | Mock In-App Events and Safe Destinations | **PROVISIONAL PROPOSAL** | Stage 09 emits recipient-owned, deduplicated in-memory notifications from committed connection, booking, and report operations. Typed internal destinations are rechecked on open; email, push, realtime, and production delivery remain unavailable. |
| **DEC-24** | Moderation | Report Receipts and Limited Social Blocking | **PROVISIONAL PROPOSAL** | Students may submit bounded reports and view only their own receipts. Blocking excludes supported social discovery/detail/actions symmetrically without deleting existing relationships/bookings/messages. Admin decisions, unblock effects, and wider app-wide blocking remain unresolved. |
| **DEC-25** | Administration | Mock Admin Operations and Redacted Audit | **PROVISIONAL PROPOSAL** | Stage 10 connects admin dashboard, users, reports, resources, bookings, and audits through `IAdminService`. Every privileged call enforces `ROLE_ADMIN`; deactivation is blocked by future confirmed bookings; report decisions require reason/confirmation and do not automatically penalize targets. |
| **DEC-26** | Administration | Frontend Resource Management Safety | **PROVISIONAL PROPOSAL** | Locations, two-person tables, and date-specific fixed slots are managed through typed mock admin methods. IDs and booked meanings are not renamed/reassigned; parent references, valid/non-overlapping times, capacity 2, and future-booking impact are enforced. Deletion and account suspension remain unsupported/pending policy. |

### Stage 11A Open Decisions

The following remain intentionally unresolved and must not be silently settled by backend or frontend implementation:

1. Friendship-only social categories versus dating/romantic categories.
2. Messaging enablement, conversation sharing across modes, and contact-handle disclosure.
3. Withdrawal, disconnect, unblock, and wider blocking effects on existing relationships/bookings/messages.
4. Partner booking approval, booking cutoffs, overlap/concurrency rules, and rescheduling authority.
5. Suspension, permanent removal, retention/anonymization, and dependent-record handling.
6. Production authentication/session protocol and identity provider; no JWT, OAuth, LDAP, or SSO is selected.

---

## 2. Detailed Decision Records & Amendments

### DEC-01: Friendship vs Dating Categorization
* **Status**: **UNRESOLVED / OPEN**
* **Context**: The product scope includes social peer connections. Whether the platform permits romantic matchmaking or is strictly confined to platonic friendships/hobbies remains undecided by stakeholders.
* **Current Stance**: Generic social connection interfaces (`Peer`, `Interest`, `Connection`) are used provisionally. Dating-specific fields (romantic preferences, relationship status, courtship prompts) are **strictly deferred**.
* **Next Steps**: Await formal product policy decision before implementing any social profiles.

### DEC-02: Dual Study Matching & Social Connections Scope
* **Status**: **USER-APPROVED** (Evidence: User prompt project definition)
* **Decision**: Campus Duo includes both academic study-partner matching and consent-first social networking within the frontend scope.
* **Architectural Impact**: Both modules share the authentication layer and design system, but operate under independent consent opt-ins.

### DEC-03: Canonical Two-Person Study-Table Model
* **Status**: **PROVISIONAL PROPOSAL** (Team planning default)
* **Decision**: All study table reservations adhere strictly to the canonical **two-person table model** (`capacity: 2`). Speculative multi-companion or group booking scope is rejected until explicitly requested.
* **Architectural Impact**: Table slot data models, availability grids, and reservation sheets enforce `capacity: 2`.

### DEC-04: Frontend AI Recommendation Scope & Boundaries
* **Status**: **USER-APPROVED** (Evidence: User prompt project definition)
* **Decision**:
  * Frontend owns: recommendation request submission, status polling/listening, grounded match presentation, transparent reasoning factor display, and failure fallbacks.
  * Backend owns: authoritative eligibility, candidate ranking, agent tool authorization, model orchestration, and policy enforcement.
* **Architectural Impact**: Client preview cards are explicitly labelled `Mock-Only Client Preview`. The agent UI has zero autonomous authority to reserve tables or send messages.

### DEC-05: Campus Identity Integration & Protected Fields
* **Status**: **UNRESOLVED / OPEN** (Stage 04 Amended)
* **Provenance & Amendments**:
  * *Original*: Scaffolding generic `IAuthService` interface with mock sessions.
  * *Stage 02 Repair Amendment (User Approved)*: Neutralize all authentication copy across UI and documentation to provider-neutral phrasing: *"Authentication integration pending."* Prohibit claims or assumptions that IITK CC SSO, LDAP, OAuth, or JWT issuance has been chosen, verified, or configured.
  * *Stage 04 Amendment (User Approved)*: Removed all *"verified through IITK CC directory"* and equivalent wording. Identity and academic fields (`userId`, `rollNumber`, `department`, `degree`, `year`, `role`) are read-only demonstration fixtures; their production source, authoritative system of record, and student edit policy remain unresolved. Explicit editable-field projection is enforced in the service adapter; wholesale copying of request objects is rejected with typed error.

### DEC-08: In-App Chat vs Handle Exchange
* **Status**: **UNRESOLVED / OPEN**
* **Provenance & Amendments**:
  * *Original*: Feature-flagged direct chat placeholder card.
  * *Stage 02 Repair Amendment (User Approved)*: Contact-handle disclosure after mutual connection is **not approved**. All displayed handles are marked as fictional fixtures with an explicit pending-policy notice. In-app messaging route (`/app/conversations`) is feature-gated via `VITE_ENABLE_MESSAGING` and excluded from primary navigation; accessing it while disabled falls through to 404 (`NotFoundPage`).

### DEC-09: Connection Persistence on Social Discovery Revocation
* **Status**: **UNRESOLVED / OPEN**
* **Provenance & Amendments**:
  * *Stage 02 Repair Amendment (User Approved)*: Whether existing connections remain accessible after discovery opt-out is explicitly documented as an **open policy decision**. The system must not silently decide this policy. In current UI shells, revoking consent pauses discovery feed inclusion without destroying existing connection records.

### DEC-11: Reservation Policy Limits & QR Credential Boundaries
* **Status**: **PROVISIONAL PROPOSAL**
* **Provenance & Amendments**:
  * *Original*: 7-day advance booking window and 2-hour limits displayed in UI notices.
  * *Stage 02 Repair Amendment (User Approved)*: 7-day advance window and 2-hour durations are removed from standard policy notices and classified strictly as configurable demonstration assumptions. The booking detail QR code preview must clearly state that it is an illustrative demonstration and not a valid table reservation or campus check-in credential.

### DEC-13: Development & Production Environment Isolation
* **Status**: **USER-APPROVED** (Stage 02 Repair)
* **Decision**:
  * **Default Production**: Completely omits demo role switching, mock login buttons, and the design-system preview route (`/preview/design-system` falls through to 404). In-app messaging is disabled unless explicitly enabled. `/login` renders an honest provider-neutral unavailable notice (*"Authentication integration pending"*).
  * **Explicit Demo Showcase** (`VITE_DEMO_SHOWCASE=true`): Separate build configuration featuring an unmistakable, persistent visible demonstration identification banner. Strictly displays illustrative simulations without claims of live authentication or valid reservations.

### DEC-14: Onboarding Mode Selection vs Independent Consent & Resumable Wizard
* **Status**: **USER-APPROVED** (Stage 04)
* **Decision**:
  * Mode selection (`STUDY`, `SOCIAL`, `BOTH`, `NEITHER`) is positioned at the start of the onboarding wizard to guide conditional form fields. Mode selection guides the form layout but **must not automatically grant consent**.
  * Discovery opt-in toggles are explicit, independent, and default to unchecked unless previously committed.
  * Final enabled modes must strictly match explicit consent values; inconsistencies are resolved prior to submission and rejected in the service adapter if inconsistent.
  * Required study-discovery inputs (at least one course and valid non-empty preferred times) are strictly validated only when academic study discovery is enabled; students may complete onboarding with neither mode enabled.
  * Transactional mock save: profile, consent records, and completion state update atomically in the mock store only after full request validation succeeds; failed saves leave prior store records unchanged.

### DEC-15: Self-Preview Architecture
* **Status**: **USER-APPROVED** (Stage 04)
* **Decision**:
  * Explicit self-public-preview methods (`getSelfStudyPreview`, `getSelfSocialPreview`) generate public projections for the authenticated actor even while discovery is disabled.
  * Preview projections display an explicit disclaimer badge: *"Preview only — not currently discoverable"*.
  * Self-preview never weakens third-party discovery eligibility checks and strictly excludes private identity (`rollNumber`, `department`) and contact-derived fields (`email`, `phone`, `maskedHandle`).

### DEC-16: Discovery Opt-Out Consistency & In-Memory Draft Scoping
* **Status**: **USER-APPROVED** (Stage 04)
* **Decision**:
  * Successful opt-out immediately purges the student from the respective public discovery pool (`publicStudyProfiles` / `publicSocialProfiles`), ensuring other mock actors immediately cease discovering the opted-out student upon subsequent query calls.
  * In-memory onboarding drafts are strictly scoped to the active session identity and survive permitted navigation within the session, but are wiped immediately upon logout, identity switch, or mock reset.
  * Obsolete callbacks from earlier sessions are suppressed from mutating the new active session state or triggering navigation.

### DEC-17: Study Compatibility Formula & Deterministic Near-Tie Ordering
* **Status**: **USER-APPROVED** (Stage 05)
* **Decision**:
  * Implement the proposed demo formula: $35C + 25T + 20P + 10L + 10G$ in the mock service layer as a proposed demo ranking specification, not an approved backend implementation.
  * Normalized on a 0–1 scale per factor with overall scores bounded between 0 and 100.
  * Factor weights for missing optional factors (Location, Goals) are omitted and remaining active weights ($W_{\text{active}}$) are renormalized ($rawWeightedSum / W_{\text{active}} \times 100$).
  * Candidates within 1.0 point are marked `isNearTied` and deterministically sorted using availability overlap -> course overlap -> target user ID string comparison. No unseeded randomness or render-dependent ordering.

### DEC-18: Study Like Independence & AI Agent Matcher Simulation
* **Status**: **USER-APPROVED** (Stage 05)
* **Decision**:
  * Independent Study relationship: One-sided study Like sets `PENDING_SENT` without unlocking booking or messaging. Reciprocal Like creates `MUTUAL_CONNECTED` exclusively under mode `STUDY`. Study Like never creates social consent or a social relationship.
  * Pass and Hide are distinct actions: `PASS` dismisses a candidate temporarily; `HIDE` permanently excludes the candidate from discovery queries.
  * Simulated AI matching agent completes immediately with grounded candidate references and explanations. Deterministic fallback returns general study candidates when course has no enrolled peers. The agent has no booking or messaging authority.

### DEC-19: Grounded Social Reasons & Deterministic Ordering
* **Status**: **PROVISIONAL PROPOSAL** (Stage 06)
* **Context**: The social recommendation feed previously surfaced unsupported numeric scores and fictional affinity.
* **Decision**:
  * No numeric social compatibility score is computed. Generic interest/category and text filters are supported; the study compatibility formula is strictly not reused for social.
  * Grounded shared-interest reasons are derived only from stored public data. With no shared interests an explicit "no explicit shared interests" statement is returned rather than fabricated affinity. Empty interests never make optional fields mandatory.
  * Deterministic ordering: shared-interest count descending, then displayName ascending (stable tie-break). No uncontrolled randomness or AI/ML ranking claims.
  * Existing unsupported social score fixtures (if present) are removed or explicitly labelled demo-only pending an approved social-ranking specification.

### DEC-20: Independent Social Like/Boundaries, Round Pass, Demo-Store Hide & Blocking
* **Status**: **PROVISIONAL PROPOSAL** (Stage 06)
* **Decision**:
  * `LIKE`: First Like records one-sided social interest (`PENDING_SENT`); reciprocal Like forms one mutual `MUTUAL_CONNECTED` social relationship exclusively under mode `SOCIAL`. Repeated Like is idempotent (no duplicate connections). Social Like never creates a `STUDY` relationship or grants study-booking eligibility. No withdrawal/disconnect implemented (no approved policy).
  * `PASS`: Dismisses a candidate for a documented social discovery round, cleared by `resetSocialDiscoveryRound`.
  * `HIDE`: Persists within the current demo store until full demo store reset. Not permanent production persistence.
  * Study and social action stores remain mode-isolated. Study Pass/Hide never silently become social Pass/Hide.
  * Eligibility/privacy enforced in the mock service (not only route guards) at read and mutation time: valid student session, actor/candidate social opt-in, self-exclusion, supported blocking/ineligibility rules, and actor-specific Hide/round-Pass exclusions. Direct candidate URLs cannot bypass discovery privacy rules. `Report`/`Block` reuse existing supported services.
  * Connection management workflow is implemented only as Like-derived summary/detail views; full lifecycle actions remain deferred.

### DEC-21: Like-Derived Connection Views
* **Status**: **PROVISIONAL PROPOSAL**
* **Decision**: Connection summaries and details derive state from existing Like records rather than introducing a second invitation/acceptance state machine. `STUDY` and `SOCIAL` relationships remain independent; only mutual STUDY relationships are booking-eligible under current mock rules.
* **Demo Policy**: Incoming and outgoing one-sided Like visibility is labelled as demo-only and is not a production privacy approval. Stored relationships are not deleted when opt-out or blocking policy is unresolved; access is represented as restricted/pending-policy where applicable.

### DEC-22: Canonical Eligibility and Mock Booking Workflow
* **Status**: **PROVISIONAL PROPOSAL**
* **Decision**: Booking companion eligibility is resolved only from reciprocal STUDY Likes. The legacy hardcoded demo-pair authorization is removed, and valid seeded demo pairs carry reciprocal STUDY Likes instead.
* **Demo Policy**: AUTO_APPROVED_DEMO partner approval and creator/admin mutation permissions remain explicitly labelled simulation policy. Location/slot collision checks and operation-token reconciliation are mock-service behavior, not evidence of database concurrency or backend delivery.
* **Unresolved**: Seven-day windows, two-hour limits, cancellation cutoffs, same-pair overlap, block/disconnect effects on existing bookings, physical check-in, QR validity, recurring bookings, waitlists, payments, and multi-companion reservations.
