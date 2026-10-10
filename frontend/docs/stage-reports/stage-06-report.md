# Stage 06 Report — Social Discovery, Preferences and Independent Consent

**Stage**: 06  
**Status**: READY FOR REVIEW  
**Execution Date**: 2026-10-10  
**Repository**: IITK Campus Duo Frontend (`frontend/`)

---

## 1. Executive Summary

Stage 06 replaces the social discovery/detail display fixtures with typed services, stateful mock actions, and actor-isolated query hooks. Generic social recommendations, supported filters, public candidate details, social Like/Pass/Hide, independent mutual social connection state, a social dashboard summary, and links to existing social preferences/settings are now connected end-to-end.

Key capabilities delivered:

1. **Mock-service-connected social workflows**: `ISocialService` (listSocialPeers, getSocialPeer, recordSocialAction, resetSocialDiscoveryRound, listSocialConnections plus consent methods) is implemented with a stateful, in-memory `MockSocialService`. Recommendations use **grounded shared-interest reasons** derived only from stored public data, and a **deterministic ordering** (shared-interest count descending, then displayName ascending). There is no numeric social compatibility score and the study formula is not reused.
2. **Eligibility & privacy enforced in the mock service, not only route guards**: valid student session, actor social opt-in, candidate opt-in, self-exclusion, supported blocking/ineligibility rules, and actor-specific Hide and current-round Pass exclusions are enforced at read **and** mutation time. Direct candidate URLs cannot bypass discovery privacy rules. Study consent does not grant social access.
3. **Social Like / Pass / Hide semantics**: `LIKE` is idempotent; a first Like records one-sided `PENDING_SENT`, a reciprocal Like forms one `MUTUAL_CONNECTED` social relationship exclusively under mode `SOCIAL` — it never creates a `STUDY` relationship or grants study-booking eligibility. `PASS` dismisses for a documented social discovery round; `HIDE` persists in the current demo store until full demo reset (not permanent production persistence). Study and social action stores remain mode-isolated.
4. **Actor-isolated query hooks & production safety**: `queryKeys.social.*` embed the actor and filters; reads are enabled only after consent prerequisites; `AbortSignal` passes through cancellable reads; `UnavailableServiceAdapter` covers all new social methods and default production never falls back to mocks. Opt-out invalidates social cache so stale results are not left visible.

All **136 automated tests across 13 test files** passed with zero failures. Static type checking (`tsc --noEmit`), linting (`eslint .`), and production building (`vite build`) completed with 0 errors and 0 lint warnings. The pre-existing >500 kB chunk-size warning is recorded and **not silenced** by raising its threshold.

Per explicit instructions:
- **Real backend integration remains unavailable**; all connected behavior is qualified as mock service-connected.
- **Friendship vs dating categorization, and connection-persistence-after-opt-out policies remain unresolved** and are not invented.
- **Full connection-management workflow is deferred to Stage 07**.
- **Mobile visual and served-production browser inspections remain pending** ("Not run"); manual verification steps are provided.
- Code has **NOT** been committed, pushed, or deployed.
- **Stage 07 has NOT been started.**

---

## 2. Implementation Scope & Delivered Artifacts

### 2.1 Domain Contracts & Types (`src/types/index.ts`, `src/types/social.ts`)
- **`PublicSocialProfile`**: Only explicitly approved public fields — `userId`, `displayName`, `bio`, `interests`. **No email, phone, handles, roll number, masked contact fields, private schedules, or private settings.**
- **`SocialRecommendation`** metadata: `matchScore` (= 0, no computed social score), `sharedInterests`, `groundedReasons?`, `relationshipStatus`. Scores and relationship state are recommendation metadata, never editable profile fields.
- **`SocialActionType`** (`LIKE | PASS | HIDE`), **`SocialActionResult`**, **`SocialDiscoveryFilters`** (`category?: SocialCategory | 'ALL'`, `search?`).
- **`ConnectionMode`** = `'STUDY' | 'SOCIAL'`; modes fully independent.

