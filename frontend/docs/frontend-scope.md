# Campus Duo — Frontend Scope Specification

**Document Version**: 1.1.0-stage01-revised  
**Project**: Campus Duo (IIT Kanpur Study-Partner Matching, Consent-First Social Connections, and Study Table Booking)  
**Status**: Stage 01 Revised Scope Specification (Supersedes prior study-only scopes)

---

## 1. Executive Summary & Provenance

### 1.1 Scope Provenance & Authority
This specification defines the frontend scope for **Campus Duo**, an IIT Kanpur student platform. Its authority structure is partitioned into four explicit tiers:

1. **User-Approved Directives (Confirmed)**:
   - Dual-scope frontend: Course-grounded study-partner matching **AND** consent-first social connections.
   - Personas: Enrolled IIT Kanpur Students and Campus Administrators.
   - Transactional shared-study-table booking (canonical 2-person table model).
   - AI-assisted recommendations belong in the frontend presentation scope (backend agent orchestration is strictly out of frontend scope).
2. **Inherited Planning Assumptions (Provisional Planning Defaults)**:
   - Provisional technology stack: React 18, TypeScript 5.7, Vite 6, Tailwind CSS 3.4, TanStack Query 5, React Hook Form 7, Zod 3.
3. **Proposed Team Defaults (Implementation Proposals)**:
   - Kyoto-inspired academic craft aesthetic for marketing hero surfaces; clean, high-contrast, distraction-free functional views for study bookings and student discovery.
   - Typed service adapter pattern isolating UI components from API transport details.
   - In-memory deterministic mock fixtures for developmental validation.
4. **Unresolved / Open Policy Questions (Awaiting Stakeholder Decisions)**:
   - **Social Scope Categorization (Friendship vs Dating)**: Explicitly **UNRESOLVED**. Generic peer connection interfaces are used provisionally; dating-specific fields (e.g. romance filters, relationship goals, courtship scoring) are strictly deferred.
   - Campus identity provider protocol (SSO/LDAP/OIDC): No verified production endpoint exists; mock authentication is used provisionally.
   - Student orientation gating, blocking ripple effects, and account retention.

---

## 2. Primary Personas & Roles

### 2.1 Student Persona (`ROLE_STUDENT`)
* **Undergraduate & Postgraduate Students**: Enrolled IITK students verified via IITK campus email/SSO credentials (`@iitk.ac.in`).
* **Core Capabilities**:
  * Discover academic study partners based on shared courses (e.g., CS455, MTH101, ESC102), study style, and revision pace.
  * Form study pairs and reserve physical 2-person study tables at campus facilities (PK Kelkar Library, Computer Centre).
  * Opt in independently to social discovery based on campus activities, clubs, sports, and hobbies.
  * Maintain granular, revocable consent over profile visibility.

### 2.2 Administrator Persona (`ROLE_ADMIN`)
* **Student Senate / Facility Administrators**:
  * Oversee study table capacity, maintenance statuses, and slot availability.
  * Review reported student interactions in a moderation queue.
  * Inspect administrative audit logs and facility usage analytics.

---

## 3. Requirement Inventory & Implementation Status

| Requirement ID | Domain | Requirement Name | Provenance Tier | Documented | Implemented (Stage 01) | Verified (Stage 01) |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| **REQ-AUTH-01** | Auth | Shared Campus Authentication | User-Approved | Yes | Preview Mock Session | Types & Fixtures Tested |
| **REQ-AUTH-02** | Auth | Session Recovery & Callbacks | Proposed Default | Yes | Deferred to Auth Stage | Documented Only |
| **REQ-ONB-01** | Onboarding | Academic Profile Setup | User-Approved | Yes | Zod Input Demo | Component Test Passed |
| **REQ-ONB-02** | Onboarding | Independent Social Consent Opt-In | User-Approved | Yes | Deferred to Onboarding | Documented Only |
| **REQ-STUDY-01** | Study | Course-Grounded Study Discovery | User-Approved | Yes | Preview Partner Card | Types & Fixtures Tested |
| **REQ-STUDY-02** | Study | Study Partnership Requests | User-Approved | Yes | Button Action Trigger | Component Test Passed |
| **REQ-SOC-01** | Social | Generic Social Discovery | User-Approved (Categories Open) | Yes | Provisional Tags Demo | Types & Fixtures Tested |
| **REQ-SOC-02** | Social | Mutual Consent Handle Reveal | User-Approved | Yes | Masked Fixture Demo | Fixture Test Passed |
| **REQ-BOOK-01** | Booking | 2-Person Table Availability Grid | User-Approved | Yes | Interactive Slot Matrix | 2-Person Model Tested |
| **REQ-BOOK-02** | Booking | Transactional Table Reservation | User-Approved | Yes | Selection & Confirm UI | Interactive Preview Tested |
| **REQ-BOOK-03** | Booking | Booking Management & Cancellation| User-Approved | Yes | Deferred to Booking | Documented Only |
| **REQ-AI-01** | AI Recs | Recommendation Explainability | User-Approved (Frontend Scope) | Yes | Match Reasoning Card | Mock Boundary Tested |
| **REQ-NOTIF-01** | Notifications | In-App Activity Notifications | Proposed Default | Yes | Interface Placeholder | Types Compiling |
| **REQ-MOD-01** | Moderation | User Reporting & Blocking | Proposed Default | Yes | Interface Placeholder | Types Compiling |
| **REQ-ADM-01** | Admin | Table Inventory Oversight | User-Approved | Yes | Interface Placeholder | Types Compiling |
| **REQ-ADM-02** | Admin | Moderation Queue Review | User-Approved | Yes | Interface Placeholder | Types Compiling |
| **REQ-ADM-03** | Admin | Administrative Audit Logging | Proposed Default | Yes | Interface Placeholder | Types Compiling |

---

## 4. Strict Scope & Architectural Boundaries

### 4.1 In Scope (Frontend Responsibilities)
* High-fidelity, accessible web interface adapting the Kyoto craft atmosphere on marketing surfaces and high-density clarity on functional app surfaces.
* Typed service adapters abstracting all data access; UI components consume abstract interfaces.
* Client-side navigation guards for authenticated student and administrator routes.
* Presentation of AI-assisted match recommendations with transparent, explainable factors.
* Real-time form validation via Zod schemas, keyboard accessibility with visible focus rings, and OS-compliant `prefers-reduced-motion` adherence.

### 4.2 Out of Scope (Explicitly Excluded / Backend Responsibilities)
* **Authoritative AI Matching & Agent Orchestration**: Backend owns eligibility validation, model prompting, vector embedding search, candidate ranking, and agent tool execution. The agent UI has **zero autonomous authority** to execute table bookings or send messages.
* **Database Transactions & Concurrency Locks**: Table reservation confirmations are server-authoritative. The client displays provisional lock states and conflict dialogs, but backend infrastructure enforces ACID isolation.
* **Dating Features & Courtship Fields**: Romantic match filters, courtship prompts, and dating algorithms are strictly excluded. Generic social terminology is enforced.
* **Verified Backend Contracts**: No actual backend API or IITK CC LDAP/OAuth2 endpoint is verified. All network payloads are simulated via typed mock adapters.
