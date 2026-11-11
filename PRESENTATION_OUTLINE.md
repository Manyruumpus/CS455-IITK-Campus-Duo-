# Campus Duo Presentation Outline

## Slide 1 — Product and responsibilities

- Campus Duo: consent-aware study-partner discovery and table-slot booking.
- Team members and individual responsibilities: **human input required**.
- Demo environment: local PostgreSQL, Express backend, React frontend.

## Slide 2 — Problem, objectives, and roles

- Students need compatible study partners and reliable shared-space booking.
- Students control independent study/social discovery consent.
- Administrators manage inventory and moderation.
- Core flow: authenticated student → mutual connection → table-slot booking.

## Slide 3 — Requirements and evolution

- Started from mock/demo service boundaries and incomplete runtime contracts.
- Added real session restoration/logout, live discovery, consent persistence,
  blocking/reporting, admin review, runtime grants, and transactional booking
  integration.
- Optional social/messaging capabilities remain explicitly secondary where not
  required by the accepted core scope.

## Slide 4 — Architecture and interaction patterns

- React pages and React Query call service interfaces.
- Environment-selected HTTP adapters call Express routes.
- Services/repositories use PostgreSQL migrations, constraints, transactions,
  idempotency, and audit/outbox records.
- Table-slot reservation is for a pair, not individual seat allocation.

## Slide 5 — Decisions, GitHub/Jira, and traceability

- Preserve the modular architecture and isolate demo role switching from real
  authentication.
- Use additive migrations and least-privilege runtime grants.
- Show genuine repository history and existing Jira/GitHub artifacts.
- Jira status and team contribution mapping require human confirmation.

## Slide 6 — Agent boundaries and safeguards

- Fixed backend orchestration queries eligible candidates and computes
  deterministic scores.
- Optional configured provider supplies bounded explanations only.
- Schema validation, grounded facts, candidate identity checks, timeout, and
  deterministic fallback protect the workflow.
- The agent cannot book, mutate profiles, bypass consent, or change access.

## Slide 7 — Evidence, security, deployment, and lessons

- Verified locally: builds, typecheck, health, authentication, consent,
  discovery, connection, booking conflict/cancel, moderation, admin review,
  audit retrieval, logout invalidation, inventory disable/re-enable, and a
  focused concurrent booking rehearsal (one success, one conflict, one
  confirmed allocation).
- Browser automation was unavailable in the local environment, so UI clicks
  require human rehearsal. Configured model-backed inference was not confirmed;
  deterministic fallback is the verified AI path.
- Automated tests, coverage, load testing, benchmarking, and formal reports
  are deferred for this implementation pass.
- Migration sequence is Flyway V001–V013; runtime uses `campus_duo_app`.
- Lessons: database privileges and API/UI contract accuracy are essential to
  truthful demo readiness.