### 2.2 Service Interfaces & Adapters (`src/services/`)
- **`interfaces.ts`**: `ISocialService` interface (all 7 methods) and `ServiceContext` (`actorSession`, `signal`); `IModerationService` (`reportUser`, `blockUser`, `listBlockedUsers`).
- **`MockStudySocialServices.ts`** (`MockSocialService`):
  - Consent-gated reads/mutations; candidate opt-in, self-exclusion, and `isSociallyBlocked` enforcement (either direction) at read and mutation time.
  - Category/text filters, deterministic ordering, and grounded shared-interest reasons (honest "no explicit shared interests" when none; empty interests never make optional fields mandatory).
  - Idempotent `LIKE` (one-sided `PENDING_SENT` → reciprocal `MUTUAL_CONNECTED` under mode `SOCIAL` only), round-scoped `PASS`, demo-store `HIDE`.
  - `resetSocialDiscoveryRound` (clears pass/like for the round) distinct from full demo-store reset; `listSocialConnections` returns mutual connections.
- **`MockAdminModerationServices.ts`** (`MockModerationService`): persisted `blockUser` / `listBlockedUsers` in `mockStore.blockedBy`, with self-block rejected.
- **`UnavailableServiceAdapter.ts`**: `social` object covers all new methods, throwing typed `SERVICE_UNAVAILABLE`. Default production never falls back to mocks.

### 2.3 Stateful Mock Database (`src/mocks/store.ts`)
- Added `public blockedBy: Map<string, Set<string>>` and `blockedBy.clear()` in `reset()`.
- Social pass/hide/likes remain module-level Maps in `MockStudySocialServices.ts`, cleared by `MockSocialService.resetActions()` (the full demo-store reset boundary), keeping study sets (`mockStore.reset()`) distinct from social action state.

### 2.4 Query Hooks (`src/queries/`)
- **`queryKeys.ts`**: Actor-scoped `queryKeys.social.all / discover / detail / connections`, embedding actor and filters.
- **`socialHooks.ts`**: `useSocialRecommendations`, `useSocialPeerDetail`, `useSocialConnections`, `useRecordSocialAction` (retry: 0, invalidates social keys, toasts).
- **`consentHooks.ts`**: `useUpdateSocialConsent` invalidates `queryKeys.social.all` on opt-out; `useBlockedUsers`.

### 2.5 User Interface Components (`src/features/student/`)
- **`SocialDiscoveryPage.tsx`**: consent-disabled guidance linking to Settings; category/text filters + clear-filters; public profile cards with grounded interest reasons; Like/Pass/Hide with pending/success/error states; mutual-connection indicator; no contact disclosure; no social-only table-booking button; messaging disabled.
- **`SocialDetailPage.tsx`**: service-backed public detail, consent gate, grounded reasons, Like/Pass/Hide, mutual indicator.
- **`SocialConnectionsPage.tsx`**: consent gate and a minimal service-backed mutual-connection summary (no chat/disconnect lifecycle work).
- **`StudentDashboardPage.tsx`**: social summary portion connected; unused imports removed.
- **`RequireSocialConsent` + `routes.tsx`**: `/app/social`, `/app/social/:studentId`, `/app/social/connections` guarded; Settings never blocked.

### 2.6 Task Artifact
- `docs/stage-reports/stage-06-tasks.md` — concise implementation/task artifact with objectives, baseline, task breakdown, constraints, and stop condition.

---

## 3. Mandatory Requirements & Verification Status

