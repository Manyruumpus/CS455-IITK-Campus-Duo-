import {
  IConnectionService,
  IStudyService,
  ServiceContext,
} from '@/services/interfaces';
import {
  AgentMatchResult,
  AppError,
  ConnectionCounts,
  ConnectionDetailView,
  ConnectionMode,
  ConnectionSummaryItem,
  ConnectionViewBucket,
  ErrorCode,
  PeerConnection,
  StudyActionResult,
  StudyConsentRecord,
  StudyDiscoveryFilters,
  StudyRecommendation,
  StudyActionType,
  StudyPreferences,
} from '@/types';
import { HttpAgentAdapter } from './HttpAgentAdapter';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class HttpDiscoveryAdapter implements IStudyService, IConnectionService {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly agent: HttpAgentAdapter;

  constructor(options?: { baseUrl?: string; fetchFn?: typeof fetch }) {
    this.baseUrl = (
      options?.baseUrl ??
      import.meta.env.VITE_API_URL ??
      import.meta.env.VITE_API_BASE_URL ??
      'http://localhost:4000'
    ).replace(/\/+$/, '');
    this.fetchFn =
      options?.fetchFn ??
      (typeof window !== 'undefined' ? window.fetch.bind(window) : globalThis.fetch);
    this.agent = new HttpAgentAdapter({
      baseUrl: this.baseUrl,
      fetchFn: this.fetchFn,
    });
  }

  private requireActor(context: ServiceContext) {
    const actor = context.actorSession;
    if (!actor) throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required.');
    if (!actor.sessionToken) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'A valid authenticated session is required.');
    }
    return actor;
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    context: ServiceContext
  ): Promise<T> {
    const actor = this.requireActor(context);
    const response = await this.fetchFn(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${actor.sessionToken}`,
        ...(init.headers ?? {}),
      },
      signal: context.signal,
    });

    let body: { data?: T; error?: { code?: string; message?: string } } | undefined;
    try {
      body = await response.json();
    } catch {
      throw new AppError(ErrorCode.SERVICE_UNAVAILABLE, 'Backend returned an invalid response.');
    }
    if (!body) {
      throw new AppError(ErrorCode.SERVICE_UNAVAILABLE, 'Backend returned an empty response.');
    }
    if (!response.ok) {
      const code = body.error?.code;
      const mapped = Object.values(ErrorCode).includes(code as never)
        ? (code as typeof ErrorCode[keyof typeof ErrorCode])
        : response.status === 401
          ? ErrorCode.UNAUTHENTICATED
          : response.status === 403
            ? ErrorCode.FORBIDDEN
            : response.status === 409
              ? ErrorCode.CONFLICT
              : ErrorCode.SERVICE_UNAVAILABLE;
      throw new AppError(mapped, body.error?.message ?? 'Discovery request failed.', {
        isTransient: response.status >= 500,
      });
    }
    return body.data as T;
  }

  async getStudyConsent(context: ServiceContext): Promise<StudyConsentRecord> {
    return this.getConsent('STUDY', context);
  }

  async updateStudyConsent(
    _optIn: boolean,
    _context: ServiceContext
  ): Promise<StudyConsentRecord> {
    return this.updateConsent('STUDY', _optIn, _context);
  }

  async getSocialConsent(context: ServiceContext) {
    return this.getConsent('SOCIAL', context);
  }

  async updateSocialConsent(optIn: boolean, context: ServiceContext) {
    return this.updateConsent('SOCIAL', optIn, context);
  }

  private async getConsent(mode: 'STUDY' | 'SOCIAL', context: ServiceContext) {
    const profile = await this.request<{
      studyConsent?: StudyConsentRecord;
      socialConsent?: { hasConsent: boolean; consentedAt?: string };
    }>('/api/profile/me', { method: 'GET' }, context);
    return mode === 'STUDY'
      ? profile.studyConsent ?? { hasConsent: false }
      : profile.socialConsent ?? { hasConsent: false };
  }

  private async updateConsent(
    mode: 'STUDY' | 'SOCIAL',
    hasConsent: boolean,
    context: ServiceContext
  ) {
    return this.request<{ hasConsent: boolean; consentedAt?: string }>(
      `/api/profile/consent/${mode}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hasConsent }),
      },
      context
    );
  }

  async listStudyPartners(
    options: StudyDiscoveryFilters | undefined,
    context: ServiceContext
  ): Promise<StudyRecommendation[]> {
    const actor = this.requireActor(context);
    if (!actor.hasStudyConsent) return [];
    const courseCode = options?.courseCode && options.courseCode !== 'ALL'
      ? options.courseCode
      : 'ALL';
    const result = await this.agent.submitMatchingQuery(
      courseCode,
      { studyGoals: options?.search },
      context
    );
    return result.results ?? [];
  }

  async getStudyPartner(
    targetStudentId: string,
    context: ServiceContext
  ): Promise<StudyRecommendation | null> {
    const candidates = await this.listStudyPartners(undefined, context);
    return candidates.find((candidate) => candidate.profile.userId === targetStudentId) ?? null;
  }

  async recordStudyAction(
    targetStudentId: string,
    action: StudyActionType,
    context: ServiceContext
  ): Promise<StudyActionResult> {
    if (!UUID_REGEX.test(targetStudentId)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Target student ID must be a UUID.');
    }
    const result = await this.request<{
      targetUserId: string;
      actionType: StudyActionType;
      relationshipStatus: StudyActionResult['relationshipStatus'];
      actionId: string;
    }>(
      '/api/discovery/actions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: targetStudentId,
          mode: 'STUDY',
          actionType: action,
        }),
      },
      context
    );
    return {
      targetStudentId: result.targetUserId,
      action,
      relationshipStatus: result.relationshipStatus,
      recordedAt: new Date().toISOString(),
    };
  }

  async submitMatchingQuery(
    courseCode: string,
    preferences: Partial<StudyPreferences>,
    context: ServiceContext
  ): Promise<AgentMatchResult> {
    return this.agent.submitMatchingQuery(courseCode || 'ALL', preferences, context);
  }

  async getMatchingStatus(
    _queryId: string,
    _context: ServiceContext
  ): Promise<AgentMatchResult> {
    throw new AppError(ErrorCode.NOT_FOUND, 'Matching results are returned synchronously.');
  }

  async resetDiscoveryRound(_context: ServiceContext): Promise<void> {
    // PASS/HIDE persistence is server-owned; there is no destructive reset endpoint.
  }

  async sendConnectionRequest(
    targetStudentId: string,
    mode: ConnectionMode,
    _note: string | undefined,
    context: ServiceContext
  ): Promise<PeerConnection> {
    await this.request(
      '/api/discovery/actions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: targetStudentId,
          mode,
          actionType: 'LIKE',
        }),
      },
      context
    );
    const connections = await this.listConnections(mode, context);
    const connection = connections.find(
      (item) =>
        item.studentAId === targetStudentId ||
        item.studentBId === targetStudentId
    );
    if (!connection) {
      throw new AppError(ErrorCode.SERVICE_UNAVAILABLE, 'Connection response was not available.');
    }
    return connection;
  }

  async listConnections(
    mode: ConnectionMode,
    context: ServiceContext
  ): Promise<PeerConnection[]> {
    const actor = this.requireActor(context);
    const summaries = await this.request<Array<{
      connectionId: string;
      peerId: string;
      mode: ConnectionMode;
      status: PeerConnection['status'];
      createdAt: string;
      updatedAt: string;
    }>>(`/api/discovery/connections?mode=${mode}`, { method: 'GET' }, context);
    return summaries.map((item) => ({
      connectionId: item.connectionId,
      studentAId: actor.userId,
      studentBId: item.peerId,
      mode: item.mode,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }

  async getConnection(
    connectionId: string,
    context: ServiceContext
  ): Promise<PeerConnection> {
    const connections = await this.listConnections('STUDY', context);
    const connection = connections.find((item) => item.connectionId === connectionId);
    if (!connection) throw new AppError(ErrorCode.NOT_FOUND, 'Connection not found.');
    return connection;
  }

  async listConnectionSummaries(
    mode: ConnectionMode,
    bucket: ConnectionViewBucket | 'ALL',
    context: ServiceContext
  ): Promise<ConnectionSummaryItem[]> {
    const connections = await this.listConnections(mode, context);
    return connections
      .filter((connection) => bucket === 'ALL' || (connection.status === 'MUTUAL_CONNECTED' ? bucket === 'MUTUAL' : bucket === 'OUTGOING'))
      .map((connection) => ({
        connectionId: connection.connectionId,
        mode,
        peerId: connection.studentBId,
        peerDisplayName: 'Study Partner',
        peerInterests: [],
        peerCourses: [],
        bucket: connection.status === 'MUTUAL_CONNECTED' ? 'MUTUAL' : 'OUTGOING',
        isRestricted: false,
        isStudyBookingEligible: mode === 'STUDY' && connection.status === 'MUTUAL_CONNECTED',
        createdAt: connection.createdAt,
        updatedAt: connection.updatedAt,
      }));
  }

  async getConnectionDetail(
    connectionId: string,
    context: ServiceContext
  ): Promise<ConnectionDetailView> {
    const connection = await this.getConnection(connectionId, context);
    return {
      connectionId: connection.connectionId,
      mode: connection.mode,
      peerId: connection.studentBId,
      peerDisplayName: 'Study Partner',
      peerInterests: [],
      peerCourses: [],
      relationshipStatus: connection.status,
      isRestricted: false,
      visibilityPolicy: 'MUTUAL_ONLY',
      isStudyBookingEligible: connection.mode === 'STUDY' && connection.status === 'MUTUAL_CONNECTED',
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
    };
  }

  async getConnectionCounts(
    mode: ConnectionMode,
    context: ServiceContext
  ): Promise<ConnectionCounts> {
    const summaries = await this.listConnectionSummaries(mode, 'ALL', context);
    return summaries.reduce(
      (counts, summary) => {
        counts[summary.bucket === 'MUTUAL' ? 'mutual' : summary.bucket === 'INCOMING' ? 'incoming' : 'outgoing'] += 1;
        return counts;
      },
      { outgoing: 0, incoming: 0, mutual: 0 }
    );
  }

  async resetDemoState(_context: ServiceContext): Promise<void> {
    throw new AppError(ErrorCode.SERVICE_UNAVAILABLE, 'Demo reset is only available for mock services.');
  }
}
