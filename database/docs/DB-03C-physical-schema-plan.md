# Stage DB-03C — PostgreSQL Physical Schema Plan

**Status:** READY FOR REVIEW — physical catalogue and migration plan complete; no migrations or database changes executed.

## 1. Evidence and physical design boundary

DB-03B execution evidence was supplied by the user and recorded in [`DB-03B-environment-log.md`](DB-03B-environment-log.md): bootstrap completed, `02-verify.sql` passed, both project roles authenticated to `campus_duo_dev`, and role passwords were set privately. The server data directory remains unverified.

This document translates the accepted DB-02 logical model into PostgreSQL names and types. It does not create tables, install Flyway, grant table privileges, or choose unresolved product policies. PostgreSQL schema ownership remains with `campus_duo_migrator`; the application role remains separate.

### Identifier rule

Production primary and foreign keys use PostgreSQL `uuid` with `pg_catalog.gen_random_uuid()` defaults. Frontend IDs such as `userId`, `bookingId`, `tableId`, `slotId`, `connectionId`, `reportId`, and `notification.id` are opaque TypeScript strings and must be mapped by the backend adapter; mock fixture IDs are not production database identifiers. No `pgcrypto` extension is required by these migrations.

### Time rule

Persist instants as `timestamptz`. Persist booking `local_date` as `date` and slot clock values as `time`; interpret them using the fixed campus timezone `Asia/Kolkata`. The backend, not a browser, owns date conversion and authorization.

## 2. Physical table catalogue

All tables below are in schema `campus_duo`. Unless stated otherwise, tables use an immutable `uuid` primary key, `created_at timestamptz NOT NULL DEFAULT now()`, and `updated_at timestamptz NOT NULL DEFAULT now()` where the record is mutable. `updated_at` maintenance is a migration/backend concern, not a database trigger requirement at this stage.

### 2.1 Mandatory identity, profile, consent, and discovery tables

