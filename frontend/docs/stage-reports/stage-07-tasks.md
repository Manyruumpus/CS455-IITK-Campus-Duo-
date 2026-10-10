# Stage 07 Tasks — Connections and Conditional Messaging

Status: COMPLETE — READY FOR REVIEW
Direct Execution Authorized: Yes

## 1. Services & Contracts
- [x] Extend `IConnectionService` and unavailable adapter with summary, detail, counts, and reset methods.
- [x] Derive connection status from mode-specific Like stores with stable mode-specific IDs.
- [x] Enforce participant authorization and public/private projection boundaries.
- [x] Implement coordinated deterministic demo reset across store, action maps, queries, and scenarios.

## 2. UI & Queries
- [x] Connect both request/connection pages to actor-scoped TanStack Query hooks.
- [x] Add labelled mode-specific tabs, counts, loading/empty/error/forbidden/not-found states, and authorized detail panels.
- [x] Refresh connection, discovery, dashboard, and booking-related query keys after reciprocal Like.
- [x] Keep booking navigation limited to mutual STUDY rows; SOCIAL rows never enable booking.

## 3. Messaging (Conditional Placeholder)
- [x] Keep messaging disabled by default with no navigation or route unless explicitly flagged.
- [x] Document messaging as deferred; no handles or delivery claims were introduced.

## 4. Quality & Verification
- [x] Run typecheck, lint, full regression tests, and production build.
- [x] Create the mandatory Stage 07 report and update capability, decision, coverage, and route inventory docs.

## 5. Completion
- [x] Verification complete
- [x] Final report delivered
- [x] Status: READY FOR REVIEW
