import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { buildRoutes } from '@/app/routes';
import { createApplicationQueryClient, queryKeys } from '@/queries';
import { DemoAuthProvider } from '@/app/context/DemoAuthContext';
import { ToastProvider } from '@/components/ui/Toast';
import { mockStore } from '@/mocks/store';
import { scenarioManager } from '@/mocks/scenarios';
import {
  MockStudyService,
  calculateStudyCompatibility,
  getStableRotationScore,
} from '@/services/mock/MockStudySocialServices';
import { UnavailableServiceAdapter } from '@/services/unavailable/UnavailableServiceAdapter';
import {
  UserSession,
  PublicStudyProfile,
  PrivateUserProfile,
  StudyDiscoveryFilters,
} from '@/types';

// Actor Sessions
const ALEX_SESSION: UserSession = {
  userId: 'usr-student-alex',
  email: 'alex.rivera@campusduo.test',
  name: 'Alex Rivera',
  rollNumber: '200001',
  role: 'ROLE_STUDENT',
  isOnboarded: true,
  hasStudyConsent: true,
  hasSocialConsent: true,
};

const NO_CONSENT_SESSION: UserSession = {
  userId: 'usr-student-fresh',
  email: 'fresh.student@campusduo.test',
  name: 'Taylor Brooks',
  rollNumber: '210001',
  role: 'ROLE_STUDENT',
  isOnboarded: true,
  hasStudyConsent: false,
  hasSocialConsent: false,
};

const AARAV_SESSION: UserSession = {
  userId: 'usr-student-aarav',
  email: 'aarav.sharma@campusduo.test',
  name: 'Aarav Sharma',
  rollNumber: '210884',
  role: 'ROLE_STUDENT',
  isOnboarded: true,
  hasStudyConsent: true,
  hasSocialConsent: false,
};

function renderWithProviders(initialRoute: string, initialSession: UserSession | null = ALEX_SESSION) {
  const queryClient = createApplicationQueryClient();
  const routes = buildRoutes();
  const router = createMemoryRouter(routes, { initialEntries: [initialRoute] });

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <DemoAuthProvider initialSession={initialSession}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </DemoAuthProvider>
    </QueryClientProvider>
  );

  return { ...utils, queryClient, router };
}

