# Stage DB-01 — Campus Duo Database Requirements Audit

**Status:** Accepted checkpoint; reconciled by DB-02  
**Scope:** Evidence-backed persistence requirements only. No schema, migrations, database execution, dependencies, backend, or frontend integration were added.

## 1. Files inspected and limitations

### Project and course documents

- `Readme.md`
- `required docs/main_proposal.md`
- `required docs/Project_Proposal_submitted.md`
- `required docs/01-requirements-and-use-cases.md`
- `required docs/02-architecture-and-design.md`
- `required docs/03-initial-traceability-matrix.md`
- `required docs/04-project-setup-and-sprint-plan.md`
- `required docs/05-ai-engineering-log.md`

The documents consistently describe a React/Node/Express/MongoDB proposal, but mark the architecture and database decision as proposed or open. `main_proposal.md` exceeded the single-file viewer limit; its relevant database, booking, agent, entity, and open-decision sections were inspected with targeted search, and the submitted proposal plus D1 documents were readable. No required document was identified as unreadable; no Jira, deployment, or instructor-approval evidence was available in the repository.

### Frontend/configuration

- `frontend/package.json`, `frontend/tsconfig.json`, `frontend/vite.config.ts`
- `frontend/src/types/index.ts`, `frontend/src/types/social.ts`
- `frontend/src/services/interfaces.ts`
- `frontend/src/services/mock/MockAuthProfileServices.ts`
- `frontend/src/services/mock/MockStudySocialServices.ts`
- `frontend/src/services/mock/MockBookingService.ts`
- `frontend/src/services/mock/MockAdminModerationServices.ts`
- `frontend/src/services/mock/notificationEvents.ts`
- `frontend/src/services/mock/studyConnectionEligibility.ts`
- `frontend/src/mocks/store.ts`
- `frontend/src/config/features.ts`
- `frontend/src/app/routes.tsx` and auth/consent guards
- Student pages for onboarding, profile, settings, study/social discovery, connections, booking, notifications, and conversations
- Admin pages for users, reports, tables, bookings, dashboard, and audit logs
- Query hooks under `frontend/src/queries/`
- Stage tests under `frontend/src/tests/`

The frontend is React 18 + TypeScript 5 + Vite, React Router, TanStack Query, React Hook Form/resolvers in the dependency set, and Zod in the dependency set. The inspected feature forms currently use local React state and service-level validation; no durable API client or database adapter was found. `frontend/src/mocks/store.ts` owns an in-memory `MockDatabase`; resets recreate seed data.

## 2. Detected stack and existing database decisions

The root README and course documents identify:

- React frontend; the actual frontend confirms React/TypeScript/Vite/Tailwind.
- Proposed Node.js/Express modular backend, not present in the inspected workspace.
- **MongoDB with atomic operations/transactions** as the planned starting point.
- PostgreSQL as an explicit alternative in `required docs/02-architecture-and-design.md` and `main_proposal.md`.

**Decision status:** MongoDB is the original proposal direction, not an approved implementation decision. The documents require a feasibility spike covering unique active-slot enforcement, transactions, reschedule/cancel failure behavior, duplicate retries, and disabled-resource races. DB-01 installs no engine and adds no dependency.

### DB-02 reconciliation revision note

DB-02 searched all readable local Markdown documentation for `ARCH-AI-04`, PostgreSQL adoption, server-side sessions, and transactional outbox decisions. No local `ARCH-AI-04` record or later PostgreSQL decision was found. `Readme.md`, `required docs/main_proposal.md`, and `required docs/02-architecture-and-design.md` retain MongoDB as a proposal and PostgreSQL as an alternative. The same documents require server-authorized session context and describe audit/outbox writes with after-commit dispatch, but `frontend/docs/decision-register.md` and `frontend/docs/backend-handoff.md` leave the authentication/session protocol and durable outbox implementation unresolved. Therefore DB-02 treats: MongoDB/PostgreSQL as an unresolved engine choice; server-side authorization context as required; the concrete session mechanism as unresolved; and transactional outbox as a required design option for reliable post-commit dispatch, not a completed implementation decision.

## 3. Evidence classification

### Persistent business data indicated by the product

Users/identity and account status; private profiles; consent records; public study/social projections or equivalent privacy-filtered views; course enrollments; study preferences; social interests; study/social likes and pass/hide actions; mode-specific connections/matches; reports and moderation decisions; locations, tables, and fixed slots; bookings and participants; notifications; audit events; and, if approved, conversations/messages.