| Table | Columns and PostgreSQL types | Keys, checks, uniqueness, and indexes | Deletion/ownership |
|---|---|---|---|
| `user_account` | `user_id uuid`; `identity_subject text NOT NULL`; `email text`; `roll_number text`; `department text`; `degree text`; `year smallint`; `display_name text`; `role text NOT NULL`; `verification_status text NOT NULL DEFAULT 'UNVERIFIED'`; `verified_at timestamptz`; `onboarding_status text NOT NULL DEFAULT 'INCOMPLETE'`; `account_status text NOT NULL DEFAULT 'ACTIVE'`; timestamps | PK `user_id`; unique `identity_subject`; optional unique normalized email and roll number after identity policy; checks for role `ROLE_STUDENT/ROLE_ADMIN`, nonnegative/valid year, and lifecycle enums; indexes on `(account_status, role)` and lower email if email is used | Referenced identity is retained; account deactivation is a status change. Owned by migrator. Public projections must not expose private identity fields. |
| `student_profile` | `user_id uuid NOT NULL`; `social_bio text`; `study_goals text`; `preferred_location text`; `study_style text`; `preferred_pace text`; `profile_version integer NOT NULL DEFAULT 1`; timestamps | PK/FK `user_id -> user_account`; checks for supported study style/pace and nonnegative version; profile update uses version in workflow | `ON DELETE RESTRICT` from account; owned by migrator. Private source record, never a direct public query. |
| `profile_preferred_time` | `user_id uuid`; `time_code text`; `created_at timestamptz` | PK `(user_id,time_code)`; FK to profile; check against `MORNING/AFTERNOON/EVENING/LATE_NIGHT`; index `(time_code,user_id)` for matching | Delete with profile using `ON DELETE CASCADE`; owned by migrator. |
| `course` | `course_id uuid`; `code text NOT NULL`; `name text NOT NULL`; `department text NOT NULL`; `instructor text` | PK; unique normalized course code; index code/name for filters | Catalog rows are retained or administratively deactivated rather than deleted once referenced. |
| `profile_course` | `user_id uuid`; `course_id uuid`; `enrolled_at timestamptz NOT NULL DEFAULT now()`; optional `enrollment_status text` | PK `(user_id,course_id)`; FKs to account/course; status check if used; index `(course_id,user_id)` | `ON DELETE CASCADE` from profile/account; course deletion restricted. |
| `social_interest` | `interest_id uuid`; `name text NOT NULL`; `category text NOT NULL`; `description text`; `active boolean NOT NULL DEFAULT true`; timestamps | PK; unique normalized `(category,name)`; index active/category | Retain referenced vocabulary; deactivate instead of deleting. |
| `profile_interest` | `user_id uuid`; `interest_id uuid`; `selected_at timestamptz NOT NULL DEFAULT now()` | PK `(user_id,interest_id)`; FKs; index `(interest_id,user_id)` | `ON DELETE CASCADE` from profile/account; interest deletion restricted. |
| `consent_record` | `consent_id uuid`; `user_id uuid NOT NULL`; `mode text NOT NULL`; `has_consent boolean NOT NULL DEFAULT false`; `consented_at timestamptz`; `revoked_at timestamptz`; `policy_version text`; `updated_at timestamptz NOT NULL DEFAULT now()` | PK; unique `(user_id,mode)`; mode check `STUDY/SOCIAL`; check timestamps are coherent; index `(mode,has_consent,user_id)` | Retain current record with account; history is not deleted by an opt-out. |
| `consent_history` | `consent_event_id uuid`; `user_id uuid`; `mode text`; `event_type text`; `has_consent boolean`; `policy_version text`; `source text`; `occurred_at timestamptz NOT NULL DEFAULT now()` | PK; FK to account; checks for mode/event; index `(user_id,mode,occurred_at DESC)` | Append-only application contract; retain according to approved policy. |
| `discovery_action` | `action_id uuid`; `actor_user_id uuid`; `target_user_id uuid`; `mode text`; `action_type text`; `discovery_round_id uuid`; `policy_version text`; timestamps | PK; actor != target check; mode/action checks; unique current action `(actor_user_id,target_user_id,mode)` if this is current-state storage; index actor/mode/action and target/mode | Retain or archive according to approved action-history policy; do not cascade target deletion into safety/audit history without a reviewed anonymization rule. |
| `connection` | `connection_id uuid`; `user_a_id uuid`; `user_b_id uuid`; `mode text`; `status text NOT NULL DEFAULT 'MUTUAL_CONNECTED'`; `note text`; `restricted_reason text`; timestamps | PK; canonical pair check `user_a_id < user_b_id`; unique `(user_a_id,user_b_id,mode)`; mode/status checks; indexes by participant and mode/status | `ON DELETE RESTRICT` while bookings/audit reference it. Pending viewer buckets remain derived from actions; this row represents the mutual match projection. |

`StudyPreferences` maps to `student_profile` plus `profile_preferred_time`; `CourseEnrollment` maps to `course` plus `profile_course`; `SocialInterestTag` maps to `social_interest` plus `profile_interest`. `PublicStudyProfile`, `PublicSocialProfile`, compatibility scores, grounded reasons, and `relationshipStatus` are response projections/derived values, not source tables.

### 2.2 Mandatory inventory and booking tables

