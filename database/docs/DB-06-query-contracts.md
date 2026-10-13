# DB-06 Query Contracts

These files are parameterized PostgreSQL driver/prepared-statement templates, not standalone `psql` scripts:

- `queries/01_private_account_profile.sql`
- `queries/02_consent.sql`
- `queries/03_study_candidates.sql`
- `queries/04_social_candidates.sql`
- `queries/05_connections.sql`
- `queries/06_resource_availability.sql`
- `queries/07_booking_history.sql`
- `queries/08_notifications.sql` (list)
- `queries/08_notification_unread_count.sql` (count)
- `queries/09_report_receipts.sql`
- `queries/10_admin_reads.sql` (report queue)
- `queries/10_admin_resource_summary.sql` (resource summary)
- `queries/11_admin_audit.sql`

Every `$n` parameter must be bound with the documented PostgreSQL type. The backend must obtain actor IDs and roles from validated server context; passing an actor UUID is not authentication.

## Coverage and mappings

| Contract | Frontend mapping | Authorization/privacy | Ordering and bounds |
|---|---|---|---|
| Private account/profile | `UserSession`, `PrivateProfile` | Actor-only; excludes provider secrets and unrelated private profiles | One row or empty |
| Consent | `ConsentStatus` | Actor-only; `STUDY` and `SOCIAL` are independent | One row or empty |
| Study candidates | Public profile plus backend-internal `study_goals`, `preferred_location`, `preferred_times`, course overlap, pace, and style inputs | Active viewer/candidate study consent, active accounts, block/action filters; scoring remains backend-owned | UUID source-page cursor, limit 1–50; not globally ranked after SQL limiting |
| Social candidates | `SocialRecommendation.profile`: user ID, display name, bio, active interests | Active viewer/candidate social consent, active accounts, block/action filters; no private schedule/contact fields | UUID source-page cursor, limit 1–50 |
| Connections | `PeerConnection` and summary/detail source fields | Viewer must be a participant; contact/private fields excluded | `updated_at DESC, connection_id DESC`, limit 1–50 |
| Availability | `CampusLocation`, `StudyTableSlot` | Authenticated read; active resources only | Campus date/time/resource ordering, limit 1–100 |
| Booking history | `BookingRecord` | Bookers/current participants only; admin is separate | `created_at DESC, booking_id DESC`, limit 1–50 |
| Notifications | `NotificationItem` | Recipient-owned only; caller recipient IDs cannot authorize | `created_at DESC, notification_id DESC`, limit 1–50 |
| Report receipts | `ReportReceipt` | Reporter-owned only; no review notes/evidence | `created_at DESC, report_id DESC`, limit 1–50 |
| Admin reports/resources | `ModerationReport`, `AdminResourceSummary` | Backend must require `ROLE_ADMIN`; report evidence/review data stays admin-only | Report queue `created_at + report_id`; resource summary uses date lower bound; bounded |
| Admin audit | Safe `AuditLogEntry` projection without unrestricted `details` | Backend must require `ROLE_ADMIN`; actor identity and administrator identity are distinct concepts | `occurred_at DESC, audit_event_id DESC`, bounded |

## Parameter and cursor matrix

| Statement | Binding signature | Cursor rule |
|---|---|---|
| Connections | `(uuid viewer, text mode, int limit, timestamptz last_updated_at, uuid last_connection_id)` | Both cursor values null or both supplied; mutable `updated_at` can cause a row to move between pages |
| Booking history | `(uuid viewer, uuid booking_id, int limit, timestamptz last_created_at, uuid last_booking_id)` | Paired `(created_at, booking_id)` keyset |
| Notifications list | `(uuid recipient, bool unread_only, text event_type, int limit, timestamptz last_created_at, uuid last_notification_id)` | Paired `(created_at, notification_id)` keyset |
| Notification count | `(uuid recipient)` | Separate statement and binding |
| Reporter receipts | `(uuid reporter, int limit, timestamptz last_created_at, uuid last_report_id)` | Paired `(created_at, report_id)` keyset |
| Admin report queue | `(text status, int limit, timestamptz last_created_at, uuid last_report_id)` | Paired `(created_at, report_id)` keyset |
| Admin audit | `(uuid actor, text target_type, int limit, timestamptz last_occurred_at, uuid last_audit_event_id)` | Paired `(occurred_at, audit_event_id)` keyset |
| Candidate source pages | Study `(uuid, text, text, text, text, int, uuid)`; social `(uuid, text, text, int, uuid)` | UUID-only because ORDER BY is UUID-only; backend must fetch/score enough source pages to produce ranked results |

