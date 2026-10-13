# Stage DB-02 — Logical Database Model

**Status:** Engine-neutral logical design; physical schema deferred to DB-03  
**Model rule:** Every entity below is a candidate persistent source-of-truth record unless marked derived or conditional. Logical types use `UUID/ID`, `TEXT`, `BOOLEAN`, `INTEGER`, `DECIMAL`, `DATE`, `TIME`, `TIMESTAMP`, `JSON`, and enumerations without selecting SQL or document syntax.

## 1. Core identity, profile, and consent

### `UserAccount`

- **Purpose:** durable user identity, role, verification state, onboarding, and lifecycle.
- **Primary identifier:** `user_id` (`ID`).
- **Fields:** `user_id` required; `email_or_provider_subject` required and authority-controlled; `email` optional/private; `roll_number`, `department`, `degree`, `year` optional/authority-controlled; `display_name` required after onboarding; `role` required (`ROLE_STUDENT`, `ROLE_ADMIN`); `verification_status` and `verified_at` optional until identity integration is chosen; `onboarding_status` required; `account_status` required (`ACTIVE`, `SUSPENDED`, `DEACTIVATED`, `ONBOARDED_INCOMPLETE` proposed); `created_at`, `updated_at` required.
- **Relationships:** one account to zero/one `StudentProfile`; one account to many consent/action/connection/booking/report/block/notification/audit records.
- **Integrity/lifecycle:** immutable identity key; unique provider subject/email as applicable; only authorized identity administration changes role/status; suspended/unverified accounts cannot use protected workflows.
- **Exposure:** private self view; minimal admin projection; never public discovery identity fields beyond approved profile projection.

### `AuthSession` — logical/conditional

- **Purpose:** server-side authenticated request context if the selected authentication design persists sessions.
- **Primary identifier:** `session_id` (`ID`).
- **Fields:** `session_id`, `user_id`, opaque session reference/hash, `created_at`, `expires_at`, `revoked_at`, `last_seen_at`, optional device/security metadata.
- **Relationships:** many sessions to one `UserAccount`.
- **Status:** **conditional and unresolved** because local documents require server-authorized context but do not select cookies, JWT, OAuth, SSO, or a session store.
- **Exposure:** never returned as raw secret/session material; only server-side.

### `StudentProfile`

- **Purpose:** private editable profile and study/social source data.
- **Primary identifier:** `user_id` (one-to-one with `UserAccount`).
- **Fields:** `display_name` required; `social_bio` optional; `study_goals` optional; `preferred_location` optional; `study_style` and `preferred_pace` optional; `profile_version` required for optimistic updates; timestamps required.
- **Relationships:** one-to-many `ProfileCourse`, `ProfileInterest`; one-to-many public projection versions if materialized.
- **Integrity:** protected identity fields are not client-editable; profile version must prevent stale overwrites.
- **Exposure:** private self/admin-authorized; public projections are separate allow-listed views.

### `Course` and `ProfileCourse`

- **Purpose:** canonical course/topic catalog and student enrollment declarations.
- **Primary identifiers:** `course_id`; composite logical key `(user_id, course_id)` for `ProfileCourse`.
- **Fields:** course code/name/department required; instructor optional; enrollment timestamps/status optional.
- **Relationships:** one course to many profile enrollments; one profile to many courses.
- **Integrity:** canonical course code unique; no duplicate enrollment per profile.
- **Exposure:** approved course code/name may appear in study projection; authority/source of enrollment remains unresolved.

### `SocialInterest` and `ProfileInterest`

- **Purpose:** controlled social interest vocabulary and profile selections.
- **Primary identifiers:** `interest_id`; composite `(user_id, interest_id)`.
- **Fields:** tag name/category required; description optional; selection timestamps.
- **Relationships:** many-to-many between users and interests.
- **Integrity/exposure:** canonical tag IDs; public only when social consent is active.

### `ConsentRecord` and `ConsentHistory`

- **Purpose:** independent study/social discovery consent.
- **Primary identifiers:** current `consent_id`; history `consent_event_id`.
- **Fields:** `user_id`, `mode` (`STUDY`/`SOCIAL`), `has_consent`, `consented_at`, `revoked_at`, `policy_version`, `updated_at`; history includes event type/source.
- **Relationships:** many history events to one user/mode; one current record per user/mode.
- **Lifecycle:** disabled → enabled only after mode-specific validation; enabled → disabled removes new discovery eligibility; no implicit effect on existing records until policy approval.
- **Exposure:** private/admin policy scope; used by authorization and filtering, never raw public.