| Table | Columns and PostgreSQL types | Keys, checks, uniqueness, and indexes | Deletion/ownership |
|---|---|---|---|
| `study_location` | `location_id uuid`; `name text`; `building text`; `open_time time`; `close_time time`; `has_power_outlets boolean NOT NULL DEFAULT false`; `has_wifi6 boolean NOT NULL DEFAULT false`; `noise_policy text`; `active boolean NOT NULL DEFAULT true`; timestamps | PK; checks `open_time < close_time`, supported noise policy; unique location identity as approved; index `(active,building)` | Soft-deactivate; `ON DELETE RESTRICT` from tables/slots/bookings. Admin-owned. |
| `study_table` | `table_id uuid`; `location_id uuid`; `table_number text`; `zone text`; `capacity smallint NOT NULL DEFAULT 2`; `active boolean NOT NULL DEFAULT true`; timestamps | PK/FK; check `capacity = 2`; unique `(location_id,table_number)`; index `(location_id,active)` | Soft-deactivate; restrict deletion/reassignment when referenced by slots/bookings. |
| `study_slot` | `slot_id uuid`; `table_id uuid`; `location_id uuid`; `local_date date`; `start_time time`; `end_time time`; `zone text`; `status text NOT NULL DEFAULT 'AVAILABLE'`; `active boolean NOT NULL DEFAULT true`; timestamps | PK; composite unique `(slot_id,table_id,location_id,local_date)` and unique `(table_id,local_date,start_time,end_time)`; checks `start_time < end_time`, status `AVAILABLE/LOCKED_MAINTENANCE`, and supported zone; composite FK to table/location; active-table exclusion constraint prevents overlap; index `(table_id,local_date,start_time)` and `(location_id,local_date,status)` | Preserve historical slots; deactivate/lock rather than delete. Booking occupancy is derived from `booking.status`, not stored slot status. |
| `booking` | `booking_id uuid`; `connection_id uuid`; `booker_id uuid`; `table_id uuid`; `location_id uuid`; `slot_id uuid`; `local_date date`; `status text`; `partner_approval_status text`; `booking_version integer NOT NULL DEFAULT 1`; `client_operation_id text`; `created_at timestamptz`; `updated_at timestamptz`; `cancelled_at timestamptz`; `cancelled_by uuid`; `cancellation_reason text`; `rescheduled_from_booking_id uuid`; optional `rescheduled_to_booking_id uuid`; optional `completed_at timestamptz` | PK; FKs to connection/account/table/location/slot and self-lineage; checks status/approval/version and cancellation coherence; composite FK/resource identity `(table_id,local_date,slot_id)`; unique idempotency handled in `idempotency_record`; candidate partial unique index on the resource key for approved occupying statuses; indexes `(booker_id,status,local_date)`, `(connection_id,status)`, `(table_id,local_date,slot_id)` | Historical rows are retained. No hard delete. Status transitions and lineage are transactional workflow rules. |
| `booking_participant` | `booking_id uuid`; `user_id uuid`; `participant_role text`; `joined_at timestamptz`; `removed_at timestamptz` | PK `(booking_id,user_id)`; role check; max two/distinct participants is a workflow trigger/service rule, not a portable row CHECK; indexes `(user_id,booking_id)` | Retain participant snapshots for booking history; removal is timestamped. |
| `idempotency_record` | `idempotency_id uuid`; `actor_user_id uuid`; `operation_type text`; `client_operation_id text`; `request_fingerprint text`; `outcome_status text`; `booking_id uuid`; `response_reference jsonb`; `created_at timestamptz`; `expires_at timestamptz` | PK; unique `(actor_user_id,operation_type,client_operation_id)`; checks operation/outcome; index actor/status/created; fingerprint mismatch is a workflow conflict | Retain long enough for reconciliation, then expire/archive only under approved policy. |

Frontend `CampusLocation`, `AdminLocation*`, `AdminTable*`, and `AdminSlot*` fields map directly to the inventory tables. `StudyTableSlot` is a joined availability projection; `reservedCount` is derived and is not a stored capacity counter under the exclusive-table model. `BookingRecord` is a participant/resource join projection. `clientOperationId` is not a primary key and is never a substitute for `booking_id`.

### 2.3 Mandatory safety, moderation, notification, and audit tables

| Table | Columns and PostgreSQL types | Keys, checks, uniqueness, and indexes | Deletion/ownership |
|---|---|---|---|
| `block` | `block_id uuid`; `actor_user_id uuid`; `target_user_id uuid`; `active boolean`; `created_at timestamptz`; `revoked_at timestamptz`; `policy_version text` | PK; unique active/current pair `(actor_user_id,target_user_id)` as approved; actor != target; indexes actor/target/active | Retain safety history; active filtering is backend policy. |
| `moderation_report` | `report_id uuid`; `reporter_user_id uuid`; `reported_user_id uuid`; `category text`; `description text`; `evidence_reference text`; `status text`; `reviewed_by uuid`; `reviewed_at timestamptz`; `review_reason text`; `audit_event_id uuid`; timestamps | PK; category/status checks; indexes `(status,created_at)`, `(reporter_user_id,created_at)`, reported user; bounded input is backend validation | Retain under approved policy; no cascade deletion of confidential case history. |
| `notification` | `notification_id uuid`; `recipient_user_id uuid`; `event_type text`; `mode text`; `title text`; `body text`; `destination_type text`; `destination_id uuid`; `is_read boolean NOT NULL DEFAULT false`; `read_at timestamptz`; `dedupe_key text`; `created_at timestamptz` | PK; read timestamp coherence; unique `(recipient_user_id,dedupe_key)` where dedupe key is non-null; index `(recipient_user_id,is_read,created_at DESC)` | Recipient-owned records; retain/read-delete only under approved policy. |
| `audit_event` | `audit_event_id uuid`; `actor_user_id uuid`; `actor_role text`; `action text`; `target_type text`; `target_id uuid`; `outcome text`; `correlation_id text`; `operation_id text`; `safe_reason text`; `details jsonb`; `occurred_at timestamptz`; `retention_class text` | PK; outcome check; indexes `(target_type,target_id,occurred_at)`, `(correlation_id)`, `(actor_user_id,occurred_at)`; no secrets/raw prompts/report evidence in backend contract | Append-only; retain/anonymize only under approved policy. |

