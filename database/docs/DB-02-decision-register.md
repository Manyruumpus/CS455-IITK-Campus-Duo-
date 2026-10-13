# Stage DB-02 — Database Decision Register

**Status:** Logical design complete; PostgreSQL target selected; DB-04A migrations drafted; approved MVP policy decisions recorded  
**Evidence boundary:** This register uses local repository documents and frontend contracts only. No external discussion is treated as repository evidence.

## 1. Reconciliation summary

| Topic | Original proposal | Later local evidence | DB-02 status |
|---|---|---|---|
| Database engine | MongoDB with atomic operations/transactions (`Readme.md`, `required docs/main_proposal.md`) | `required docs/02-architecture-and-design.md` ADR-004 remained **Open**; DB-03A records the user's PostgreSQL direction | **CURRENT IMPLEMENTATION DECISION; not an `ARCH-AI-04` or instructor/team approval record** |
| `ARCH-AI-04` | Not present in original proposal/D1 files | Repository-wide search found no local record | **No local decision evidence** |
| Authentication/session | Provider-neutral frontend mock; proposal mentions verification but later docs remove provider claims | `frontend/docs/backend-handoff.md` requires server-authorized session/token context but says protocol is unresolved; `frontend/docs/decision-register.md` DEC-05 is open | **Authorization context required; protocol unresolved** |
| Transactional outbox | Proposal/D1 require audit plus after-commit notification behavior and prefer an outbox | Frontend docs describe only in-memory notification/audit behavior; DB-04A records user approval for the mandatory MVP outbox | **USER-APPROVED MVP; dispatcher later** |
| Fixed slots | Proposal and D1 choose fixed, non-overlapping two-person table slots | Frontend contracts enforce `tableId + localDate + slotId`, capacity 2, slot overlap validation | **Provisional logical baseline** |
| Booking approval | Written requirements asked for review; DB-04A user decision approves auto-confirmation after eligibility validation | `frontend/docs/decision-register.md` DEC-22; DB-04A user-approved MVP policy | **USER-APPROVED MVP: auto-confirm; no pending state** |
| Capacity model | Earlier proposal language sometimes says one capacity unit | D1 and frontend capability docs canonicalize one exclusive two-person table slot | **Use exclusive-table baseline; do not generalize to seat counters** |

## 2. Decision register

| ID | Decision | Evidence | Status | Recommendation | Schema impact |
|---|---|---|---|---|---|
| DB-DEC-01 | Use a transactional database capable of enforcing an active booking claim | `Readme.md` booking invariant; `required docs/01-requirements-and-use-cases.md` FR-07–FR-09; `required docs/02-architecture-and-design.md` ADR-004 | **REQUIRED INVARIANT** | Implement with PostgreSQL and validate through DB-03C concurrency/failure tests | Requires unique active resource key and atomic booking/audit/outbox boundary |
| DB-DEC-02 | PostgreSQL is the target engine for this implementation | MongoDB is the original proposal in `Readme.md` and `required docs/main_proposal.md`; ADR-004 in `required docs/02-architecture-and-design.md` was open; DB-03A records the user's direction | **CURRENT DESIGN DECISION** | Use a supported PostgreSQL major version; keep this explicitly separate from absent `ARCH-AI-04` and from instructor/team approval evidence | Physical PostgreSQL schema, constraints, indexes, transactions, and migration plan proceed in later stages |
| DB-DEC-03 | Fixed exclusive two-person table slot | `required docs/01-requirements-and-use-cases.md` UC-01; `frontend/docs/api-capabilities.md` CAP-BOOK; `frontend/src/types/index.ts` booking types | **PROVISIONAL BASELINE** | Treat a slot as wholly occupied by one pair; capacity is exactly 2 | Active claim key is `(tableId, localDate, slotId)`; no generalized occupancy ledger |
| DB-DEC-04 | Server-side authorization context | `required docs/02-architecture-and-design.md` trust boundary; `frontend/docs/backend-handoff.md` §1 and §3 | **REQUIRED BOUNDARY** | Backend must derive actor from validated server context and ignore caller identity for authorization | Session reference/actor IDs on mutations; no client-editable ownership fields |
| DB-DEC-05 | Concrete session mechanism | `frontend/docs/backend-handoff.md` header and §9; `frontend/docs/decision-register.md` DEC-05 | **UNRESOLVED** | Choose server-side cookie/session or token-backed server context in a later auth decision; do not encode JWT/OAuth/SSO assumptions | Optional `AuthSession` is logical only; provider credentials remain out of DB scope |
| DB-DEC-06 | Transactional outbox for post-commit notifications | `Readme.md` audit/notification language; `required docs/01-requirements-and-use-cases.md` UC-01; `frontend/docs/backend-handoff.md` §7; DB-04A user-approved policy | **USER-APPROVED MVP** | Store an outbox event in the same transaction as consequential business state, then dispatch asynchronously later | `outbox_event` is mandatory; worker remains later |
| DB-DEC-07 | Booking approval | `frontend/src/types/index.ts` `PartnerApprovalPolicyStatus`; `frontend/docs/decision-register.md` DEC-22; DB-04A user-approved policy | **USER-APPROVED MVP** | Auto-confirm after server-side participant, eligibility, and mutual-STUDY validation; no pending workflow | `booking.partner_approval_status = NOT_REQUIRED`; only confirmed occupancy |
| DB-DEC-08 | Booking mutation authority | `frontend/src/services/mock/MockBookingService.ts`; `frontend/docs/backend-handoff.md` §3; DB-04A user-approved policy | **USER-APPROVED MVP** | Creator may cancel/reschedule; other participant initially read-only; admin override requires reason and audit | Backend authorization and audit workflow; participant roles remain stored |
| DB-DEC-09 | Consent history and opt-out effects | `frontend/docs/decision-register.md` DEC-09/DEC-16; DB-04A user-approved policy | **USER-APPROVED MVP** | Block new discovery/actions and new bookings involving affected pair; preserve history and allow cancellation; reschedule revalidates | Current consent/history, backend eligibility checks, no destructive cascade |
| DB-DEC-10 | Social/messaging persistence scope | `frontend/docs/decision-register.md` DEC-08; `frontend/src/config/features.ts`; DB-04A user-approved policy | **USER-APPROVED MVP DEFERMENT** | Defer `auth_session`, `conversation`, and `message` tables | Conditional migrations omitted |
| DB-DEC-11 | Retention/deletion/anonymization | `frontend/docs/decision-register.md` DEC-12; DB-04A user-approved policy | **USER-APPROVED INITIAL POLICY** | Use account/resource deactivation; automated deletion/anonymization remains disabled pending later approval | Status/active flags; no destructive retention job |

