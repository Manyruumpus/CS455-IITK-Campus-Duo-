# Campus Duo — Route Inventory & Navigation Architecture

**Document Version**: 2.1.0-stage02-repaired  
**Status**: Stage 02 Application Shell & Route Inventory Reconciled

---

## 1. Route Summary & Pattern Inventory

The application router (`src/app/routes.tsx`) registers **31 route patterns**, corresponding to **29 navigable pages** and **2 index redirects**.

| Route Classification | Count | Patterns |
| :--- | :---: | :--- |
| **Marketing / Public (`MarketingLayout`)** | 2 | `/` (LandingPage), `/preview/design-system` (Dev-only) |
| **Authentication (`AuthLayout`)** | 3 | `/login`, `/auth/callback`, `/auth/recovery` |
| **Student Application (`StudentLayout`)** | 17 | Index redirect (`/app` → `/app/dashboard`) + 16 pages (`dashboard`, `study`, `study/:studentId`, `study/requests`, `social`, `social/:studentId`, `social/connections`, `booking`, `booking/table-grid`, `booking/new`, `booking/:bookingId`, `booking/history`, `conversations`, `notifications`, `profile`, `settings`) |
| **Admin Console (`AdminLayout`)** | 7 | Index redirect (`/admin` → `/admin/dashboard`) + 6 pages (`dashboard`, `users`, `reports`, `tables`, `bookings`, `audit-logs`) |
| **Error & Fallback (`ErrorLayout`)** | 2 | `/forbidden`, `*` (404) |
| **Total Registered Patterns** | **31** | **29 navigable pages + 2 index redirects** |

---

## 2. Granular Route Status Breakdown

Status Layers:
- **Registered**: Route path configured in `routes.tsx`.
- **Shell Rendered**: Layout and page component mounted with Outlet and UI primitives.
- **Fixture Displayed**: Static or mock fixture data displayed for visual inspection.
- **Service Connected**: Real API adapter or TanStack Query mutation attached (Stage 03).
- **Requirement Verified**: Formal end-to-end domain verification against backend.

