# Campus Duo — Route Inventory & Navigation Architecture

**Document Version**: 3.0.0-stage11a-audited
**Status**: Stage 11A route and capability audit; mock workflows are not real backend integration

---

## 1. Route Summary by Configuration

All route objects are generated dynamically by `buildRoutes()` in `src/app/routes.tsx`. Route counts vary strictly by environment and feature flags:

| Configuration | Layout Nodes | Navigable Pages | Index Redirects | Wildcard Fallback | Conditional Routes Included | Total Leaf Routes (Pages + Redirects + Fallback) | Total Tree Nodes (Layouts + Leaves) |
| :--- | :---: | :---: | :---: | :---: | :--- | :---: | :---: |
| **Development** (`import.meta.env.DEV`) | 5 | 28 | 2 | 1 | `/preview/design-system` | **31** | **36** |
| **Default Production** (Strict Production) | 5 | 27 | 2 | 1 | None (Preview & Messaging excluded) | **30** | **35** |
| **Explicit Demo Showcase** (`VITE_DEMO_SHOWCASE=true`) | 5 | 28 | 2 | 1 | `/preview/design-system` | **31** | **36** |
| **Showcase + Messaging** (`VITE_ENABLE_MESSAGING=true`) | 5 | 29 | 2 | 1 | `/preview/design-system`, `/app/conversations` | **32** | **37** |

### Breakdown of Layout Nodes (5)
1. `MarketingLayout` (`/` root layout)
2. `AuthLayout` (`/` auth container layout)
3. `StudentLayout` (`/app` protected layout; guarded by `RequireAuth` + `RequireRole('ROLE_STUDENT')`)
4. `AdminLayout` (`/admin` protected layout; guarded by `RequireAuth` + `RequireRole('ROLE_ADMIN')`)
5. `ErrorLayout` (`/` error boundary layout)

### Breakdown of Index Redirects (2)
1. `/app` (index: true) → Redirects to `/app/dashboard`
2. `/admin` (index: true) → Redirects to `/admin/dashboard`

### Breakdown of Wildcard Fallback (1)
1. `*` → Renders `NotFoundPage` (404)

---

## 2. Granular Route Status Breakdown

Implementation Status Levels:
- **Route Registered**: Route path formally configured in `buildRoutes()` (`src/app/routes.tsx`).
- **Shell Implemented**: Layout and page component mounted with Outlet, PageHeader, and responsive primitives.
- **Workflow Implemented**: Interactive local form/dialog interaction without backend persistence.
- **Service Connected**: Real API adapter or TanStack Query cache attached.
- **Verified**: Empirically verified via automated unit/integration tests or manual inspection.

