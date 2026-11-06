import { IProfileService, ServiceContext } from '../interfaces';
import { mockStore } from '@/mocks/store';
import {
  PrivateUserProfile,
  PublicStudyProfile,
  PublicSocialProfile,
  ProfileUpdateRequest,
  StudentOnboardingRequest,
  SelfPreviewResult,
  AppError,
  ErrorCode,
} from '@/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEMO_USER_MAP: Record<string, string> = {
  'usr-student-alex': '00000000-0000-0000-0000-00000000D501',
  'usr-student-sam': '00000000-0000-0000-0000-00000000D502',
  'usr-student-jordan': '00000000-0000-0000-0000-00000000D503',
  'usr-admin-senate': '00000000-0000-0000-0000-00000000D599',
};

function resolveUserId(id: string): string {
  if (UUID_REGEX.test(id)) return id;
  return DEMO_USER_MAP[id] || id;
}

export interface HttpProfileAdapterOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

export class HttpProfileAdapter implements IProfileService {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options?: HttpProfileAdapterOptions) {
    const rawBaseUrl =
      options?.baseUrl ??
      import.meta.env.VITE_API_URL ??
      import.meta.env.VITE_API_BASE_URL ??
      'http://localhost:4000';
    this.baseUrl = rawBaseUrl.replace(/\/+$/, '');
    this.fetchFn =
      options?.fetchFn ??
      (typeof window !== 'undefined' ? window.fetch.bind(window) : globalThis.fetch);
  }

  private getAuthHeaders(context: ServiceContext, extraHeaders?: Record<string, string>): Record<string, string> {
    const actor = context.actorSession;
    if (!actor || !actor.userId) {
      throw new AppError(
        ErrorCode.UNAUTHENTICATED,
        'Authentication required: missing active user session.'
      );
    }

    const actorId = resolveUserId(actor.userId);
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Campus-Duo-Test-Actor': actorId,
      ...extraHeaders,
    };
    if (actor.sessionToken) {
      headers['Authorization'] = `Bearer ${actor.sessionToken}`;
    }
    return headers;
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    if (res.ok) {
      const body = await res.json();
      return (body && typeof body === 'object' && 'data' in body ? body.data : body) as T;
    }

    let errorBody: any;
    try {
      errorBody = await res.json();
    } catch {
      // Ignore JSON parse errors for non-JSON responses
    }

    const code = errorBody?.error?.code;
    const message = errorBody?.error?.message || `Profile request failed with status ${res.status}`;

    if (res.status === 401 || code === 'UNAUTHENTICATED') {
      throw new AppError(ErrorCode.UNAUTHENTICATED, message);
    }
    if (res.status === 403 || code === 'FORBIDDEN') {
      throw new AppError(ErrorCode.FORBIDDEN, message);
    }
    if (res.status === 404 || code === 'NOT_FOUND') {
      throw new AppError(ErrorCode.NOT_FOUND, message);
    }
    if (res.status === 400 || code === 'VALIDATION_ERROR') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, message);
    }
    if (res.status === 409 || code === 'CONFLICT') {
      throw new AppError(ErrorCode.CONFLICT, message);
    }

    throw new AppError(ErrorCode.SERVICE_UNAVAILABLE, message);
  }

  public async getPrivateProfile(context: ServiceContext): Promise<PrivateUserProfile> {
    const headers = this.getAuthHeaders(context);
    const res = await this.fetchFn(`${this.baseUrl}/api/profile/me`, {
      method: 'GET',
      headers,
      signal: context.signal,
    });
    const profile = await this.handleResponse<PrivateUserProfile>(res);
    if (context.actorSession?.userId && profile) {
      mockStore.privateProfiles.set(context.actorSession.userId, profile);
    }
    return profile;
  }

  public async updatePrivateProfile(
    request: ProfileUpdateRequest,
    context: ServiceContext
  ): Promise<PrivateUserProfile> {
    const headers = this.getAuthHeaders(context);
    const res = await this.fetchFn(`${this.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(request),
      signal: context.signal,
    });
    const profile = await this.handleResponse<PrivateUserProfile>(res);
    if (context.actorSession?.userId && profile) {
      mockStore.privateProfiles.set(context.actorSession.userId, profile);
    }
    return profile;
  }

  public async completeOnboarding(
    request: StudentOnboardingRequest,
    context: ServiceContext
  ): Promise<PrivateUserProfile> {
    const profileUpdate: ProfileUpdateRequest = {
      displayName: request.displayName,
      studyPreferences: request.studyPreferences,
      courses: request.courses,
      socialBio: request.socialBio,
      socialInterests: request.socialInterests,
    };
    return this.updatePrivateProfile(profileUpdate, context);
  }

  public async getPublicStudyProfile(
    targetUserId: string,
    context: ServiceContext
  ): Promise<PublicStudyProfile> {
    const actor = context.actorSession;
    if (actor && (targetUserId === actor.userId || resolveUserId(targetUserId) === resolveUserId(actor.userId))) {
      const preview = await this.getSelfStudyPreview(context);
      return preview.profile;
    }

    try {
      const headers = this.getAuthHeaders(context);
      const res = await this.fetchFn(`${this.baseUrl}/api/discovery/study/${targetUserId}`, {
        method: 'GET',
        headers,
        signal: context.signal,
      });
      if (res.ok) {
        return this.handleResponse<PublicStudyProfile>(res);
      }
    } catch {
      // fallback
    }

    return {
      userId: targetUserId,
      displayName: 'Peer Student',
      department: 'Engineering',
      degree: 'B.Tech',
      year: 4,
      courses: [],
      studyStyle: 'QUIET_FOCUSED',
      preferredPace: 'STANDARD_REGULAR',
      preferredTimes: [],
      activeStatus: 'LOOKING',
    };
  }

  public async getSelfStudyPreview(
    context: ServiceContext
  ): Promise<SelfPreviewResult<PublicStudyProfile>> {
    const privateProfile = await this.getPrivateProfile(context);
    const hasConsent = Boolean(privateProfile.studyConsent?.hasConsent);

    return {
      profile: {
        userId: privateProfile.userId,
        displayName: privateProfile.displayName,
        department: privateProfile.department,
        degree: privateProfile.degree,
        year: privateProfile.year,
        courses: privateProfile.courses || [],
        studyStyle: privateProfile.studyPreferences?.studyStyle ?? 'QUIET_FOCUSED',
        preferredPace: privateProfile.studyPreferences?.preferredPace ?? 'STANDARD_REGULAR',
        preferredTimes: privateProfile.studyPreferences?.preferredTimes ?? [],
        activeStatus: hasConsent ? 'LOOKING' : 'UNAVAILABLE',
      },
      isDiscoverable: hasConsent,
      previewNotice: !hasConsent ? 'Study discovery is disabled.' : undefined,
    };
  }

  public async getSelfSocialPreview(
    context: ServiceContext
  ): Promise<SelfPreviewResult<PublicSocialProfile>> {
    const privateProfile = await this.getPrivateProfile(context);
    const hasConsent = Boolean(privateProfile.socialConsent?.hasConsent);

    return {
      profile: {
        userId: privateProfile.userId,
        displayName: privateProfile.displayName,
        bio: privateProfile.socialBio ?? '',
        interests: privateProfile.socialInterests ?? [],
      },
      isDiscoverable: hasConsent,
      previewNotice: !hasConsent ? 'Social discovery is disabled.' : undefined,
    };
  }
}