### Derived values

Compatibility scores, factor contributions, allowed reasons, data-completeness score, near-tie ordering, relationship bucket/counts, booking allowed actions, slot occupancy/reserved count, dashboard counts, unread count, public profile projections, and social shared-interest lists. These may be materialized for performance later, but the source-of-truth and invalidation policy must be explicit.

### Temporary UI/session state

Onboarding wizard step and draft (`DemoAuthContext`), local search/filter controls, open dialogs, loading/error/toast state, query cache, demo role switching, and injected demo clock. These are not database entities. An authenticated production session/token may need server-side persistence or a session store later, but the current frontend only models `UserSession`.

### Mock-only or test-only evidence

Seed identities, synthetic emails/roll numbers, `MockDatabase`, `SEED_*` records, in-memory agent query map, scenario fault injection, demo reset, generated demo IDs, and local notification delivery. They demonstrate fields and workflows but do not establish production retention, identity verification, or database semantics.

### Unclear or unresolved

Allowed institute domain and verification provider; account deletion/retention; whether academic identity fields come from an authoritative source; final database/hosting; slot duration and booking horizon; cancellation and block effects on future bookings; whether either matched member or both must approve a booking; exact profile projection policy after opt-out; report/evidence retention; audit retention and actor/IP policy; notification delivery guarantees; messaging approval and message retention; score-policy reconciliation; and final social-mode scope.

## 4. Feature-to-persistence mapping

| Feature/workflow | Evidence | Persistence requirement | Derived/temporary boundary |
|---|---|---|---|
| Authentication and onboarding | `types/index.ts:12-23,59-81`; `OnboardingPage.tsx`; `MockAuthProfileServices.ts` | Account identity, role, verification/onboarding state, account status, consent timestamps | Session object and draft are not durable profile data; email-domain ownership is not full affiliation proof |
| Study profile/preferences | `types/index.ts:47-56,100-130`; profile page/service | Private editable profile, course enrollments, study preferences, version/audit timestamps | Public study card is a permission-filtered projection |
| Study discovery | `types/index.ts:132-181`; `MockStudySocialServices.ts`; study pages | Consent, likes, pass/hide decisions, optional matching-query ownership/result record | Score, reasons, ordering, completeness, filters are derived; agent result map is mock-only unless product chooses history |
| Social profile/consent | `types/index.ts:198-221`; `MockStudySocialServices.ts`; settings/guards | Separate social consent with timestamp, bio, interest tags, visibility/status | Public social profile and shared-interest reasons are derived/projection data |
| Connections/matches | `types/index.ts:223-306`; connection service; `studyConnectionEligibility.ts` | Mode-specific directed likes and a canonical pair relationship/match with lifecycle | Incoming/outgoing/mutual buckets, counts, booking eligibility are derived |
| Conditional messaging | `services/interfaces.ts:184-192`; `config/features.ts:16`; `routes.tsx` | Only if approved/enabled: conversation, participants, messages, authorization and moderation metadata | Currently feature-flagged off and mock send returns a placeholder; no real message history exists |
| Study-table booking | `types/index.ts:308-390`; `MockBookingService.ts`; booking pages | Location/table/slot inventory, participants, booking state, idempotency operation, version/history, timestamps | Availability, reserved count, allowed actions, dashboard totals are derived |
| Notifications | `types/index.ts:431-460`; `notificationEvents.ts`; notification service | Recipient-scoped notification, event type/mode, destination, read state, created time, dedupe identity | Unread count and filtered lists are derived |
| Blocking/reporting | `types/index.ts:462-484`; moderation service/report dialog/settings | Directed blocks, reports, category, bounded description/evidence, moderation status/reviewer/reason | Discovery exclusion is derived; report visibility must be role/ownership filtered |
| Admin governance | `types/index.ts:501-580`; admin service/pages | Admin role/account state, resource lifecycle changes, report decisions, booking overrides | Dashboard/resource counts are derived |
| Audit records | `types/index.ts:486-499`; admin service; written requirements | Append-oriented actor/action/target/outcome/correlation/time record with redacted reason/details | Audit should not be reconstructed from current state; notification/outbox delivery status may be separate |

## 5. Candidate persistent entities

