# Campus Duo — Frontend Requirements Traceability Matrix

**Document Version**: 6.0.0-stage11a-audited
**Status**: Stage 11A frontend coverage audit complete; mock workflows are not real backend integration

---

## 1. Traceability Matrix (`REQ-*` Status Breakdown)

> **Architectural Boundary Clarification (Stage 03)**:
> In Stage 03, the client-side typed service boundary (`src/services/interfaces.ts`) and stateful mock database (`src/mocks/store.ts`) are fully implemented.
> A focused UI vertical slice connects **Table Availability Grid, Booking Creation, Booking Detail/Pass, and Booking History/Cancellation** through TanStack Query hooks.
> Coverage status is evidence-based. A route is not considered complete solely because it renders: service wiring, permission behavior, UI states, and focused evidence are recorded separately. Production adapters remain unavailable unless a real adapter is implemented.

| Requirement ID | Primary Route | Core Components | Service Capability | Route Registered | Shell Implemented | Workflow Implemented | Service Connected | Verified Status | Target Stage for Live Service |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **REQ-AUTH-01** | `/login` | `LoginPage`, `AuthProvider` | `IAuthService.loginWithDemoRole` | Yes | Yes (Isolated Demo/Prod) | Multi-Identity Switcher / Prod Unavailable | **Connected (`useDemoAuth`)** | **Verified (`stage04.test.tsx`, `routing.test.tsx`)** | Stage 04 Live |
| **REQ-AUTH-02** | `/auth/recovery` | `AuthRecoveryPage`, `Toast` | `IAuthService.refreshToken` | Yes | Yes (Recovery Page Shell) | Illustrative Simulation | Mock Implemented | Service Verified (`services.test.ts`) | Stage 04 Live |
| **REQ-AUTH-03** | `/auth/callback` | `AuthCallbackPage` | `IAuthService.getCurrentSession` | Yes | Yes (Callback Page Shell) | Illustrative Simulation | Mock Implemented | Service Verified (`services.test.ts`) | Stage 04 Live |
| **REQ-ONB-01** | `/onboarding` | `OnboardingPage`, `Card`, `Badge` | `IProfileService.completeOnboarding` | Yes | Yes (6-Step Resumable Wizard) | Mode-First Guided Form & Atomic Save | **Connected (`useCompleteOnboarding`)** | **Verified (`stage04.test.tsx`)** | Stage 04 Live |
| **REQ-PROF-01** | `/app/profile` | `ProfilePage`, `Input`, `Badge` | `IProfileService.updatePrivateProfile`, `getSelfStudyPreview`, `getSelfSocialPreview` | Yes | Yes (Dual Tab Edit & Self-Preview) | Dirty State, Cancel, Live Update, Opt-Out Preview | **Connected (`usePrivateProfile`, `useUpdateProfile`, `usePublicStudyProfilePreview`, `usePublicSocialProfilePreview`)** | **Verified (`stage04.test.tsx`)** | Stage 04 Live |
| **REQ-SETT-01** | `/app/settings` | `SettingsPage`, `Card`, `Badge` | `IStudyService.updateStudyConsent`, `ISocialService.updateSocialConsent` | Yes | Yes (Privacy & Consent Controls) | Independent Discovery Opt-Out, Required Study Validation | **Connected (`useStudyConsent`, `useSocialConsent`, `useUpdateStudyConsent`, `useUpdateSocialConsent`, `useBlockedUsers`)** | **Verified (`stage04.test.tsx`)** | Stage 04 Live |
| **REQ-STUDY-01** | `/app/study`, `/app/study/:studentId` | `StudyDiscoveryPage`, `StudyDetailPage`, `Badge` | `IStudyService.listStudyPartners`, `getStudyPartner`, `recordStudyAction` | Yes | Yes (Discovery Feed & Detail Page) | Multi-Field Filter, Compatibility Breakdown, Like/Pass/Hide | **Connected (`useStudyRecommendations`, `useStudyPartnerDetail`, `useRecordStudyAction`)** | **Verified (`stage05.test.tsx`)** | Stage 05 Live |
| **REQ-STUDY-02** | `/app/study/requests`| `StudyRequestsPage`, connection detail panel | `IConnectionService.listConnectionSummaries`, `getConnectionDetail`, `getConnectionCounts` | Yes | Yes | Outgoing/incoming/mutual Like-derived views, reciprocal Like, authorized detail, booking eligibility | **Connected** | **Verified (`stage07.test.tsx`)** | Stage 07 Live |
| **REQ-SOC-01** | `/app/social` | `SocialDiscoveryPage`, `FilterBar`, `Badge` | `ISocialService.listSocialPeers`, `recordSocialAction`, `resetSocialDiscoveryRound` | Yes | Yes (Discovery Feed) | Filter UI + Like/Pass/Hide + Grounded Reasons | **Connected (`useSocialRecommendations`, `useRecordSocialAction`, `useResetSocialRound`)** | **Verified (`stage06.test.tsx`)** | Stage 06 Live |
| **REQ-SOC-02** | `/app/social/connections`| `SocialConnectionsPage`, connection detail panel | `IConnectionService.listConnectionSummaries`, `getConnectionDetail`, `getConnectionCounts` | Yes | Yes | Outgoing/incoming/mutual Like-derived views, reciprocal Like, authorized detail, SOCIAL-only booking exclusion | **Connected** | **Verified (`stage07.test.tsx`)** | Stage 07 Live |
| **REQ-BOOK-01** | `/app/booking` | `TableBookingOverviewPage`, `Card` | `IBookingService.listLocations` | Yes | Yes | Service-backed location/resource browsing with loading/error states | **Connected (`useBookingLocations`)** | **Verified (`stage08.test.ts`, `routing.test.tsx`)** | Stage 08 Live |
| **REQ-BOOK-02** | `/app/booking/table-grid`| `TableBookingGridPage`, `Badge` | `IBookingService.listTableAvailability` | Yes | Yes | Campus-date selector, fixed slots, occupied/unavailable states, selection | **Connected (`useTableAvailability`)** | **Verified (`stage08.test.ts`, `services.test.ts`, `routing.test.tsx`)** | Stage 08 Live |
| **REQ-BOOK-03** | `/app/booking/new` | `NewBookingPage`, `ConfirmationDialog` | `IBookingService.createBooking`, reciprocal STUDY connection resolver | Yes | Yes | Authorized companion selection, review, duplicate guard, conflict/uncertain states | **Connected (`useCreateBooking`, `useConnectionSummaries`)** | **Verified (`stage08.test.ts`, `services.test.ts`, `queries.test.tsx`)** | Stage 08 Live |
| **REQ-BOOK-04** | `/app/booking/:id` | `BookingDetailPage`, `ConfirmationDialog` | `getBooking`, `rescheduleBooking`, `cancelBooking` | Yes | Yes | Authorized detail, rescheduling review/conflict, cancellation | **Connected (`useBookingDetail`, `useRescheduleBooking`, `useCancelBooking`)** | **Verified (`stage08.test.ts`, `services.test.ts`)** | Stage 08 Live |
| **REQ-BOOK-05** | `/app/booking/history`| `BookingHistoryPage`, `TableWrapper` | `IBookingService.getMyBookings` | Yes | Yes | Participant history with status/date filters | **Connected (`useMyBookings`)** | **Verified (`services.test.ts`, `stage08.test.ts`)** | Stage 08 Live |
| **REQ-AI-01** | `/app/study`, `/preview` | `Dialog`, `Button`, `Badge` | `IStudyService.submitMatchingQuery`, `getMatchingStatus` | Yes | Yes (Agent Matcher Dialog) | Request Submission, Grounded Reasons, Deterministic Fallback | **Connected (`useSubmitMatchingQuery`, `useMatchingQueryStatus`)** | **Verified (`stage05.test.tsx`)** | Stage 05 Live |
| **REQ-NOTIF-01** | `/app/notifications`| `NotificationsPage`, `StudentLayout` | `INotificationService` | Yes | Yes | Service-backed filters, unread badge, read/unread controls and typed destinations | **Connected (`notificationHooks`)** | **Verified (`stage09.test.ts`)** | Stage 09 Mock |
| **REQ-MOD-05** | `/app/social/:studentId`, `/app/settings` | `ReportDialog`, `SocialDetailPage`, `SettingsPage` | `IModerationService` | Yes | Yes | Bounded report submission, private receipts, supported social-only block list/actions | **Connected (`moderationHooks`)** | **Verified (`stage09.test.ts`, stage06.test.tsx`)** | Stage 09 Mock |
| **REQ-MOD-01** | `/app/conversations` | `ConversationsPage`, `Badge` | `IConversationService.listConversations` | Conditional | Yes (Feature Flag Gated Shell) | Disabled/deferred unless explicitly enabled | Mock contract only | **Verified route exclusion (`stage07.test.tsx`)** | Deferred |
| **REQ-ADM-01** | `/admin/tables` | `AdminTablesPage`, `TableWrapper` | `IAdminService.listResources`, `deactivateLocation` | Yes | Yes | Service-backed resource inventory and guarded deactivation | **Connected (`adminHooks`)** | **Verified (`stage10.test.ts`)** | Stage 10 Mock |
| **REQ-ADM-07** | `/admin/tables` | `AdminTablesPage`, `Dialog` | `IAdminService.create/updateLocation`, `create/updateTable`, `create/updateSlot`, active-state methods | Yes | Yes | Location, two-person table, fixed-slot management with validation and booking-history protection | **Connected (`adminHooks`)** | **Verified (`stage10.test.ts`)** | Stage 10 Mock; browser inspection pending |
| **REQ-ADM-02** | `/admin/reports` | `AdminReportsPage`, `TableWrapper`, `ConfirmationDialog` | `IAdminService.listModerationReports`, `resolveReport` | Yes | Yes | Pending/resolved queue, required reason/confirmation, stale transition denial | **Connected (`adminHooks`)** | **Verified (`stage10.test.ts`)** | Stage 10 Mock |
| **REQ-ADM-03** | `/admin/audit-logs` | `AdminAuditLogsPage`, `TableWrapper` | `IAdminService.listAuditLogs` | Yes | Yes | Redacted actor/action/target/outcome/reason list | **Connected (`adminHooks`)** | **Verified (`stage10.test.ts`)** | Stage 10 Mock |
| **REQ-ADM-04** | `/admin/dashboard` | `AdminDashboardPage`, `Card` | `IAdminService.getDashboardSummary` | Yes | Yes | Store-derived resource, booking, report, and audit counts | **Connected (`adminHooks`)** | **Verified (`stage10.test.ts`)** | Stage 10 Mock |
| **REQ-ADM-05** | `/admin/users` | `AdminUsersPage`, `TableWrapper` | `IAdminService.listUsers`, `getUser` | Yes | Yes | Searchable minimal user summaries without private fields | **Connected (`adminHooks`)** | **Verified (`stage10.test.ts`)** | Stage 10 Mock |
| **REQ-ADM-06** | `/admin/bookings` | `AdminBookingsPage`, `TableWrapper`, `ConfirmationDialog` | `IAdminService.listBookings`, `cancelBooking` | Yes | Yes | Filtered oversight and reason-confirmed admin cancellation | **Connected (`adminHooks`)** | **Verified (`stage10.test.ts`)** | Stage 10 Mock |

## 4. Stage 11A Evidence-Based Coverage Audit

The audit distinguishes route rendering from service wiring and test evidence. “Mock complete” means the in-memory adapter and frontend behavior are implemented; it does not mean a production backend exists.

| Capability | User action and states audited | Permission rule | Mock/test evidence | Production dependency or gap |
|---|---|---|---|---|
| Auth/session | Login, role switch, logout, recovery/callback; signed-out, forbidden, unavailable | Authenticated session and role guards; provider-neutral | `MockAuthProfileServices`, `routing.test.tsx`, `stage04.test.tsx`, `services.test.ts` | Identity provider/session protocol and real token lifecycle unresolved |
| Onboarding/profile/consent | Complete wizard, edit private profile, preview public projections, independently opt in/out; validation/loading/success/error | Self-only private writes; separate study/social consent | `stage04.test.tsx`, query/service tests | Real identity source, persistence, and provider-backed profile rules |
| Study discovery/agent | Filter/list/detail, Like/Pass/Hide, agent request/status; loading/empty/fallback/failed/action states | Study consent, self-exclusion, actor-scoped actions | `stage05.test.tsx`, `MockStudySocialServices`, `studyHooks` | Backend ranking/agent orchestration and authoritative eligibility |
| Social discovery | Consent gate, filters, detail, Like/Pass/Hide, reset; loading/empty/unavailable/action states | Both actor and candidate social consent, social-only blocking | `stage06.test.tsx`, `socialHooks` | Social policy, persistence, real privacy enforcement |
| Connections | Outgoing/incoming/mutual summaries, reciprocal Like, authorized detail; forbidden/not-found/pending/error/success | Participant-level detail authorization and mode isolation | `stage07.test.tsx`, `connectionHooks` | Production relationship read model and unresolved withdrawal/disconnect/opt-out effects |
| Booking | Location/availability, create/review, conflict, reschedule/cancel/history, uncertain reconciliation | Participant/creator/admin demo authority; stable operation ID | `stage08.test.ts`, `services.test.ts`, `queries.test.tsx` | Durable transactions, concurrency, cutoff/overlap policy, real resource inventory |
| Notifications | List/filter, unread badge, mark read/unread/all; loading/empty/error/restricted destination | Recipient-owned reads/mutations | `stage09.test.ts`, `notificationHooks` | Durable eventing, email/push/realtime delivery |
| Reports/blocking | Bounded report dialog/receipt, blocked list, social-only block; validation/pending/failure/success | Self-owned reports; symmetric supported social exclusion | `stage09.test.ts`, `moderationHooks` | Admin moderation backend, unblock/wider effects, retention |
| Admin resources | Inventory, location/table/slot create/edit/active controls, protected deactivation; validation/conflict/confirmation/error | Direct `ROLE_ADMIN` service enforcement | `stage10.test.ts`, `adminHooks` | Persistent inventory, concurrency, remediation workflow |
| Admin moderation/bookings/audits | Search/review/cancel, required reason/confirmation, redacted audit refresh | Admin-only; minimal user projections | `stage10.test.ts` | Durable/tamper-resistant audit, approved suspension/removal/booking policies |
| Messaging | Route/navigation excluded by default; no enabled delivery states | Active authorized mutual connection only if explicitly enabled | route exclusion tests, feature flag | Entire production messaging contract and policy unresolved |

### Coverage gaps found and fixed

- Corrected stale documentation that described current admin/resource screens as fixture-only or deactivation-only.
- Recorded the final Stage 10 build evidence after the slot-editor changes.
- Added the backend handoff, machine-readable contract schema, synthetic fixtures, and frontend runbook.

### Remaining frontend-only work

- Desktop/mobile browser inspection of student and admin flows remains pending.
- The resource screen has service-backed slot/table active controls, but richer per-record edit affordances and visual responsiveness still need browser confirmation.
- No frontend omission justified inventing backend endpoints or changing unresolved policy.

---

## 2. Stage 05 Deliverables & Verification Status

| Deliverable Area | Implementation Files | Verification Method | Status |
| :--- | :--- | :--- | :--- |
| **Study Discovery Eligibility & Privacy** | `StudyDiscoveryPage.tsx`, `MockStudySocialServices.ts` | Enforces valid session, required study consent, self-exclusion, contact field suppression. Consent-disabled card links to Settings. | **Verified (`stage05.test.tsx`)** |
| **Compatibility Demo Formula & Renormalization** | `MockStudySocialServices.ts`, `StudyDetailPage.tsx` | Demo ranking formula $35C + 25T + 20P + 10L + 10G$. Renormalizes active factor weights when optional factors are omitted. Score bounded [0, 100]. | **Verified (`stage05.test.tsx`)** |
| **Near-Tied Ordering & Tie Breaking** | `MockStudySocialServices.ts` | Candidates within 1.0 score point marked `isNearTied`. Sorted deterministically: availability overlap -> course overlap -> user ID. | **Verified (`stage05.test.tsx`)** |
| **Like, Pass, and Hide Service Actions** | `MockStudySocialServices.ts`, `StudyDiscoveryPage.tsx`, `StudyDetailPage.tsx` | One-sided Like records `PENDING_SENT`; reciprocal Like creates mutual `STUDY` partnership without touching social relationships. `PASS` dismisses; `HIDE` permanently excludes. | **Verified (`stage05.test.tsx`)** |
| **AI Agent Matching Simulation & Fallback** | `StudyDiscoveryPage.tsx`, `studyHooks.ts`, `MockStudySocialServices.ts` | Immediate completion with grounded candidate references and explanations. Deterministic fallback when course has no peers. Disclaimers visible. | **Verified (`stage05.test.tsx`)** |
| **Dashboard Service Integration** | `StudentDashboardPage.tsx` | Suggested study match card derives from `useStudyRecommendations()`. Displays live partner name, score, and grounding. | **Verified (`stage05.test.tsx`)** |
| **Query & Production Safety** | `studyHooks.ts`, `UnavailableServiceAdapter.ts` | Actor-scoped query keys embed filters. `UnavailableServiceAdapter` rejects all calls with `SERVICE_UNAVAILABLE`. | **Verified (`stage05.test.tsx`)** |
| **Automated Test Suite** | `src/tests/stage05.test.tsx` | 23 comprehensive tests in Stage 05 suite; 117 total passing tests across 12 files. | **Verified (`npm test -- --run`)** |
| **Type Check & Lint** | Whole codebase | TypeScript 0 errors, ESLint 0 errors / 0 warnings | **Verified (`npm run typecheck`, `npm run lint`)** |
| **Production Build** | `vite build` | Production bundle generation (`dist/`) | **Verified (`npm run build`)** |

---

## 3. Stage 06 Deliverables & Verification Status

| Deliverable Area | Implementation Files | Verification Method | Status |
| :--- | :--- | :--- | :--- |
| **Social Recommendations & Filters** | `MockStudySocialServices.ts`, `SocialDiscoveryPage.tsx`, `socialHooks.ts` | Grounded shared-interest reasons derived from stored public data; honest "no explicit shared interests" for no overlap; generic category + text filters; deterministic ordering (shared-interest count desc, then displayName asc); no numeric social compatibility score. | **Verified (`stage06.test.tsx`)** |
| **Public Candidate Details & Privacy** | `MockStudySocialServices.ts`, `SocialDetailPage.tsx`, `types/index.ts` | `PublicSocialProfile` contains only approved public fields (userId, displayName, bio, interests) with no email/phone/handles/roll/masked contacts/private schedules/settings. Scores and relationship state are metadata, not editable profile fields. Direct detail URLs cannot bypass discovery privacy rules. | **Verified (`stage06.test.tsx`)** |
| **Independent Social Like/Pass/Hide** | `MockStudySocialServices.ts`, `SocialDiscoveryPage.tsx`, `SocialDetailPage.tsx` | `LIKE` idempotent (one-sided `PENDING_SENT` → reciprocal `MUTUAL_CONNECTED` under mode `SOCIAL` only, never `STUDY`, never study-booking eligibility). `PASS` round-scoped (cleared by `resetSocialDiscoveryRound`); `HIDE` persisted in demo store until full demo reset. Study and social action stores remain mode-isolated. | **Verified (`stage06.test.tsx`)** |
| **Eligibility & Consent Enforcement in Mock Services** | `MockStudySocialServices.ts` | Enforced at read and mutation time: valid student session, actor social opt-in, candidate opt-in, self-exclusion, blocking/ineligibility, actor Hide and round Pass exclusions. Study consent does NOT grant social access. | **Verified (`stage06.test.tsx`)** |
| **Social Dashboard Summary** | `StudentDashboardPage.tsx`, `socialHooks.ts` | Social portion derives from `useSocialConnections()` and discovery counts; links to existing settings/preferences. | **Verified (`stage06.test.tsx`)** |
| **Query & Production Safety** | `socialHooks.ts`, `UnavailableServiceAdapter.ts` | Actor-scoped `queryKeys.social.*` embed actor/filters; reads enabled only after consent; `AbortSignal` passes through cancellable reads; `UnavailableServiceAdapter` covers all new social methods. | **Verified (`stage06.test.tsx`)** |
| **Automated Test Suite** | `src/tests/stage06.test.tsx` | 19 comprehensive tests in Stage 06 suite; 136 total passing tests across 13 files. | **Verified (`npm test -- --run`)** |
| **Type Check & Lint** | Whole codebase | TypeScript 0 errors, ESLint 0 errors / 0 warnings | **Verified (`npm run typecheck`, `npm run lint`)** |
| **Production Build** | `vite build` | Production bundle generation (`dist/`) with pre-existing >500 kB chunk-size warning recorded, not silenced. | **Verified (`npm run build`)** |
