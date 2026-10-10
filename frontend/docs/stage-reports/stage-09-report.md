# Stage 09 Report — Notifications, Blocking and Reporting

**Stage**: 09  
**Status**: READY FOR REVIEW  
**Execution Date**: 2026-10-10  
**Repository**: IITK Campus Duo Frontend (`frontend/`)

## 1. Executive Summary

The notification center, unread navigation state, read-state controls, typed internal destinations, report submission, report receipts, and supported social blocking workflows are connected to the existing in-memory mock services. Notification records remain actor-owned and permission checked. Real email, push, realtime, database, and production backend delivery remain unavailable.

## 2. Carry-Forward Booking Evidence

The accepted Stage 08 architecture was preserved. Existing focused coverage continues to exercise explicit conflict alternatives, failed reschedule preservation, participant detail/history authorization and refresh behavior, and late mutation/session isolation. Stage 09 adds booking-event notification assertions without changing booking eligibility, capacity, cancellation, rescheduling, or uncertainty rules.

## 3. Notification Contract and Event Generation

`INotificationService` now supports filtered lists, unread counts, mark-read, mark-unread, and mark-all-read operations. Records have stable IDs, recipient ownership, event type, optional STUDY/SOCIAL/booking/moderation context, timestamps from the injected demo clock, permission-safe summaries, and typed internal destinations rather than raw URLs. Committed mutual connections, booking creation/reschedule/cancellation, and report receipt creation emit deduplicated notifications. Failed operations emit no success event; uncertain committed bookings retain the existing exact-operation reconciliation requirement.

## 4. Notification UI and Authorization

`NotificationsPage` is service-backed with All/unread/type filters, loading, empty, error, restricted-destination, read/unread, and mark-all states. `StudentLayout` derives its badge from the actor-scoped unread query instead of a fixture count. Notification mutations reject non-recipient actors. Booking and connection destinations use approved internal routes and remain subject to normal detail authorization; no private contact, schedule, reporter identity, or hidden profile data is included.

## 5. Reporting Workflow

`ReportDialog` is reusable and accessible through the existing focus-managed dialog primitive. It validates supported categories, requires a bounded description, prevents duplicate submission, exposes pending/error/success status, and clearly states that a report creates a pending receipt rather than an automatic penalty. Students can inspect only their own report receipt/status in Settings. Admin moderation decisions and confidential notes remain Stage 10 scope; reporter identity is not exposed to the reported user.

## 6. Blocking and Privacy Boundaries

Block actions are connected on social detail and the blocked-account self-service section remains available in Settings. Current demo scope is symmetric exclusion from supported social discovery, detail, and action operations using actor-scoped in-memory state. Existing connections, bookings, and messages are not deleted, cancelled, or modified. Unblock, opt-out persistence, disconnect/withdrawal, and broader app-wide blocking effects remain unresolved and are not promised by the UI.

## 7. Reset and Session Safety

The coordinated demo reset continues to clear notifications, reports, blocking state, Likes, bookings, scenario controls, and related mock state to the deterministic baseline. Notification and moderation queries use actor-scoped keys and pass `AbortSignal` for reads. Production adapters expose explicit `SERVICE_UNAVAILABLE` failures for all new notification/report operations. Logout or identity changes do not reverse committed mutations.

## 8. Documentation and Policy Register

Updated `docs/api-capabilities.md`, `docs/decision-register.md`, `docs/frontend-coverage.md`, and `docs/route-inventory.md`. Added `docs/stage-reports/stage-09-tasks.md`. New decisions record mock in-app event boundaries, typed safe destinations, report receipts, and limited social-only blocking. Messaging remains feature-flagged off with no enabled navigation or delivery claim.

## 9. Automated Verification and Build Evidence

| Command | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with 0 errors and 0 warnings |
| `npm test -- --run` | Passed: 16 files, 171 tests |
| `npm run build` | Passed; generated JS bundle 611.48 kB, gzip 158.07 kB; existing Vite >500 kB chunk warning recorded |

Focused Stage 09 coverage is in `src/tests/stage09.test.ts` with 9 tests covering recipient authorization, event deduplication, both-participant booking notifications, failed-operation silence, read-state/count convergence, report privacy/no automatic penalty, symmetric blocking, reset, and unavailable production adapters. Browser layout evidence was not substituted with DOM tests.

## 10. Browser Checks, Remaining Defects, and Stop Condition

Desktop/mobile inspection of the notification center, unread badge, report dialog, social safety controls, and blocked-account settings was **Not run** because browser tools were unavailable. Manual checks remain: open `/app/notifications`, `/app/social/:studentId`, and `/app/settings` at desktop/mobile widths; verify keyboard dialog focus, filter tabs, read/unread count convergence, restricted destinations, report validation, block copy, and reset behavior.

Remaining defects and policy decisions are explicitly deferred: real backend/database integration, email/push/realtime delivery, admin moderation decisions, unblock effects, wider blocking consequences, opt-out/relationship persistence, and the existing bundle-size warning. No commit, push, deploy, or Stage 10 work was performed.

**READY FOR REVIEW**
