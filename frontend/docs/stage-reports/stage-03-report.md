# Stage 03 Report — Typed Services, Stateful Mocks, and Query Architecture

**Stage**: 03  
**Status**: REPAIRED & READY FOR REVIEW (Revision 2 — 2026-10-10)  
**Initial Baseline Execution**: 2026-10-08  
**Targeted Repair Execution**: 2026-10-10  
**Repository**: IITK Campus Duo Frontend (`frontend/`)  

---

## 1. Executive Summary

Stage 03 successfully replaces disconnected display fixtures with a typed service adapter boundary, a stateful in-memory mock store, and an actor-isolated TanStack Query architecture. All eight explicit user amendments have been implemented and verified.

A vertical slice of the user interface—encompassing **Table Availability Matrix, New Booking Creation, Reservation Pass Detail, and Booking History with Cancellation**—has been wired through React Query hooks and stateful mock services. The reciprocal study partner requirement, atomic conflict checks, and idempotent cancellation semantics were proven across 72 passing automated tests. All quality gates (`typecheck`, `lint`, `test`, `build`) succeeded cleanly.

---

## 2. Implementation Scope & Delivered Artifacts

### 2.1 Core Contracts & Types
- **`src/types/index.ts`**:
  - Independent consent schemas: `StudyConsentRecord` and `SocialConsentRecord`.
  - Separation of private user profile (`PrivateUserProfile`) from permission-filtered public views (`PublicStudyProfile`, `PublicSocialProfile`).
  - Separation of profile data from recommendation metadata (`StudyRecommendation` with `aiMatchReasons`, `dataCompletenessScore`, and `relationshipStatus`).
  - Canonical table booking unit: `tableId + localDate + slotId` with strict 2-person capacity (`capacity: 2`).
  - Lifecycle statuses: `CONFIRMED`, `COMPLETED`, `CANCELLED` (with physical `CHECKED_IN` deferred per amendment 1).
  - Partner approval status represented as provisional enum: `UNRESOLVED_PENDING | AUTO_ACCEPTED | NOT_REQUIRED`.
  - Typed error model: `AppError` class and `ErrorCode` constant enum (`UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `VALIDATION_ERROR`, `SERVICE_UNAVAILABLE`, `AGENT_FAILED`, `UNCERTAIN_MUTATION`, `CANCELLED`).

### 2.2 Service Interface Boundary
- **`src/services/interfaces.ts`**:
  - Reconciled domain service contracts: `IAuthService`, `IProfileService`, `IStudyService`, `ISocialService`, `IConnectionService`, `IBookingService`, `INotificationService`, `IModerationService`, `IAdminService`, `IConversationService`.
  - Universal `ServiceContext { actorSession, signal }` passed through all calls.

### 2.3 Stateful Mock Layer & Isolation
- **`src/mocks/store.ts`**: Deterministic in-memory database (`MockDatabase`) with seed data for synthetic student identities (`usr-student-mohit`, `usr-student-210642`, `usr-student-aarav`, `usr-student-riya`, `usr-student-vikram`, `usr-student-stranger`, `usr-admin-senate`), mutual connections, table slots, bookings, and an explicit `reset()` operation.
- **`src/mocks/scenarios.ts`**: `ScenarioManager` supporting deterministic delay (`forceDelayMs` with `AbortSignal` cancellation), error code injection (`forceError`), AI recommendation fallback (`forceAgentFallback`), and uncertain mutation responses (`forceUncertainMutation`).
- **`src/services/mock/`**:
  - `MockAuthProfileServices.ts`: Identity and profile queries with private vs public filtering and admin boundary checks.
  - `MockStudySocialServices.ts`: Study recommendations, grounded AI reasons, social discovery with masked handles and consent checks.
  - `MockBookingService.ts`: Canonical table slot availability, reciprocal study partner eligibility check, atomic conflict check, idempotent cancellation, and conflict-preserving reschedule.
  - `MockAdminModerationServices.ts`: Moderation reports, block lists, audit logs, and feature-flag gated conversations.
- **`src/services/unavailable/UnavailableServiceAdapter.ts`**: Production adapter that strictly throws `SERVICE_UNAVAILABLE` on all operations when demo auth is disabled.
- **`src/services/index.ts`**: Singleton service provider returning `MockServiceAdapter` in demo mode and `UnavailableServiceAdapter` in default production.

### 2.4 TanStack Query Architecture
- **`src/queries/queryClient.ts`**: `createApplicationQueryClient()` configured with transient-only query retries (`failureCount < 2`), zero retries for client/conflict errors (400, 401, 403, 404, 409), and `retry: 0` for mutations.
- **`src/queries/queryKeys.ts`**: Actor-scoped query key factories embedding `actorId` into every permission-sensitive key (`queryKeys.bookings`, `queryKeys.profiles`, `queryKeys.study`, `queryKeys.social`, etc.).
- **`src/queries/bookingHooks.ts`**: `useTableAvailability` (`staleTime: 0`), `useBookingDetail`, `useMyBookings`, `useCreateBooking`, `useCancelBooking`, `useRescheduleBooking`.
- **`src/app/context/DemoAuthContext.tsx`**: Session boundary handlers invoking `activeQueryClient.cancelQueries()` and `activeQueryClient.clear()` on logout and role switch.

### 2.5 Limited UI Slice
- **`src/features/student/TableBookingGridPage.tsx`**: Live occupancy query hook, dynamic available/reserved/occupied counters, and slot navigation.
- **`src/features/student/NewBookingPage.tsx`**: Wired to `useCreateBooking` mutation, mutual study partner selection vs ineligible social contact, atomic conflict and permission error toast handling.
- **`src/features/student/BookingDetailPage.tsx`**: Wired to `useBookingDetail` and `useCancelBooking`, displaying dynamic booking data and cancellation dialog.
- **`src/features/student/BookingHistoryPage.tsx`**: Wired to `useMyBookings`, displaying real historical reservations and direct pass links.

---

## 3. Domain Contracts & Boundary Enforcement

1. **Independent Consent**:
   - `StudyConsentRecord` and `SocialConsentRecord` operate independently. Modifying social consent leaves academic study consent untouched.
   - Reading peer directory feeds without social consent strictly throws `FORBIDDEN`.
2. **Profile vs Recommendation Separation**:
   - Scores, match reasons (`aiMatchReasons`), data completeness scores, and relationship statuses are delivered via `StudyRecommendation`, never embedded in public profile records.
   - Public profile views strip email addresses, roll numbers, and direct contact details.
3. **Contact Disclosure**:
   - Public social discovery returns masked handles (e.g. `v***@iitk.ac.in`). Unapproved direct handle disclosure remains unsupported until a bilateral disclosure protocol is formally approved.
4. **Deferred Lifecycle**:
   - Physical QR check-in and `CHECKED_IN` booking status are deferred. Reservation passes display explicit non-validity notices.
5. **Provisional Partner Approval**:
   - Partner approval status is surfaced as `AUTO_ACCEPTED` / `UNRESOLVED_PENDING` / `NOT_REQUIRED` under provisional demonstration assumption DEC-11.

---

## 4. Actor, Session & Permission Architecture

1. **ServiceContext Actor Resolution**:
   - All services resolve permissions directly from `context.actorSession`. Caller-provided `userId` parameters are never trusted for authorization.
2. **Booking Detail Ownership**:
   - Reading booking details (`getBooking`) enforces ownership: only the booker or an administrative user may view the record. Unrelated students receive `FORBIDDEN`.
3. **Admin Privilege Boundaries**:
   - Administrative users can inspect table bookings and moderation records for governance, but attempting to inspect student private profiles directly throws `FORBIDDEN`. Admin access does not grant unrestricted private data access.
4. **Production Isolation**:
   - In default production builds (`isDemoAuthEnabled: false`), `UnavailableServiceAdapter` throws `SERVICE_UNAVAILABLE` across all methods, preventing mock data leakage.

---

## 5. Query Key Lifecycle, Invalidation & Isolation

1. **Actor-Scoped Query Keys**:
   - Every permission-sensitive query key includes the actor's ID:
     `['bookings', actorId, 'availability', locationId, date]`
     `['bookings', actorId, 'detail', bookingId]`
     `['bookings', actorId, 'my', { status: 'all' }]`
2. **Session Transition Cache Hygiene**:
   - When a student signs out or switches roles (`switchRole`, `logout`), `queryClient.cancelQueries()` cancels all pending in-flight HTTP/mock reads and `queryClient.clear()` purges all cached entries.
   - Tests verified that late responses from previous sessions do not update or populate the cache of subsequent sessions.
3. **Retry Policy**:
   - Validation errors, unauthenticated errors (401), forbidden errors (403), not found errors (404), and booking conflict errors (409) return `false` on retry checks.
   - Only explicitly transient read failures (`isTransient: true`, e.g. temporary 503) are retried up to 2 times.
   - Mutations strictly maintain `retry: 0`.
4. **Freshness Settings**:
   - Table availability uses `staleTime: 0` because mutation-time collision checks are authoritative.

---

## 6. Booking Simulation, Concurrency & Invariants

1. **Canonical 2-Person Model**:
   - All slots enforce `capacity: 2` and slot occupancy is calculated from active confirmed bookings.
2. **Reciprocal Study Partner Eligibility**:
   - Reserving a table with companion `usr-student-aarav` (who possesses an active mutual `STUDY` connection) succeeds.
   - Reserving with `usr-student-vikram` (who possesses only a `SOCIAL` connection) throws `FORBIDDEN`.
3. **Atomic Collision Check**:
   - Reserving an already-occupied slot immediately throws `CONFLICT`.
   - In-memory mock reads and writes execute synchronously within the mock adapter, preventing async gaps between collision check and write.
4. **Failed Reschedule**:
   - Attempting to reschedule to an already-occupied slot throws `CONFLICT` and preserves the original booking intact.
5. **Idempotent Cancellation**:
   - Cancelling a booking updates status to `CANCELLED` and frees slot occupancy.
   - Repeated cancellation converges idempotently to `CANCELLED` without error.
6. **Uncertain Mutation Reconciliation**:
   - Simulated uncertain mutation outcome (`forceUncertainMutation`) returns `UNCERTAIN_MUTATION`. The test verifies client-side reconciliation via booking history without blind duplicate submissions.
7. **Concurrency Disclaimer**:
   - In-memory mock tests prove application invariant enforcement and mock state machine correctness. They do **not** claim to prove distributed database concurrency.

---

## 7. Deterministic Scenarios & Failure Testing

The mock system implements `ScenarioManager` supporting:
- **Delay**: Injectable delay in milliseconds. Verified with `AbortSignal` cancellation returning `CANCELLED`.
- **Error Injection**: Simulated `SERVICE_UNAVAILABLE` transient error triggers retry logic.
- **Agent Fallback**: Recommendation matching query returns structured fallback status with grounded explanation.
- **Reset Operation**: `mockStore.reset()` and `scenarioManager.reset()` reliably restore clean state across test runs.

---

## 8. Limited UI Vertical Slice (Table Booking)

| Page | Service Integration | Key Behaviors |
| :--- | :--- | :--- |
| `TableBookingGridPage.tsx` | `useTableAvailability` | Live slot occupancy, loading spinner, error retry, slot selection passing parameters to new reservation |
| `NewBookingPage.tsx` | `useCreateBooking` | Slot prefill, partner selection with reciprocal eligibility check, conflict error handling via Toast |
| `BookingDetailPage.tsx` | `useBookingDetail`, `useCancelBooking` | Live booking pass fetch, simulated QR pass notice, interactive cancellation dialog |
| `BookingHistoryPage.tsx` | `useMyBookings` | Historical bookings table, dynamic badges, navigation to passes |

*All other feature pages (Study Discovery, Social Discovery, Conversations, Admin tables/reports) remain intentionally fixture-only UI shells.*

---

## 9. Verification Results & Quality Gates

All four required verification commands were executed on the actual codebase:

```bash
# 1. Typecheck
npm run typecheck
> tsc --noEmit
# Result: Exit code 0 (0 errors)

# 2. Lint
npm run lint
> eslint .
# Result: Exit code 0 (0 warnings, 0 errors)

# 3. Test Suite
npm test
> vitest run
# Result: Exit code 0 (10 test files passed, 72 tests passed)

# 4. Production Build
npm run build
> tsc && vite build
# Result: Exit code 0 (Clean bundle generated in dist/ in 47.37s)
```

### Test Suite Inventory (72 tests across 10 files)
- `src/tests/sanity.test.ts` (1 test): Test harness environment validation.
- `src/tests/mocks.test.ts` (6 tests): Domain fixtures and canonical model structure.
- `src/tests/Button.test.tsx` (4 tests): Button component behavior and accessibility.
- `src/tests/Input.test.tsx` (4 tests): Input accessibility and validation error rendering.
- `src/tests/dialog.test.tsx` (5 tests): Dialog focus trapping and escape dismiss.
- `src/tests/navigation.test.tsx` (3 tests): Navigation landmarks and drawer toggles.
- `src/tests/returnPath.test.ts` (9 tests): Return-path security and origin validation.
- `src/tests/routing.test.tsx` (17 tests): Route inventory counts and navigation guards.
- `src/tests/services.test.ts` (18 tests): Domain services, actor boundaries, study pair eligibility, conflict checks, reschedule preservation, repeated cancellation, uncertain mutation reconciliation, and production unavailable isolation.
- `src/tests/queries.test.tsx` (5 tests): Actor-scoped query keys, transient-only retry policy, zero-retry mutations, cache clearing on identity switch, and delayed mutation session isolation.

---

## 10. Unresolved Policy Notes & Stage 04 Readiness

### 10.1 Pending Checks (Accurate Status Reporting)
- **Mobile Visual Inspection**: Not run / Pending.
- **Served-Production Browser Inspection**: Not run / Pending.
*(These inspections remain pending and are not claimed as completed.)*

### 10.2 Open Decisions & Policy Assumptions
- **DEC-08**: Direct in-app messaging remains feature-flag gated (`isMessagingEnabled: false` by default).
- **DEC-11**: Two-hour slot duration limits and 7-day advance booking windows remain unapproved demonstration assumptions.
- **Partner Booking Approval**: Approval workflow is tracked as provisional policy (`UNRESOLVED_PENDING` / `AUTO_ACCEPTED` / `NOT_REQUIRED`) pending Senate ratification.
- **Contact Disclosure**: Direct handle sharing is disabled; masked handles are enforced.

---

## 11. Stage 03 Targeted Repair Revision (Current Status: 2026-10-10)

Following the initial Stage 03 checkpoint, a targeted repair was executed in strict adherence to seven mandatory amendments. Historical sections above document the initial Stage 03 implementation baseline; this section establishes the authoritative current status.

### 11.1 Repair Amendments Implemented & Verified

#### Amendment 1: Operation Reconciliation
- **Frontend/Mock Contract**: Abandoned resource composite keys (`tableId + localDate + slotId`) as idempotency tokens. Introduced a stable `clientOperationId: string` generated once per logical booking creation attempt in `NewBookingPage` (`useState(() => `op-${Date.now().toString(36)}-...`)`).
- **Uncertainty & Reconciliation**: `clientOperationId` is preserved throughout uncertain network states. The booking service stores it with the confirmed booking record and reconciles strictly by `actorSession.userId` + `clientOperationId`.
- **Honest Unresolved State**: If reconciliation queries an uncommitted operation, the service returns `null` and the UI presents an honest unresolved notification (*"No committed reservation found for this operation attempt. You may safely retry."*) without automatic duplicate re-submission.
- **Session Boundary Protection**: Tested and verified that session switches (logout/role change) cancel pending mutations and clear actor-scoped caches, preventing old-operation toasts, navigation, or cross-session cache pollution.

#### Amendment 2: Approval Simulation
- **Provisional Policy Scope**: Implemented the configured `AUTO_APPROVED_DEMO` path only, and displayed the explicit provisional policy label in the UI:
  `"Demo Policy: Auto-Approved (Provisional — Pending team/user approval)"`.
- **Unsupported Approval Rejection**: Explicitly rejected `REQUIRES_EXPLICIT_APPROVAL` by returning a typed `UNSUPPORTED_ACTION` error before writing or holding any table slot.
- **No Indefinitely Held Slots**: Rejected implementation of speculative approval/rejection/expiry workflows or indefinitely held pending reservations in this repair.

#### Amendment 3: Actor-Specific Mutation Policy
- **Demo Mutation Policy**: Creator-only mutation and administrator overrides are explicitly labelled and enforced as demo policy, not approved production permissions.
- **Dynamic `allowedActions` Computation**: Services compute `allowedActions` based on the requesting actor's identity:
  - Creator: `['CANCEL', 'RESCHEDULE']`
  - Companion: `[]` (read-only; sees full detail and history, but mutation controls are disabled in UI with a demo policy notice and rejected with `FORBIDDEN` on direct service calls)
  - Admin: `['CANCEL', 'RESCHEDULE']` (governance override)
- **Participant Validation**: Enforces exactly two distinct participants (`validateParticipants`) and strictly prevents self-booking (cannot book oneself as companion).

#### Amendment 4: Participant Cache Consistency & Observable Reads
- **Observable Read Verification**: Creation, cancellation, and rescheduling were verified against live observable reads (calling `listTableAvailability`, `getBooking`, and `getMyBookings`), rather than mere invalidation spies:
  - **Creation**: Slot becomes `OCCUPIED`; detail returns `CONFIRMED`; booking appears in both creator and companion history.
  - **Cancellation**: Slot returns to `AVAILABLE`; detail returns `CANCELLED`; booking updates to `CANCELLED` in both creator and companion history.
  - **Rescheduling**: Verified that rescheduling refreshes both the old slot (becomes `AVAILABLE`) and the new slot (becomes `OCCUPIED`).
- **Session Isolation**: Tested and confirmed that session changes cancel in-flight queries and purge actor cache completely.

#### Amendment 5: Public Privacy and Clock
- **Public Social Privacy**: Removed `maskedHandle`, `revealedContact`, and all contact-derived fields from public social contracts (`PublicSocialProfile`), fixtures, and connection displays. Mutual connection does not automatically disclose contact details.
- **Explicit Field Projection**: Full response shapes are explicitly projected and asserted in automated tests.
- **Synthetic Identities**: Replaced all personal fixtures with synthetic identities (`Alex Rivera`, `Samira Patel`, `Taylor Swift`, `Morgan Chen`, `Stranger Student`, `Senate Moderator`).
- **Campus Timezone Integration**: Documented campus timezone (`Asia/Kolkata`, UTC+05:30) for `localDate` generation (`getCampusLocalDate()`). Prohibited blind UTC timestamp slicing (`toISOString().slice(0, 10)`). Verified with an injected clock near date boundaries (e.g., 19:00 UTC = 00:30 IST next day).

#### Amendment 6: Agent Coverage & Ownership
- **Submitting Actor Ownership**: Agent matching requests belong exclusively to the submitting actor. Unrelated students attempting to retrieve another student's private matching status or results are denied with `FORBIDDEN`.
- **Honest Simulation Documentation**: Documented that agent matching completion is immediate in this mock adapter, honestly reflecting simulated execution rather than claiming asynchronous background polling was demonstrated.
- **Fallback Verification**: Simulated unavailable agent service reliably yields grounded fallback results with structured fallback explanations.

### 11.2 Verification Results & Quality Gates (Current Execution)

All four quality checks were executed on the repaired codebase:

1. **Typecheck (`npm run typecheck`)**:
   ```bash
   > tsc --noEmit
   # Result: Exit code 0 (0 errors)
   ```
2. **Lint (`npm run lint`)**:
   ```bash
   > eslint .
   # Result: Exit code 0 (0 warnings, 0 errors)
   ```
3. **Test Suite (`npm test -- --run`)**:
   ```bash
   > vitest run --run
   # Result: Exit code 0 (10 test files passed, 74 tests passed, 0 failures)
   ```
   - `src/tests/sanity.test.ts` (1 test): Test harness environment validation.
   - `src/tests/mocks.test.ts` (6 tests): Domain fixtures and canonical model structure.
   - `src/tests/Button.test.tsx` (4 tests): Button component behavior and accessibility.
   - `src/tests/Input.test.tsx` (4 tests): Input accessibility and validation error rendering.
   - `src/tests/dialog.test.tsx` (5 tests): Dialog focus trapping and escape dismiss.
   - `src/tests/navigation.test.tsx` (3 tests): Navigation landmarks and drawer toggles.
   - `src/tests/returnPath.test.ts` (9 tests): Return-path security and origin validation.
   - `src/tests/routing.test.tsx` (17 tests): Route inventory counts and navigation guards.
   - `src/tests/services.test.ts` (20 tests): Actor boundaries, shared bookings, reconciliation, approval simulation, observable reads, clock near date boundaries, agent ownership, and unavailable adapter.
   - `src/tests/queries.test.tsx` (5 tests): Actor-scoped query keys, transient-only retry policy, zero-retry mutations, cache clearing on identity switch, and delayed mutation session isolation.
4. **Production Build (`npm run build`)**:
   ```bash
   > tsc && vite build
   # Result: Exit code 0 (1699 modules transformed, clean bundle in dist/)
   ```

### 11.3 Accurate Inspection Status

- **Mobile Visual Inspection**: Not run / Pending.
- **Served-Production Browser Inspection**: Not run / Pending.  
*(These inspections remain pending and are not claimed as completed.)*

---

## Stage 03 Checkpoint Status

**READY FOR REVIEW**
