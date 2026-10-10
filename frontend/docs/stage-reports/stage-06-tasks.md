# Stage 06 — Implementation / Task Artifact

**Stage**: 06 — Social Discovery, Preferences and Independent Consent
**Status**: Complete — READY FOR REVIEW (see `stage-06-report.md`)

## Objectives
Replace social discovery/detail display fixtures with typed services, stateful mock
actions and actor-isolated query hooks, and wire consent-disabled guidance, filters,
Like/Pass/Hide, mutual-connection indicators and dashboard summary.

## Baseline (accepted)
- Stage 05 Revision 2 accepted as mock study-discovery checkpoint.
- Preserve study scoring, onboarding, profile/privacy, booking mocks, session
  isolation and production-unavailable behaviour.

## Task Breakdown
1. [x] Inspect workspace; read stage-05 report, contracts, store, hooks, pages, docs.
2. [x] Fix existing type errors in social pages (`onOptionChange` -> `onOptionSelect`,
      unused imports).
3. [x] Wire persisted actor-scoped blocking into mock store + moderation service.
4. [x] Enforce blocking/ineligibility in social mock service (list/detail/mutation).
5. [x] Add `src/tests/stage06.test.tsx` covering all Stage 06 regression scenarios.
6. [x] Verify: typecheck, lint, tests, build (0 errors; 136 tests passing).
7. [x] Update docs (api-capabilities, frontend-coverage, decision-register, route-inventory).
8. [x] Write `docs/stage-reports/stage-06-report.md` (mandatory 10-section format).

## Constraints
- No dating-specific fields, age-eligibility claims, sensitive preference collection,
  chat or contact disclosure.
- Study/social action stores remain mode-isolated.
- Numeric social score not required; grounded reasons only; deterministic ordering.
- No claim that cancellation reverses committed mutations; production falls back to
  Unavailable adapter, never mocks.
- Do not begin Stage 07; do not commit/push/deploy.

## Stop condition
Stop after Stage 06 verification and report. End with READY FOR REVIEW or BLOCKED.