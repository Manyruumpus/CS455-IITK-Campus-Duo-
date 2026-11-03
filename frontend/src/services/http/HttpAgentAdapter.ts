import { ServiceContext } from '@/services/interfaces';
import { AgentMatchResult, AppError, AppErrorCode, ErrorCode, StudyPreferences, StudyRecommendation } from '@/types';

interface HttpAgentAdapterOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

interface AgentResponseRecommendation {
  profile?: Record<string, unknown>;
  aiMatchScore?: unknown;
  aiMatchReasons?: unknown;
  dataCompletenessScore?: unknown;
  relationshipStatus?: unknown;
}

export const COURSE_CODE_TO_API: Record<string, string> = {
  CS455: 'DB05-CS455',
  MTH101: 'DB05-MTH101',
};

function matchesRequestedCourse(candidate: StudyRecommendation, requestedCode: string): boolean {
  const normalize = (code: string) => code.replace(/^DB05-/i, '').toLowerCase();
  return candidate.profile.courses.some((course) => normalize(course.code) === normalize(requestedCode));
}

/** HTTP boundary for the read-only AI recommendation endpoint. */
export class HttpAgentAdapter {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options?: HttpAgentAdapterOptions) {
    this.baseUrl = (options?.baseUrl ?? import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
    this.fetchFn = options?.fetchFn ?? (typeof window !== 'undefined' ? window.fetch.bind(window) : globalThis.fetch);
  }