The following are candidate entities for DB-02. Field requirements are inferred from the frontend contracts and written requirements; they are not yet a final schema.

### 5.1 `UserAccount`

**Purpose/evidence:** identity, role, lifecycle, verification, and access boundary. Sources: `types/index.ts:9-23,100-116`, `mocks/store.ts:24-104`, `Readme.md` roles/authentication, `01-requirements-and-use-cases.md` FR-01/FR-02.

**Candidate fields:** `userId` required and immutable; institute email or privacy-preserving identity reference required; `rollNumber`, display name, department, degree, year optional/authority-controlled; role required (`ROLE_STUDENT`/`ROLE_ADMIN`); verification state and verified timestamp required for protected student workflows; onboarding flag; account status (`ACTIVE`, `SUSPENDED`, incomplete, and future deactivated state); created/updated timestamps.

**Relationships/lifecycle/integrity:** owns one private profile and consent records; is the actor for all likes, bookings, reports, notifications, and audit events. Email identity and external subject must be unique. A suspended/unverified account must not access protected student workflows. Do not allow client writes to role, identity ownership, verification, or account status.

**Privacy:** email, roll number, and exact identity attributes are private/admin-scoped; public discovery projections must exclude them.

### 5.2 `StudentProfile`, `Course`, `ProfileCourse`, `StudyPreference`, `SocialInterest`, `ProfileInterest`

**Purpose/evidence:** editable profile and mode-specific discovery data. Sources: `types/index.ts:36-56,100-130,198-211`, onboarding/profile pages, `MockAuthProfileServices.ts`.

**Candidate fields:** profile/user key required; display name required; courses require canonical course code/name/department, instructor optional; study preferences optional individually but `courses` and non-empty `preferredTimes` required before study opt-in; style, pace, goals, preferred location optional; social bio optional; interest tag id/name/category required when selected; profile version and timestamps recommended.

**Relationships/lifecycle/integrity:** one current private profile per user; many course enrollments and interest tags; course code and interest ID should be canonical/unique within a profile. Identity fields shown read-only in the frontend must be authority-controlled. Consent changes create/remove or hide public projections without deleting private history unless retention policy says otherwise.

**Privacy:** private profile is self/admin-controlled; public study projection may expose display name, department, degree/year, courses, style, pace, preferred time windows, and active status only as approved. Public social projection exposes display name, bio, and interests; no contact details.

### 5.3 `ConsentRecord`

**Purpose/evidence:** independent study and social opt-in/out. Sources: `types/index.ts:25-34`, settings page, consent hooks, `MockStudySocialServices.ts`, `RequireSocialConsent.tsx`.

**Candidate fields:** user, mode (`STUDY`/`SOCIAL`), boolean status, consented-at, revoked-at, updated-at, optional policy/version/source metadata.

**Relationships/lifecycle/integrity:** at most one current record per user/mode, with append-only history preferred for accountability. Enabling study requires at least one course and one preferred time. Mode selection and consent toggles must be consistent during onboarding. Opt-out removes the user from new public discovery; existing connections/bookings persistence is explicitly unresolved.

**Privacy:** consent state is private/admin-scoped; it gates discovery and direct-detail access server-side.

### 5.4 `DiscoveryAction`

**Purpose/evidence:** study/social `LIKE`, `PASS`, `HIDE` actions. Sources: `types/index.ts:132-169`, `types/social.ts:10-28`, study/social services and mock stores.

**Candidate fields:** action ID; actor; target; mode; action; recorded/updated timestamps; optional discovery-round marker and policy version.

**Relationships/lifecycle/integrity:** actor and target must be distinct users; mode is required; unique current action per `(actor,target,mode)` or an explicit action history plus current-state projection. Repeated likes are idempotent. Study and social action stores must remain isolated. Pass resets per discovery round in the mock; hide persists until reset, so durable retention policy is open.

**Privacy:** actions are private to the actor/system and must not be exposed as raw records to the other user or the agent.

### 5.5 `Connection` / `StudyMatch`

**Purpose/evidence:** mode-specific peer relationship and mutual-match gate. Sources: `types/index.ts:223-306`, connection service, `studyConnectionEligibility.ts`.

**Candidate fields:** connection ID; canonical ordered user pair; mode; status (`PENDING_SENT`, `PENDING_RECEIVED`, `MUTUAL_CONNECTED`, `DISCONNECTED`); optional note; created/updated/disconnected timestamps.

