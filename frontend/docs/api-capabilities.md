# Campus Duo — API Capabilities & Service Adapter Contracts

**Document Version**: 3.4.0-stage10-implemented
**Status**: Stage 10 Verified — Mock Administrator Workflows and Redacted Audit Views
**Boundary Warning**: *These interfaces define client-side service contracts. When running with `isDemoAuthEnabled: true`, in-memory stateful mock adapters fulfill all requests with deterministic stores. In default production builds, `UnavailableServiceAdapter` strictly intercepts all calls with `SERVICE_UNAVAILABLE`. Concurrency checks in tests prove mock invariants, not multi-node database concurrency.*

---

## 1. Service Boundary Architecture

All data operations flow through typed contracts defined in `src/services/interfaces.ts`:

```
UI Component (React)
       │
       ▼
React Hook (TanStack Query)
       │
       ▼
Service Interface (e.g., IBookingService)
       │ (with ServiceContext: { actorSession, signal })
       │
       ├──► [Development / Demo Showcase]: MockServiceAdapter (In-memory state, scenario manager)
       │
       └──► [Default Production]: UnavailableServiceAdapter (Strict SERVICE_UNAVAILABLE)
```

### Context & Authorization Boundaries
Every service method accepts a `context: ServiceContext`:
- **`actorSession`**: Resolves the acting identity directly from the authenticated session. Callers can never spoof or supply an arbitrary `userId` to bypass permissions.
- **`signal`**: Propagates TanStack Query's `AbortSignal` through mock delays and asynchronous reads. Cancellation immediately aborts in-flight timers.

---

## 2. Reconciled Capability Registry

### 2.1 Authentication & Session Service (`CAP-AUTH`)
- **Interface**: `IAuthService`
- **Methods**:
  - `getCurrentSession(context?: ServiceContext): Promise<UserSession | null>`
  - `loginWithDemoRole(role: UserRole, context?: ServiceContext): Promise<UserSession>`
  - `logout(context?: ServiceContext): Promise<void>`
  - `refreshToken(context?: ServiceContext): Promise<UserSession>`
- **Mock Implementation**: `MockAuthService`
- **Scenarios Tested**: Authenticated session resolution, role switching, logout cache clearing.

### 2.2 Profile Management Service (`CAP-PROF`)
- **Interface**: `IProfileService`
- **Methods**:
  - `getPrivateProfile(context: ServiceContext): Promise<PrivateUserProfile>`
  - `updatePrivateProfile(request: ProfileUpdateRequest, context: ServiceContext): Promise<PrivateUserProfile>`
  - `completeOnboarding(request: StudentOnboardingRequest, context: ServiceContext): Promise<PrivateUserProfile>`
  - `getPublicStudyProfile(targetUserId: string, context: ServiceContext): Promise<PublicStudyProfile>`
  - `getSelfStudyPreview(context: ServiceContext): Promise<SelfPreviewResult<PublicStudyProfile>>`
  - `getSelfSocialPreview(context: ServiceContext): Promise<SelfPreviewResult<PublicSocialProfile>>`
- **Boundary Rules**:
  - `getPrivateProfile` returns sensitive academic and contact records only for self. Admin access explicitly throws `FORBIDDEN` (admins have no unrestricted private profile access).
  - `updatePrivateProfile` rejects attempts to change protected fields (`userId`, `rollNumber`, `department`, `degree`, `year`, `role`, `isOnboarded`) in the service adapter with `VALIDATION_ERROR`.
  - `completeOnboarding` executes transactional atomic saves across profile, consent records, and session state. Rejects mode/consent inconsistencies and incomplete required study fields.
  - `getSelfStudyPreview` and `getSelfSocialPreview` allow self-preview while opted out with explicit label *"Preview only — not currently discoverable"*, never exposing contact or private identity fields.
  - `getPublicStudyProfile` returns a public projection that strips roll numbers, emails, and direct contact details.

### 2.3 Academic Study Discovery & AI Recommendation (`CAP-STUDY`)
- **Interface**: `IStudyService`
- **Methods**:
  - `getStudyConsent(context: ServiceContext): Promise<StudyConsentRecord>`
  - `updateStudyConsent(optIn: boolean, context: ServiceContext): Promise<StudyConsentRecord>`
  - `listStudyPartners(options?: StudyDiscoveryFilters, context?: ServiceContext): Promise<StudyRecommendation[]>`
  - `getStudyPartner(targetStudentId: string, context: ServiceContext): Promise<StudyRecommendation | null>`
  - `recordStudyAction(targetStudentId: string, action: StudyActionType, context: ServiceContext): Promise<StudyActionResult>`
  - `submitMatchingQuery(courseCode: string, preferences: Partial<StudyPreferences>, context: ServiceContext): Promise<AgentMatchResult>`
  - `getMatchingStatus(queryId: string, context: ServiceContext): Promise<AgentMatchResult>`
