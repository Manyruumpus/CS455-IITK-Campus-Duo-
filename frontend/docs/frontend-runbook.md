# Campus Duo Frontend Runbook — Stage 11A

## Install and run

From `frontend/`:

```powershell
npm install
npm run dev
```

Verification commands:

```powershell
npm run typecheck
npm run lint
npm test -- --run
npm run build
```

## Runtime modes

- **Default production:** real backend/auth adapters are not implemented; unavailable states are expected. Demo authentication, preview routes, and messaging are not enabled by default.
- **Development demo:** `npm run dev` enables the deterministic mock showcase because Vite development mode enables demo auth controls.
- **Explicit showcase:** set `VITE_DEMO_SHOWCASE=true` for an intentionally labelled demo build. `VITE_ENABLE_PREVIEW=true` may expose the design-system preview.
- **Messaging preview:** set `VITE_ENABLE_MESSAGING=true` only for the bounded, simulated preview. It remains disabled by default and is not a delivery claim.
- **Partner approval scenario:** `VITE_PARTNER_APPROVAL_POLICY=REQUIRES_EXPLICIT_APPROVAL` exercises the unsupported/pending approval path; the default demo is `AUTO_APPROVED_DEMO` and is visibly provisional.

No real credentials, cookies, tokens, or provider configuration belong in this repository.

## Synthetic identities

The mock store contains fictional identities for a student, peers, an incomplete student, and an administrator. Use the visible demo role switcher rather than entering real credentials. Admin screens require the synthetic `ROLE_ADMIN` session and still enforce authorization inside mock services.

## Coordinated reset

Use the reset control in Settings or the demo reset flow. It restores sessions, profiles, consent, Likes/actions, connections, bookings, notifications/read states, reports, blocks, resources, audits, scenario controls, and the injected clock to the deterministic baseline. Logout does not reverse committed mutations.

## Deterministic failure scenarios

The scenario manager supports:

- forced delay for loading/cancellation and identity-switch checks;
- typed forced errors such as `FORBIDDEN`, `CONFLICT`, `SERVICE_UNAVAILABLE`, and `UNCERTAIN_MUTATION`;
- agent fallback;
- uncertain booking mutation followed by operation-ID reconciliation.

These controls are mock-only and are not backend behavior.

## Known limitations and pending checks

- No real backend, persistence, durable audit store, email/push/realtime delivery, physical resource integration, or selected authentication protocol.
- Messaging, withdrawal/disconnect, unblock/wider blocking, account suspension/removal, retention, and some booking policies remain disabled or provisional.
- Browser desktop/mobile inspection is pending. DOM tests do not establish visual layout evidence.
- Fixed slots use campus-local `Asia/Kolkata` dates and `HH:mm` values in the mock; backend timezone/concurrency rules require approval.