| Route ID | Path | Layout Parent | Guard / Role | Route Registered | Shell Implemented | Workflow Implemented | Service Connected | Verified Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **RT-MKT-01** | `/` | `MarketingLayout` | Public | Yes | Yes | Yes (Hero CTAs) | N/A | Verified (`routing.test.tsx`) |
| **RT-PRV-01** | `/preview/design-system` | `MarketingLayout` | Public (Dev/Showcase only) | Conditional | Yes | Yes (Workbench) | N/A | Verified (`routing.test.tsx`) |
| **RT-AUTH-01** | `/login` | `AuthLayout` | Public (Demo/Prod isolated) | Yes | Yes | Yes (Demo Switcher/Notice) | Yes (MockAuth) | Verified (`routing.test.tsx`) |
| **RT-AUTH-02** | `/auth/callback` | `AuthLayout` | Public | Yes | Yes | Illustrative Simulation | No | Verified (`routing.test.tsx`) |
| **RT-AUTH-03** | `/auth/recovery` | `AuthLayout` | Public | Yes | Yes | Illustrative Simulation | No | Verified (`routing.test.tsx`) |
| **RT-AUTH-04** | `/onboarding` | `AuthLayout` | `RequireAuth` (Student only; Admin bypass) | Yes | Yes | Yes (6-Step Resumable Wizard) | Yes (MockProfile) | Verified (`stage04.test.tsx`, `routing.test.tsx`) |
| **RT-APP-00** | `/app` | `StudentLayout` | `ROLE_STUDENT` | Yes | Redirect | N/A | N/A | Verified (Redirects to dashboard) |
| **RT-APP-01** | `/app/dashboard` | `StudentLayout` | `ROLE_STUDENT` | Yes | Yes | Yes (Service-Derived Study Match + Social Summary) | Yes (MockStudy, MockSocial) | Verified (`stage05.test.tsx`, `stage06.test.tsx`, `routing.test.tsx`) |
| **RT-STUDY-01** | `/app/study` | `StudentLayout` | `ROLE_STUDENT` | Yes | Yes | Yes (Filter/Compatibility/Like/Agent) | Yes (MockStudy) | Verified (`stage05.test.tsx`) |
| **RT-STUDY-02** | `/app/study/:studentId` | `StudentLayout` | `ROLE_STUDENT` | Yes | Yes | Yes (Factor Breakdown / Actions) | Yes (MockStudy) | Verified (`stage05.test.tsx`) |
| **RT-STUDY-03** | `/app/study/requests` | `StudentLayout` | `ROLE_STUDENT` | Yes | Yes (Like-derived tabs/detail) | Yes (Reciprocal Like; withdrawal/decline unavailable) | **Yes (`IConnectionService`)** | **Verified (`stage07.test.tsx`)** |
| **RT-SOC-01** | `/app/social` | `StudentLayout` | `ROLE_STUDENT` + `RequireSocialConsent` | Yes | Yes | Yes (Filter/Like/Pass/Hide/Grounded Reasons) | Yes (MockSocial) | Verified (`stage06.test.tsx`, `routing.test.tsx`) |
| **RT-SOC-02** | `/app/social/:studentId` | `StudentLayout` | `ROLE_STUDENT` + `RequireSocialConsent` | Yes | Yes | Yes (Public Detail / Actions / Mutual Indicator) | Yes (MockSocial) | Verified (`stage06.test.tsx`) |
| **RT-SOC-03** | `/app/social/connections` | `StudentLayout` | `ROLE_STUDENT` + `RequireSocialConsent` | Yes | Yes (Like-derived tabs/detail) | Yes (Reciprocal Like; SOCIAL-only booking exclusion) | **Yes (`IConnectionService`)** | **Verified (`stage07.test.tsx`)** |
| **RT-BOOK-01** | `/app/booking` | `StudentLayout` | `ROLE_STUDENT` | Yes | Yes | Service-backed resource/location browsing | **Yes (`IBookingService.listLocations`)** | **Verified (`stage08.test.ts`, `routing.test.tsx`)** |
| **RT-BOOK-02** | `/app/booking/table-grid` | `StudentLayout` | `ROLE_STUDENT` | Yes | Yes | Campus date/fixed-slot selection with live occupancy | **Yes (`IBookingService.listTableAvailability`)** | **Verified (`stage08.test.ts`, `routing.test.tsx`)** |
| **RT-BOOK-03** | `/app/booking/new` | `StudentLayout` | `ROLE_STUDENT` | Yes | Yes | Review/confirmation with authorized mutual STUDY companion | **Yes (`IBookingService.createBooking`)** | **Verified (`stage08.test.ts`, `queries.test.tsx`)** |
| **RT-BOOK-04** | `/app/booking/:bookingId`| `StudentLayout` | `ROLE_STUDENT` | Yes | Yes | Detail, actor-authorized reschedule, cancellation, conflict state | **Yes (`IBookingService`)** | **Verified (`stage08.test.ts`, `services.test.ts`)** |
| **RT-BOOK-05** | `/app/booking/history` | `StudentLayout` | `ROLE_STUDENT` | Yes | Yes | Participant history with status/date filters | **Yes (`IBookingService.getMyBookings`)** | **Verified (`stage08.test.ts`, `routing.test.tsx`)** |
| **RT-CHAT-01** | `/app/conversations` | `StudentLayout` | `ROLE_STUDENT` | Conditional (DEC-08 Flag) | Yes | Disabled/deferred by default | No | **Verified route exclusion (`stage07.test.tsx`)** |
| **RT-NOTIF-01** | `/app/notifications`| `StudentLayout` | `ROLE_STUDENT` | Yes | Yes | Yes (service filters/read-state/destinations) | **Yes (`INotificationService`)** | **Verified (`stage09.test.ts`, routing.test.tsx`)** |
| **RT-PROF-01** | `/app/profile` | `StudentLayout` | `ROLE_STUDENT` | Yes | Yes | Yes (Profile Form) | No | Verified (`Input.test.tsx`) |
| **RT-SETT-01** | `/app/settings` | `StudentLayout` | `ROLE_STUDENT` (Always Accessible)| Yes | Yes | Yes (consent, blocked-account explanation, own report receipts, reset) | **Yes (`IModerationService`)** | **Verified (`stage09.test.ts`, routing.test.tsx`)** |
| **RT-ADM-00** | `/admin` | `AdminLayout` | `ROLE_ADMIN` | Yes | Redirect | N/A | N/A | Verified (Redirects to dashboard) |
| **RT-ADM-01** | `/admin/dashboard` | `AdminLayout` | `ROLE_ADMIN` | Yes | Yes | Yes (store-derived operational counts) | **Yes (`IAdminService`)** | **Verified (`stage10.test.ts`, routing.test.tsx`)** |
| **RT-ADM-02** | `/admin/users` | `AdminLayout` | `ROLE_ADMIN` | Yes | Yes | Yes (service-backed searchable user summaries) | **Yes (`IAdminService`)** | **Verified (`stage10.test.ts`)** |
| **RT-ADM-03** | `/admin/reports` | `AdminLayout` | `ROLE_ADMIN` | Yes | Yes | Yes (service-backed review with guarded outcomes) | **Yes (`IAdminService`)** | **Verified (`stage10.test.ts`)** |
| **RT-ADM-04** | `/admin/tables` | `AdminLayout` | `ROLE_ADMIN` | Yes | Yes | Yes (location/table/fixed-slot inventory, create/edit, active controls, guarded deactivation) | **Yes (`IAdminService`, mock only)** | **Service verified (`stage10.test.ts`); browser pending** |
| **RT-ADM-05** | `/admin/bookings` | `AdminLayout` | `ROLE_ADMIN` | Yes | Yes | Yes (filtered booking oversight and cancellation) | **Yes (`IAdminService`)** | **Verified (`stage10.test.ts`)** |
| **RT-ADM-06** | `/admin/audit-logs` | `AdminLayout` | `ROLE_ADMIN` | Yes | Yes | Yes (redacted audit list) | **Yes (`IAdminService`)** | **Verified (`stage10.test.ts`)** |
| **RT-ERR-403** | `/forbidden` | `ErrorLayout` | Public | Yes | Yes | Yes (403 Screen) | N/A | Verified (`routing.test.tsx`) |
| **RT-ERR-404** | `*` | `ErrorLayout` | Public | Yes | Yes | Yes (404 Fallback) | N/A | Verified (`routing.test.tsx`) |

---

## 3. Planned But Unregistered Routes

The following routes are defined in long-term requirements but are **NOT registered in `src/app/routes.tsx`**:

| Planned Route | Target Shell | Description | Current Status |
| :--- | :--- | :--- | :--- |
| `/about` | `MarketingLayout` | Campus Duo Kyoto design ethos and campus guidelines | Deferred |
| `/onboarding` | `AuthLayout` | Multi-step student course enrollment and profile wizard | Stage 04 |
| `/onboarding/social` | `AuthLayout` | Social interest taxonomy selection onboarding flow | Stage 04 |
| `/auth/iitk` | External/Auth | Direct redirect handler for future campus identity provider | Pending Identity Provider (DEC-05) |
| `/auth/logout` | External/Auth | Authoritative session invalidation endpoint | Stage 04 |

---

## 4. Guard & Boundary Architecture

### 4.1 Client Navigation Guards
- **`RequireAuth`**:
  - Captures and preserves `location.pathname + location.search + location.hash`.
  - Redirects unauthenticated visitors to `/login?from=<encoded-destination>`.
  - Client-side navigation assistance only; server API endpoints authoritatively enforce authorization headers.
- **`RequireRole`**:
  - Compares authenticated session role against required role (`ROLE_STUDENT` or `ROLE_ADMIN`).
  - Redirects unauthorized roles to `/forbidden` (403).
- **`RequireSocialConsent`**:
  - Provisional client guard protecting `/app/social/*`.
  - If social consent is not granted, presents an inline activation prompt with a direct button to `/app/settings`.
  - Settings (`/app/settings`) is unconditionally accessible regardless of consent state.

### 4.2 Return-Path Security (`validateReturnPath`)
- Evaluates destination against the current application origin using `new URL()`.
- Rejects external origins, protocol-relative prefixes (`//`, `/\`), backslashes, and control characters.
- Rejects auth paths (`/login`, `/auth/*`, `/forbidden`) to prevent redirect loops.
- Enforces role compatibility: falls back to the active role's dashboard (`/app/dashboard` or `/admin/dashboard`) if the path is invalid or incompatible.
- Emits only parsed `pathname + search + hash` without repeated decoding.
