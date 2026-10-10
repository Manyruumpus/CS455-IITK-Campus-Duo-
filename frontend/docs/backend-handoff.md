# Campus Duo Backend Handoff — Stage 11A

**Status:** Frontend contract handoff; no production backend is implemented or approved.  
**Authentication:** unresolved. This document does not select JWT, OAuth, LDAP, SSO, cookies, or any other identity protocol.

## 1. Existing frontend service boundary

The frontend talks only to typed services in `src/services/interfaces.ts` through query hooks. A production adapter must implement the same contracts; it must not require components to call URLs directly.

| Capability | Existing interface | Main records |
|---|---|---|
| Session/auth | `IAuthService` | `UserSession` |
| Profile/onboarding/consent | `IProfileService`, `IStudyService`, `ISocialService` | private profile, public projections, consent records |
| Study/social discovery | `IStudyService`, `ISocialService` | recommendations, mode-specific actions |
| Connections | `IConnectionService` | Like-derived `PeerConnection`, summaries, detail |
| Booking | `IBookingService` | locations, fixed slots, `BookingRecord` |
| Notifications | `INotificationService` | recipient-owned notification records |
| Reports/blocking | `IModerationService` | report receipts, supported social blocks |
| Administration | `IAdminService` | minimal user projections, resources, reports, bookings |
| Messaging | `IConversationService` | disabled by default and policy-gated |

Every call receives `ServiceContext`, including the authenticated actor session in the mock and an optional `AbortSignal` for reads. Production authorization must use the server-side session/token context rather than trusting IDs in request bodies.

## 2. Proposed production request/response shape

These are proposals for backend implementation, not verified endpoints or approvals. Field names follow current TypeScript types and may be versioned by the backend owner.

### Common envelope

```json
{
  "data": {},
  "operationId": "op-unique-client-or-server-id",
  "requestId": "req-correlating-id"
}
```

Errors should map to the existing `AppErrorCode` values: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `VALIDATION_ERROR`, `SERVICE_UNAVAILABLE`, `AGENT_FAILED`, `UNCERTAIN_MUTATION`, `UNSUPPORTED_ACTION`, and `CANCELLED`. The UI maps permission/conflict/validation errors to inline error states, unavailable/transient errors to unavailable/retry states, uncertain mutations to reconciliation UI, and cancellation to silent query cancellation.

### Auth/profile

- Session response: `userId`, `name`, `email` only if the authenticated UI is authorized to display it, `role`, onboarding state, and independent study/social consent summaries.
- Private profile writes must be allowlisted fields. Academic identity fields and provider identifiers are not client-editable.
- Public study/social responses must contain only the approved projection for the mode; no contact handles, private schedules, hidden identity fields, messages, or report data.

### Discovery/connections

- Discovery reads accept mode-specific filters and return deterministic recommendation records with grounded reasons.
- Actions carry target ID, mode, action type, and a client operation identifier where retries are possible.
- Connections remain derived from Like records; do not add a second invitation state machine. Detail responses must be participant-authorized and separate relationship summary fields from discovery profile fields.

### Booking

`BookingCreationRequest` contains `clientOperationId`, `tableId`, `locationId`, `localDate`, `slotId`, and optional `companionStudentId`. A booking response is the existing `BookingRecord`, including participants, status, allowed actions, approval status, timestamps, and the operation identifier.

Reschedule requests contain the existing booking ID and replacement local date/slot/table/location. Cancellation requires server-side participant/admin authorization and must preserve idempotency. `reconcileBooking(clientOperationId)` must return only a booking owned by or involving the authorized actor.

### Notifications and moderation

- Notifications are recipient-owned records with stable ID, event type, mode, created timestamp, read state, permission-safe summary, and a typed internal destination.
- Report submission accepts target, supported category, and optional bounded description. The response is a safe receipt; reporter identity and confidential admin notes never appear in the reported user's data.
- Blocking remains limited to the documented social discovery/detail/action exclusion until wider effects are approved.