| Requirement Area | Specification & Rule | Implementation Mechanism | Verification Result |
| :--- | :--- | :--- | :--- |
| **Social-only discovery without study prefs** | A social-only student can discover without study consent/preferences. | `listSocialPeers` gates only on actor/candidate social consent (not study). `SOCIAL_ONLY_SESSION` discovers fine. | **Verified** (`stage06.test.tsx`) |
| **Study consent ≠ social access** | Study consent does NOT grant social access; consent is independent. | Actor social-consent required for social reads (FORBIDDEN) and mutations (VALIDATION_ERROR). | **Verified** (`stage06.test.tsx`) |
| **Candidate opt-out & direct-detail privacy** | Candidate opt-out excludes list and direct-detail access; direct URLs cannot bypass. | Both `listSocialPeers` and `getSocialPeer` recheck candidate opt-in and blocking; returns `null`/exclusion. | **Verified** (`stage06.test.tsx`) |
| **Public response shape (no private/contact fields)** | Only approved public fields; no email/phone/handle/roll/masked contact. | `PublicSocialProfile` projection is enforced; test asserts absence of private fields. | **Verified** (`stage06.test.tsx`) |
| **Self-actions & ineligible Like rejected** | Self Like / ineligible candidate Like must be rejected. | `recordSocialAction` rejects self-action and non-eligible/blocked candidates with typed error. | **Verified** (`stage06.test.tsx`) |
| **Filters, grounded reasons, empty-interest cases** | Generic category/text filters; honest grounded reasons; no fabricated affinity; empty interests don't force optional fields. | Filter application + grounded reasons + explicit "no explicit shared interests" case. | **Verified** (`stage06.test.tsx`) |
| **Repeated Like → no duplicate connections** | Repeated Like is idempotent; no duplicate `MUTUAL_CONNECTED`. | Connection ID `conn-{actorId}-{targetId}-social` is created once; repeated Like returns existing status. | **Verified** (`stage06.test.tsx`) |
| **Reciprocal SOCIAL Like never grants STUDY eligibility** | Social mutual connection must not create a STUDY relationship/booking eligibility. | Connections always created under `mode: 'SOCIAL'`; study/booking eligibility untouched. | **Verified** (`stage06.test.tsx`) |
| **Study vs social Pass/Hide independence** | Study Pass/Hide must not silently become social Pass/Hide (and vice-versa). | Distinct store sets per mode; tests use independent candidates per mode. | **Verified** (`stage06.test.tsx`) |
| **Round reset vs full-store reset** | Discovery-round reset differs from full demo-store reset. | `resetSocialDiscoveryRound` clears round state; `MockSocialService.resetActions()`/`mockStore.reset()` is full reset. | **Verified** (`stage06.test.tsx`) |
| **Failed mutation → no false success** | No success toast/UI on failure; retry: 0. | Scenario-injected failure asserted not to surface false success; hook `retry: 0`. | **Verified** (`stage06.test.tsx`) |
| **Refresh after actions & opt-out** | Discovery/detail/summary refresh after successful actions; opt-out leaves no stale results. | Cache invalidation on mutation success and on consent opt-out. | **Verified** (`stage06.test.tsx`) |
| **Late effects isolated across sessions** | Old-session responses/toasts/navigation/callbacks suppressed after identity change. | Query client cancellation/clear across identity boundary; actor-scoped keys. | **Verified** (`stage06.test.tsx`) |
| **Production unavailable adapter coverage** | Adapter covers all new social methods. | `UnavailableServiceAdapter.social.*` all throw `SERVICE_UNAVAILABLE`. | **Verified** (`stage06.test.tsx`) |
| **Accessible forms & keyboard interactions** | Accessible controls and keyboard navigation. | Buttons/filter controls have accessible labels; keyboard reachable. | **Verified** (`stage06.test.tsx`) |

---

## 4. Route & UI Integration Status