`NotificationItem`, `ModerationReport`, `ReportReceipt`, and `AuditLogEntry` are filtered projections of these records. `reportedUserName`, `timeWindow`, `allowedActions`, unread counts, and dashboard counts are derived or authorization-filtered.

### 2.4 Conditional tables

| Table | Columns and controls | Inclusion gate |
|---|---|---|
| `auth_session` | `session_id uuid`; `user_id uuid`; `session_secret_hash text`; `created_at`; `expires_at`; `revoked_at`; `last_seen_at`; optional device metadata; unique secret hash | Add only if the selected server-side session mechanism persists sessions. Never store raw session secrets. |
| `outbox_event` | `outbox_event_id uuid`; `event_type text`; `aggregate_type text`; `aggregate_id uuid`; `dedupe_key text`; `payload jsonb` or safe reference; `status text`; `attempts integer`; `next_attempt_at`; `created_at`; `dispatched_at`; `correlation_id text` | Add if transactional outbox is approved. Unique dedupe key where event semantics require it; worker-only access. |
| `conversation` / `message` | canonical participant/connection reference; sender; bounded content; moderation/status timestamps | Add only if `VITE_ENABLE_MESSAGING` becomes an approved production capability. No booking dependency. |

No GenAI result, raw prompt, credential, or model payload table is planned. Matching scores and explanations remain derived; only sanitized audit metadata may be recorded through `audit_event` if approved.

## 3. Constraints and indexes by enforcement layer

### Database-enforced

- Primary keys, foreign keys, non-null ownership references, canonical pair ordering, actor != target, enum/value checks local to one row, `capacity = 2`, valid slot times, profile/course/interest uniqueness, consent uniqueness, idempotency uniqueness, and approved active booking resource uniqueness.
- Foreign keys should use `RESTRICT` for historical resources/bookings/audit and `CASCADE` only for dependent profile selections that have no independent retention obligation.
- Slot overlap is enforced by the PostgreSQL GiST exclusion constraint in V004. The administrator-installed `btree_gist` extension must exist in `public`; adjacent half-open ranges remain valid.

### Transactional workflow

- Booking create: resolve operation, validate current eligibility, validate resource tuple, insert booking/participants, claim occupancy, write audit and approved outbox event, commit together.
- Reschedule: lock/recheck source and target, claim target before releasing source, create successor or approved lineage update, increment versions, write audit/outbox, commit atomically; failure leaves the original claim intact.
- Cancel: idempotently transition the booking, record actor/reason/timestamp, release current occupancy, write audit/outbox, commit together.
- Consent/block/moderation/resource deactivation changes and their audit/outbox records commit as one unit where notifications are approved.
- Participant maximum, reciprocal-study eligibility, parent location/table consistency, future-booking safety, and report confidentiality remain workflow/backend rules rather than cross-table `CHECK` expressions.

### Backend authorization

The server resolves the actor from validated session/token context, enforces role and participant ownership, applies consent/block/public-projection rules, selects safe notification/report projections, and authorizes admin/resource/audit access. PostgreSQL constraints do not replace these checks.

## 4. Booking integrity design