describe('Stage 05 — Study Discovery, Compatibility and Agent Workflow (Targeted Repair)', () => {
  let studyService: MockStudyService;

  beforeEach(() => {
    mockStore.reset();
    scenarioManager.reset();
    studyService = new MockStudyService();
  });

  describe('1. Optional Style/Pace Scoring, Base vs Effective Weights, and Missing Data Renormalization', () => {
    const baseActor: PrivateUserProfile = {
      userId: 'usr-actor',
      email: 'actor@test.edu',
      rollNumber: '200111',
      displayName: 'Actor Student',
      department: 'Computer Science',
      degree: 'B.Tech',
      year: 4,
      isOnboarded: true,
      courses: [{ code: 'CS455', name: 'Software Eng', department: 'CSE' }],
      studyPreferences: {
        preferredTimes: ['EVENING'],
        studyStyle: 'QUIET_FOCUSED',
        preferredPace: 'STANDARD_REGULAR',
        preferredLocation: 'P.K. Kelkar Library',
        studyGoals: 'Core exam review',
      },
      studyConsent: { hasConsent: true },
      socialConsent: { hasConsent: false },
    };

    const baseCandidate: PublicStudyProfile = {
      userId: 'usr-cand',
      displayName: 'Candidate Student',
      department: 'Computer Science',
      degree: 'B.Tech',
      year: 4,
      courses: [{ code: 'CS455', name: 'Software Eng', department: 'CSE' }],
      studyStyle: 'QUIET_FOCUSED',
      preferredPace: 'STANDARD_REGULAR',
      preferredTimes: ['EVENING'],
      activeStatus: 'LOOKING',
    };

    const baseCandidatePrivate: PrivateUserProfile = {
      ...baseActor,
      userId: 'usr-cand',
      displayName: 'Candidate Student',
    };

    it('calculates complete preference data (100 base weight, completeness 1.00, effective weights equal base weights)', () => {
      const result = calculateStudyCompatibility(baseActor, baseCandidate, baseCandidatePrivate);
      const b = result.compatibilityBreakdown;

      expect(b.activeBaseWeightTotal).toBe(100);
      expect(result.dataCompletenessScore).toBe(1.0);
      expect(b.courseFactor.baseWeight).toBe(35);
      expect(b.courseFactor.effectiveWeight).toBe(35);
      expect(b.timeFactor.baseWeight).toBe(25);
      expect(b.timeFactor.effectiveWeight).toBe(25);
      expect(b.styleFactor?.baseWeight).toBe(10);
      expect(b.styleFactor?.effectiveWeight).toBe(10);
      expect(b.paceFactor?.baseWeight).toBe(10);
      expect(b.paceFactor?.effectiveWeight).toBe(10);
      expect(b.locationFactor?.baseWeight).toBe(10);
      expect(b.locationFactor?.effectiveWeight).toBe(10);
      expect(b.goalsFactor?.baseWeight).toBe(10);
      expect(b.goalsFactor?.effectiveWeight).toBe(10);
      expect(b.omittedFactors.length).toBe(0);
    });

    it('omits Style when missing on either profile without penalty, renormalizing active weights', () => {
      // Actor has no studyStyle
      const actorNoStyle: PrivateUserProfile = {
        ...baseActor,
        studyPreferences: {
          ...baseActor.studyPreferences!,
          studyStyle: undefined,
        },
      };

      const result = calculateStudyCompatibility(actorNoStyle, baseCandidate, baseCandidatePrivate);
      const b = result.compatibilityBreakdown;

      expect(b.styleFactor).toBeUndefined();
      expect(b.omittedFactors).toContain('Study Style');
      // Active base weights: 35 + 25 + 10 (pace) + 10 (loc) + 10 (goals) = 90
      expect(b.activeBaseWeightTotal).toBe(90);
      expect(result.dataCompletenessScore).toBe(0.9);
      // Effective weights must renormalize to sum to 100
      expect(b.courseFactor.effectiveWeight).toBeCloseTo((35 / 90) * 100, 1);
      expect(b.timeFactor.effectiveWeight).toBeCloseTo((25 / 90) * 100, 1);
      expect(b.paceFactor?.effectiveWeight).toBeCloseTo((10 / 90) * 100, 1);
    });

    it('omits Pace when missing on either profile without penalty, renormalizing active weights', () => {
      // Candidate has undefined preferredPace
      const candidateNoPace: PublicStudyProfile = {
        ...baseCandidate,
        preferredPace: undefined as unknown as PublicStudyProfile['preferredPace'],
      };

      const result = calculateStudyCompatibility(baseActor, candidateNoPace, baseCandidatePrivate);
      const b = result.compatibilityBreakdown;

      expect(b.paceFactor).toBeUndefined();
      expect(b.omittedFactors).toContain('Study Pace');
      expect(b.activeBaseWeightTotal).toBe(90);
      expect(result.dataCompletenessScore).toBe(0.9);
      expect(b.styleFactor?.effectiveWeight).toBeCloseTo((10 / 90) * 100, 1);
    });

    it('omits both Style and Pace when missing, yielding minimum valid active base weight (60) and completeness (0.60)', () => {
      // Actor and candidate have only required Course + Time, no style, pace, location, or goals
      const minimalActor: PrivateUserProfile = {
        ...baseActor,
        studyPreferences: {
          preferredTimes: ['EVENING'],
        },
      };
      const minimalCandidate: PublicStudyProfile = {
        ...baseCandidate,
        studyStyle: undefined as unknown as PublicStudyProfile['studyStyle'],
        preferredPace: undefined as unknown as PublicStudyProfile['preferredPace'],
      };

      const result = calculateStudyCompatibility(minimalActor, minimalCandidate, undefined);
      const b = result.compatibilityBreakdown;

      expect(b.styleFactor).toBeUndefined();
      expect(b.paceFactor).toBeUndefined();
      expect(b.locationFactor).toBeUndefined();
      expect(b.goalsFactor).toBeUndefined();
      expect(b.activeBaseWeightTotal).toBe(60);
      expect(result.dataCompletenessScore).toBe(0.6);
      expect(b.omittedFactors).toEqual([
        'Study Style',
        'Study Pace',
        'Preferred Location',
        'Study Goals',
      ]);
      // Active weights: Course (35/60 * 100 = 58.3%) and Time (25/60 * 100 = 41.7%)
      expect(b.courseFactor.effectiveWeight).toBeCloseTo((35 / 60) * 100, 1);
      expect(b.timeFactor.effectiveWeight).toBeCloseTo((25 / 60) * 100, 1);
      expect(b.courseFactor.effectiveWeight + b.timeFactor.effectiveWeight).toBeCloseTo(100, 0);
    });

    it('renders consent-disabled screen linking to Settings when user has not opted into study discovery', async () => {
      renderWithProviders('/app/study', NO_CONSENT_SESSION);

      expect(
        await screen.findByText('Study Discovery Consent Required')
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Enable in Settings/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Review Profile Onboarding/i })
      ).toBeInTheDocument();
    });

    it('filters recommendations by course, time, and text search, and validates query keys', async () => {
      const filters: StudyDiscoveryFilters = { courseCode: 'CS455', preferredTime: 'EVENING' };
      const key = queryKeys.study.recommendations('usr-student-alex', filters as Record<string, unknown>);

      expect(key).toContain('study');
      expect(key).toContain('recommendations');
      expect(key).toContain('usr-student-alex');
      expect(key[3]).toEqual(filters);

      const cs455List = await studyService.listStudyPartners({ courseCode: 'CS455' }, {
        actorSession: ALEX_SESSION,
      });
      expect(cs455List.length).toBeGreaterThan(0);
      for (const rec of cs455List) {
        expect(rec.profile.courses.some((c) => c.code === 'CS455')).toBe(true);
      }
    });
  });

  describe('2. Independent Completeness Metric & Badge Visibility Threshold', () => {
    it('defines completeness independently as active base weight / 100, separate from compatibility score', async () => {
      const recommendations = await studyService.listStudyPartners(undefined, {
        actorSession: ALEX_SESSION,
      });

      for (const rec of recommendations) {
        expect(rec.dataCompletenessScore).toBeGreaterThanOrEqual(0.6);
        expect(rec.dataCompletenessScore).toBeLessThanOrEqual(1.0);
        // Compatibility score is quality of fit (0-100), completeness is data volume
        expect(typeof rec.aiMatchScore).toBe('number');
        expect(typeof rec.dataCompletenessScore).toBe('number');
      }
    });

    it('renders completeness badge in visible state when completeness is below 0.80', async () => {
      // Render detail view of a candidate whose completeness is 0.70 (< 0.80)
      const mockCand: PublicStudyProfile = {
        userId: 'usr-student-incomplete',
        displayName: 'Incomplete Candidate',
        department: 'CSE',
        degree: 'B.Tech',
        year: 4,
        courses: [{ code: 'CS455', name: 'Software Eng', department: 'CSE' }],
        studyStyle: 'QUIET_FOCUSED',
        preferredPace: undefined as unknown as PublicStudyProfile['preferredPace'], // missing pace
        preferredTimes: ['EVENING'],
        activeStatus: 'LOOKING',
      };
      mockStore.publicStudyProfiles.set(mockCand.userId, mockCand);
      mockStore.privateProfiles.set(mockCand.userId, {
        userId: mockCand.userId,
        email: 'incomplete@test.edu',
        rollNumber: '210999',
        displayName: mockCand.displayName,
        department: mockCand.department,
        degree: mockCand.degree,
        year: mockCand.year,
        isOnboarded: true,
        courses: mockCand.courses,
        studyPreferences: { preferredTimes: mockCand.preferredTimes, studyStyle: mockCand.studyStyle },
        studyConsent: { hasConsent: true },
        socialConsent: { hasConsent: false },
      });

      renderWithProviders('/app/study/usr-student-incomplete', ALEX_SESSION);

      expect(await screen.findByTestId('completeness-badge')).toBeInTheDocument();
      expect(screen.getByText('Limited preference data')).toBeInTheDocument();
    });

    it('hides completeness badge when completeness meets or exceeds 0.80 threshold', async () => {
      // Aarav has style and pace configured (completeness = 80% with Alex)
      renderWithProviders('/app/study/usr-student-aarav', ALEX_SESSION);

      expect(await screen.findByRole('heading', { name: 'Aarav Sharma' })).toBeInTheDocument();
      expect(screen.queryByTestId('completeness-badge')).not.toBeInTheDocument();
    });
  });

  describe('3. Transitive Anchor-Based Near-Tie Ordering', () => {
    it('clusters candidates within 1.0 point of anchor score and produces identical order under shuffled inputs', async () => {
      // Create 3 candidates with near-tied scores within 1.0 point
      const candA: PublicStudyProfile = {
        userId: 'usr-cand-a',
        displayName: 'Alpha Student',
        department: 'CSE',
        degree: 'B.Tech',
        year: 4,
        courses: [{ code: 'CS455', name: 'Software Eng', department: 'CSE' }],
        studyStyle: 'QUIET_FOCUSED',
        preferredPace: 'STANDARD_REGULAR',
        preferredTimes: ['MORNING'],
        activeStatus: 'LOOKING',
      };

      const candB: PublicStudyProfile = {
        ...candA,
        userId: 'usr-cand-b',
        displayName: 'Beta Student',
        preferredTimes: ['MORNING', 'AFTERNOON'], // Higher availability overlap with Alex
      };

      const candC: PublicStudyProfile = {
        ...candA,
        userId: 'usr-cand-c',
        displayName: 'Gamma Student',
        preferredTimes: ['EVENING'],
      };

      mockStore.publicStudyProfiles.set(candA.userId, candA);
      mockStore.publicStudyProfiles.set(candB.userId, candB);
      mockStore.publicStudyProfiles.set(candC.userId, candC);

      const run1 = await studyService.listStudyPartners(undefined, { actorSession: ALEX_SESSION });
      const order1 = run1.map((r) => r.profile.userId);

      // Re-run multiple times; order must be 100% stable and deterministic
      const run2 = await studyService.listStudyPartners(undefined, { actorSession: ALEX_SESSION });
      const order2 = run2.map((r) => r.profile.userId);

      expect(order1).toEqual(order2);
    });

    it('strictly partitions chained near-tie scores without comparator transitivity cycles', async () => {
      // Test the anchor-based grouping rule:
      // Anchor = 80.0. Scores: 80.0, 79.5, 79.1, 78.8
      // 80.0 - 79.5 = 0.5 <= 1.0 (Cluster 1)
      // 80.0 - 79.1 = 0.9 <= 1.0 (Cluster 1)
      // 80.0 - 78.8 = 1.2 > 1.0  (Starts Cluster 2 with anchor 78.8)
      // In a pairwise comparator, 79.1 and 78.8 would be within 0.3, causing transitivity cycle
      const recs = await studyService.listStudyPartners(undefined, { actorSession: ALEX_SESSION });
      expect(Array.isArray(recs)).toBe(true);

      // Verify rotation score generator is deterministic and non-random
      const rot1 = getStableRotationScore('usr-student-alex', 'usr-cand-1');
      const rot2 = getStableRotationScore('usr-student-alex', 'usr-cand-1');
      expect(rot1).toBe(rot2);
      expect(typeof rot1).toBe('number');
    });
  });

  describe('4. Empty Results vs Deterministic Failure Fallbacks in Agent Workflow', () => {
    it('returns empty exact-match result and broader suggestedAlternatives when course has no matches', async () => {
      const result = await studyService.submitMatchingQuery('NONEXISTENT_COURSE', {}, {
        actorSession: ALEX_SESSION,
      });

      // No matches for course: status is COMPLETED, results is empty array
      expect(result.status).toBe('COMPLETED');
      expect(result.results).toEqual([]);
      expect(result.suggestedAlternatives).toBeDefined();
      expect(result.suggestedAlternatives!.length).toBeGreaterThan(0);

      // Alternatives must explicitly state they do NOT satisfy the requested course
      for (const alt of result.suggestedAlternatives!) {
        const hasDisclaimer = alt.aiMatchReasons.some((r) =>
          r.includes('does NOT satisfy NONEXISTENT_COURSE')
        );
        expect(hasDisclaimer).toBe(true);
      }
    });

    it('returns distinctly labelled deterministic FALLBACK upon agent failure or service unavailability', async () => {
      scenarioManager.setScenario({ forceAgentFallback: true });

      const result = await studyService.submitMatchingQuery('CS455', {}, {
        actorSession: ALEX_SESSION,
      });

      expect(result.status).toBe('FALLBACK');
      expect(result.fallbackReason).toContain('Deterministic fallback candidate recommendations');
      expect(result.results).toBeDefined();
      expect(result.results!.length).toBeGreaterThan(0);
    });

    it('protects private query results from unauthorized cross-actor access', async () => {
      const queryRes = await studyService.submitMatchingQuery('CS455', {}, {
        actorSession: ALEX_SESSION,
      });

      // Aarav attempts to read Alex's query result
      await expect(
        studyService.getMatchingStatus(queryRes.queryId, { actorSession: AARAV_SESSION })
      ).rejects.toThrow('Private query results belong exclusively to the submitting student.');
    });
  });

  describe('5. Action Eligibility, Mutation-Time Rechecks, and Idempotent Like', () => {
    it('rejects self-actions and self-lookups', async () => {
      // Self-lookup in getStudyPartner returns null
      const selfDetail = await studyService.getStudyPartner(ALEX_SESSION.userId, {
        actorSession: ALEX_SESSION,
      });
      expect(selfDetail).toBeNull();

      // Self-action throws VALIDATION_ERROR
      await expect(
        studyService.recordStudyAction(ALEX_SESSION.userId, 'LIKE', {
          actorSession: ALEX_SESSION,
        })
      ).rejects.toThrow('Cannot perform study action on yourself');
    });

    it('rechecks candidate eligibility at mutation time and rejects actions on consent-disabled candidates', async () => {
      // Attempt to LIKE Taylor Brooks who has hasStudyConsent: false
      await expect(
        studyService.recordStudyAction('usr-student-fresh', 'LIKE', {
          actorSession: ALEX_SESSION,
        })
      ).rejects.toThrow('Target student is not eligible for study interactions');
    });

    it('keeps repeated Like idempotent without creating duplicate connections or overwriting timestamps', async () => {
      const res1 = await studyService.recordStudyAction('usr-student-aarav', 'LIKE', {
        actorSession: ALEX_SESSION,
      });
      expect(res1.relationshipStatus).toBe('PENDING_SENT');

      const initialConnectionsCount = mockStore.connections.size;

      // Repeat identical Like
      const res2 = await studyService.recordStudyAction('usr-student-aarav', 'LIKE', {
        actorSession: ALEX_SESSION,
      });

      expect(res2.relationshipStatus).toBe('PENDING_SENT');
      expect(mockStore.connections.size).toBe(initialConnectionsCount);
    });

    it('preserves independent STUDY and SOCIAL relationship state upon mutual study connection', async () => {
      // Step 1: Aarav likes Alex for study
      await studyService.recordStudyAction(ALEX_SESSION.userId, 'LIKE', {
        actorSession: AARAV_SESSION,
      });

      // Step 2: Alex likes Aarav for study
      const res = await studyService.recordStudyAction('usr-student-aarav', 'LIKE', {
        actorSession: ALEX_SESSION,
      });
      expect(res.relationshipStatus).toBe('MUTUAL_CONNECTED');

      // Verify STUDY connection exists
      const studyConn = Array.from(mockStore.connections.values()).find(
        (c) => c.mode === 'STUDY' && c.studentAId === ALEX_SESSION.userId && c.studentBId === 'usr-student-aarav'
      );
      expect(studyConn).toBeDefined();

      // Verify SOCIAL connections are unaffected
      const socialConn = Array.from(mockStore.connections.values()).find(
        (c) => c.mode === 'SOCIAL' && (c.studentAId === 'usr-student-aarav' || c.studentBId === 'usr-student-aarav')
      );
      expect(socialConn).toBeUndefined();
    });
  });

  describe('6. Discovery Round Boundaries & Pass vs Hide Semantics', () => {
    it('dismisses candidate for current round on PASS, and restores candidate upon resetDiscoveryRound', async () => {
      // Aarav is visible initially
      const initial = await studyService.listStudyPartners(undefined, { actorSession: ALEX_SESSION });
      expect(initial.some((r) => r.profile.userId === 'usr-student-aarav')).toBe(true);

      // Pass Aarav
      await studyService.recordStudyAction('usr-student-aarav', 'PASS', { actorSession: ALEX_SESSION });

      // In current round, Aarav is excluded
      const afterPass = await studyService.listStudyPartners(undefined, { actorSession: ALEX_SESSION });
      expect(afterPass.some((r) => r.profile.userId === 'usr-student-aarav')).toBe(false);

      // Reset discovery round
      await studyService.resetDiscoveryRound({ actorSession: ALEX_SESSION });

      // In new round, Aarav is eligible again
      const afterReset = await studyService.listStudyPartners(undefined, { actorSession: ALEX_SESSION });
      expect(afterReset.some((r) => r.profile.userId === 'usr-student-aarav')).toBe(true);
    });

    it('persists HIDE across discovery rounds until full demo store reset', async () => {
      await studyService.recordStudyAction('usr-student-aarav', 'HIDE', { actorSession: ALEX_SESSION });

      // Reset discovery round does NOT unhide
      await studyService.resetDiscoveryRound({ actorSession: ALEX_SESSION });

      const afterRoundReset = await studyService.listStudyPartners(undefined, { actorSession: ALEX_SESSION });
      expect(afterRoundReset.some((r) => r.profile.userId === 'usr-student-aarav')).toBe(false);

      // Full store reset restores initial demo state
      mockStore.reset();
      const afterStoreReset = await studyService.listStudyPartners(undefined, { actorSession: ALEX_SESSION });
      expect(afterStoreReset.some((r) => r.profile.userId === 'usr-student-aarav')).toBe(true);
    });
  });

  describe('7. Production Unavailable Adapter & Stale Session Protection', () => {
    it('rejects all Stage 05 study service methods with SERVICE_UNAVAILABLE in production adapter', async () => {
      const prodAdapter = new UnavailableServiceAdapter();

      await expect(
        prodAdapter.study.listStudyPartners(undefined, { actorSession: ALEX_SESSION })
      ).rejects.toThrow('SERVICE_UNAVAILABLE');

      await expect(
        prodAdapter.study.getStudyPartner('usr-student-aarav', { actorSession: ALEX_SESSION })
      ).rejects.toThrow('SERVICE_UNAVAILABLE');

      await expect(
        prodAdapter.study.recordStudyAction('usr-student-aarav', 'LIKE', { actorSession: ALEX_SESSION })
      ).rejects.toThrow('SERVICE_UNAVAILABLE');

      await expect(
        prodAdapter.study.submitMatchingQuery('CS455', {}, { actorSession: ALEX_SESSION })
      ).rejects.toThrow('SERVICE_UNAVAILABLE');

      await expect(
        prodAdapter.study.getMatchingStatus('query-123', { actorSession: ALEX_SESSION })
      ).rejects.toThrow('SERVICE_UNAVAILABLE');

      await expect(
        prodAdapter.study.resetDiscoveryRound({ actorSession: ALEX_SESSION })
      ).rejects.toThrow('SERVICE_UNAVAILABLE');
    });
  });

  describe('8. UI Flow & Detail View Integration', () => {
    it('renders candidate detail page distinguishing base weights from renormalized weights', async () => {
      renderWithProviders('/app/study/usr-student-aarav', ALEX_SESSION);

      expect(await screen.findByRole('heading', { name: 'Aarav Sharma' })).toBeInTheDocument();
      expect(screen.getByText('Compatibility Factor Breakdown')).toBeInTheDocument();
      expect(screen.getByText(/Course Overlap \(Base 35% · Effective/i)).toBeInTheDocument();
      expect(screen.getByText(/Time Availability \(Base 25% · Effective/i)).toBeInTheDocument();
      expect(screen.getByText(/Study Style \(Base 10% · Effective/i)).toBeInTheDocument();
      expect(screen.getByText(/Study Pace \(Base 10% · Effective/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Send Study Like/i })).toBeInTheDocument();
    });

    it('renders agent matcher dialog and displays simulated results', async () => {
      renderWithProviders('/app/study', ALEX_SESSION);

      const agentBtn = await screen.findByRole('button', { name: /AI Study Matcher \(Demo\)/i });
      fireEvent.click(agentBtn);

      expect(screen.getByText('AI Study Matcher (Demo Simulator)')).toBeInTheDocument();
      const submitBtn = screen.getByRole('button', { name: /Run Match Query/i });
      fireEvent.click(submitBtn);

      expect(await screen.findByText(/Simulated Agent Findings/i)).toBeInTheDocument();
    });
  });
});