- **Separation & Consent Rules**:
  - Independent consent: Academic study consent is decoupled from campus social consent. Opting out of study immediately removes student from `publicStudyProfiles` without affecting social pool.
  - Enabling study discovery requires valid enrolled courses and availability preferences.
- **Compatibility & Ranking Contracts (Stage 05)**:
  - Demo Formula: $35C + 25T + 20P + 10L + 10G$, normalized on a 0–1 scale and bounded [0, 100].
  - Weight renormalization: Optional omitted factors (Location, Goals) renormalize remaining active factor weights ($W_{\text{active}}$).
  - Deterministic tie-breaking: Candidates within 1.0 point are marked `isNearTied` and deterministically sorted by availability overlap -> course overlap -> target user ID.
  - Data Completeness: Weighted completion ratio returned in metadata (`dataCompletenessScore < 0.7` flags limited preference data).
- **Study Action Semantics**:
  - `LIKE`: Records one-sided interest (`PENDING_SENT`). If reciprocal, forms mutual partnership (`MUTUAL_CONNECTED`) under mode `STUDY`. Strictly never alters social consent or social relationships.
  - `PASS`: Dismisses candidate from current discovery round.
  - `HIDE`: Excludes candidate permanently from future recommendation queries.
- **Agent Matcher Simulation**:
  - Immediate synchronous completion with grounded explanations.
  - Deterministic fallback when course has no enrolled peers or when inference is unavailable.
  - Explicit labeling: Agent has no booking or messaging authority.


### 2.4 Consent-First Campus Social Discovery (`CAP-SOC`)
- **Interface**: `ISocialService`
- **Methods**:
  - `getSocialConsent(context: ServiceContext): Promise<SocialConsentRecord>`
  - `updateSocialConsent(optIn: boolean, context: ServiceContext): Promise<SocialConsentRecord>`
  - `listSocialPeers(options?: SocialDiscoveryFilters, context?: ServiceContext): Promise<SocialRecommendation[]>`
  - `getSocialPeer(targetStudentId: string, context: ServiceContext): Promise<SocialRecommendation | null>`
  - `recordSocialAction(targetStudentId: string, action: SocialActionType, context: ServiceContext): Promise<SocialActionResult>`
  - `resetSocialDiscoveryRound(context: ServiceContext): Promise<void>`
  - `listSocialConnections(context: ServiceContext): Promise<SocialRecommendation[]>`
- **Filters**: `SocialDiscoveryFilters` supports `category` (generic `SocialCategory` or `'ALL'`) and text `search`.
- **Privacy & Consent Rules (Stage 06)**:
  - Independent consent: revoking social consent does NOT revoke study consent. Study consent does NOT grant social access.
  - Actor must hold active social consent to read the feed, open detail URLs, or record actions; otherwise reads throw `FORBIDDEN` and mutations throw `VALIDATION_ERROR`.
  - Public profiles contain strictly approved public fields only — **no email, phone, handles, roll number, masked contact fields, private schedules, or private settings**. Scores and relationship state are recommendation metadata, never editable profile fields.
  - Candidate discovery opt-in, self-exclusion, actor pass/hide, and blocking/ineligibility rules are enforced in the mock service at read **and** mutation time. Direct detail URLs cannot bypass these checks.
- **Recommendations (Stage 06)**:
  - Grounded shared-interest reasons derived only from stored public data; with no shared interests an explicit "no explicit shared interests" statement is returned (no fabricated affinity, no numeric social compatibility score).
  - Deterministic ordering by shared-interest count descending then displayName ascending; no uncontrolled randomness or AI/ML ranking claims.
- **Social Action Semantics (Stage 06)**:
  - `LIKE`: First like records one-sided `PENDING_SENT`; reciprocal like forms `MUTUAL_CONNECTED` exclusively under mode `SOCIAL`. Repeated like is idempotent. Never creates a `STUDY` relationship or grants study-booking eligibility.
  - `PASS`: Dismisses candidate for the current social discovery round (cleared by `resetSocialDiscoveryRound`).
  - `HIDE`: Persists within the current demo store until full demo reset (documented demo-store persistence, not permanent production storage).