  async submitMatchingQuery(courseCode: string, preferences: Partial<StudyPreferences>, context: ServiceContext): Promise<AgentMatchResult> {
    const actor = context.actorSession;
    if (!actor) throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to request matching');
    if (actor.role !== 'ROLE_STUDENT') throw new AppError(ErrorCode.FORBIDDEN, 'Only students can request study partner recommendations.');
    if (!actor.hasStudyConsent) throw new AppError(ErrorCode.FORBIDDEN, 'Active study consent is required to request recommendations.');
    if (!actor.sessionToken) throw new AppError(ErrorCode.UNAUTHENTICATED, 'A valid authenticated student session is required.');
    if (!/^[A-Z0-9][A-Z0-9_-]{1,39}$/i.test(courseCode)) throw new AppError(ErrorCode.VALIDATION_ERROR, 'A valid course code is required.');

    const controller = new AbortController();
    const forwardAbort = () => controller.abort();
    if (context.signal?.aborted) forwardAbort();
    else context.signal?.addEventListener('abort', forwardAbort, { once: true });
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await this.fetchFn(`${this.baseUrl}/api/agent/recommend`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${actor.sessionToken}` },
        body: JSON.stringify({ courseCode: COURSE_CODE_TO_API[courseCode] ?? courseCode, prompt: preferences.studyGoals?.trim() || undefined }),
        signal: controller.signal,
      });
      let body: any;
      try { body = await response.json(); } catch { throw new AppError(ErrorCode.AGENT_FAILED, 'Agent returned an invalid response.'); }
      if (!response.ok) {
        const known = Object.values(ErrorCode) as AppErrorCode[];
        const code = known.includes(body?.error?.code) ? body.error.code as AppErrorCode : response.status === 401 ? ErrorCode.UNAUTHENTICATED : response.status === 403 ? ErrorCode.FORBIDDEN : response.status === 400 ? ErrorCode.VALIDATION_ERROR : ErrorCode.SERVICE_UNAVAILABLE;
        throw new AppError(code, body?.error?.message || 'Agent recommendation request failed.', { isTransient: response.status >= 500 });
      }
      const data = body?.data;
      if (!data || typeof data.queryId !== 'string' || !['COMPLETED', 'FALLBACK'].includes(data.status) || !Array.isArray(data.recommendations) || !Array.isArray(data.suggestedAlternatives)) {
        throw new AppError(ErrorCode.AGENT_FAILED, 'Agent returned an invalid response.');
      }
      const recommendations = data.recommendations.map((entry: unknown) => this.mapRecommendation(entry));
      const suppliedAlternatives = data.suggestedAlternatives.map((entry: unknown) => this.mapRecommendation(entry));
      const exactMatches = recommendations.filter((entry: StudyRecommendation) => matchesRequestedCourse(entry, courseCode));
      const alternatives = [
        ...recommendations.filter((entry: StudyRecommendation) => !matchesRequestedCourse(entry, courseCode)),
        ...suppliedAlternatives.filter((entry: StudyRecommendation) => !matchesRequestedCourse(entry, courseCode)),
      ];
      return {
        queryId: data.queryId,
        status: data.status,
        results: exactMatches,
        suggestedAlternatives: alternatives,
        fallbackReason: typeof data.fallbackReason === 'string' ? data.fallbackReason : undefined,
        generatedAt: typeof data.generatedAt === 'string' ? data.generatedAt : new Date().toISOString(),
      };
    } catch (error) {
      if (context.signal?.aborted) throw new AppError(ErrorCode.CANCELLED, 'Matching request was cancelled.');
      if (error instanceof AppError) throw error;
      throw new AppError(ErrorCode.SERVICE_UNAVAILABLE, 'Agent recommendation service is unavailable.', { isTransient: true });
    } finally {
      clearTimeout(timeout);
      context.signal?.removeEventListener('abort', forwardAbort);
    }
  }

  private mapRecommendation(value: unknown): StudyRecommendation {
    const item = value as AgentResponseRecommendation;
    const profile = item?.profile;
    if (!profile || typeof profile.userId !== 'string' || typeof profile.displayName !== 'string' || typeof item.aiMatchScore !== 'number' || !Number.isFinite(item.aiMatchScore) || !Array.isArray(item.aiMatchReasons) || !item.aiMatchReasons.every((reason) => typeof reason === 'string')) {
      throw new AppError(ErrorCode.AGENT_FAILED, 'Agent returned an invalid recommendation.');
    }
    const courses = (Array.isArray(profile.courses) ? profile.courses : []).filter((course): course is {code:string; name?:string; department?:string} => Boolean(course && typeof course === 'object' && typeof (course as {code?:unknown}).code === 'string')).map((course) => ({ code: course.code, name: course.name || course.code, department: course.department || (typeof profile.department === 'string' ? profile.department : '') }));
    const scrub = (reason: string) => /overlapping study slots\s*:|compatible availability\s*:/i.test(reason) ? 'Overlapping study availability' : /^(active academic goal|academic goal|goal focus)\s*:/i.test(reason) ? 'Academic goal compatibility' : /^(common preferred location|common study base|preferred base|location)\s*:/i.test(reason) ? 'Study location preference considered' : reason;
    const degrees = ['B.Tech', 'M.Tech', 'PhD', 'BS', 'MSc'];
    return {
      profile: {
        userId: profile.userId, displayName: profile.displayName,
        department: typeof profile.department === 'string' ? profile.department : '',
        degree: degrees.includes(String(profile.degree)) ? profile.degree as StudyRecommendation['profile']['degree'] : 'B.Tech',
        year: typeof profile.year === 'number' ? profile.year : 1, courses,
        studyStyle: typeof profile.studyStyle === 'string' ? profile.studyStyle as StudyRecommendation['profile']['studyStyle'] : 'QUIET_FOCUSED',
        preferredPace: typeof profile.preferredPace === 'string' ? profile.preferredPace as StudyRecommendation['profile']['preferredPace'] : 'STANDARD_REGULAR',
        preferredTimes: [], activeStatus: 'LOOKING',
      },
      aiMatchScore: item.aiMatchScore, aiMatchReasons: (item.aiMatchReasons as string[]).map(scrub),
      dataCompletenessScore: typeof item.dataCompletenessScore === 'number' && Number.isFinite(item.dataCompletenessScore) ? item.dataCompletenessScore : 0.6,
      relationshipStatus: typeof item.relationshipStatus === 'string' ? item.relationshipStatus as StudyRecommendation['relationshipStatus'] : 'NONE',
    };
  }
}