- **Resource key:** `(table_id, local_date, slot_id)` exactly mirrors frontend `tableId + localDate + slotId`; the slot composite identity must agree with the referenced table and date.
- **Capacity:** one exclusive two-person table; no seat counter or generalized occupancy ledger. `capacity = 2` is a row constraint; two distinct participants is a workflow invariant.
- **Occupancy baseline:** `CONFIRMED` occupies. `COMPLETED` and `CANCELLED` do not. The approved MVP has no pending approval or temporary hold state. The physical partial unique index therefore applies only to `CONFIRMED`.
- **Historical preservation:** never delete, overwrite, or reuse a booking row to release occupancy. Retain original resource, actors, timestamps, cancellation reason, and lineage. A successor booking or explicit lineage fields must preserve reschedules.
- **Backdated policy:** unresolved. The recommended option is to reject new backdated bookings and permit historical imports only through a privileged, audited migration path; duplicate historical claims must be rejected or quarantined rather than silently merged.
- **Reschedule:** target conflict leaves the source booking unchanged. Recommended physical model is a new successor row linked by `rescheduled_from_booking_id`, with the source transitioned to an approved historical terminal state; exact terminal status (`RESCHEDULED` versus cancellation-with-lineage) needs migration review.
- **Cancellation:** record `cancelled_at`, `cancelled_by`, reason, and operation identity; repeat cancellation returns the same terminal result and does not emit duplicate success effects.
- **Participants/connection:** exactly two distinct users, linked to the booking's reciprocal `STUDY` connection; social-only or one-sided relationships cannot authorize booking. These are cross-table workflow checks.
- **Idempotency:** unique `(actor_user_id, operation_type, client_operation_id)`; same key with a different request fingerprint is a conflict. Reconciliation uses actor plus operation ID, never the resource key alone.
- **Atomic boundary:** booking state, current occupancy claim, participants, audit event, and approved outbox event commit in one transaction. Notifications dispatch only after commit.

## 5. Consequential decisions requiring approval

All recommendations below are **PROPOSED — AWAITING REVIEW**.

| Decision | Existing evidence | Recommended option | Schema impact | Requires user approval |
|---|---|---|---|---|
| Booking approval and mutation authority | User-approved DB-04A MVP policy; frontend mock uses `AUTO_APPROVED` and creator/admin mutation as demo policy | Auto-confirm after server eligibility and mutual `STUDY` connection; creator may mutate, admin override requires an audit reason | `NOT_REQUIRED` approval field, creator/admin backend authorization | No — approved for MVP |
| Pending bookings and capacity | User-approved DB-04A MVP policy | No pending approval or temporary hold; only `CONFIRMED` occupies | Partial unique index predicate is `status = 'CONFIRMED'` | No — approved for MVP |
| Consent/block effects on existing records | DEC-09 and DEC-24 keep persistence/effects open; current UI pauses discovery and blocks supported discovery actions | Preserve historical connections/bookings; block new discovery/actions immediately; do not cancel existing bookings without explicit safety policy | Active filters only initially; possible restriction/status/audit fields | Yes |
| Authentication/session storage | Backend handoff requires server-authorized context; provider/protocol is open | Keep `auth_session` conditional; core schema stores authority references without provider-specific columns | Optional session table; no JWT/OAuth/SSO assumptions | Yes |
| Transactional outbox scope | Requirements prefer after-commit notifications; no durable implementation exists | Approve outbox for booking, connection, report, and moderation effects; worker remains later | `outbox_event`, dedupe/status/retry fields, worker privileges | Yes |
| Retention/deletion | DEC-12 and DB-02 leave periods/anonymization open | Soft-deactivate accounts/resources; retain booking, safety, and audit history for an approved period; anonymize public identity where allowed | Delete actions, retention metadata, nullable/anonymized references, archive policy | Yes |
| Conditional messaging | DEC-08 and feature flag keep direct messaging disabled by default | Exclude `conversation`/`message` from mandatory migrations until messaging and disclosure policy are approved | Optional module only; no booking dependency | Yes |

The MVP approval blockers are resolved for executable migrations: confirmed-only occupancy, auto-confirmation, creator/admin mutation authority, audited rescheduling/cancellation workflow, backdated booking rejection with a separate historical-import path, and mandatory outbox. Session provider, retention periods, and conditional messaging remain deferred.

## 6. Migration batches and ownership