| Route ID | Path | Component | Status | Service Hook |
| :--- | :--- | :--- | :---: | :--- |
| **RT-APP-01** | `/app/dashboard` | `StudentDashboardPage` | **Connected (Social Summary)** | `useSocialConnections()` / recommendations |
| **RT-SOC-01** | `/app/social` | `SocialDiscoveryPage` | **Connected** | `useSocialRecommendations()`, `useRecordSocialAction()`, `useResetSocialRound()` |
| **RT-SOC-02** | `/app/social/:studentId` | `SocialDetailPage` | **Connected** | `useSocialPeerDetail()`, `useRecordSocialAction()` |
| **RT-SOC-03** | `/app/social/connections` | `SocialConnectionsPage` | **Connected (Minimal Summary)** | `useSocialConnections()` |

All three social routes remain wrapped in `RequireSocialConsent`; Settings (`/app/settings`) is unconditionally accessible.

---

## 5. Quality Gates & Empirical Validation Results

### 5.1 Static Type Checking (`npm run typecheck`)
- Command: `tsc --noEmit`
- Result: **Passed (0 errors)**

### 5.2 Code Quality & Linting (`npm run lint`)
- Command: `eslint .`
- Result: **Passed (0 errors, 0 warnings)**

### 5.3 Automated Unit & Integration Tests (`npm test -- --run`)
- Command: `vitest run --run`
- Test Files: **13 passed (13 total)**
- Tests: **136 passed (136 total, 0 failed, 0 skipped)**
- Duration: 10.51s
- Test Suites Executed:
  - `src/tests/returnPath.test.ts` (9 tests)
  - `src/tests/sanity.test.ts` (1 test)
  - `src/tests/mocks.test.ts` (6 tests)
  - `src/tests/services.test.ts` (20 tests)
  - `src/tests/Input.test.tsx` (4 tests)
  - `src/tests/Button.test.tsx` (4 tests)
  - `src/tests/dialog.test.tsx` (5 tests)
  - `src/tests/queries.test.tsx` (5 tests)
  - `src/tests/navigation.test.tsx` (3 tests)
  - `src/tests/routing.test.tsx` (17 tests)
  - `src/tests/stage04.test.tsx` (20 tests)
  - `src/tests/stage05.test.tsx` (23 tests)
  - `src/tests/stage06.test.tsx` (**19 new tests**)

### 5.4 Production Build Verification (`npm run build`)
- Command: `tsc && vite build`
- Result: **Passed (built in 5.88s; production bundle generated in `dist/`)**
- Bundle Artifacts:
  - `dist/index.html` (1.12 kB)
  - `dist/assets/index-CbHS2J2v.css` (34.10 kB)
  - `dist/assets/index-Cmtq4rbz.js` (563.19 kB | gzip 147.87 kB)
- **Chunk-size warning**: Vite emits the pre-existing `(!) Some chunks are larger than 500 kB` warning for the single JS chunk. This is recorded honestly and **not silenced** by raising `build.chunkSizeWarningLimit`. No unrelated performance rewrite was performed, per instructions.

---

## 6. Social Recommendations & Deterministic Ordering

1. **No numeric social compatibility score** is computed (no reuse of the study formula). `matchScore` is fixed at `0` per the contract.
2. **Grounded reasons** are derived only from stored public shared interests. When there are no shared interests, an explicit honest statement is returned ("no explicit shared interests") rather than fabricated affinity.
3. **Empty interests** never make optional fields mandatory and never fabricate overlap.
4. **Deterministic ordering**: shared-interest count descending, then `displayName` ascending (stable tie-break). No uncontrolled randomness and no AI/ML ranking claims.
5. **Filters**: generic `category` and text `search` are supported. Optional public academic filters may be used only where supported by existing contracts and consent; no required academic preconditions exist for social use.

---

## 7. Social Action Semantics & Independent Consent