## 2. Discovery and relationships

### `DiscoveryAction`

- **Purpose:** mode-specific `LIKE`, `PASS`, and `HIDE` intent.
- **Primary identifier:** `action_id`.
- **Fields:** `actor_user_id`, `target_user_id`, `mode`, `action_type`, `discovery_round_id` optional, `created_at`, `updated_at`, optional policy version.
- **Relationships:** two users; contributes to one mode-specific relationship.
- **Integrity:** actor != target; unique current action per `(actor,target,mode)` if storing current state; action history may use a separate append-only record. `PASS` is round-scoped in frontend behavior; `HIDE` persistence duration is pending policy.
- **Exposure:** actor/system only.

### `Connection`

- **Purpose:** mode-specific pair relationship and mutual-match gate.
- **Primary identifier:** `connection_id`.
- **Fields:** canonical `user_a_id`, `user_b_id`, `mode`, `status` (`PENDING_SENT`, `PENDING_RECEIVED` derived for viewer, `MUTUAL_CONNECTED`, `DISCONNECTED`); `note` optional; timestamps; `restricted_reason` optional.
- **Relationships:** one canonical pair per mode; a study connection may authorize bookings.
- **Integrity/lifecycle:** no self-pair; reciprocal likes transition pending → mutual; repeated likes idempotent; only mutual `STUDY` connection is booking-eligible. Withdrawal/disconnect/expiry are proposed additions, not current frontend states.
- **Exposure:** participant-scoped summary/detail; no raw private profile fields.

## 3. Resource inventory and booking

### `StudyLocation`

- **Purpose:** admin-managed campus/demo location.
- **Primary identifier:** `location_id`.
- **Fields:** name/building/open_time/close_time/features/noise_policy required as applicable; `active` required; timestamps.
- **Relationships:** one location to many tables and slots.
- **Lifecycle:** active → inactive; permanent deletion is not supported by local evidence.
- **Exposure:** active inventory to authorized booking reads; admin management fields restricted.

### `StudyTable`

- **Purpose:** exclusive two-person bookable table.
- **Primary identifier:** `table_id`.
- **Fields:** `location_id`, `table_number`, `capacity=2`, `active`, timestamps.
- **Relationships:** one table to many date-specific slots and bookings over time.
- **Integrity:** table number/ID uniqueness within the required scope; parent location exists; capacity is fixed at 2.
- **Lifecycle:** active ↔ maintenance/inactive; future confirmed bookings block unsafe deactivation or meaning-changing edits.

### `StudySlot`

- **Purpose:** fixed date-specific interval for one table.
- **Primary identifier:** `slot_id`.
- **Fields:** `table_id`, `location_id`, `local_date` (`DATE`), `start_time`/`end_time` (`TIME`), `zone`, `status` (`AVAILABLE`, `RESERVED`, `OCCUPIED`, `LOCKED_MAINTENANCE`), timestamps.
- **Relationships:** many slots to one table; one slot/date key to zero/one active booking under exclusive policy.
- **Integrity:** campus timezone `Asia/Kolkata`; start < end; no overlap for same table/date; inactive parent makes slot unavailable.
- **Lifecycle:** available → occupied/reserved; maintenance lock excludes new booking; historical slots remain for booking history.

### `Booking`

- **Purpose:** durable reservation of one exclusive table/date/slot by an eligible study pair.
- **Primary identifier:** `booking_id`.
- **Fields:** `booking_id`, `connection_id` required for companion booking; `booker_id`; `table_id`, `location_id`, `local_date`, `slot_id`; `status` (`CONFIRMED`, `PENDING_PARTNER_APPROVAL`, `COMPLETED`, `CANCELLED`); `partner_approval_status` (`UNRESOLVED_PENDING`, `AUTO_ACCEPTED`, `NOT_REQUIRED`); `booking_version`; `client_operation_id` optional/required for mutation contract; created/updated/cancelled timestamps; cancellation actor/reason; reschedule lineage.
- **Relationships:** one booking to one connection and one table/date/slot; many `BookingParticipant` rows; many audit/outbox events.
- **Integrity:** active resource claim is unique on `(table_id, local_date, slot_id)` for statuses defined by the approved occupancy policy. Recommended baseline: only `CONFIRMED` occupies; `PENDING_PARTNER_APPROVAL` does not occupy until approval, unless team approves a temporary hold state with expiry.
- **Exposure:** participants and authorized admins; exact booking details never appear in discovery or agent projections.