All migrations run as `campus_duo_migrator` against `campus_duo_dev`; the role owns schema objects and migration history. `campus_duo_app` is not a migration user and receives no DDL privileges.

| Batch | Scope and dependencies | Mandatory? |
|---|---|---|
| `V001` | Confirm schema search path, UUID strategy/extensions, shared updated-at conventions, and core value checks/types | Yes |
| `V002` | `user_account`, `student_profile`, course/interest catalog and profile join tables, preferred times | Yes |
| `V003` | `consent_record`, `consent_history`, `discovery_action`, `connection`, and safety `block` | Yes |
| `V004` | `study_location`, `study_table`, `study_slot`; parent/resource constraints and non-overlap representation | Yes |
| `V005` | `booking`, `booking_participant`, `idempotency_record`; approved occupancy constraint only after policy gate | Yes |
| `V006` | `moderation_report`, `notification`, `audit_event` | Yes |
| `V007` | `outbox_event` and dispatch indexes/grants, only if approved | Conditional |
| `V008` | `auth_session`, only if the selected session design persists server sessions | Conditional |
| `V009` | `conversation`, `message`, only if messaging is approved | Conditional |

Each batch should be transactional unless PostgreSQL requires a specific non-transactional operation. Migrations must be forward-only and reviewed; no reset/destructive migration is part of this plan.

## 7. Proposed application privileges

At the current bootstrap checkpoint, `campus_duo_app` has only database `CONNECT` and schema `USAGE`; it cannot create tables or use business objects. After migrations, the preferred boundary is:

- `campus_duo_migrator`: owns schema and runs migrations; not used by application requests.
- `campus_duo_app`: receives only the minimum `SELECT/INSERT/UPDATE` privileges needed by the approved backend adapter, with no `CREATE`, ownership, role management, or migration privileges.
- Sensitive tables (`audit_event`, `outbox_event`, confidential moderation fields, and optional session data) should not be broadly exposed to the app role; use a narrower worker/admin role or reviewed backend functions/views.
- Row-level security or backend-owned security-definer functions/views should be evaluated before granting broad student-facing table access. RLS cannot replace server actor resolution.
- Sequence privileges, function execution, and default future grants are intentionally deferred to migration review.

The bootstrap grants no table privileges. This is deliberate and must remain true until physical migrations and backend access patterns are approved.

## 8. Frontend-to-database mapping

| Frontend contract | Physical source/projection | Notes |
|---|---|---|
| `UserSession`, `PrivateUserProfile` | `user_account`, `student_profile`, consent joins | Session response is a projection; provider/session storage remains open |
| `StudyPreferences`, `CourseEnrollment`, `SocialInterestTag` | profile, preferred-time, course, interest join tables | Arrays become normalized rows |
| `StudyConsentRecord`, `SocialConsentRecord` | `consent_record`; changes in `consent_history` | Independent mode rows |
| `StudyActionResult`, `SocialActionResult` | `discovery_action` plus derived connection state | `recordedAt` maps to server timestamps |
| `PeerConnection`, summaries/details | `connection` plus actions/profile projections and authorization filters | Pending buckets are viewer-derived |
| `CampusLocation`, admin resource requests | `study_location` | Counts are derived |
| `StudyTableSlot`, admin slot requests | `study_table`, `study_slot`, booking availability join | `reservedCount` is derived; date is `local_date` |
| `BookingRecord`, booking requests | `booking`, `booking_participant`, `idempotency_record` | `allowedActions`, names, and time window are derived/authorized |
| `NotificationItem` | `notification` | Destination is typed reference and reauthorized on open |
| `ModerationReport`, `ReportReceipt` | `moderation_report` | Evidence/confidential fields are not returned to ordinary users |
| `AuditLogEntry` | `audit_event` | Safe projection only; no raw private payloads |
| `AgentMatchResult`, compatibility breakdown | No mandatory table | Derived/temporary orchestration state; only sanitized audit metadata may persist |
| `Conversation`/`Message` service | Conditional tables | Feature-gated and policy-dependent |

## 9. Test matrix for later execution

Tests are specified here; execution belongs to DB-04 and later backend integration.

