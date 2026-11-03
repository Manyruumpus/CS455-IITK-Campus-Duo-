import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockStudyService } from '@/services/mock/MockStudySocialServices';
import { HttpAgentAdapter } from '@/services/http/HttpAgentAdapter';
import { getAppServices } from '@/services';
import { mockStore } from '@/mocks/store';
import { scenarioManager } from '@/mocks/scenarios';
import { AppError, ErrorCode, UserSession } from '@/types';

const ALEX_SESSION: UserSession = {
  userId: 'usr-student-alex',
  email: 'alex.rivera@iitk.ac.in',
  name: 'Alex Rivera',
  rollNumber: '200001',
  role: 'ROLE_STUDENT',
  isOnboarded: true,
  hasStudyConsent: true,
  hasSocialConsent: false,
  sessionToken: 'student-session-token',
};

const API_CANDIDATE = {
  profile: {
    userId: '00000000-0000-0000-0000-00000000D502',
    displayName: 'Sam Tandon',
    department: 'CSE',
    degree: 'B.Tech',
    year: 4,
    studyStyle: 'QUIET_FOCUSED',
    preferredPace: 'STANDARD_REGULAR',
    activeStatus: 'ACTIVE',
    preferredTimes: ['MON_MORNING'],
    email: 'sam.private@iitk.ac.in',
    rollNumber: '200002',
    courses: [{ code: 'DB05-CS455', name: 'Database Systems' }],
  },
  aiMatchScore: 87,
  aiMatchReasons: [
    'Shared courses: DB05-CS455',
    'Overlapping study slots: MON_MORNING',
    'Active academic goal: confidential goal text',
    'Common preferred location: private location',
  ],
  dataCompletenessScore: 1,
  relationshipStatus: 'NONE',
  compatibilityBreakdown: {
    factors: {
      time: { explanation: 'Overlapping study slots: MON_MORNING' },
      goals: { explanation: 'Goal: confidential goal text' },
      location: { explanation: 'Location: private location' },
    },
  },
};

const originalLiveFlag = import.meta.env.VITE_USE_LIVE_BOOKING;