1. **LIKE** — first Like records one-sided social interest (`PENDING_SENT`). A reciprocal Like forms one mutual `MUTUAL_CONNECTED` social relationship **exclusively under mode `SOCIAL`**. Repeated Like is idempotent (no duplicate connections) and **never creates a `STUDY` relationship nor grants study-booking eligibility**. No withdrawal/disconnect is implemented (no approved policy).
2. **PASS** — dismisses a candidate for a documented social discovery round (cleared by `resetSocialDiscoveryRound`).
3. **HIDE** — persists within the current demo store until full demo reset. Documented as demo-store persistence, not permanent production persistence.
4. **Mode isolation** — study and social action stores are fully independent; study Pass/Hide never silently become social Pass/Hide.
5. **Eligibility rechecked at mutation time** — valid session, candidate opt-in, self-exclusion, blocking/ineligibility, and actor Hide/round-Pass exclusions are enforced in the mock service for `recordSocialAction`, `listSocialPeers`, and `getSocialPeer`.
6. **Report/Block** reuse existing supported services (`IModerationService`). Any unsupported actions remain disabled with explanation.
7. **Existing connections after opt-out** remain an unresolved policy; no deletion, retention, or access rules are invented.

---

## 8. Open Decisions, Deferred Policies & Unresolved Capabilities

1. **DEC-01 — Friendship vs Dating categorization**: Remains UNRESOLVED/OPEN. No dating-specific fields, age-eligibility promises, sensitive-preference collection, chat, or contact disclosure were introduced.
2. **DEC-09 — Connection persistence on social opt-out**: Remains UNRESOLVED/OPEN. No deletion/retention/access rules invented for existing connections after opt-out.
3. **DEC-19 — Social ranking**: Grounded reasons + deterministic ordering is a PROVISIONAL proposal; a formal social-ranking specification is pending. Unsupported social score fixtures (if any) are removed or labelled demo-only.
4. **DEC-20 — Social action semantics**: Like/Pass/Hide, round-pass, demo-store hide, and blocking are PROVISIONAL proposals pending policy approval.
5. **Stage 07 deferred**: full connection-management workflow (sending/accepting/declining, disconnect lifecycle, chat) is out of scope. The social-connections page shows only a minimal service-backed summary.
6. **Real backend integration**: unavailable; all connected behavior is mock service-connected.
7. **Browser visual inspections**: pending ("Not run"). See Section 10 manual verification steps.

---

## 9. Changed Files Inventory

```
frontend/
├── docs/
│   ├── api-capabilities.md                     # Updated CAP-SOC to full Stage 06 method list, filters, privacy/consent + recommendation/action semantics
│   ├── decision-register.md                    # Added DEC-19, DEC-20; updated header/status
│   ├── frontend-coverage.md                    # REQ-SOC-01/02 → Stage 06 Live; added Stage 06 deliverables section
│   ├── route-inventory.md                      # RT-SOC-01/02/03 + RT-APP-01 → Service Connected: Yes
│   └── stage-reports/
│       ├── stage-06-tasks.md                   # Implementation/task artifact
│       └── stage-06-report.md                  # Mandatory Stage 06 report (this document)
├── src/
│   ├── features/student/
│   │   ├── SocialDiscoveryPage.tsx             # Filter, Like/Pass/Hide, grounded reasons, states, consent guidance
│   │   ├── SocialDetailPage.tsx                # Public detail, actions, mutual indicator
│   │   ├── SocialConnectionsPage.tsx           # Minimal service-backed mutual summary
│   │   └── StudentDashboardPage.tsx            # Social dashboard summary; removed unused import
│   ├── mocks/
│   │   └── store.ts                            # Added blockedBy Map + reset
│   ├── queries/
│   │   ├── socialHooks.ts                      # Recommendations, detail, connections, record action
│   │   └── queryKeys.ts                        # Actor-scoped social keys
│   ├── services/
│   │   ├── interfaces.ts                       # ISocialService, IModerationService
│   │   ├── mock/
│   │   │   ├── MockStudySocialServices.ts      # MockSocialService: consent, filters, ordering, like/pass/hide, blocking
│   │   │   └── MockAdminModerationServices.ts  # Persisted blockUser/listBlockedUsers
│   │   └── unavailable/
│   │       └── UnavailableServiceAdapter.ts    # Covers all new social methods (SERVICE_UNAVAILABLE)
│   ├── tests/
│   │   └── stage06.test.tsx                    # 19 comprehensive comp/unit tests
│   └── types/
│       ├── index.ts                            # PublicSocialProfile, SocialRecommendation, ConnectionMode, etc.
│       └── social.ts                           # SocialActionType, SocialActionResult, SocialDiscoveryFilters
```