### 2.5 Peer Connection & Relationship Management (`CAP-CONN`)
- **Interface**: `IConnectionService`
- **Methods**:
  - `sendConnectionRequest(targetStudentId: string, mode: ConnectionMode, note: string | undefined, context: ServiceContext): Promise<PeerConnection>`
  - `listConnections(mode: ConnectionMode, context: ServiceContext): Promise<PeerConnection[]>`
  - `getConnection(connectionId: string, context: ServiceContext): Promise<PeerConnection>`
  - `listConnectionSummaries(mode, bucket, context): Promise<ConnectionSummaryItem[]>`
  - `getConnectionDetail(connectionId, context): Promise<ConnectionDetailView>`
  - `getConnectionCounts(mode, context): Promise<ConnectionCounts>`
  - `resetDemoState(context): Promise<void>`
- **Mode Separation**:
  - `STUDY` vs `SOCIAL` connection modes are tracked independently. A student may be a mutual social connection without being an eligible study partner.
- **State Rule**: Request state is derived from existing mode-specific Like records. Reciprocal Like creates mutual connection; no reject/withdraw/disconnect/expiry state machine is introduced.
- **Privacy Rule**: Detail reads require participant authorization and return public relationship projections only. One-sided visibility is an explicit demo policy, not a production privacy decision.

### 2.6 Campus Table Reservation Service (`CAP-BOOK`)
- **Interface**: `IBookingService`
- **Methods**:
  - `listLocations(context: ServiceContext): Promise<CampusLocation[]>`
  - `listTableAvailability(locationId: string, date: string, context: ServiceContext): Promise<StudyTableSlot[]>`
  - `getBooking(bookingId: string, context: ServiceContext): Promise<BookingRecord>`
  - `createBooking(request: BookingCreationRequest, context: ServiceContext): Promise<BookingRecord>`
  - `rescheduleBooking(request: BookingRescheduleRequest, context: ServiceContext): Promise<BookingRecord>`
  - `cancelBooking(bookingId: string, context: ServiceContext): Promise<BookingRecord>`
  - `getMyBookings(context: ServiceContext): Promise<BookingRecord[]>`
- **Domain Invariants**:
  - **Canonical Unit**: `tableId + localDate + slotId`, strictly 2-person capacity.
  - **Reciprocal Study Partner Eligibility**: Companion bookings use the canonical reciprocal-STUDY-Like resolver. The former Stage 07 legacy demo-pair bypass is removed; social-only or one-sided relationships throw `FORBIDDEN`.
  - **Resource Validation**: Location, table, slot, and local date are validated by the service; navigation parameters are not trusted.
  - **Atomic Collision Check**: Confirmed slot occupancy prevents duplicate booking.
  - **Failed Reschedule**: Target slot conflict preserves the original booking intact.
  - **Idempotent Cancellation**: Repeated cancellation converges to `CANCELLED` and frees slot occupancy. Cancelled bookings are excluded from active occupancy.
  - **Uncertain Creation**: `clientOperationId` is retained and reconciliation is scoped to actor plus operation ID. A null reconciliation result remains unresolved.
  - **Lifecycle Policy**: Physical check-in and `CHECKED_IN` status are deferred. Partner booking approval is tracked as `AUTO_ACCEPTED` / `UNRESOLVED_PENDING` / `NOT_REQUIRED`.

### 2.7 In-App Notifications (`CAP-NOTIF`)
- **Interface**: `INotificationService`
- **Methods**:
  - `listNotifications(filters, context): Promise<NotificationItem[]>`
  - `markAsRead(notificationId: string, context: ServiceContext): Promise<void>`
  - `markAsUnread(notificationId: string, context: ServiceContext): Promise<void>`
  - `markAllAsRead(context: ServiceContext): Promise<void>`
  - `getUnreadCount(context: ServiceContext): Promise<number>`
- **Mock events**: mutual STUDY/SOCIAL connections, committed booking create/reschedule/cancel for both participants, and report receipts. IDs are deterministic within the resettable demo store and repeated operations are deduplicated.
- **Destination boundary**: notifications carry typed internal references only. Booking, connection, and report destinations are resolved through approved routes and remain subject to normal authorization; no raw URLs or private fields are stored.
- **Delivery boundary**: in-app state is simulated in memory only. Email, push, realtime, database, and production delivery are unavailable.

### 2.8 Privacy, Blocking & Moderation Reporting (`CAP-MOD`)
- **Interface**: `IModerationService`
- **Methods**:
  - `reportUser(reportedUserId: string, category: string, description: string, context: ServiceContext): Promise<ReportReceipt>`
  - `blockUser(targetUserId: string, context: ServiceContext): Promise<{ blocked: boolean }>`
  - `listBlockedUsers(context: ServiceContext): Promise<string[]>`
  - `listMyReports(context: ServiceContext): Promise<ReportReceipt[]>`
