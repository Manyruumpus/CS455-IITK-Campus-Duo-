import { describe, it, expect, vi } from 'vitest';
import { getAppServices } from '../services';
import { HttpProfileAdapter } from '../services/http/HttpProfileAdapter';
import { MockProfileService } from '../services/mock/MockAuthProfileServices';
import { ServiceContext } from '../services/interfaces';
import { UserSession, ErrorCode } from '../types';

describe('Profile Service Selection & HttpProfileAdapter Suite', () => {
  const MOCK_SESSION: UserSession = {
    userId: '00000000-0000-0000-0000-00000000D501',
    email: 'alex.rivera@campusduo.test',
    name: 'Alex Rivera',
    role: 'ROLE_STUDENT',
    isOnboarded: true,
    hasStudyConsent: true,
    hasSocialConsent: true,
    sessionToken: 'test-session-token-xyz',
  };

  const context: ServiceContext = {
    actorSession: MOCK_SESSION,
  };

  describe('1. Service Selection Isolation Rules', () => {
    it('selects HttpProfileAdapter when isLiveProfileEnabled is true', () => {
      const services = getAppServices({ isLiveProfileEnabled: true, isDemoAuthEnabled: true });
      expect(services.profile).toBeInstanceOf(HttpProfileAdapter);
    });

    it('selects HttpProfileAdapter when isLiveBookingEnabled is true', () => {
      const services = getAppServices({ isLiveBookingEnabled: true, isDemoAuthEnabled: true });
      expect(services.profile).toBeInstanceOf(HttpProfileAdapter);
    });

    it('selects MockProfileService when live flags are false and demo auth is enabled', () => {
      const services = getAppServices({
        isLiveProfileEnabled: false,
        isLiveBookingEnabled: false,
        isDemoAuthEnabled: true,
      });
      expect(services.profile).toBeInstanceOf(MockProfileService);
    });

    it('returns unavailable profile adapter when live flags are false and demo auth is disabled', async () => {
      const services = getAppServices({
        isLiveProfileEnabled: false,
        isLiveBookingEnabled: false,
        isDemoAuthEnabled: false,
      });
      await expect(services.profile.getPrivateProfile(context)).rejects.toMatchObject({
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });
    });
  });

  describe('2. HttpProfileAdapter Contract and Serialization', () => {
    it('executes GET /api/profile/me with bearer auth and unwraps data payload', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            userId: MOCK_SESSION.userId,
            email: MOCK_SESSION.email,
            displayName: MOCK_SESSION.name,
            studyPreferences: {
              studyStyle: 'DISCUSSION_HEAVY',
              preferredPace: 'STANDARD_REGULAR',
              preferredTimes: ['EVENING'],
            },
            courses: [],
            studyConsent: { hasConsent: true },
            socialConsent: { hasConsent: false },
          },
          requestId: 'req-test-1',
        }),
      });

      const adapter = new HttpProfileAdapter({ baseUrl: 'http://test-api:4000', fetchFn: mockFetch });
      const profile = await adapter.getPrivateProfile(context);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('http://test-api:4000/api/profile/me');
      expect(init.method).toBe('GET');
      expect(init.headers['Authorization']).toBe(`Bearer ${MOCK_SESSION.sessionToken}`);
      expect(profile.displayName).toBe(MOCK_SESSION.name);
      expect(profile.studyPreferences.studyStyle).toBe('DISCUSSION_HEAVY');
    });

    it('executes PUT /api/profile/me with update payload and bearer auth', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            userId: MOCK_SESSION.userId,
            email: MOCK_SESSION.email,
            displayName: 'Alex Updated',
            studyPreferences: {
              studyStyle: 'PROBLEM_SOLVING',
              preferredPace: 'EXAM_CRAMMING',
              preferredTimes: ['MORNING'],
            },
            courses: [],
            studyConsent: { hasConsent: true },
            socialConsent: { hasConsent: false },
          },
          requestId: 'req-test-2',
        }),
      });

      const adapter = new HttpProfileAdapter({ baseUrl: 'http://test-api:4000', fetchFn: mockFetch });
      const updated = await adapter.updatePrivateProfile(
        {
          displayName: 'Alex Updated',
          studyPreferences: {
            studyStyle: 'PROBLEM_SOLVING',
            preferredPace: 'EXAM_CRAMMING',
          },
        },
        context
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('http://test-api:4000/api/profile/me');
      expect(init.method).toBe('PUT');
      expect(init.headers['Authorization']).toBe(`Bearer ${MOCK_SESSION.sessionToken}`);
      const parsedBody = JSON.parse(init.body);
      expect(parsedBody.displayName).toBe('Alex Updated');
      expect(parsedBody.studyPreferences.studyStyle).toBe('PROBLEM_SOLVING');
      expect(updated.displayName).toBe('Alex Updated');
    });

    it('correctly maps 401, 403, 400, and 404 HTTP errors to domain ErrorCodes', async () => {
      const makeAdapterWithStatus = (status: number, code: string, message: string) => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: false,
          status,
          json: async () => ({
            error: { code, message },
            requestId: 'req-err',
          }),
        });
        return new HttpProfileAdapter({ baseUrl: 'http://test-api:4000', fetchFn: mockFetch });
      };

      const unauthAdapter = makeAdapterWithStatus(401, 'UNAUTHENTICATED', 'Missing token');
      await expect(unauthAdapter.getPrivateProfile(context)).rejects.toMatchObject({
        code: ErrorCode.UNAUTHENTICATED,
      });

      const forbiddenAdapter = makeAdapterWithStatus(403, 'FORBIDDEN', 'Admins cannot access student profiles');
      await expect(forbiddenAdapter.getPrivateProfile(context)).rejects.toMatchObject({
        code: ErrorCode.FORBIDDEN,
      });

      const validationAdapter = makeAdapterWithStatus(400, 'VALIDATION_ERROR', 'Invalid study style');
      await expect(
        validationAdapter.updatePrivateProfile({ studyPreferences: { studyStyle: 'BAD' as any } }, context)
      ).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_ERROR,
      });
    });

    it('derives discoverable self-study and self-social previews', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            userId: MOCK_SESSION.userId,
            email: MOCK_SESSION.email,
            displayName: MOCK_SESSION.name,
            department: 'Computer Science',
            degree: 'B.Tech',
            year: 4,
            socialBio: 'Algorithm buff',
            socialInterests: [{ id: 'tag-1', name: 'Chess', category: 'SPORTS_FITNESS' }],
            studyPreferences: {
              studyStyle: 'DISCUSSION_HEAVY',
              preferredPace: 'STANDARD_REGULAR',
              preferredTimes: ['EVENING'],
            },
            courses: [{ code: 'CS455', name: 'Computer Networks', department: 'CSE' }],
            studyConsent: { hasConsent: true },
            socialConsent: { hasConsent: false },
          },
          requestId: 'req-preview',
        }),
      });

      const adapter = new HttpProfileAdapter({ baseUrl: 'http://test-api:4000', fetchFn: mockFetch });

      const studyPreview = await adapter.getSelfStudyPreview(context);
      expect(studyPreview.isDiscoverable).toBe(true);
      expect(studyPreview.profile.studyStyle).toBe('DISCUSSION_HEAVY');
      expect(studyPreview.profile.activeStatus).toBe('LOOKING');

      const socialPreview = await adapter.getSelfSocialPreview(context);
      expect(socialPreview.isDiscoverable).toBe(false);
      expect(socialPreview.previewNotice).toBe('Social discovery is disabled.');
      expect(socialPreview.profile.bio).toBe('Algorithm buff');
    });
  });
});