---

## 10. Acceptance Checklist, Pending Checks & Manual Verification

### Acceptance Checklist
- [x] Social recommendations replaced fixtures with typed service + stateful mock + actor-isolated hooks.
- [x] Generic category/text filters with clear-filters action.
- [x] Public candidate details with only approved public fields (no email/phone/handle/roll/masked contact).
- [x] Social Like / Pass / Hide service-backed with pending/success/error states.
- [x] Independent mutual social connection state (mode `SOCIAL` only); repeated Like idempotent.
- [x] Social dashboard summary; existing preferences/settings links.
- [x] Consent-disabled guidance linking to Settings.
- [x] Loading, empty, unavailable, forbidden, not-found states.
- [x] Eligibility/privacy enforced in mock services at read and mutation time (session, actor/candidate opt-in, self-exclusion, blocking/ineligibility, Hide/round-Pass).
- [x] Direct candidate URLs cannot bypass privacy rules.
- [x] Study consent does not grant social access; social-only discovery works without study prefs.
- [x] Reciprocal SOCIAL Like never creates STUDY eligibility.
- [x] Study and social Pass/Hide independent; round reset distinct from full-store reset.
- [x] Production `UnavailableServiceAdapter` covers all new methods; production never falls back to mocks.
- [x] Messaging disabled; no social-only table-booking button; no chat/disconnect lifecycle work.
- [x] 19 new automated tests; all 136 tests passing across 13 files.
- [x] TypeScript compiles cleanly (`npm run typecheck`: 0 errors).
- [x] Linting passes cleanly (`npm run lint`: 0 errors, 0 warnings).
- [x] Production build succeeds (`npm run build`); chunk-size warning recorded, not silenced.
- [x] Documentation updated: `api-capabilities.md`, `frontend-coverage.md`, `decision-register.md`, `route-inventory.md`.
- [x] Task artifact created: `docs/stage-reports/stage-06-tasks.md`.
- [x] Stage 06 Report created with all mandatory 10 sections.
- [ ] **Stage 07 NOT started; no git commits or pushes executed.**

### Browser Inspections — Status: **Not run**
DOM tests are recorded and are not visual-layout evidence. Automatic social list/detail and consent-disabled visual captures on desktop and mobile were not executed in this environment.

### Manual Verification Steps
1. Run the demo (`VITE_DEMO_SHOWCASE=true`) and sign in as a student.
2. `/app/settings` → enable **Social Discovery** (independent of Study). Confirm study discovery remains independently toggleable.
3. Visit `/app/social` while social consent is OFF → confirm the consent-disabled guidance card links to Settings. Enable consent and return — the feed loads.
4. `/app/social` (desktop + mobile): confirm filter controls + clear-filters, public profile cards, grounded "shared interests" reasons, and the honest "no explicit shared interests" case, Like/Pass/Hide buttons with pending/success/error, mutual-connection indicator, and no contact/table-booking elements.
5. `/app/social/:studentId` (direct URL) for a candidate who opted out or is hidden/blocked → confirm forbidden/not-found; for a valid candidate confirm public fields only.
6. Like a candidate (one-sided), then log in as that candidate and Like back → confirm one mutual connection appears under `/app/social/connections`, and that the Study feed/booking eligibility is unaffected.
7. PASS vs HIDE: PASS clears on discovery-round reset; HIDE persists until full demo reset.
8. Revoke social consent → confirm no stale discovery results remain visible.

---

READY FOR REVIEW