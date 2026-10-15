import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockStudyService, MockConnectionService } from '@/services/mock/MockStudySocialServices';
import { mockStore } from '@/mocks/store';
import { ServiceContext } from '@/services/interfaces';
import { UserSession } from '@/types';

describe('Live Discovery & Reciprocal Mutual Connection Suite (FR-05 & KAN-32)', () => {
  const ALEX_SESSION: UserSession = {
    userId: 'usr-student-alex',
    email: 'alex.rivera@iitk.ac.in',
    name: 'Alex Rivera',
    rollNumber: '200001',
    role: 'ROLE_STUDENT',
    isOnboarded: true,
    hasStudyConsent: true,
    hasSocialConsent: false,
  };

  const SAM_SESSION: UserSession = {
    userId: 'usr-student-sam',
    email: 'sam.chen@iitk.ac.in',
    name: 'Sam Chen',
    rollNumber: '200002',
    role: 'ROLE_STUDENT',
    isOnboarded: true,
    hasStudyConsent: true,
    hasSocialConsent: false,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockStore.reset();
    mockStore.connections.clear();
    mockStore.studyLikes.clear();
  });

  it('records reciprocal likes and establishes exactly one active mutual STUDY connection', async () => {
    const studyService = new MockStudyService();
    const connectionService = new MockConnectionService();

    const alexContext: ServiceContext = {
      actorSession: ALEX_SESSION,
    };
    const samContext: ServiceContext = {
      actorSession: SAM_SESSION,
    };

    // Step 1: Alex sends LIKE to Sam
    const firstLike = await studyService.recordStudyAction(
      'usr-student-sam',
      'LIKE',
      alexContext
    );
    expect(firstLike.action).toBe('LIKE');
    expect(firstLike.relationshipStatus).toBe('PENDING_SENT');

    // Alex's view: 1 outgoing connection, 0 mutual connections
    const alexOutgoing = await connectionService.listConnectionSummaries('STUDY', 'OUTGOING', alexContext);
    expect(alexOutgoing.length).toBe(1);
    expect(alexOutgoing[0].peerId).toBe('usr-student-sam');
    expect(alexOutgoing[0].isStudyBookingEligible).toBe(false);

    const alexMutualBefore = await connectionService.listConnectionSummaries('STUDY', 'MUTUAL', alexContext);
    expect(alexMutualBefore.length).toBe(0);

    // Step 2: Sam sends reciprocal LIKE to Alex
    const reciprocalLike = await studyService.recordStudyAction(
      'usr-student-alex',
      'LIKE',
      samContext
    );
    expect(reciprocalLike.action).toBe('LIKE');
    expect(reciprocalLike.relationshipStatus).toBe('MUTUAL_CONNECTED');

    // Step 3: Now both Alex and Sam observe the active mutual connection
    const alexMutualAfter = await connectionService.listConnectionSummaries('STUDY', 'MUTUAL', alexContext);
    expect(alexMutualAfter.length).toBe(1);
    expect(alexMutualAfter[0].peerId).toBe('usr-student-sam');
    expect(alexMutualAfter[0].isStudyBookingEligible).toBe(true);

    const samMutualAfter = await connectionService.listConnectionSummaries('STUDY', 'MUTUAL', samContext);
    expect(samMutualAfter.length).toBe(1);
    expect(samMutualAfter[0].peerId).toBe('usr-student-alex');
    expect(samMutualAfter[0].isStudyBookingEligible).toBe(true);
  });

  it('dispatches to live backend API when live mode is active', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          actionId: '00000000-0000-0000-0000-00000000e001',
          actorStudentId: '00000000-0000-0000-0000-00000000d501',
          targetStudentId: '00000000-0000-0000-0000-00000000d502',
          mode: 'STUDY',
          actionType: 'LIKE',
          relationshipStatus: 'MUTUAL_CONNECTED',
          connectionId: '00000000-0000-0000-0000-00000000d561',
          createdAt: new Date().toISOString(),
        },
      }),
    });
    globalThis.fetch = mockFetch as any;

    const studyService = new MockStudyService();
    const alexContext: ServiceContext = {
      actorSession: {
        ...ALEX_SESSION,
        sessionToken: 'test-alex-token-abc',
      },
    };

    // Simulate VITE_USE_LIVE_BOOKING active
    const originalEnv = import.meta.env.VITE_USE_LIVE_BOOKING;
    (import.meta.env as any).VITE_USE_LIVE_BOOKING = 'true';

    try {
      const result = await studyService.recordStudyAction('usr-student-sam', 'LIKE', alexContext);
      expect(result.action).toBe('LIKE');
      expect(result.relationshipStatus).toBe('MUTUAL_CONNECTED');

      // Verify the live backend was invoked with UUID translation and auth headers
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/discovery/actions'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Campus-Duo-Test-Actor': '00000000-0000-0000-0000-00000000D501',
            Authorization: 'Bearer test-alex-token-abc',
          }),
          body: JSON.stringify({
            targetStudentId: '00000000-0000-0000-0000-00000000D502',
            mode: 'STUDY',
            action: 'LIKE',
          }),
        })
      );
    } finally {
      (import.meta.env as any).VITE_USE_LIVE_BOOKING = originalEnv;
    }
  });
});