**Relationships/lifecycle/integrity:** exactly one current relationship per unordered pair and mode; no self-pairs. One like creates pending state; reciprocal likes create one mutual connection; retries cannot duplicate. Only mutual `STUDY` connections authorize booking. Social connections never authorize booking.

**Privacy:** detail and summaries are participant-scoped and projection-filtered. Blocks and opt-outs can restrict visibility; exact policy for existing connections is unresolved.

### 5.6 `StudyLocation`, `StudyTable`, `StudySlot`

**Purpose/evidence:** admin-managed inventory and fixed bookable units. Sources: `types/index.ts:308-338,529-572`, `MockAdminModerationServices.ts`, booking pages, `main_proposal.md` resource rules.

**Candidate fields:** location ID/name/building/open/close times/features/noise policy/active; table ID/location/table number/capacity (currently exactly 2)/active; slot ID/table/location/local date/start/end/zone/status and optional active flag.

**Relationships/lifecycle/integrity:** location owns tables; table owns slots; IDs unique. Slot date uses campus local date and `Asia/Kolkata`; start < end; slots for one table/date cannot overlap. Resource deactivation/meaning-changing edits are blocked when future confirmed bookings exist; disablement must not erase historical bookings. Capacity is currently a strict two-person table, not a general counter.

**Privacy:** inventory is readable to authorized booking users/admins; unpublished/maintenance resources must not appear as bookable.

### 5.7 `Booking` and `BookingParticipant`

**Purpose/evidence:** capacity-limited reservation for a mutually matched pair. Sources: `types/index.ts:339-390`, `MockBookingService.ts`, `01-requirements-and-use-cases.md` UC-01/FR-07-09.

**Candidate fields:** booking ID; creator/booker; match ID or equivalent eligibility reference; one/two participants and roles; table/location/local date/slot; status (`CONFIRMED`, provisional/pending policy, `COMPLETED`, `CANCELLED`); approval-policy status; booking version; client operation/idempotency key; created/updated/cancelled timestamps; reschedule lineage; cancellation reason/actor for admin actions.

**Relationships/lifecycle/integrity:** booking belongs to exactly one table/date/slot and must reference an active mutual study match at creation. Self-booking is invalid. Enforce one active claim for `(tableId, localDate, slotId)` at storage level. Create is commit-before-success. Reschedule must atomically claim target and release source; conflict/stale failure leaves source unchanged. Cancel is idempotent and releases the active claim. Current mock policy permits creator/admin mutation and companion read-only access; written requirements say either member may be allowed and require team confirmation.

**Privacy:** only participants and authorized admins may read booking details; discovery/agent outputs must not reveal exact private schedules. Admin cancellation requires reason, confirmation, and audit.

### 5.8 `IdempotencyRecord`

**Purpose/evidence:** stable booking operation reconciliation. Sources: `types/index.ts:373-390`, `MockBookingService.ts`, requirements UC-01 and architecture booking design.

**Candidate fields:** caller/user, operation name, client key, request fingerprint, outcome/status, booking ID, response reference, created/expiry timestamps.

**Integrity:** uniqueness scoped by caller and operation/key; a same-key retry returns the original outcome, while another user cannot adopt the key. Retention is unresolved.

### 5.9 `Notification`

**Purpose/evidence:** in-app event notices. Sources: `types/index.ts:431-460`, `notificationEvents.ts`, notification service/pages.

**Candidate fields:** notification ID; recipient; event/mode/type; title/body; optional typed destination to booking/connection/report/settings; read state and read timestamp; created timestamp; dedupe key.

**Integrity/lifecycle:** recipient-scoped reads and mutations; deduplicate repeated transition notifications; notifications should be emitted after the related business transaction commits. Read/unread is mutable UI-facing business state.

**Privacy:** only recipient can view or change read state; body and destinations must avoid confidential moderation notes.

### 5.10 `ModerationReport`, `Block`, and `ModerationDecision`

**Purpose/evidence:** safety controls and governed review. Sources: `types/index.ts:462-484`, report dialog, moderation/admin services, settings page.

**Candidate fields:** report ID, reporter, reported user, category, bounded description/evidence reference, created time, status (`PENDING_REVIEW`, `WARNED`, `SUSPENDED`, `DISMISSED`), reviewer, reviewed time, reason, audit reference; block actor/target/timestamps/status.

