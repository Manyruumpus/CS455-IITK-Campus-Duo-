# Campus Duo Capability Contracts — Stage 11A

This package is a frontend-derived contract aid. It describes the existing mock behavior and proposed production mapping; it is not an approved OpenAPI specification and does not authorize fabricated URLs.

## Contract source

The authoritative frontend types are in `src/types/index.ts` and service interfaces are in `src/services/interfaces.ts`. The unavailable adapter intentionally throws `SERVICE_UNAVAILABLE` for production-unimplemented methods.

## Capability matrix

| Capability | Mock behavior | Proposed backend response | UI states | Evidence |
|---|---|---|---|---|
| Auth/session | Demo identities; production unavailable | Provider-neutral session object | loading, signed-out, forbidden, unavailable | `stage04.test.tsx`, `routing.test.tsx`, `services.test.ts` |
| Onboarding/profile/consent | In-memory private profile and independent consent | Allowlisted profile/consent resources | loading, validation, saved, error | `stage04.test.tsx` |
| Study discovery/agent | Consent-gated deterministic recommendations and bounded agent fallback | Filtered recommendations and agent job/status | loading, empty, fallback, failed, action pending/success/error | `stage05.test.tsx` |
| Social discovery | Consent-gated grounded reasons and mode-isolated actions | Public social projection and policy-authorized actions | consent gate, loading, empty, unavailable, action states | `stage06.test.tsx` |
| Connections | Like-derived STUDY/SOCIAL summaries and participant detail | Like-derived relationship read model | outgoing/incoming/mutual, forbidden/not-found, reciprocal pending/error/success | `stage07.test.tsx` |
| Booking | Fixed two-person slots, conflicts, cancellation, uncertain reconciliation | Authoritative reservation/availability resources | loading, empty, conflict, uncertain, reconciliation, history | `stage08.test.ts`, `services.test.ts`, `queries.test.tsx` |
| Notifications | Recipient-owned deterministic in-memory events/read state | Cursor list plus typed internal destinations | unread badge, loading, empty, read mutation pending/error | `stage09.test.ts` |
| Reports/blocking | Bounded reports; social-only block scope | Moderation receipt and policy-scoped block resources | validation, pending, success, failure, privacy-safe receipt | `stage09.test.ts` |
| Admin resources/moderation/bookings | Admin-only service methods, protected resources, redacted audits | Server-authorized admin resources/actions | forbidden, validation, conflict, confirmation, audit refresh | `stage10.test.ts` |
| Messaging | Contract exists but route/navigation disabled by default | Only after explicit approval and membership policy | disabled by default | route exclusion tests |

## Error mapping

| Service error | Frontend meaning | UI treatment |
|---|---|---|
| `UNAUTHENTICATED` | Session missing/expired | redirect or signed-out state |
| `FORBIDDEN` | Actor lacks permission/ownership | forbidden/restricted state; do not retry |
| `NOT_FOUND` | Resource/destination absent or privacy-safe hidden | not-found/restricted state |
| `CONFLICT` | Current state prevents operation | preserve displayed data and explain remediation |
| `VALIDATION_ERROR` | Invalid input | field/form error |
| `SERVICE_UNAVAILABLE` | Production adapter/backend unavailable | explicit unavailable state; retry only when appropriate |
| `AGENT_FAILED` | Agent request failed | failed state and safe fallback if supplied |
| `UNCERTAIN_MUTATION` | Commit status unknown | pending/reconcile UI; no false success |
| `UNSUPPORTED_ACTION` | Policy or capability disabled | disabled/unavailable explanation |
| `CANCELLED` | Request intentionally aborted | suppress stale result/toast |

## Synthetic fixtures

Valid and error examples are in `docs/contracts/fixtures.json`. They are fictional, non-secret, and not production credentials.

## Adapter mapping

The eventual production adapter should translate approved transport responses into the existing domain types and `AppError` model. Components and query hooks must remain unchanged unless a reviewed contract version requires a type migration. No frontend code should call a backend URL directly.