### Administration/resources/audits

Admin methods require a server-authorized admin role on every operation. User projections exclude unrestricted private profiles, contact fields, private schedules, message content, report descriptions, and credentials.

Resource operations preserve the current typed requests: location, two-person table, and date-specific fixed slot create/update/active-state methods. Parent references must exist; capacity is exactly 2; slot times are valid and non-overlapping for a table/date. IDs and the meaning of resources referenced by future confirmed bookings cannot be renamed, reassigned, or silently changed. Deactivation must calculate future confirmed-booking impact and reject unsafe operations unless a separately approved remediation policy exists. Permanent deletion remains unsupported.

Audit records contain stable event ID, actor ID/role, action, target type/ID, injected/server timestamp, outcome, safe reason/metadata, and operation/correlation reference. They must not copy passwords, tokens, cookies, raw prompts, report descriptions, private profiles, schedules, or messages. Mock audit append-only behavior is not a claim of durable storage or tamper resistance.

## 3. Permission and ownership rules

- Unauthenticated actors: only public marketing and provider-neutral auth surfaces.
- Students: only their own private profile, consent, notifications, reports/receipts, bookings, participant-authorized connections, and supported social actions.
- Connection detail: both participants only; unrelated IDs must return `FORBIDDEN` or a privacy-safe not-found according to the approved API convention.
- Notifications/read state: recipient ownership is mandatory; caller-supplied recipient IDs are ignored for authorization.
- Booking detail/mutations: creator, authorized participant, or approved admin policy; exact mutation authority remains a demo policy where the frontend currently labels it provisional.
- Admin: `ROLE_ADMIN` required server-side for every admin capability.
- Agent operations: backend owns tool authorization and eligibility. The frontend agent preview cannot book, message, disclose contacts, or alter records.

## 4. Pagination, filters, and cancellation

List APIs should accept stable cursor pagination (`cursor`, `limit`) and return `items`, `nextCursor`, and applied filter metadata where lists can grow. Existing frontend filters include discovery filters, notification unread/type filters, admin booking search/status/date filters, and report/resource views. Reads must accept cancellation and must not publish results after actor/session changes.

## 5. Campus time and fixed-slot semantics

The demo uses `Asia/Kolkata` (`UTC+05:30`) as the campus timezone. `localDate` is a campus calendar date, not a browser UTC date. Fixed slots use local `HH:mm` start/end values, end strictly after start, and a date-specific table assignment. Availability and conflict checks must be authoritative on the server and must not rely on browser clocks.

## 6. Operation identifiers and uncertain outcomes

Mutations that can commit before a response is received must accept a stable client operation identifier. Retries with the same logical operation must be idempotent. If the client receives `UNCERTAIN_MUTATION`, it must not show false success or issue a duplicate mutation; it should reconcile by operation identifier and present pending/confirmed/failed states. A request ID is for tracing; an operation ID is for deduplication and reconciliation.

## 7. Notifications and deduplication

Generate notifications only after the corresponding operation commits. Booking create/reschedule/cancel events notify both participants under the approved safe summary. Connection/report events follow the existing demo visibility policy. Deduplicate by event type, target/resource, operation or stable event key. Failed operations must not emit success notifications.

## 8. Agent request/result/fallback boundary

The current `submitMatchingQuery`/`getMatchingStatus` contract returns `QUEUED`, `PROCESSING`, `COMPLETED`, `FALLBACK`, or `FAILED` with grounded recommendation results and a fallback reason. Production agent orchestration, model choice, retrieval, policy checks, tool permissions, and auditability belong to the backend. The UI must treat fallback as an honest result state and must never infer authority from an agent response.

## 9. Decisions requiring approval

Authentication/session protocol, friendship versus dating scope, messaging and contact disclosure, withdrawal/disconnect, unblock and wider blocking effects, partner approval, booking cutoffs/overlaps, suspension/removal/retention, durable audit policy, and production resource-remediation policy remain open. The frontend keeps unsupported features disabled or provisional.