### `BookingParticipant`

- **Purpose:** pair membership and role snapshot for a booking.
- **Primary identifier:** composite `(booking_id,user_id)` or participant ID.
- **Fields:** user, role (`CREATOR`, `COMPANION`), joined/removed timestamps.
- **Integrity:** maximum two participants; distinct users; participant membership must correspond to the eligible connection.
- **Exposure:** participant/admin only.

### `IdempotencyRecord`

- **Purpose:** deduplicate uncertain/retried mutations.
- **Primary identifier:** `idempotency_id`.
- **Fields:** actor, logical operation (`CREATE_BOOKING`, `RESCHEDULE_BOOKING`, `CANCEL_BOOKING`), client operation ID, request fingerprint, outcome/status, booking ID, response reference, created/expires timestamps.
- **Integrity:** unique `(actor_user_id, operation_type, client_operation_id)`; same key with a different fingerprint is a conflict.
- **Reconciliation:** lookup is by authorized actor + logical operation ID, never by resource key alone. Resource key can identify conflicts, not ownership of an uncertain response.

## 4. Safety, notifications, audit

### `Block`

- **Purpose:** directed actor-to-target safety exclusion.
- **Primary identifier:** composite `(actor_user_id,target_user_id)` or block ID.
- **Fields:** actor, target, status/active, created/revoked timestamps, policy version.
- **Lifecycle:** active block excludes supported discovery/detail/actions in both directions at evaluation time; unblock is unresolved.
- **Exposure:** blocker self view; authorization subsystem; do not reveal unnecessary block existence.

### `ModerationReport`

- **Purpose:** student safety report and admin review case.
- **Primary identifier:** `report_id`.
- **Fields:** reporter, reported user, category, bounded description/evidence reference, status (`PENDING_REVIEW`, `WARNED`, `SUSPENDED`, `DISMISSED`), reviewer, reviewed_at, review_reason, audit reference, timestamps.
- **Lifecycle:** pending → one terminal decision; duplicate pending submissions may be idempotent.
- **Exposure:** reporter receives limited receipt; admins receive scoped case data; reported user does not receive evidence by default.

### `Notification`

- **Purpose:** recipient-owned in-app event state.
- **Primary identifier:** `notification_id`.
- **Fields:** recipient, event type/mode, safe title/body, typed destination reference, `is_read`, read timestamp, dedupe key, created timestamp.
- **Integrity:** recipient-only reads/mutations; dedupe by stable event key.
- **Exposure:** recipient only; typed destination is reauthorized when opened.

### `AuditEvent`

- **Purpose:** append-oriented record of consequential state changes.
- **Primary identifier:** `audit_event_id`.
- **Fields:** actor/role, action, target type/ID, outcome, correlation/request/operation ID, redacted reason/details, timestamp, optional safe network metadata, retention class.
- **Integrity:** append-only application contract; no secrets, raw prompts, report evidence, private profiles, or full message content.
- **Exposure:** scoped admin/audit readers; actor-facing views only where explicitly approved.

### `OutboxEvent`

- **Purpose:** reliable after-commit dispatch of notifications or other approved events.
- **Primary identifier:** `outbox_event_id`.
- **Fields:** event type, aggregate type/ID, payload reference or sanitized payload, dedupe key, status (`PENDING`, `DISPATCHED`, `FAILED`, `DEAD_LETTER` proposed), attempts, next attempt, created/dispatched timestamps, correlation ID.
- **Integrity:** created in the same transaction as the business change; unique dedupe key where appropriate; worker retries must be bounded/idempotent.
- **Exposure:** internal worker/admin diagnostics only.

## 5. Conditional messaging and excluded GenAI storage

`Conversation` and `Message` remain conditional because `frontend/docs/decision-register.md` DEC-08 and `frontend/src/config/features.ts` keep messaging disabled by default. If approved later, use a canonical participant pair, connection/mode reference, message sender/content/timestamps, moderation state, and per-message authorization. Do not make it a prerequisite for study booking.

The GenAI agent remains outside the database implementation scope. Its recommendations and scores are derived from authorized profile/relationship/slot data. If audit requires an agent event, store only sanitized tool/action metadata and correlation IDs; do not store raw prompts, credentials, or sensitive model payloads.