| Area | Test | Expected result |
|---|---|---|
| Identity | Create valid account/profile; duplicate identity subject/email/course enrollment/interest | Valid rows commit; duplicates fail with constraint conflict |
| Validation | Invalid role/status/mode, self-action, invalid capacity, reversed slot times, invalid consent timestamps | Database-local checks reject invalid rows |
| References | Missing user, course, interest, location, table, slot, connection, or participant | Foreign-key failure; no partial booking |
| Consent/discovery | One current consent per mode; action idempotency; reciprocal likes create one connection | Unique/current-state rules hold; pending viewer state remains derived |
| Inventory | Duplicate table number/location; mismatched slot parent; overlapping slot definition | Unique/FK/workflow validation rejects unsafe inventory |
| Booking creation | Eligible pair claims free resource; social-only/one-sided pair attempts; duplicate resource | Valid claim commits; unauthorized/collision attempts fail |
| Concurrency | Two transactions claim the same final `(table_id,local_date,slot_id)` | Exactly one occupying booking succeeds under approved unique constraint |
| Pending occupancy | Pending booking under each approved policy | Capacity behavior matches approved status predicate |
| Reschedule | Free target, conflicting target, stale booking version, transaction failure | Success preserves lineage; conflict/failure preserves source |
| Cancellation/history | Cancel once, repeat cancel, inspect historical source and rebook | Idempotent terminal state; history remains; released resource can be booked |
| Idempotency | Same actor/operation/client ID and same/different fingerprint; different actors reuse token | Same request returns original outcome; changed fingerprint conflicts; actor scope isolates keys |
| Moderation/privacy | Reporter receipt, admin decision, blocked discovery, public projection | Confidential fields remain hidden; authorized filters apply |
| Audit/outbox | Booking/moderation success and failure paths | Audit/outbox are atomic with approved state; failed transaction emits no success event |
| Application role | Connect as `campus_duo_app`, inspect/create table, use schema, access restricted tables | Connect/approved grants work; DDL and unauthorized object access fail |
| Migration role | Run ordered migrations as `campus_duo_migrator`; rerun same version | Migrations apply in order and duplicate application is rejected/recorded safely |
| Retention | Deactivate account/resource with historical references | No unsafe hard delete; approved anonymization/retention behavior is preserved |

## 10. Readiness for migration implementation

### DB-04A implementation reconciliation

- `booking.partner_approval_status` is physically constrained to `NOT_REQUIRED`; pending approval and hold states are not migrated.
- `booking.status` is limited to `CONFIRMED`, `COMPLETED`, and `CANCELLED`; a reschedule successor stores `rescheduled_from_booking_id`, while the source cancellation reason is handled by the approved workflow.
- Idempotency keys live in `idempotency_record`; `booking` does not duplicate `client_operation_id`.
- The mandatory `outbox_event` table is included. `auth_session`, `conversation`, and `message` are intentionally absent.
- `study_slot` uses a generated half-open `tsrange` and `btree_gist` exclusion constraint; `booking` uses one partial unique confirmed-resource index.
- Database migrations do not enforce current-time, participant-cardinality, mutual-connection, consent/block, actor-authority, completion-time, or reschedule-order rules; these remain transactional/backend responsibilities.

The mandatory identity/profile, consent/discovery, inventory, safety, notification, audit, and outbox catalogue is now implemented as migration drafts under `database/migrations/`. The user-approved MVP decisions resolve the previous booking blockers: auto-confirmation, creator-only mutation with audited admin override, confirmed-only occupancy, no pending holds, historical successor rescheduling, and mandatory outbox.

The following remain deferred workflow or policy work rather than migration blockers:

- server-side authorization and mutual-study eligibility checks;
- rejection of new backdated bookings and the privileged audited historical-import path;
- completion only after a slot ends;
- admin deactivation safety checks against future confirmed bookings;
- cancellation/reschedule transaction orchestration and outbox dispatch;
- concrete authentication/session provider;
- retention periods and automated anonymization;
- conditional messaging.

DB-04A SQL is drafted but has not been executed. `V001` validates that `btree_gist` is installed in `public`; an administrator must install it separately before migration execution if it is absent. V004 resolves the extension-provided GiST operator classes through `SET search_path = campus_duo, public`. The partial confirmed-booking index and half-open slot exclusion constraint are included in the drafts.
