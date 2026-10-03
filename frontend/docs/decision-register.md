# Campus Duo — Architectural Decision Register (ADR)

**Document Version**: 1.1.0-stage01-revised  
**Status**: Stage 01 Working Register

---

## 1. Decision Provenance & Tier Summary

| Decision ID | Area | Decision Title | Status | Approval Source / Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **DEC-01** | Social Scope | Friendship vs Dating Categorization | **UNRESOLVED / OPEN** | User directive: *"Social categories and several policies remain undecided."* Kept provisional. |
| **DEC-02** | Scope Baseline | Dual Study Matching & Social Connections | **USER-APPROVED** | User prompt: *"study-partner matching AND consent-first social connections"*. |
| **DEC-03** | Booking Model | Canonical Two-Person Study-Table Reservations | **PROVISIONAL PROPOSAL** | Proposed team default based on user prompt ("shared-study-table booking"). Multi-companion rejected. |
| **DEC-04** | AI Scope | Frontend Recommendation Presentation & Boundaries | **USER-APPROVED** | User prompt: *"AI-assisted recommendations belong in the frontend scope; backend agent authorization/orchestration is not frontend work."* |
| **DEC-05** | Identity Provider| Campus Identity Protocol & Endpoint Integration | **UNRESOLVED / OPEN** | No production backend contract verified. Mock authentication used provisionally. |
| **DEC-06** | Eligibility | First-Year Student Orientation Policy | **UNRESOLVED / OPEN** | Awaiting campus student senate guidance. |
| **DEC-07** | Social Taxonomy | Profile Interest Tag Categorization | **PROVISIONAL PROPOSAL** | Configurable team proposal across 4 broad categories. Not confirmed policy. |
| **DEC-08** | Communications | In-App Direct Chat vs External Handle Exchange | **UNRESOLVED / OPEN** | Awaiting communication stage requirements and privacy policy decision. |
| **DEC-09** | Moderation | Ripple Effects of User Blocking & Disconnecting | **PROVISIONAL PROPOSAL** | Team proposal: immediate feed masking and slot cancellation. Awaiting review. |
| **DEC-10** | Booking Workflow | Multi-Party RSVP Grace Period | **UNRESOLVED / OPEN** | Awaiting booking stage requirements. |
| **DEC-11** | Booking Policy | Advance Reservation Windows & Session Limits | **PROVISIONAL PROPOSAL** | Configurable proposal (7-day window, 2-hour max). Not confirmed campus rules. |
| **DEC-12** | Privacy & Data | Account Deletion Retention & Anonymization | **UNRESOLVED / OPEN** | Awaiting IITK legal and campus data retention guidelines. |

---

## 2. Detailed Decision Records

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
* **Decision**: All study table reservations adhere strictly to the canonical **two-person table model** (Table Capacity: 2). Speculative multi-companion or group booking scope is rejected until explicitly requested.
* **Architectural Impact**: Table slot data models, availability grids, and reservation sheets enforce `capacity: 2`.

### DEC-04: Frontend AI Recommendation Scope & Boundaries
* **Status**: **USER-APPROVED** (Evidence: User prompt project definition)
* **Decision**:
  * Frontend owns: recommendation request submission, status polling/listening, grounded match presentation, transparent reasoning factor display, and failure fallbacks.
  * Backend owns: authoritative eligibility, candidate ranking, agent tool authorization, model orchestration, and policy enforcement.
* **Architectural Impact**: Client preview cards are explicitly labelled `Mock-Only Client Preview`. The agent UI has zero autonomous authority to reserve tables or send messages.

### DEC-05: Campus Identity Integration
* **Status**: **UNRESOLVED / OPEN**
* **Context**: Integration with IITK CC Web SSO / LDAP is required for production, but no verified production endpoints or credentials currently exist.
* **Current Stance**: Scaffolds a generic `IAuthService` interface with deterministic mock sessions (`ROLE_STUDENT`, `ROLE_ADMIN`). Claims of verified live LDAP/OAuth2 endpoints are prohibited.

### DEC-07: Campus Interest Tag Taxonomy
* **Status**: **PROVISIONAL PROPOSAL**
* **Context**: Social networking requires interest tagging.
* **Current Stance**: Proposed initial set of tags across 4 categories (Tech & Academic, Cultural & Arts, Sports & Fitness, Campus Life). Reclassified as a configurable proposal, not a fixed mandatory taxonomy.

### DEC-08: In-App Chat vs Handle Exchange
* **Status**: **UNRESOLVED / OPEN**
* **Context**: Deciding between building full WebSocket persistent chat versus bilateral verified handle exchange (Telegram/Email).
* **Current Stance**: Scaffolds an optional `IConversationService` interface placeholder. Concrete implementation deferred.

### DEC-11: Reservation Policy Limits
* **Status**: **PROVISIONAL PROPOSAL**
* **Current Stance**: 7-day advance booking window and 2-hour session limits are documented as configurable provisional defaults, not immutable campus rules.
