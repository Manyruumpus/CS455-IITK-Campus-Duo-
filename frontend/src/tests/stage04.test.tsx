import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { buildRoutes } from '@/app/routes';
import { createApplicationQueryClient } from '@/queries';
import { DemoAuthProvider, useDemoAuth } from '@/app/context/DemoAuthContext';
import { ToastProvider } from '@/components/ui/Toast';
import { mockStore } from '@/mocks/store';
import { scenarioManager } from '@/mocks/scenarios';
import {
  MockProfileService,
} from '@/services/mock/MockAuthProfileServices';
import {
  MockStudyService,
  MockSocialService,
} from '@/services/mock/MockStudySocialServices';
import {
  UserSession,
  AppError,
  ErrorCode,
  StudentOnboardingRequest,
  ProfileUpdateRequest,
  CourseEnrollment,
  SocialInterestTag,
} from '@/types';
import { SettingsPage } from '@/features/student/SettingsPage';

// Helper sessions
const FRESH_STUDENT_SESSION: UserSession = {
  userId: 'usr-student-fresh',
  email: 'fresh.student@campusduo.test',
  name: 'Taylor Brooks',
  rollNumber: '210001',
  role: 'ROLE_STUDENT',
  isOnboarded: false,
  hasStudyConsent: false,
  hasSocialConsent: false,
};

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

const SAM_SESSION: UserSession = {
  userId: 'usr-student-sam',
  email: 'samira.patel@campusduo.test',
  name: 'Samira Patel',
  rollNumber: '200002',
  role: 'ROLE_STUDENT',
  isOnboarded: true,
  hasStudyConsent: true,
  hasSocialConsent: false,
};

const JORDAN_SESSION: UserSession = {
  userId: 'usr-student-jordan',
  email: 'jordan.lee@campusduo.test',
  name: 'Jordan Lee',
  rollNumber: '200003',
  role: 'ROLE_STUDENT',
  isOnboarded: true,
  hasStudyConsent: true,
  hasSocialConsent: true,
};

const ADMIN_SESSION: UserSession = {
  userId: 'usr-admin-senate',
  email: 'senate.mod@campusduo.test',
  name: 'Senate Moderator',
  role: 'ROLE_ADMIN',
  isOnboarded: true,
  hasStudyConsent: false,
  hasSocialConsent: false,
};

const TEST_COURSE: CourseEnrollment = {
  code: 'CS455',
  name: 'Advanced Software Engineering',
  department: 'CSE',
};

const TEST_INTEREST: SocialInterestTag = {
  id: 'chess',
  name: 'Chess Club',
  category: 'CAMPUS_LIFE',
};

function renderAppWithRouter(
  initialEntry: string,
  initialSession: UserSession | null = null,
  featureOverrides = {}
) {
  const routes = buildRoutes(featureOverrides);
  const router = createMemoryRouter(routes, {
    initialEntries: [initialEntry],
  });
  const testQueryClient = createApplicationQueryClient();

  return {
    testQueryClient,
    router,
    ...render(
      <QueryClientProvider client={testQueryClient}>
        <ToastProvider>
          <DemoAuthProvider initialSession={initialSession} isDemoAuthEnabled={true}>
            <RouterProvider router={router} />
          </DemoAuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    ),
  };
}

