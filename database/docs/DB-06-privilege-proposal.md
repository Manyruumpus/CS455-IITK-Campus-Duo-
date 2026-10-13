# DB-06 Least-Privilege Proposal

The user approved this design for DB-07 implementation. The SQL artifacts are
prepared, but existing roles and privileges remain unchanged until the
administrator bootstrap and V008 are explicitly executed. No RLS, function,
view, or SECURITY DEFINER implementation was created.

`campus_duo_app` is the existing trusted backend identity, never a browser or
student identity. `campus_duo_admin_service` and `campus_duo_worker` are the
approved separate identities prepared by DB-07. The backend must resolve the
actor and role from validated server authentication before issuing queries.

## Concrete operation matrix

| Object | `campus_duo_app` read columns | `campus_duo_app` write columns | Service role | Backend authorization |
|---|---|---|---|---|
| `user_account` | Approved public identity fields; own private account fields | Own allow-listed profile/account fields only | App | Actor ownership; admin for account moderation |
| `student_profile`, `profile_course`, `profile_interest`, `profile_preferred_time` | Own full projection; approved public projection for candidates/peers | Own profile and join rows | App | Actor ownership; consent/block filtering |
| `course`, `social_interest` | Active catalog columns | None for ordinary app | App | Active-catalog filtering |
| `consent_record` | Own `mode`, state, timestamps, policy version | Own state/timestamps only | App | Actor ownership; modes remain independent |
| `consent_history` | Own history where approved | Append-only event columns | App | Actor ownership; immutable history |
| `discovery_action`, `connection`, `block` | Participant/viewer-safe columns | Actor-scoped actions and block operations | App | Consent, self, pair ordering, block, and mutual-action rules |
| `study_location`, `study_table`, `study_slot` | Active availability columns | None for ordinary app | App | Authenticated read; admin-only resource changes |
| `booking`, `booking_participant`, `idempotency_record` | Authorized participant booking fields | Booking/cancel/reschedule fields; actor-scoped idempotency fields | App | Creator/admin override, mutual study connection, resource and lifecycle checks |
| `notification` | Recipient-owned notification columns | Recipient `is_read/read_at`; trusted event creation | App | Recipient ownership; event creation only in atomic business workflow |
| `moderation_report` | Reporter receipt columns only | Reporter submission columns | App | Reporter ownership; admin decision through separate path |
| `audit_event` | No ordinary app read | Approved append-only safe fields only | App/admin path | Actor identity recorded separately from administrator identity |
| `outbox_event` | No ordinary app read | Business-event insert columns only | App | Atomic with business mutation |
| `outbox_event` dispatch fields | None | `status`, `attempts`, `next_attempt_at`, `dispatched_at`, error metadata only | Proposed worker | Worker claims/retries; no business-table writes |
| `moderation_report`, resource admin reads, safe audit reads | Full approved admin projection, excluding unrestricted audit `details` by default | Review/resource fields through admin workflow | App admin path or proposed admin role | Backend `ROLE_ADMIN`; caller parameters never authenticate |

`campus_duo_migrator` retains migration/ownership authority and is not a
runtime request identity. Admin requests use the separate admin service
identity, and dispatch/retry uses the separate worker identity.

## Enforced boundaries requiring design approval

Audit should use a privilege-enforced append-only view or function. Before
implementation, its owner, fixed `search_path`, `PUBLIC EXECUTE` revocation,
safe-column allow-list, and authorization model must be reviewed. Runtime
writers must not receive `UPDATE` or `DELETE` on `audit_event`.

Outbox business insertion and worker dispatch/retry updates are separate
capabilities. Confidential reports, private profiles, participant bookings,
and notifications require backend object authorization even if views or RLS
are later added for defense in depth. No `SECURITY DEFINER` implementation is
proposed until those controls are approved.

## Deferred implementation decisions

1. Direct column grants versus reviewed views/functions for each projection.
2. Whether RLS is required and how validated actor context reaches it safely.
3. Audit append-only owner, search path, execute revocations, and redaction.
4. Worker role and exact claim/retry locking protocol.
5. Separate admin identity versus backend role checks.
6. Report evidence and audit-detail retention/redaction policy.

These deferred controls do not block preparation of the approved explicit
grants, but they must be reviewed before adding RLS or SECURITY DEFINER paths.
> **DB-07 Revision 1 status:** The four-role design below is approved, but
> V008 is prepared and **NOT APPLIED**. Role provisioning, passwords, grants,
> runtime login tests, and backend authorization remain pending. Account
> identity/provider provisioning is intentionally deferred; idempotency is
> insert-final-outcome only; audit linkage is backend-owned through
> `INSERT ... RETURNING audit_event_id`.
