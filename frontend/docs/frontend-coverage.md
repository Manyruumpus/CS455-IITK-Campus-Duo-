# Campus Duo — Frontend Requirements Traceability Matrix

**Document Version**: 2.1.0-stage02-repaired  
**Status**: Stage 02 Application Shell & Visual System Reconciled

---

## 1. Traceability Matrix (`REQ-*` Status Breakdown)

> **Important Boundary Clarification (Stage 02)**: In Stage 02, requirements are implemented as **navigable UI shells with illustrative fixtures only**. No backend API services or live mutations are connected yet. Full domain requirement fulfillment is deferred to subsequent stages.

| Requirement ID | Primary Route | Core Components | Service Capability | Documented | Shell Registered (Stage 02) | Service Connected (Stage 02) | Verified Status | Stage Target |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **REQ-AUTH-01** | `/login` | `LoginPage`, `DemoAuthContext` | `IAuthService.loginWithIITK` | Yes | Yes (Demo Switcher Shell) | No | Shell Verified (`routing.test.tsx`) | Stage 02 Shell / Stage 04 Live |
| **REQ-AUTH-02** | `/auth/recovery` | `AuthRecoveryPage`, `Toast` | `IAuthService.refreshToken` | Yes | Yes (Recovery Page Shell) | No | Shell Verified (`routing.test.tsx`) | Stage 02 Shell / Stage 04 Live |
| **REQ-AUTH-03** | `/auth/callback` | `AuthCallbackPage` | `IAuthService.handleOAuthCallback` | Yes | Yes (Simulated Callback Shell) | No | Shell Verified (`routing.test.tsx`) | Stage 02 Shell / Stage 04 Live |
| **REQ-ONB-01** | `/app/profile` | `Input`, `ProfilePage`, `Zod` | `IProfileService` | Yes | Yes (Profile Form Shell) | No | Shell Verified (`Input.test.tsx`) | Stage 02 Shell / Stage 04 Live |
| **REQ-ONB-02** | `/app/settings` | `SettingsPage`, `RequireSocialConsent` | `ISocialService.updateConsent` | Yes | Yes (Consent Toggle Shell) | No | Shell Verified (`routing.test.tsx`) | Stage 02 Shell / Stage 04 Live |
| **REQ-STUDY-01** | `/app/study` | `StudyDiscoveryPage`, `FilterBar`, `Badge` | `IStudyService.listPartners` | Yes | Yes (Discovery Feed Shell) | No | Shell Verified (`routing.test.tsx`) | Stage 02 Shell / Stage 05 Live |
| **REQ-STUDY-02** | `/app/study/requests`| `StudyRequestsPage`, `ConfirmationDialog` | `IConnectionService.sendRequest` | Yes | Yes (Requests Shell) | No | Shell Verified (`dialog.test.tsx`) | Stage 02 Shell / Stage 05 Live |
| **REQ-SOC-01** | `/app/social` | `SocialDiscoveryPage`, `FilterBar`, `Badge` | `ISocialService.listSocialPeers` | Yes | Yes (Discovery Feed Shell) | No | Shell Verified (`routing.test.tsx`) | Stage 02 Shell / Stage 06 Live |
| **REQ-SOC-02** | `/app/social/connections`| `SocialConnectionsPage`, `Badge` | `ISocialService.listMutual` | Yes | Yes (Mutual Connections Shell) | No | Shell Verified (`routing.test.tsx`) | Stage 02 Shell / Stage 06 Live |
| **REQ-BOOK-01** | `/app/booking` | `TableBookingOverviewPage`, `Card` | `IBookingService.listSlots` | Yes | Yes (Booking Overview Shell) | No | Shell Verified (`routing.test.tsx`) | Stage 02 Shell / Stage 07 Live |
| **REQ-BOOK-02** | `/app/booking/table-grid`| `TableBookingGridPage`, `Badge` | `IBookingService.listSlots` | Yes | Yes (2-Person Matrix Shell) | No | Shell Verified (`routing.test.tsx`) | Stage 02 Shell / Stage 07 Live |
| **REQ-BOOK-03** | `/app/booking/new` | `NewBookingPage`, `ConfirmationDialog` | `IBookingService.reserveSlot` | Yes | Yes (Reservation Form Shell) | No | Shell Verified (`routing.test.tsx`) | Stage 02 Shell / Stage 07 Live |
| **REQ-BOOK-04** | `/app/booking/:id` | `BookingDetailPage`, `ConfirmationDialog` | `IBookingService.cancelBooking` | Yes | Yes (Pass & Cancellation Shell) | No | Shell Verified (`dialog.test.tsx`) | Stage 02 Shell / Stage 07 Live |
| **REQ-AI-01** | `/app/study`, `/preview` | `Card`, `Badge` | `IAgentRecommendationService` | Yes | Yes (Grounding Factors Mock Display) | No | Shell Verified (`mocks.test.ts`) | Stage 02 Shell / Stage 05 Live |
| **REQ-NOTIF-01** | `/app/notifications`| `NotificationsPage`, `Toast` | `INotificationService` | Yes | Yes (Notification List Shell) | No | Shell Verified (`routing.test.tsx`) | Stage 02 Shell / Stage 08 Live |
| **REQ-MOD-01** | `/app/conversations` | `ConversationsPage`, `Badge` | `IModerationService` | Yes | Yes (DEC-08 Provisional Placeholder) | No | Shell Verified (`routing.test.tsx`) | Stage 02 Shell / Stage 09 Live |
| **REQ-ADM-01** | `/admin/tables` | `AdminTablesPage`, `TableWrapper` | `IAdminService.listTableInventory` | Yes | Yes (Table Inventory Console Shell) | No | Shell Verified (`routing.test.tsx`) | Stage 02 Shell / Stage 10 Live |
| **REQ-ADM-02** | `/admin/reports` | `AdminReportsPage`, `TableWrapper` | `IAdminService.listReports` | Yes | Yes (Moderation Queue Console Shell)| No | Shell Verified (`routing.test.tsx`) | Stage 02 Shell / Stage 10 Live |
| **REQ-ADM-03** | `/admin/audit-logs` | `AdminAuditLogsPage`, `TableWrapper`| `IAdminService.listAuditLogs` | Yes | Yes (Audit Log Console Shell) | No | Shell Verified (`routing.test.tsx`) | Stage 02 Shell / Stage 10 Live |
| **REQ-ADM-04** | `/admin/dashboard` | `AdminDashboardPage`, `Card` | `IAdminService` | Yes | Yes (Admin Console Shell) | No | Shell Verified (`routing.test.tsx`) | Stage 02 Shell / Stage 10 Live |