Every limit is required and fail-closed through a bounded `BETWEEN` predicate. Date ranges are required and ordered in availability. The backend must validate the same requirements before binding values. Each multi-statement concern is split into an independent file so one driver call never assumes shared bindings.

Private profile returns `profile_version` and aggregated `preferred_times`; these are private fields. Candidate queries return backend-internal scoring inputs only to a trusted backend path and must not expose them directly to the frontend. Social output follows the approved public projection and does not assume a new display-name masking policy.

## Policy boundaries

Candidate queries return source data and relationship filters. The approved demo formula `35C + 25T + 20P + 10L + 10G` is not newly implemented in SQL; scoring, missing-factor normalization, grounded reasons, and compatibility breakdown remain backend-owned until separately approved.

Consent and active-block filters are mode-aware. A block prevents supported discovery/detail/action access while preserving history. Confirmed-only occupancy is derived from `booking.status = 'CONFIRMED'`; cancellation history remains readable to authorized participants and does not consume availability.

The templates use JSON aggregation or `EXISTS` to avoid multiplying rows across courses, interests, preferred times, or participants. Empty results are normal and must map to empty lists or not-found service results as appropriate.

## Write transaction contracts

These are responsibilities for a future backend, not completed workflows:

1. **Profile update:** authenticate actor; lock/read current profile version; validate allowlisted fields; write profile and join replacements in one transaction; audit the change; use optimistic version checking; return conflict on stale version.
2. **Consent update/history:** lock the actor's mode row; update current consent timestamps/state; append one history event; audit where required; emit no discovery result before commit; preserve the other mode.
3. **Discovery action/mutual connection:** authenticate actor; validate mode consent, block and self/pair rules; insert actor-scoped action idempotently; derive reciprocal connection only when both mode-specific likes exist; audit and enqueue any approved outbox event atomically.
4. **Booking creation:** authenticate actor and validate mutual STUDY connection, participant eligibility, resource/date/slot consistency, consent/block policy, and participant count; serialize the resource claim; create booking and exactly two participants; write idempotency, audit, and outbox rows in one transaction. Unique-index conflicts are resource guarantees, not eligibility authorization.
5. **Cancellation:** authenticate the booking creator or an administrator override with an audit reason; lock booking/version; write cancellation fields; preserve history; reconcile actor-scoped idempotency; audit/outbox writes are atomic. The other participant is read-only initially.
6. **Rescheduling:** authenticate the booking creator or an administrator override with an audit reason; lock source and replacement resource; create one direct successor only after replacement succeeds; source cancellation reason is `RESCHEDULED`; preserve original resource/history; a failed attempt leaves the source unchanged. The other participant is read-only initially.
7. **Moderation decision:** require server-side admin authorization; lock report/version; write review fields; append audit event; emit approved notification/outbox work atomically; never expose admin notes through reporter receipt queries.
8. **Notification read state:** authenticate recipient; lock target notification or use a safe set-based update constrained by recipient; set `is_read/read_at` coherently; avoid caller-supplied recipient authorization; audit only if policy requires.

Service mapping must distinguish `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `VALIDATION_ERROR`, `UNCERTAIN_MUTATION`, and `CANCELLED`. A passed actor parameter cannot prove any of those authorization decisions. Cancellation and rescheduling are authorized for the booking creator or an administrator override with an audit reason; the other participant is read-only initially. Exactly two participants, started-slot/completion-time rules, idempotency replay, and atomic workflow behavior remain backend-required.