| Route ID | Path | Layout Shell | Required Role / Guard | Registered | Shell Rendered | Fixture Displayed | Service Connected | Requirement Verified |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **RT-MKT-01** | `/` | `MarketingLayout` | Public | Yes | Yes | Yes | N/A | Shell Verified |
| **RT-PRV-01** | `/preview/design-system` | `MarketingLayout` | Public (Dev-only: `import.meta.env.DEV`) | Yes | Yes | Yes | N/A | Shell Verified |
| **RT-AUTH-01** | `/login` | `AuthLayout` | Public (Guest / Demo Switcher) | Yes | Yes | Yes | No | Shell Verified |
| **RT-AUTH-02** | `/auth/callback` | `AuthLayout` | Public | Yes | Yes | Yes | No | Shell Verified |
| **RT-AUTH-03** | `/auth/recovery` | `AuthLayout` | Public | Yes | Yes | Yes | No | Shell Verified |
| **RT-APP-00** | `/app` | `StudentLayout` | `ROLE_STUDENT` (Index Redirect) | Yes | Redirect | N/A | N/A | Verified |
| **RT-APP-01** | `/app/dashboard` | `StudentLayout` | `ROLE_STUDENT` | Yes | Yes | Yes | No | Shell Verified |
| **RT-STUDY-01** | `/app/study` | `StudentLayout` | `ROLE_STUDENT` | Yes | Yes | Yes | No | Shell Verified |
| **RT-STUDY-02** | `/app/study/:studentId` | `StudentLayout` | `ROLE_STUDENT` | Yes | Yes | Yes | No | Shell Verified |
| **RT-STUDY-03** | `/app/study/requests` | `StudentLayout` | `ROLE_STUDENT` | Yes | Yes | Yes | No | Shell Verified |
| **RT-SOC-01** | `/app/social` | `StudentLayout` | `ROLE_STUDENT` + `SocialConsent` | Yes | Yes | Yes | No | Shell Verified |
| **RT-SOC-02** | `/app/social/:studentId` | `StudentLayout` | `ROLE_STUDENT` + `SocialConsent` | Yes | Yes | Yes | No | Shell Verified |
| **RT-SOC-03** | `/app/social/connections` | `StudentLayout` | `ROLE_STUDENT` + `SocialConsent` | Yes | Yes | Yes | No | Shell Verified |
| **RT-BOOK-01** | `/app/booking` | `StudentLayout` | `ROLE_STUDENT` | Yes | Yes | Yes | No | Shell Verified |
| **RT-BOOK-02** | `/app/booking/table-grid` | `StudentLayout` | `ROLE_STUDENT` | Yes | Yes | Yes | No | Shell Verified |
| **RT-BOOK-03** | `/app/booking/new` | `StudentLayout` | `ROLE_STUDENT` | Yes | Yes | Yes | No | Shell Verified |
| **RT-BOOK-04** | `/app/booking/:bookingId`| `StudentLayout` | `ROLE_STUDENT` | Yes | Yes | Yes | No | Shell Verified |
| **RT-BOOK-05** | `/app/booking/history` | `StudentLayout` | `ROLE_STUDENT` | Yes | Yes | Yes | No | Shell Verified |
| **RT-CHAT-01** | `/app/conversations` | `StudentLayout` | `ROLE_STUDENT` (Direct link only; excluded from primary nav) | Yes | Yes | Yes | No | Shell Verified |
| **RT-NOTIF-01** | `/app/notifications`| `StudentLayout` | `ROLE_STUDENT` | Yes | Yes | Yes | No | Shell Verified |
| **RT-PROF-01** | `/app/profile` | `StudentLayout` | `ROLE_STUDENT` | Yes | Yes | Yes | No | Shell Verified |
| **RT-SETT-01** | `/app/settings` | `StudentLayout` | `ROLE_STUDENT` | Yes | Yes | Yes | No | Shell Verified |
| **RT-ADM-00** | `/admin` | `AdminLayout` | `ROLE_ADMIN` (Index Redirect) | Yes | Redirect | N/A | N/A | Verified |
| **RT-ADM-01** | `/admin/dashboard` | `AdminLayout` | `ROLE_ADMIN` | Yes | Yes | Yes | No | Shell Verified |
| **RT-ADM-02** | `/admin/users` | `AdminLayout` | `ROLE_ADMIN` | Yes | Yes | Yes | No | Shell Verified |
| **RT-ADM-03** | `/admin/reports` | `AdminLayout` | `ROLE_ADMIN` | Yes | Yes | Yes | No | Shell Verified |
| **RT-ADM-04** | `/admin/tables` | `AdminLayout` | `ROLE_ADMIN` | Yes | Yes | Yes | No | Shell Verified |
| **RT-ADM-05** | `/admin/bookings` | `AdminLayout` | `ROLE_ADMIN` | Yes | Yes | Yes | No | Shell Verified |
| **RT-ADM-06** | `/admin/audit-logs` | `AdminLayout` | `ROLE_ADMIN` | Yes | Yes | Yes | No | Shell Verified |
| **RT-ERR-403** | `/forbidden` | `ErrorLayout` | Public | Yes | Yes | Yes | N/A | Shell Verified |
| **RT-ERR-404** | `*` | `ErrorLayout` | Public | Yes | Yes | Yes | N/A | Shell Verified |

---

## 3. Planned But Unregistered Routes

The following routes are documented in planning specifications but are **NOT registered in `routes.tsx`** for Stage 02:

| Planned Route | Target Shell | Description | Stage Target |
| :--- | :--- | :--- | :---: |
| `/about` | `MarketingLayout` | Platform overview and Kyoto ethos page | Deferred |
| `/onboarding` | `AuthLayout` | Student academic profile onboarding wizard | Stage 04 |
| `/onboarding/social` | `AuthLayout` | Social track opt-in & interest selection wizard | Stage 04 |

---

## 4. Guard & Navigation Architecture

### 4.1 Client Navigation Guards
- **`RequireAuth`**: Inspects client authentication state. If unauthenticated, redirects to `/login?from=<pathname>`.
- **`RequireRole`**: Enforces client role boundaries (`ROLE_STUDENT` vs `ROLE_ADMIN`). Unauthorized roles redirect to `/forbidden` (403).
- **`RequireSocialConsent`**: Guards `/app/social/*`. Displays an inline consent opt-in interface if the student has not granted consent. Settings (`/app/settings`) remains always accessible.
- **Notice**: Client guards are strictly UX aids; backend endpoints will authoritatively enforce JWT claims and database permissions on every API request.

### 4.2 Universal Six-State Standard
Every route shell incorporates structured representations for:
1. **Loading State**: Content skeleton loader with `aria-busy="true"`.
2. **Empty State**: Contextual message, icon, and call-to-action button.
3. **Error State**: Non-destructive boundary recovery with retry action.
4. **Validation State**: Real-time inline field validation using Zod schemas.
5. **Expired Session State**: Non-blocking toast or recovery prompt preserving user inputs.
6. **Forbidden State (403)**: Clear explanation of role deficit with safe return pathway.
