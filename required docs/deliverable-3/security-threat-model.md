# Security and Threat Model

## Assets and boundaries

Assets are user identity/profile data, consent and relationship state, booking/occupancy state, audit records, migration history, credentials, and fixture ownership. Trust boundaries are browser → frontend adapter, frontend → backend API, test-auth header → database identity lookup, backend role → PostgreSQL schema, migrator/admin tools → disposable databases, and k6/performance process → loopback app.

## Threats and controls

| Threat | Control and evidence | Residual risk |
|---|---|---|
| Actor impersonation | UUID format, database lookup, active/verified student checks; backend auth tests | Development-only test header is not production authentication |
| Unauthorized profile/relationship access | Actor-scoped service checks, consent/blocking tests, public projections | Frontend mock policy is not production authorization |
| Booking double allocation | Transactional conflict constraint and 10-request PostgreSQL race evidence | Single local database only |
| Replay/idempotency abuse | Client operation ID scoped to actor and reconciliation tests | External queue/retry infrastructure not deployed |
| SQL/input abuse | Parameterized repository queries and validation/error tests | No external penetration test |
| Error/data leakage | Central error handler and redacted audit/error tests | Production observability policy remains to be configured |
| Migration privilege escalation | `campus_duo_migrator` owns schema; `campus_duo_app` receives explicit V008 grants | Verification is local-only; hosted provisioning is not claimed |
| Fixture contamination | Exact database allowlists, manifests, ownership checks and cleanup guards | Final credentialed backend rerun remains pending |
| Unsafe harness exposure | Loopback-only launcher, development auth flag and k6 credential sanitization | Must be rechecked during actual smoke run |
| Prompt injection/tool abuse | Not applicable: no implemented agent tool/action surface | Agent recommendation boundaries remain documented |

The high-severity development-auth exposure found during review is now
guarded in `backend/src/server.ts`: `HOST` defaults to `127.0.0.1`, and
startup fails when `ALLOW_TEST_HARNESS_AUTH=true` is combined with a
non-loopback host. The performance launcher already binds explicitly to
`127.0.0.1`. CORS remains broad for the local prototype, but the
development identity-selector cannot be exposed by an accidental public
bind; production authentication is still not implemented.

Dependency evidence is retained under `evidence/dependency-audit/`, including before/after backend production audit artifacts for KAN-70. No dependency installation or upgrade was performed in this session.