describe('KAN-49 frontend to backend assistant integration', () => {
  beforeEach(() => {
    mockStore.reset();
    scenarioManager.reset();
    (import.meta.env as any).VITE_USE_LIVE_BOOKING = 'true';
  });

  afterEach(() => {
    (import.meta.env as any).VITE_USE_LIVE_BOOKING = originalLiveFlag;
    vi.restoreAllMocks();
  });

  it('posts the assistant query with the student session and maps a private-safe response', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          queryId: 'query-backend-1',
          status: 'FALLBACK',
          recommendations: [API_CANDIDATE],
          suggestedAlternatives: [],
          fallbackReason: 'Inference provider offline. Deterministic recommendations provided.',
          generatedAt: '2026-10-15T00:00:00.000Z',
        },
      }),
    });
    const service = new MockStudyService({ fetchFn: fetchFn as unknown as typeof fetch });

    const result = await service.submitMatchingQuery(
      'DB05-CS455',
      { studyGoals: 'Find a partner for exam practice' },
      { actorSession: ALEX_SESSION }
    );

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, request] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/api/agent/recommend');
    expect(request.method).toBe('POST');
    expect(request.headers).toMatchObject({
      Accept: 'application/json',
      Authorization: 'Bearer student-session-token',
    });
    expect(JSON.parse(String(request.body))).toEqual({
      courseCode: 'DB05-CS455',
      prompt: 'Find a partner for exam practice',
    });
    expect(result.status).toBe('FALLBACK');
    expect(result.queryId).toBe('query-backend-1');
    expect(result.results?.[0].profile.preferredTimes).toEqual([]);
    expect(result.results?.[0].compatibilityBreakdown).toBeUndefined();

    const serialized = JSON.stringify(result);
    for (const privateValue of [
      'MON_MORNING',
      'sam.private@iitk.ac.in',
      '200002',
      'confidential goal text',
      'private location',
      'compatibilityBreakdown',
    ]) {
      expect(serialized).not.toContain(privateValue);
    }
  });

  it('maps default demo course identifiers to the backend course catalog and returns exact recommendations', async () => {
    (import.meta.env as any).VITE_USE_LIVE_BOOKING = 'true';
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ data: { queryId: 'exact-1', status: 'COMPLETED', recommendations: [API_CANDIDATE], suggestedAlternatives: [], generatedAt: '2026-10-15T00:00:00.000Z' } }),
    });
    const service = new MockStudyService({ fetchFn: fetchFn as unknown as typeof fetch });
    const result = await service.submitMatchingQuery('CS455', {}, { actorSession: ALEX_SESSION });
    expect(JSON.parse(String(fetchFn.mock.calls[0][1].body)).courseCode).toBe('DB05-CS455');
    expect(result.status).toBe('COMPLETED');
    expect(result.results).toHaveLength(1);
    expect(result.results?.[0].profile.courses[0].code).toBe('DB05-CS455');
  });

  it('moves an unrelated backend candidate into the explicitly labeled alternatives collection', async () => {
    const unrelatedCandidate = { ...API_CANDIDATE, profile: { ...API_CANDIDATE.profile, courses: [{ code: 'DB05-MTH101', name: 'Mathematics I' }] } };
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ data: { queryId: 'course-filter-1', status: 'COMPLETED', recommendations: [unrelatedCandidate], suggestedAlternatives: [], generatedAt: '2026-10-15T00:00:00.000Z' } }),
    });
    const adapter = new HttpAgentAdapter({ fetchFn: fetchFn as unknown as typeof fetch });
    const result = await adapter.submitMatchingQuery('CS455', {}, { actorSession: ALEX_SESSION });
    expect(result.results).toEqual([]);
    expect(result.suggestedAlternatives).toHaveLength(1);
  });

  it('keeps broader outage candidates out of exact course results', async () => {
    const service = new MockStudyService();
    const broadCandidates = await service.listStudyPartners(undefined, { actorSession: ALEX_SESSION });
    const listSpy = vi.spyOn(service, 'listStudyPartners').mockImplementation(async (filters) =>
      filters?.courseCode ? [] : broadCandidates
    );
    scenarioManager.setScenario({ forceAgentFallback: true });
    const result = await service.submitMatchingQuery('NO_MATCH_COURSE', {}, { actorSession: ALEX_SESSION });
    expect(listSpy).toHaveBeenCalledWith({ courseCode: 'NO_MATCH_COURSE' }, expect.anything());
    expect(result.status).toBe('FALLBACK');
    expect(result.results).toEqual([]);
    expect(result.suggestedAlternatives?.length).toBeGreaterThan(0);
    expect(result.suggestedAlternatives?.every((candidate) =>
      !candidate.profile.courses.some((course) => course.code === 'NO_MATCH_COURSE')
    )).toBe(true);
  });

  it('wires only the live agent operation into production study services', async () => {
    const fetchFn = vi.fn();
    const originalFetch = Object.getOwnPropertyDescriptor(window, 'fetch');
    Object.defineProperty(window, 'fetch', { configurable: true, value: fetchFn });
    try {
      const services = getAppServices({ isDemoAuthEnabled: false, isLiveBookingEnabled: true });
      const sessionWithoutBearer = { ...ALEX_SESSION, sessionToken: undefined };
      await expect(services.study.submitMatchingQuery('CS455', {}, { actorSession: sessionWithoutBearer }))
        .rejects.toMatchObject({ code: ErrorCode.UNAUTHENTICATED });
      expect(fetchFn).not.toHaveBeenCalled();
      await expect(services.study.listStudyPartners(undefined, { actorSession: ALEX_SESSION }))
        .rejects.toMatchObject({ code: ErrorCode.SERVICE_UNAVAILABLE });
    } finally {
      if (originalFetch) Object.defineProperty(window, 'fetch', originalFetch);
      else delete (window as Partial<Window>).fetch;
    }
  });

  it('sends bearer authentication and maps the approved response fields in the live adapter', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ data: { queryId: 'live-1', status: 'COMPLETED', recommendations: [API_CANDIDATE], suggestedAlternatives: [], generatedAt: '2026-10-15T00:00:00.000Z' } }),
    });
    const adapter = new HttpAgentAdapter({ fetchFn: fetchFn as unknown as typeof fetch });
    const result = await adapter.submitMatchingQuery('CS455', {}, { actorSession: ALEX_SESSION });
    const [, request] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect((request.headers as Record<string, string>).Authorization).toBe('Bearer student-session-token');
    expect(JSON.parse(String(request.body)).courseCode).toBe('DB05-CS455');
    expect(result.results?.[0].profile.preferredTimes).toEqual([]);
    expect(result.results?.[0].compatibilityBreakdown).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('sam.private@iitk.ac.in');
  });

  it('uses a redacted deterministic fallback when the backend is unreachable', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('connection refused'));
    const service = new MockStudyService({ fetchFn: fetchFn as unknown as typeof fetch });

    const result = await service.submitMatchingQuery(
      'DB05-CS455',
      {},
      { actorSession: ALEX_SESSION }
    );

    expect(result.status).toBe('FALLBACK');
    expect(result.fallbackReason).toContain('Deterministic fallback candidate recommendations');
    expect(Array.isArray(result.results)).toBe(true);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('MON_MORNING');
    expect(serialized).not.toContain('rollNumber');
    expect(serialized).not.toContain('email');
  });

  it('does not silently fall back when the backend denies authorization', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { code: 'FORBIDDEN', message: 'Study consent required.' } }),
    });
    const service = new MockStudyService({ fetchFn: fetchFn as unknown as typeof fetch });

    await expect(
      service.submitMatchingQuery('DB05-CS455', {}, { actorSession: ALEX_SESSION })
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });

  it('requires student role and study consent before contacting the agent endpoint', async () => {
    const fetchFn = vi.fn();
    const service = new MockStudyService({ fetchFn: fetchFn as unknown as typeof fetch });

    await expect(
      service.submitMatchingQuery('DB05-CS455', {}, {
        actorSession: { ...ALEX_SESSION, hasStudyConsent: false },
      })
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      service.submitMatchingQuery('DB05-CS455', {}, {
        actorSession: { ...ALEX_SESSION, role: 'ROLE_ADMIN' },
      })
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