**Relationships/lifecycle/integrity:** no self-block; a duplicate pending report with same reporter/target/category/content is idempotently returned by the mock. Reports are not an automatic global penalty. Admin resolution requires role, reason, confirmation, and one-way resolution from pending. A block excludes discovery/contact in both directions in social logic; exact effects on existing matches/bookings need policy.

**Privacy:** reporter receipts expose only the reporter's own limited status; confidential evidence and review notes are admin/moderation scoped. Do not expose report existence or evidence to the reported user by default.

### 5.11 `AuditEvent` and optional `OutboxEvent`

**Purpose/evidence:** traceability for consequential changes. Sources: `types/index.ts:486-499`, admin service, root README audit requirement, written FR-12/NFR-08.

**Candidate fields:** event ID, actor/admin, role, action, target ID/type, outcome, correlation ID, safe/redacted reason, sanitized details, timestamp, optional request metadata/IP, and retention classification. An outbox event may hold post-commit notification/dispatch state.

**Integrity/lifecycle:** append-only audit records; state transition and audit/outbox write must commit together where required; do not log secrets, full private profiles, raw LLM prompts, or confidential evidence. Audit retention and deletion/legal policy are open.

### 5.12 `Conversation` and `Message` — conditional

**Purpose/evidence:** `IConversationService` in `services/interfaces.ts:184-192`, `ConversationsPage.tsx`, `config/features.ts:16`, and routes feature flag. Written requirements mark messaging Should/optional.

**Candidate fields if approved:** conversation ID, canonical participant pair, originating mutual connection/mode, status, created/closed timestamps; message ID, sender, content, sent/edited/deleted timestamps, moderation state, and read receipt if required.

**Integrity/privacy:** only an active mutual study match (or separately approved social policy) may read/send; every read/send must reauthorize current relationship and block state. Current implementation is feature-flagged and mock-only, so DB-02 must not implement it unless separately approved.

## 6. Integrity, consent, privacy, and booking requirements

1. **Authorization is server-side.** UI guards and `ServiceContext.actorSession` are not sufficient. Every read/write must derive actor identity from the authenticated server context, enforce role/resource ownership, and recheck eligibility at mutation time.
2. **Consent is independent by mode.** Study and social opt-in/out are separate records. A missing/withdrawn consent excludes new discovery and direct detail access for that mode. Do not silently infer consent from mode labels.
3. **Public projections are allow-listed.** Never expose email, roll number, credentials, exact private schedules, private chats, sensitive attributes, report evidence, or admin notes in discovery, social, booking, or agent responses.
4. **Mutual match is a hard booking gate.** A pending like, social connection, or one-sided relationship cannot create a study booking.
5. **Booking uniqueness is storage-enforced.** The active claim key is `(tableId, localDate, slotId)` for a fixed two-person table slot. Read-before-write checks alone are not acceptable.
6. **Booking transitions are atomic.** Create, reschedule, and cancel must maintain the active claim and booking state together; reschedule failure preserves the source; cancellation is idempotent; success is returned only after durable commit.
7. **Idempotency is caller-scoped.** Duplicate booking submissions with the same operation key must converge to one outcome; keys cannot be reused across callers or different request fingerprints.
8. **Resource lifecycle preserves history.** Disable/deactivate prevents new bookings but does not delete historical bookings. Meaning-changing edits or removal with future confirmed bookings require audited remediation.
9. **Timezone is explicit.** Slots use a campus-local date and fixed non-overlapping times in `Asia/Kolkata`; date boundaries must not depend on browser timezone.
10. **Notifications follow commit.** Booking, connection, report, and moderation notices should be generated after commit or via a transactional outbox; dedupe keys prevent repeated side effects.
11. **Audit is append-oriented and redacted.** Record consequential booking, moderation, resource, consent, and agent/tool decisions with actor, target, outcome, correlation ID, and safe reason without secrets or private payloads.
12. **Agent is read-only.** Agent query ownership must be isolated; tools may return only authorized projections, deterministic score/reasons, and safe availability. Agent writes, private lookup, and invented reasons are prohibited.

## 7. Frontend-to-written-requirement mismatches