describe('Stage 04: Authentication, Onboarding, Profile & Privacy Amendments', () => {
  let profileService: MockProfileService;
  let studyService: MockStudyService;
  let socialService: MockSocialService;

  beforeEach(() => {
    mockStore.reset();
    scenarioManager.reset();
    profileService = new MockProfileService();
    studyService = new MockStudyService();
    socialService = new MockSocialService();
  });

  // =========================================================================
  // 1. IDENTITY PROVENANCE & PROTECTED FIELDS
  // =========================================================================
  describe('1. Identity Provenance & Protected Fields', () => {
    it('rejects attempts to modify protected fields in MockProfileService adapter', async () => {
      // Attacker attempts to change role, rollNumber, email, userId, isOnboarded
      const maliciousPayload = {
        userId: 'usr-hacker-hijack',
        email: 'hacker@malicious.test',
        rollNumber: '999999',
        role: 'ROLE_ADMIN',
        department: 'Economics',
        degree: 'PhD' as const,
        year: 4,
        isOnboarded: true,
        displayName: 'Legitimate Name',
      };

      try {
        await profileService.updatePrivateProfile(maliciousPayload as unknown as ProfileUpdateRequest, {
          actorSession: ALEX_SESSION,
        });
        expect.unreachable('Should have thrown VALIDATION_ERROR for protected field modification');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(appErr.message).toMatch(/cannot modify protected.*field/i);
      }

      // Verify stored record was completely untouched
      const stored = mockStore.privateProfiles.get(ALEX_SESSION.userId);
      expect(stored?.userId).toBe(ALEX_SESSION.userId);
      expect(stored?.email).toBe(ALEX_SESSION.email);
      expect(stored?.rollNumber).toBe(ALEX_SESSION.rollNumber);
      expect(stored?.department).toBe('Computer Science & Engineering');
    });

    it('uses explicit projection for editable fields only', async () => {
      const validUpdate = {
        displayName: 'Alex R.',
        courses: [TEST_COURSE],
        studyPreferences: {
          studyStyle: 'QUIET_FOCUSED' as const,
          preferredPace: 'STANDARD_REGULAR' as const,
          preferredTimes: ['EVENING' as const],
        },
        socialBio: 'Updated social bio',
        socialInterests: [TEST_INTEREST],
      };

      const result = await profileService.updatePrivateProfile(validUpdate, {
        actorSession: ALEX_SESSION,
      });
      expect(result.displayName).toBe('Alex R.');
      expect(result.courses).toEqual([TEST_COURSE]);
      expect(result.socialBio).toBe('Updated social bio');

      const stored = mockStore.privateProfiles.get(ALEX_SESSION.userId);
      expect(stored?.displayName).toBe('Alex R.');
      expect(stored?.socialBio).toBe('Updated social bio');
      expect(stored?.socialInterests).toEqual([TEST_INTEREST]);
    });
  });

  // =========================================================================
  // 2. ONBOARDING ORDER & CONSENT
  // =========================================================================
  describe('2. Onboarding Order, Modes & Inconsistency Validation', () => {
    it('completes onboarding with STUDY mode when study consent is granted with required fields', async () => {
      const request: StudentOnboardingRequest = {
        displayName: 'Taylor Brooks',
        modesSelected: 'STUDY',
        studyConsent: true,
        socialConsent: false,
        courses: [TEST_COURSE],
        studyPreferences: {
          preferredTimes: ['MORNING'],
        },
      };

      const response = await profileService.completeOnboarding(request, {
        actorSession: FRESH_STUDENT_SESSION,
      });
      expect(response.isOnboarded).toBe(true);
      expect(response.studyConsent.hasConsent).toBe(true);
      expect(response.socialConsent.hasConsent).toBe(false);

      const stored = mockStore.privateProfiles.get(FRESH_STUDENT_SESSION.userId);
      expect(stored?.isOnboarded).toBe(true);
      expect(stored?.studyConsent.hasConsent).toBe(true);
      expect(stored?.socialConsent.hasConsent).toBe(false);
      expect(mockStore.publicStudyProfiles.has(FRESH_STUDENT_SESSION.userId)).toBe(true);
      expect(mockStore.publicSocialProfiles.has(FRESH_STUDENT_SESSION.userId)).toBe(false);
    });

    it('completes onboarding with SOCIAL mode without requiring study fields', async () => {
      const request: StudentOnboardingRequest = {
        displayName: 'Taylor Brooks',
        modesSelected: 'SOCIAL',
        studyConsent: false,
        socialConsent: true,
        courses: [], // no courses required
        studyPreferences: {
          preferredTimes: [], // no study availability required
        },
        socialBio: 'Looking for sports and casual dining partners',
      };

      const response = await profileService.completeOnboarding(request, {
        actorSession: FRESH_STUDENT_SESSION,
      });
      expect(response.isOnboarded).toBe(true);
      expect(response.studyConsent.hasConsent).toBe(false);
      expect(response.socialConsent.hasConsent).toBe(true);
      expect(response.socialBio).toBe('Looking for sports and casual dining partners');
      expect(mockStore.publicSocialProfiles.has(FRESH_STUDENT_SESSION.userId)).toBe(true);
      expect(mockStore.publicStudyProfiles.has(FRESH_STUDENT_SESSION.userId)).toBe(false);
    });

    it('completes onboarding with BOTH mode when both consents and required study fields are provided', async () => {
      const request: StudentOnboardingRequest = {
        displayName: 'Taylor Brooks',
        modesSelected: 'BOTH',
        studyConsent: true,
        socialConsent: true,
        courses: [TEST_COURSE],
        studyPreferences: {
          preferredTimes: ['EVENING'],
        },
        socialBio: 'Robotics and coffee enthusiast',
      };

      const response = await profileService.completeOnboarding(request, {
        actorSession: FRESH_STUDENT_SESSION,
      });
      expect(response.isOnboarded).toBe(true);
      expect(response.studyConsent.hasConsent).toBe(true);
      expect(response.socialConsent.hasConsent).toBe(true);
      expect(response.courses).toEqual([TEST_COURSE]);
      expect(mockStore.publicStudyProfiles.has(FRESH_STUDENT_SESSION.userId)).toBe(true);
      expect(mockStore.publicSocialProfiles.has(FRESH_STUDENT_SESSION.userId)).toBe(true);
    });

    it('completes onboarding with NEITHER mode with both consents false and no study fields', async () => {
      const request: StudentOnboardingRequest = {
        displayName: 'Taylor Brooks',
        modesSelected: 'NEITHER',
        studyConsent: false,
        socialConsent: false,
        courses: [],
        studyPreferences: {
          preferredTimes: [],
        },
      };

      const response = await profileService.completeOnboarding(request, {
        actorSession: FRESH_STUDENT_SESSION,
      });
      expect(response.isOnboarded).toBe(true);
      expect(response.studyConsent.hasConsent).toBe(false);
      expect(response.socialConsent.hasConsent).toBe(false);
      expect(mockStore.publicStudyProfiles.has(FRESH_STUDENT_SESSION.userId)).toBe(false);
      expect(mockStore.publicSocialProfiles.has(FRESH_STUDENT_SESSION.userId)).toBe(false);
    });

    it('rejects mode-vs-consent inconsistencies prior to updating store', async () => {
      // Inconsistency 1: STUDY mode selected but studyConsent is false
      try {
        await profileService.completeOnboarding(
          {
            displayName: 'Taylor Brooks',
            modesSelected: 'STUDY',
            studyConsent: false,
            socialConsent: false,
            courses: [TEST_COURSE],
            studyPreferences: { preferredTimes: ['MORNING'] },
          },
          { actorSession: FRESH_STUDENT_SESSION }
        );
        expect.unreachable('Should have failed validation');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).code).toBe(ErrorCode.VALIDATION_ERROR);
      }

      // Inconsistency 2: SOCIAL mode selected but socialConsent is false
      try {
        await profileService.completeOnboarding(
          {
            displayName: 'Taylor Brooks',
            modesSelected: 'SOCIAL',
            studyConsent: false,
            socialConsent: false,
          },
          { actorSession: FRESH_STUDENT_SESSION }
        );
        expect.unreachable('Should have failed validation');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).code).toBe(ErrorCode.VALIDATION_ERROR);
      }

      // Inconsistency 3: NEITHER mode selected but studyConsent is true
      try {
        await profileService.completeOnboarding(
          {
            displayName: 'Taylor Brooks',
            modesSelected: 'NEITHER',
            studyConsent: true,
            socialConsent: false,
          },
          { actorSession: FRESH_STUDENT_SESSION }
        );
        expect.unreachable('Should have failed validation');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).code).toBe(ErrorCode.VALIDATION_ERROR);
      }

      // Inconsistency 4: BOTH mode selected but one consent is false
      try {
        await profileService.completeOnboarding(
          {
            displayName: 'Taylor Brooks',
            modesSelected: 'BOTH',
            studyConsent: true,
            socialConsent: false,
            courses: [TEST_COURSE],
            studyPreferences: { preferredTimes: ['MORNING'] },
          },
          { actorSession: FRESH_STUDENT_SESSION }
        );
        expect.unreachable('Should have failed validation');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).code).toBe(ErrorCode.VALIDATION_ERROR);
      }
    });

    it('enforces required study inputs (courses and availability) only when study is enabled', async () => {
      // Missing courses
      try {
        await profileService.completeOnboarding(
          {
            displayName: 'Taylor Brooks',
            modesSelected: 'STUDY',
            studyConsent: true,
            socialConsent: false,
            courses: [],
            studyPreferences: { preferredTimes: ['MORNING'] },
          },
          { actorSession: FRESH_STUDENT_SESSION }
        );
        expect.unreachable('Should have failed validation for missing courses');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).message).toMatch(/at least one course\/topic is required/i);
      }

      // Missing availability
      try {
        await profileService.completeOnboarding(
          {
            displayName: 'Taylor Brooks',
            modesSelected: 'STUDY',
            studyConsent: true,
            socialConsent: false,
            courses: [TEST_COURSE],
            studyPreferences: { preferredTimes: [] },
          },
          { actorSession: FRESH_STUDENT_SESSION }
        );
        expect.unreachable('Should have failed validation for missing availability');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).message).toMatch(/valid, non-empty study availability is required/i);
      }
    });
  });

  // =========================================================================
  // 3. TRANSACTIONAL MOCK SAVE & SETTINGS ENFORCEMENT
  // =========================================================================
  describe('3. Transactional Mock Save & Settings Enforcement', () => {
    it('leaves all prior saved values unchanged on validation or simulated network failure', async () => {
      const initialProfile = mockStore.privateProfiles.get(FRESH_STUDENT_SESSION.userId);
      expect(initialProfile?.isOnboarded).toBe(false);

      // Injected service failure
      scenarioManager.setScenario({ forceError: 'SERVICE_UNAVAILABLE' });

      try {
        await profileService.completeOnboarding(
          {
            displayName: 'Taylor Brooks',
            modesSelected: 'STUDY',
            studyConsent: true,
            socialConsent: false,
            courses: [TEST_COURSE],
            studyPreferences: { preferredTimes: ['MORNING'] },
          },
          { actorSession: FRESH_STUDENT_SESSION }
        );
        expect.unreachable('Should have thrown SERVICE_UNAVAILABLE');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
      }

      // Verify store is completely unchanged
      const afterFailureProfile = mockStore.privateProfiles.get(FRESH_STUDENT_SESSION.userId);
      expect(afterFailureProfile?.isOnboarded).toBe(false);
      expect(afterFailureProfile?.studyConsent.hasConsent).toBe(false);
      expect(mockStore.publicStudyProfiles.has(FRESH_STUDENT_SESSION.userId)).toBe(false);
    });

    it('enforcing study discovery in Settings rejects if study profile is incomplete', async () => {
      // First, complete onboarding as SOCIAL only (no study courses/times)
      await profileService.completeOnboarding(
        {
          displayName: 'Taylor Brooks',
          modesSelected: 'SOCIAL',
          studyConsent: false,
          socialConsent: true,
          socialBio: 'Social only user',
        },
        { actorSession: FRESH_STUDENT_SESSION }
      );

      const freshProfile = mockStore.privateProfiles.get(FRESH_STUDENT_SESSION.userId);
      expect(freshProfile?.courses).toHaveLength(0);

      // Later, user tries to enable study discovery via Settings/StudyService
      try {
        await studyService.updateStudyConsent(true, { actorSession: FRESH_STUDENT_SESSION });
        expect.unreachable('Should have rejected enabling study discovery without study preferences');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(appErr.message).toMatch(/cannot enable study discovery without enrolled courses/i);
      }

      // Verify study consent remained false
      const updatedProfile = mockStore.privateProfiles.get(FRESH_STUDENT_SESSION.userId);
      expect(updatedProfile?.studyConsent.hasConsent).toBe(false);
    });
  });

  // =========================================================================
  // 4. SELF-PREVIEW VERSUS DISCOVERY
  // =========================================================================
  describe('4. Self-Preview vs. Discovery', () => {
    it('allows self-preview while opted out with explicit disclaimer badge', async () => {
      // Ensure Alex is opted out of study discovery
      const alexProfile = mockStore.privateProfiles.get(ALEX_SESSION.userId)!;
      alexProfile.studyConsent = { hasConsent: false };
      mockStore.publicStudyProfiles.delete(ALEX_SESSION.userId);

      const preview = await profileService.getSelfStudyPreview({ actorSession: ALEX_SESSION });
      expect(preview.isDiscoverable).toBe(false);
      expect(preview.previewNotice).toBe('Preview only — not currently discoverable');
      expect(preview.profile.userId).toBe(ALEX_SESSION.userId);
      expect(preview.profile.displayName).toBe(ALEX_SESSION.name);

      // Verify no contact details or private identity fields are exposed
      const studyRecord = preview.profile as unknown as Record<string, unknown>;
      expect(studyRecord.email).toBeUndefined();
      expect(studyRecord.rollNumber).toBeUndefined();
      expect(studyRecord.phone).toBeUndefined();
    });

    it('allows self social preview while opted out with disclaimer badge', async () => {
      const alexProfile = mockStore.privateProfiles.get(ALEX_SESSION.userId)!;
      alexProfile.socialConsent = { hasConsent: false };
      mockStore.publicSocialProfiles.delete(ALEX_SESSION.userId);

      const preview = await profileService.getSelfSocialPreview({ actorSession: ALEX_SESSION });
      expect(preview.isDiscoverable).toBe(false);
      expect(preview.previewNotice).toBe('Preview only — not currently discoverable');
      expect(preview.profile.userId).toBe(ALEX_SESSION.userId);
      const socialRecord = preview.profile as unknown as Record<string, unknown>;
      expect(socialRecord.email).toBeUndefined();
      expect(socialRecord.maskedHandle).toBeUndefined();
    });
  });

  // =========================================================================
  // 5. CONSENT, CACHE CONSISTENCY & DISCOVERY REMOVAL
  // =========================================================================
  describe('5. Consent & Discovery Removal Observed by Other Actors', () => {
    it('removes student from other actor discovery results immediately upon study opt-out', async () => {
      // Populate Alex in public pools initially
      mockStore.publicStudyProfiles.set(ALEX_SESSION.userId, {
        userId: ALEX_SESSION.userId,
        displayName: 'Alex Rivera',
        department: 'Computer Science & Engineering',
        degree: 'B.Tech',
        year: 4,
        courses: [TEST_COURSE],
        studyStyle: 'QUIET_FOCUSED',
        preferredPace: 'STANDARD_REGULAR',
        preferredTimes: ['EVENING'],
        activeStatus: 'LOOKING',
      });
      mockStore.publicSocialProfiles.set(ALEX_SESSION.userId, {
        userId: ALEX_SESSION.userId,
        displayName: 'Alex Rivera',
        bio: 'Alex social bio',
        interests: [TEST_INTEREST],
      });

      expect(mockStore.publicStudyProfiles.has(ALEX_SESSION.userId)).toBe(true);

      // Samira queries study partners
      const initialPartners = await studyService.listStudyPartners(undefined, { actorSession: SAM_SESSION });
      const alexInInitial = initialPartners.find((p) => p.profile.userId === ALEX_SESSION.userId);
      expect(alexInInitial).toBeDefined();

      // Alex opts out of study discovery
      const optOutResult = await studyService.updateStudyConsent(false, { actorSession: ALEX_SESSION });
      expect(optOutResult.hasConsent).toBe(false);

      // Samira queries again: Alex MUST NO LONGER appear in study discovery!
      const afterOptOutPartners = await studyService.listStudyPartners(undefined, { actorSession: SAM_SESSION });
      const alexInAfter = afterOptOutPartners.find((p) => p.profile.userId === ALEX_SESSION.userId);
      expect(alexInAfter).toBeUndefined();

      // Alex's social consent remains unaffected
      const alexProfile = mockStore.privateProfiles.get(ALEX_SESSION.userId)!;
      expect(alexProfile.socialConsent.hasConsent).toBe(true);
      const socialPeers = await socialService.listSocialPeers(undefined, { actorSession: JORDAN_SESSION });
      const alexInSocial = socialPeers.find((p) => p.profile.userId === ALEX_SESSION.userId);
      expect(alexInSocial).toBeDefined();
    });

    it('removes student from social discovery pool upon social opt-out', async () => {
      mockStore.publicSocialProfiles.set(ALEX_SESSION.userId, {
        userId: ALEX_SESSION.userId,
        displayName: 'Alex Rivera',
        bio: 'Alex social bio',
        interests: [TEST_INTEREST],
      });
      expect(mockStore.publicSocialProfiles.has(ALEX_SESSION.userId)).toBe(true);

      await socialService.updateSocialConsent(false, { actorSession: ALEX_SESSION });
      expect(mockStore.publicSocialProfiles.has(ALEX_SESSION.userId)).toBe(false);

      const peers = await socialService.listSocialPeers(undefined, { actorSession: JORDAN_SESSION });
      expect(peers.find((p) => p.profile.userId === ALEX_SESSION.userId)).toBeUndefined();
    });
  });

  // =========================================================================
  // 6. DRAFT AND SESSION ISOLATION
  // =========================================================================
  describe('6. Draft and Session Isolation', () => {
    it('persists onboarding draft in memory and clears it on role switch and logout', async () => {
      let authHook: ReturnType<typeof useDemoAuth> | undefined;

      function TestDraftConsumer() {
        authHook = useDemoAuth();
        return (
          <div>
            <div data-testid="draft-mode">{authHook.onboardingDraft?.modesSelected ?? 'NONE'}</div>
            <button
              onClick={() =>
                authHook?.setOnboardingDraft({
                  currentStep: 2,
                  displayName: 'Taylor Draft',
                  modesSelected: 'BOTH',
                  studyConsent: true,
                  socialConsent: true,
                  courses: [TEST_COURSE],
                  studyPreferences: {
                    preferredTimes: ['EVENING'],
                    studyStyle: 'QUIET_FOCUSED',
                    preferredPace: 'STANDARD_REGULAR',
                  },
                  socialBio: 'Active draft test',
                  socialInterests: [TEST_INTEREST],
                })
              }
            >
              Set Draft
            </button>
            <button onClick={() => authHook?.logout()}>Logout</button>
            <button onClick={() => authHook?.switchRole('ROLE_STUDENT')}>Switch Role</button>
          </div>
        );
      }

      render(
        <ToastProvider>
          <DemoAuthProvider initialSession={FRESH_STUDENT_SESSION} isDemoAuthEnabled={true}>
            <TestDraftConsumer />
          </DemoAuthProvider>
        </ToastProvider>
      );

      expect(screen.getByTestId('draft-mode').textContent).toBe('NONE');

      // Set draft
      fireEvent.click(screen.getByRole('button', { name: /set draft/i }));
      expect(screen.getByTestId('draft-mode').textContent).toBe('BOTH');

      // Switch role -> draft should be reset
      fireEvent.click(screen.getByRole('button', { name: /switch role/i }));
      expect(screen.getByTestId('draft-mode').textContent).toBe('NONE');

      // Set draft again
      fireEvent.click(screen.getByRole('button', { name: /set draft/i }));
      expect(screen.getByTestId('draft-mode').textContent).toBe('BOTH');

      // Logout -> draft should be reset
      fireEvent.click(screen.getByRole('button', { name: /logout/i }));
      expect(screen.getByTestId('draft-mode').textContent).toBe('NONE');
    });
  });

  // =========================================================================
  // 7. GUARDS AND RETURN PATHS
  // =========================================================================
  describe('7. Navigation Guards & Access Boundaries', () => {
    it('redirects unauthenticated user accessing /onboarding to /login with return destination', async () => {
      renderAppWithRouter('/onboarding', null);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /sign in to campus duo/i })).toBeInTheDocument();
        // Check return destination notice
        expect(screen.getByText(/\/onboarding/i)).toBeInTheDocument();
      });
    });

    it('redirects admin accessing /onboarding to /admin/dashboard (admin bypass)', async () => {
      renderAppWithRouter('/onboarding', ADMIN_SESSION);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /campus administration console/i })).toBeInTheDocument();
      });
    });

    it('redirects incomplete student accessing student routes to /onboarding', async () => {
      renderAppWithRouter('/app/dashboard', FRESH_STUDENT_SESSION);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /student onboarding/i })).toBeInTheDocument();
      });
    });

    it('allows incomplete student to access Settings and Logout without trapping', async () => {
      renderAppWithRouter('/app/settings', FRESH_STUDENT_SESSION);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /privacy & consent settings/i })).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // 8. ACTUAL QUERY-DRIVEN UI REFRESH
  // =========================================================================
  describe('8. Actual Query-Driven UI Refresh & Settings Toggles', () => {
    it('renders consent states in Settings and updates via query invalidation without full page reload', async () => {
      const testQueryClient = createApplicationQueryClient();

      render(
        <QueryClientProvider client={testQueryClient}>
          <ToastProvider>
            <DemoAuthProvider initialSession={ALEX_SESSION} isDemoAuthEnabled={true}>
              <SettingsPage />
            </DemoAuthProvider>
          </ToastProvider>
        </QueryClientProvider>
      );

      // Verify initial rendered state from query
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /privacy & consent settings/i })).toBeInTheDocument();
        const optOutBtn = screen.getByRole('button', { name: /opt out of study/i });
        expect(optOutBtn).toBeInTheDocument();
      });

      // Toggle study consent off
      const optOutBtn = screen.getByRole('button', { name: /opt out of study/i });
      fireEvent.click(optOutBtn);

      // Observe query update reflection in UI
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /enable study discovery/i })).toBeInTheDocument();
        const alexStored = mockStore.privateProfiles.get(ALEX_SESSION.userId);
        expect(alexStored?.studyConsent.hasConsent).toBe(false);
      });
    });
  });
});