- **Report boundary**: students can submit bounded reports and read only their own pending/status receipt. Admin moderation decisions remain Stage 10; reporting does not automatically penalize, suspend, hide, or reveal reporter identity.
- **Blocking boundary**: blocking is actor-scoped, symmetric for supported social discovery/detail/actions, and in memory only. It does not delete connections, cancel bookings, or modify messages; unblock and wider app-wide effects remain unresolved.

### 2.9 Administrative Governance & Audit (`CAP-ADM`)
- **Interface**: `IAdminService`
- **Methods**:
  - `listModerationReports(context: ServiceContext): Promise<ModerationReport[]>`
  - `resolveReport(reportId, { action, reason, confirm }, context): Promise<ModerationReport>`
  - `listAuditLogs(context: ServiceContext): Promise<AuditLogEntry[]>`
  - `getDashboardSummary(context): Promise<AdminDashboardSummary>`
  - `listUsers(search, context): Promise<AdminUserSummary[]>`
  - `getUser(userId, context): Promise<AdminUserSummary>`
  - `listResources(context): Promise<AdminResourceSummary[]>`
  - `createLocation(request, context): Promise<CampusLocation>`
  - `updateLocation(locationId, request, context): Promise<CampusLocation>`
  - `deactivateLocation(locationId, reason, confirm, context): Promise<void>`
  - `listTables(context): Promise<AdminTableResource[]>`
  - `createTable(request, context): Promise<AdminTableResource>`
  - `updateTable(tableId, request, context): Promise<AdminTableResource>`
  - `setTableActive(tableId, active, reason, confirm, context): Promise<void>`
  - `listSlots(context): Promise<StudyTableSlot[]>`
  - `createSlot(request, context): Promise<StudyTableSlot>`
  - `updateSlot(slotId, request, context): Promise<StudyTableSlot>`
  - `setSlotActive(slotId, active, reason, confirm, context): Promise<void>`
  - `listBookings(filters, context): Promise<BookingRecord[]>`
  - `cancelBooking(bookingId, reason, confirm, context): Promise<BookingRecord>`
- **Authorization**: Every operation enforces `ROLE_ADMIN` in the mock service; navigation guards are not the security boundary. User views are minimal projections without email, phone, private schedules, messages, or report descriptions in general audit records.
- **Resource policy**: Locations, tables, and fixed slots support typed create/edit/active-state operations. IDs and booked meanings are immutable in effect: edits or deactivation affecting future confirmed bookings are rejected, parent references must exist, slot times must be valid/non-overlapping for a table/date, and capacity is fixed at 2. Locations/resources are deactivated rather than deleted; confirmed bookings are never silently cancelled. Production adapters remain explicitly unavailable.
- **Moderation policy**: Report reason and explicit confirmation are required for decisions. Description is optional and bounded. Resolved reports persist reviewer, timestamp, reason, and audit reference; resolution does not automatically suspend the target. Duplicate/stale decisions are rejected.
- **Audit boundary**: Audit records are typed, redacted, append-only within the resettable mock store, and use the injected demo clock. They do not prove durable storage, tamper resistance, or real governance compliance.

### 2.10 Conditional Messaging Service (`CAP-CHAT`)
- **Interface**: `IConversationService`
- **Methods**:
  - `listConversations(context: ServiceContext): Promise<Array<{ id: string; peerId: string }>>`
  - `sendMessage(conversationId: string, content: string, context: ServiceContext): Promise<{ messageId: string }>`
- **Gating**: Disabled by default; route/navigation are omitted unless `VITE_ENABLE_MESSAGING=true`. Messaging remains deferred and makes no delivery or contact-handle claims.

---

## 3. Deterministic Scenarios & Error Model

The mock layer includes `ScenarioManager` (`src/mocks/scenarios.ts`) supporting:
1. `forceDelayMs`: Injects cancellable network latency via `AbortSignal`.
2. `forceError`: Injects deterministic error codes (`VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `SERVICE_UNAVAILABLE`, `AGENT_FAILED`).
3. `forceAgentFallback`: Forces AI recommendation queries into structured fallback mode.
4. `forceUncertainMutation`: Commits mock writes but returns an uncertain response (`UNCERTAIN_MUTATION`), enabling testing of client-side reconciliation via booking history without blind duplicate resubmissions.
5. `reset()`: Completely resets scenario overrides and resets `MockDatabase` to clean deterministic seeds.

*Scenario controls are strictly isolated from default production builds.*