---

## 2. Stage 02 Deliverables & Verification Status

| Deliverable Area | Implementation Files | Verification Method | Status |
| :--- | :--- | :--- | :--- |
| **Application Routing** | `src/app/routes.tsx`, `App.tsx` | 31 registered route patterns (29 navigable pages + 2 index redirects) in nested layout hierarchy | **Verified (9/9 Route Tests Pass in `routing.test.tsx`)** |
| **Layout Shells** | `MarketingLayout`, `AuthLayout`, `StudentLayout`, `AdminLayout`, `ErrorLayout` | Navigation drawer, responsive layout, skip-to-content links | **Verified (`navigation.test.tsx`)** |
| **Landing Page** | `src/features/marketing/LandingPage.tsx` | Kyoto craft design, dual study/social tracks, consent explanation | **Verified (Renders cleanly)** |
| **Accessible Dialog Primitive** | `src/components/ui/Dialog.tsx`, `ConfirmationDialog.tsx` | Focus trap, Escape key dismiss, focus restoration to trigger | **Verified (`dialog.test.tsx`)** |
| **Universal State Primitives** | `LoadingSkeleton`, `EmptyState`, `ErrorState`, `Toast` | WAI-ARIA labels, non-destructive recovery, dismiss callbacks | **Verified (Unit tested & integrated)** |
| **Client Navigation Guards** | `RequireAuth`, `RequireRole`, `RequireSocialConsent` | Default unauthenticated state, 403 redirect, consent prompt | **Verified (Tested in `routing.test.tsx`)** |
| **Type Check (`tsc --noEmit`)** | Whole codebase | Strict TypeScript compilation (`noUnusedLocals: true`) | **Verified (0 Errors)** |
| **Lint Check (`eslint .`)** | Whole codebase | ESLint recommended + React hooks rules | **Verified (0 Errors, 0 Warnings)** |
| **Automated Test Suite** | `src/tests/*.test.tsx` | Vitest runtime runner (`npm test`) | **Verified (7/7 Suites, 31/31 Tests Pass)** |
| **Production Build** | `vite build` | Production bundle generation (`dist/`) | **Verified** |