## 6. State transitions

| Area | Evidence-backed states/transitions | Proposed additions |
|---|---|---|
| Consent | disabled → enabled; enabled → disabled; independent `STUDY` and `SOCIAL` records | `PENDING_REVIEW` or consent version only if identity/policy requires |
| Discovery action | no action → `LIKE`/`PASS`/`HIDE`; pass resets by round; like is idempotent | action history/event retention |
| Connection | no reciprocal like → `PENDING_SENT`/viewer-derived `PENDING_RECEIVED`; reciprocal like → `MUTUAL_CONNECTED` | `DISCONNECTED`, withdrawal, expiry; all require review |
| Resource | `AVAILABLE` ↔ `OCCUPIED`; `LOCKED_MAINTENANCE` excludes booking; location/table active ↔ inactive | `RESERVED` only if temporary holds are approved |
| Booking | create → `CONFIRMED` or policy-approved `PENDING_PARTNER_APPROVAL`; confirmed → `COMPLETED` or `CANCELLED`; confirmed → rescheduled confirmed target atomically | `EXPIRED`, `NO_SHOW`, and hold expiry are not currently supported |
| Block | no active block → active block; unblock unresolved | explicit revoked state if unblock is approved |
| Report | `PENDING_REVIEW` → `WARNED`/`SUSPENDED`/`DISMISSED` | appeal/escalation states not supported |

## 7. Enforcement boundary

**Database-enforced or constraint-level:** primary/foreign-key-equivalent identity, canonical pair uniqueness, no duplicate profile enrollment/interest, active booking claim uniqueness, idempotency key uniqueness, valid non-null ownership references, and (where supported) slot overlap prevention or a representation that makes overlap impossible.

**Transactional workflow:** booking creation plus claim plus audit/outbox; reschedule target claim/source release/version update; cancellation plus release/status/audit/outbox; consent update plus public-eligibility projection; moderation decision plus audit; resource deactivation checks against future bookings.

**Backend authorization/policy:** authenticated actor resolution, role checks, participant ownership, mutual-study-match eligibility, consent/block filtering, public projection shaping, report confidentiality, approval policy, rate limits, agent tool authorization, and messaging authorization. The database cannot replace these checks.

## 8. Candidate indexes and supported queries

| Candidate index | Query supported | Status |
|---|---|---|
| unique user/provider identity | session lookup and account uniqueness | required logical constraint |
| `(user_id, mode)` current consent | consent gate and discovery eligibility | required |
| `(user_id, course_id)` and `(user_id, interest_id)` | profile editing and matching filters | required |
| `(actor_user_id,target_user_id,mode)` current action | idempotent action update and relationship derivation | proposed current-state index |
| canonical `(min_user_id,max_user_id,mode)` connection | one relationship per pair/mode | required |
| `(location_id,active)` and `(table_id,active)` | inventory availability | required |
| `(table_id,local_date,start_time,end_time)` | slot availability and overlap checks | required; overlap enforcement is engine-specific |
| unique partial active `(table_id,local_date,slot_id)` | final-slot conflict prevention | required logical constraint; active statuses must be approved |
| `(actor_user_id,operation_type,client_operation_id)` unique | mutation retry/reconciliation | required |
| `(recipient_user_id,is_read,created_at)` | notification inbox/unread count | required |
| `(reporter_user_id,created_at)` and `(status,created_at)` | student receipts/admin queue | required |
| `(target_type,target_id,created_at)` and correlation ID | scoped audit review | required |
| `(status,next_attempt_at)` plus dedupe key | outbox worker polling/retry | conditional on outbox approval |

## 9. Privacy, deletion, and retention proposals

- Use separate private source records and public study/social projections. Never make public discovery a direct unrestricted profile query.
- Students can read/write only their own private profile, consent, actions, reports/receipts, notifications, and authorized booking/connection records. Admins receive minimal projections and scoped moderation/resource/audit access.
- Soft-deactivate users, locations, tables, and slots rather than deleting records referenced by bookings, reports, or audits.
- **PROPOSED — AWAITING REVIEW:** retain booking, moderation, and audit records for a course-approved period; pseudonymize public-facing identity after account deletion while preserving referential integrity for safety/audit obligations.
- Do not retain raw authentication secrets, session secrets, raw agent prompts, private schedules in public projections, or unnecessary report evidence.
- Define exact retention periods, legal/course requirements, erasure exceptions, and anonymization strategy before DB-03.
