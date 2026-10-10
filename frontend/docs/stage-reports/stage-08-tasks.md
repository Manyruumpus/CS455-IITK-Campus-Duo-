# Stage 08 Tasks — Complete Study-Table Booking Workflow

Status: COMPLETE — READY FOR REVIEW
Direct Execution Authorized: Yes

## 1. Booking authorization and service contract
- [x] Remove the Stage 07 legacy demo-pair booking exception.
- [x] Resolve booking companion eligibility from canonical reciprocal STUDY Likes.
- [x] Validate resource, table, slot, date, capacity, and participant inputs at mutation time.
- [x] Preserve participant/admin authorization, idempotency, conflict, cancellation, reschedule, and uncertainty semantics.

## 2. Resource, availability, and booking UI
- [x] Connect location browsing and date/slot selection to service-backed reads.
- [x] Add canonical review/confirmation details and Asia/Kolkata display.
- [x] Add service-backed reschedule and cancellation controls from booking detail.
- [x] Add useful history status/date filtering without fabricating lifecycle transitions.

## 3. Query/session consistency
- [x] Refresh observable availability, detail, history, and participant caches after mutations.
- [x] Preserve actor-scoped keys and suppress stale identity callbacks.
- [x] Keep production adapters explicitly unavailable.

## 4. Verification and reporting
- [x] Add Stage 08 service/query/UI regression coverage.
- [x] Run typecheck, lint, full tests, and build.
- [x] Update API capabilities, decision register, route inventory, and frontend coverage.
- [x] Create the mandatory ten-section Stage 08 report.