## 3. Recommendation awaiting approval

**Implementation engine:** PostgreSQL, selected in DB-03A from the user's stated direction. A relational design fits the explicit user/account relationships, mode-scoped pair uniqueness, fixed inventory hierarchy, booking claims, audit records, and transactional outbox. It also makes active booking uniqueness and atomic reschedule/cancel boundaries straightforward to express. This is a current implementation decision, not evidence that `ARCH-AI-04` exists and not evidence of instructor/team approval.

**Implementation gate:** DB-03B may install and initialize PostgreSQL. DB-03C must still test active-claim uniqueness, concurrent final-slot requests, target-conflict reschedule, cancel races, duplicate operation retries, uncertain-response reconciliation, disabled-table races, and transaction recovery.

## 4. Explicit non-decisions

## 5. DB-04A user-approved MVP reconciliation

The following decisions are recorded from the DB-04A user instruction. They are current implementation approvals for this stage, not historical proposal evidence and not proof of instructor/team approval:

- Bookings auto-confirm only after backend validation of both participants, eligibility, and a mutual `STUDY` connection.
- The creator may cancel/reschedule; the other participant initially has read access; an admin override requires an audit reason.
- There is no pending approval workflow or temporary hold. Only `CONFIRMED` occupies a resource.
- Completion is permitted only after the slot has ended; new backdated bookings are rejected by backend workflow, while historical imports require a separate audited operation.
- Rescheduling creates a successor, preserves the source resource and participants, marks the source `CANCELLED` with reason `RESCHEDULED`, and leaves the source unchanged if the target claim fails.
- Transactional outbox is mandatory; dispatcher implementation remains later.
- `auth_session`, `conversation`, and `message` tables are deferred.
- Consent/block ineligibility prevents new discovery/actions and new bookings involving the affected pair, while preserving history and allowing cancellation; rescheduling revalidates eligibility.
- Account and resource deactivation are the initial lifecycle controls; automated deletion/anonymization remains disabled.

- No local evidence supports `ARCH-AI-04`; it is not adopted or rejected by this repository.
- No provider, JWT, OAuth, LDAP, SSO, cookie, or session-store product is selected.
- No GenAI collection is required by DB-02. Agent prompts, model calls, scores, and explanations remain outside database implementation scope; only optional audit metadata may reference an agent/tool decision without storing sensitive prompt content.
- No real-time messaging schema is mandatory.
- PostgreSQL selection does not resolve booking approval/mutation authority, pending-hold occupancy, consent/block consequences, session protocol, retention/deletion, or conditional messaging.
- Historical booking integrity remains unresolved: before finalizing an occupancy constraint, DB-03C must decide whether backdated bookings and duplicate historical claims are permitted. Releasing current occupancy must not allow historical records to be overwritten or made ambiguous.
- DB-03C records a physical PostgreSQL plan without converting the unresolved policies into executable migrations. The plan is not evidence that those policies have been approved.