| Area | Frontend evidence | Written requirement | Audit treatment |
|---|---|---|---|
| Database choice | No database adapter; all service implementations are mock/in-memory | README proposes MongoDB; D1 keeps PostgreSQL alternative | Treat MongoDB as proposal only; require DB-02 feasibility decision |
| Booking authority | `MockBookingService` allows creator/admin cancel/reschedule; companion is read-only | Proposal/requirements discuss either member and explicitly say confirm policy | Do not encode either rule as final until approved |
| Partner approval | Config defaults to `AUTO_APPROVED_DEMO`; explicit approval mode throws unsupported | Written requirements leave approval policy pending and say either member may book | Model provisional approval as an explicit state/policy, not implicit truth |
| Capacity representation | Frontend has `capacity: 2`, `reservedCount`, and one confirmed booking per slot | Some proposal text says “one capacity unit”; core design chooses one two-person table claim | Use the canonical table/date/slot active-claim invariant; do not implement a generic seat counter without review |
| Matching score | Frontend splits style and pace into separate optional factors, renormalizes active weights, and uses a goal score of `0.8` when both goals exist | Proposal uses a combined `P` factor; D1 says exact style map/area adjacency remain open | Preserve score as derived and version the policy; resolve the contract before backend implementation |
| Social mode | Fully represented in frontend with separate consent and mode-isolated actions | Requirements mark social/dating mode as later/optional and require separate approval | Existing UI is evidence of a workflow, not final scope approval |
| Messaging | Route/service exists only behind `VITE_ENABLE_MESSAGING`; mock returns empty/placeholder message | FR-14 is Should/if time permits; rich realtime chat is later | Conditional entity; exclude from core DB-02 unless approved |
| Reports and blocks | Block is directed in store; social eligibility checks either-direction blocks; no unblock workflow | Written requirements require block/report but leave effects on existing matches/bookings open | Persist directed blocks/reports; require policy for existing relationships/bookings |
| Notifications | In-memory dedupe and read state; emitted by mock after mutation | Written docs require after-commit notification/audit behavior | Persist notification/outbox semantics in DB-02, not mock timing |
| Verification | Synthetic `.test` accounts and demo role switching | Requirements require allowed institute-email ownership verification | Treat seed auth as mock-only; require real identity/verification decision |

## 8. Open decisions before schema implementation

- Approve MongoDB versus PostgreSQL and the actual hosting/transaction capability.
- Confirm institute domain, verification challenge/SSO, account suspension/reactivation, deletion, and retention.
- Confirm canonical course/topic catalog ownership and whether students may edit enrollment.
- Fix the scoring contract: combined versus split style/pace, location representation, goals representation, optional-data ranking, policy versioning, and tie rotation.
- Decide whether discovery actions are current-state only or retained as an audit/history stream; define discovery-round retention.
- Decide whether existing connections remain visible after opt-out, and how block/report affects existing matches, messages, and future bookings.
- Confirm whether either matched member or both must approve creation, reschedule, and cancellation; align frontend provisional policy with written requirements.
- Fix slot duration, advance-booking window, cancellation window, completion job, timezone/DST assumptions, and whether a pair may hold multiple overlapping/future bookings.
- Decide whether a booking references a durable `Connection`/match snapshot and what happens if the match later disconnects.
- Define notification delivery, deduplication, read retention, and whether an outbox/worker is required in MVP.
- Define report evidence storage, moderation retention, admin scope, and audit retention/redaction/IP policy.
- Approve messaging and social mode as in-scope or defer them; if approved, define consent, authorization, moderation, and retention separately.
- Define agent query/result retention, tool-call audit detail, rate limits, and privacy-safe projection contract.

## 9. Proposed DB-02 scope

1. Record approved decisions and a source-of-truth versus projection map.
2. Produce the reviewed logical model and relationship/cardinality diagram.
3. Define status/state transition tables for consent, connections, bookings, resources, reports, and account status.
4. Select the database engine using the required concurrent booking/reschedule/cancel and failure test plan.
5. Specify indexes/constraints for identity uniqueness, pair uniqueness, consent lookup, active booking claims, slot overlap, idempotency, notification dedupe, and audit correlation.
6. Define privacy projections and authorization boundaries for student, participant, admin, moderation, and agent reads.
7. Define retention, deletion, soft-deactivation, audit, and outbox policies.
8. Only after review, implement migrations/schema and database tests in a later approved stage.

## 10. Files created

- `database/README.md`
- `database/docs/DB-01-requirements-audit.md`

No files outside `database/` were changed for DB-01.
