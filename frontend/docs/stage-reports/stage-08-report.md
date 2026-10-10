# Stage 08 Report — Complete Study-Table Booking Workflow

**Stage**: 08
**Status**: READY FOR REVIEW
**Execution Date**: 2026-10-10
**Repository**: IITK Campus Duo Frontend (`frontend/`)

## 1. Executive Summary

The study-table booking vertical slice is now service-backed end to end in the mock environment: locations, campus-date availability, fixed-slot selection, authorized mutual-STUDY companion selection, review/confirmation, detail, participant history, rescheduling, cancellation, conflict handling, and uncertain creation reconciliation.

## 2. Legacy Eligibility Exception Removed

The Stage 07 hardcoded legacy demo-pair booking bypass was removed. Connection views and booking creation now use reciprocal STUDY Likes as the canonical eligibility source. Reciprocal STUDY Likes are seeded for the valid Alex/Samira demo pair; no duplicate relationship source was introduced. A pair without reciprocal STUDY Likes, including a SOCIAL-only pair, is rejected consistently by direct service calls and the UI's eligible companion list.

## 3. Resource and Availability Workflow

`IBookingService.listLocations` and `listTableAvailability` provide service-backed resource reads. The grid supports a campus-local date selector, fixed slots, table IDs, available/occupied/unavailable states, loading/error states, and authoritative mutation-time validation. Invalid locations, malformed dates, inactive/tampered slots, and mismatched table/slot inputs are rejected. Displayed booking times are explicitly Asia/Kolkata campus-local values.

## 4. Creation and Review

The reservation screen carries the selected table/date/slot into a review card, displays the participants and stable client operation ID, labels the `AUTO_APPROVED_DEMO` partner policy, and keeps the simulated nature of the workflow visible. Eligible companions are loaded from mutual STUDY connection summaries; duplicate submission is disabled while pending and uncertain attempts cannot be blindly resubmitted.

## 5. Conflict and Rescheduling

Creation checks occupancy at mutation time and returns a conflict rather than false success. The service-backed reschedule panel shows the current booking beside an explicitly selected replacement date/slot. Replacement validation and occupancy checks happen before mutation; a conflict leaves the original booking unchanged. Successful mutation refreshes detail, availability, and participant histories through actor-scoped query invalidation.

## 6. Cancellation and History

Booking detail and history enforce participant/admin read authorization and actor-specific allowed actions. Creator/admin cancellation is confirmation-gated and repeated cancellation converges to `CANCELLED`; cancelled slots become available again. History supports status and campus-date filters. No completed-session transition, physical check-in, valid QR credential, recurring booking, waitlist, payment, or multi-companion behavior was added.

## 7. Uncertain Outcomes and Session Safety

Creation retains `clientOperationId` and reconciles by actor plus operation ID. A committed-but-uncertain response renders an unresolved state; a null reconciliation result remains unresolved and is not described as safe to retry. Reschedule/cancel uncertain-response simulation is unsupported and remains documented as such. Existing actor-scoped keys, AbortSignal reads, identity-switch cache clearing, and stale mutation callback guards remain active. Logout does not reverse committed mutations.

## 8. Documentation and Policy Boundaries

Updated `docs/api-capabilities.md`, `docs/decision-register.md`, `docs/frontend-coverage.md`, and `docs/route-inventory.md`. `AUTO_APPROVED_DEMO` partner approval and creator/admin mutation permissions remain demo policies. Seven-day windows, two-hour limits, cancellation cutoffs, same-pair overlap, block/disconnect effects on existing bookings, and database concurrency remain unresolved. Real backend/database integration remains unavailable through the default production adapter.

## 9. Automated Verification and Build Evidence

| Command | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with 0 errors and 0 warnings |
| `npm test -- --run` | Passed: 15 files, 162 tests |
| `npm run build` | Passed; generated JS bundle 599.57 kB, gzip 155.08 kB; Vite emitted the existing >500 kB chunk warning |

Focused Stage 08 coverage is in `src/tests/stage08.test.ts` and covers legacy bypass removal, reciprocal eligibility, SOCIAL-only rejection, tampered resource/slot rejection, conflict-preserving reschedule, cancellation idempotency, and released occupancy. Existing Stage 06/07 fixtures were updated to isolate clean relationship-transition tests from the newly seeded valid study pair.

## 10. Browser Checks, Remaining Defects, and Stop Condition

Desktop/mobile browser inspection of availability, review, detail, reschedule, cancellation, and conflict states was **Not run** because browser tools were unavailable. Manual checks remain: open `/app/booking`, `/app/booking/table-grid`, `/app/booking/new`, `/app/booking/:bookingId`, and `/app/booking/history` at desktop/mobile widths; verify date/slot selection, participant display, confirmation dialog, conflict alternatives, reschedule preservation, cancellation release, and history filters. DOM tests are not layout evidence.

Remaining defects/policy gaps are limited to the explicitly deferred policies above and the existing bundle-size warning. No commit, push, deploy, or Stage 09 work was performed.

**READY FOR REVIEW**
