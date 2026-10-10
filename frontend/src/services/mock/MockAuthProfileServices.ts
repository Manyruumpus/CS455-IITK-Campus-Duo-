import { IAuthService, IProfileService, ServiceContext } from '@/services/interfaces';
import {
  UserSession,
  UserRole,
  PrivateUserProfile,
  PublicStudyProfile,
  PublicSocialProfile,
  ProfileUpdateRequest,
  StudentOnboardingRequest,
  SelfPreviewResult,
  AppError,
  ErrorCode,
} from '@/types';
import { mockStore } from '@/mocks/store';
import { scenarioManager } from '@/mocks/scenarios';

export class MockAuthService implements IAuthService {
  public async getCurrentSession(context?: ServiceContext): Promise<UserSession | null> {
    await scenarioManager.applyScenario(context?.signal);
    if (!context?.actorSession) return null;
    return mockStore.sessions.get(context.actorSession.userId) ?? context.actorSession;
  }

  public async loginWithDemoRole(
    role: UserRole,
    context?: ServiceContext
  ): Promise<UserSession> {
    await scenarioManager.applyScenario(context?.signal);

    if (role === 'ROLE_ADMIN') {
      const adminSession = mockStore.sessions.get('admin');
      if (!adminSession) throw new AppError(ErrorCode.NOT_FOUND, 'Admin session not found');
      return { ...adminSession };
    }
    const studentSession = mockStore.sessions.get('alex');
    if (!studentSession) throw new AppError(ErrorCode.NOT_FOUND, 'Student session not found');
    return { ...studentSession };
  }

  public async logout(context?: ServiceContext): Promise<void> {
    await scenarioManager.applyScenario(context?.signal);
  }

  public async refreshToken(context?: ServiceContext): Promise<UserSession> {
    await scenarioManager.applyScenario(context?.signal);
    if (!context?.actorSession) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'No active session to refresh');
    }
    const session = mockStore.sessions.get(context.actorSession.userId);
    return session ? { ...session } : { ...context.actorSession };
  }
}

export class MockProfileService implements IProfileService {
  public async getPrivateProfile(context: ServiceContext): Promise<PrivateUserProfile> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to view private profile');
    }

    if (actor.role === 'ROLE_ADMIN') {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Administrative role cannot access private student profile data directly'
      );
    }

    let profile = mockStore.privateProfiles.get(actor.userId);
    if (!profile) {
      // Fallback for synthetic student in demo store
      profile = {
        userId: actor.userId,
        email: actor.email,
        rollNumber: actor.rollNumber ?? '210000',
        displayName: actor.name,
        department: 'Engineering',
        degree: 'B.Tech',
        year: 4,
        isOnboarded: actor.isOnboarded,
        courses: [],
        studyPreferences: {
          preferredTimes: [],
        },
        studyConsent: { hasConsent: actor.hasStudyConsent },
        socialConsent: { hasConsent: actor.hasSocialConsent },
      };
      mockStore.privateProfiles.set(actor.userId, profile);
    }

    return { ...profile };
  }

  public async updatePrivateProfile(
    request: ProfileUpdateRequest,
    context: ServiceContext
  ): Promise<PrivateUserProfile> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to update profile');
    }

    if (actor.role === 'ROLE_ADMIN') {
      throw new AppError(ErrorCode.FORBIDDEN, 'Administrators cannot modify student profiles');
    }

    // Reject attempts to change protected fields (Amendment 1)
    const rawReq = request as Record<string, unknown>;
    const protectedFields = [
      'userId',
      'email',
      'rollNumber',
      'department',
      'degree',
      'year',
      'isOnboarded',
      'role',
      'studyConsent',
      'socialConsent',
    ];
    for (const field of protectedFields) {
      if (rawReq[field] !== undefined) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          `Cannot modify protected identity or metadata field '${field}'. Identity fields are read-only demo fixtures.`
        );
      }
    }

    const existing = await this.getPrivateProfile(context);

    // Explicit editable-field projection (Amendment 1)
    const updated: PrivateUserProfile = {
      ...existing,
      displayName: request.displayName !== undefined ? request.displayName.trim() : existing.displayName,
      courses: request.courses !== undefined ? request.courses : existing.courses,
      studyPreferences: request.studyPreferences !== undefined
        ? {
            ...existing.studyPreferences,
            ...request.studyPreferences,
            preferredTimes: request.studyPreferences.preferredTimes !== undefined
              ? request.studyPreferences.preferredTimes
              : existing.studyPreferences.preferredTimes,
          }
        : existing.studyPreferences,
      socialBio: request.socialBio !== undefined ? request.socialBio : existing.socialBio,
      socialInterests: request.socialInterests !== undefined ? request.socialInterests : existing.socialInterests,
    };

    mockStore.privateProfiles.set(actor.userId, updated);

    // Sync public study profile if active
    if (updated.studyConsent.hasConsent) {
      mockStore.publicStudyProfiles.set(actor.userId, {
        userId: actor.userId,
        displayName: updated.displayName,
        department: updated.department,
        degree: updated.degree,
        year: updated.year,
        courses: updated.courses,
        studyStyle: updated.studyPreferences.studyStyle ?? 'QUIET_FOCUSED',
        preferredPace: updated.studyPreferences.preferredPace ?? 'STANDARD_REGULAR',
        preferredTimes: updated.studyPreferences.preferredTimes,
        activeStatus: 'LOOKING',
      });
    }

    // Sync public social profile if active
    if (updated.socialConsent.hasConsent) {
      mockStore.publicSocialProfiles.set(actor.userId, {
        userId: actor.userId,
        displayName: updated.displayName,
        bio: updated.socialBio ?? '',
        interests: updated.socialInterests ?? [],
      });
    }

    return { ...updated };
  }

  public async completeOnboarding(
    request: StudentOnboardingRequest,
    context: ServiceContext
  ): Promise<PrivateUserProfile> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to complete onboarding');
    }

    if (actor.role === 'ROLE_ADMIN') {
      throw new AppError(ErrorCode.FORBIDDEN, 'Administrator users do not participate in student onboarding');
    }

    // Reject attempts to alter protected fields
    const rawReq = request as unknown as Record<string, unknown>;
    const protectedFields = ['userId', 'email', 'rollNumber', 'department', 'degree', 'year', 'role'];
    for (const field of protectedFields) {
      if (rawReq[field] !== undefined) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          `Cannot modify protected identity field '${field}' during onboarding.`
        );
      }
    }

    // Amendment 2: Validate mode selection and explicit consent consistency
    if (request.modesSelected === 'STUDY' && (!request.studyConsent || request.socialConsent)) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Mode selection and consent toggles must match: Study mode requires study consent enabled and social consent disabled.'
      );
    }
    if (request.modesSelected === 'SOCIAL' && (!request.socialConsent || request.studyConsent)) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Mode selection and consent toggles must match: Social mode requires social consent enabled and study consent disabled.'
      );
    }
    if (request.modesSelected === 'BOTH' && (!request.studyConsent || !request.socialConsent)) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Mode selection and consent toggles must match: Both mode requires both study and social discovery consent enabled.'
      );
    }
    if (request.modesSelected === 'NEITHER' && (request.studyConsent || request.socialConsent)) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Mode selection and consent toggles must match: Neither mode requires both discovery consents disabled.'
      );
    }

    // Amendment 2: Required study-discovery inputs
    if (request.studyConsent) {
      if (!request.courses || request.courses.length === 0) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'At least one course/topic is required when academic study discovery is enabled.'
        );
      }
      if (!request.studyPreferences?.preferredTimes || request.studyPreferences.preferredTimes.length === 0) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Valid, non-empty study availability is required when academic study discovery is enabled.'
        );
      }
    }

    // Transactional Mock Save: All validations passed before touching store (Amendment 3)
    const existing = await this.getPrivateProfile(context);
    const nowIso = mockStore.getDemoClock();

    const savedProfile: PrivateUserProfile = {
      ...existing,
      displayName: request.displayName ? request.displayName.trim() : existing.displayName,
      courses: request.courses ?? existing.courses,
      studyPreferences: {
        ...existing.studyPreferences,
        studyStyle: request.studyPreferences?.studyStyle ?? existing.studyPreferences.studyStyle,
        preferredPace: request.studyPreferences?.preferredPace ?? existing.studyPreferences.preferredPace,
        preferredTimes: request.studyPreferences?.preferredTimes ?? existing.studyPreferences.preferredTimes,
        studyGoals: request.studyPreferences?.studyGoals ?? existing.studyPreferences.studyGoals,
        preferredLocation: request.studyPreferences?.preferredLocation ?? existing.studyPreferences.preferredLocation,
      },
      socialBio: request.socialBio ?? existing.socialBio,
      socialInterests: request.socialInterests ?? existing.socialInterests,
      studyConsent: {
        hasConsent: request.studyConsent,
        consentedAt: request.studyConsent ? nowIso : undefined,
      },
      socialConsent: {
        hasConsent: request.socialConsent,
        consentedAt: request.socialConsent ? nowIso : undefined,
      },
      isOnboarded: true,
    };

    // Update store atomically
    mockStore.privateProfiles.set(actor.userId, savedProfile);

    // Synchronize session state from saved result (Amendment 3)
    const existingSession = mockStore.sessions.get(actor.userId) ?? actor;
    mockStore.sessions.set(actor.userId, {
      ...existingSession,
      isOnboarded: true,
      hasStudyConsent: request.studyConsent,
      hasSocialConsent: request.socialConsent,
    });

    // Public discovery projection updates
    if (request.studyConsent) {
      mockStore.publicStudyProfiles.set(actor.userId, {
        userId: actor.userId,
        displayName: savedProfile.displayName,
        department: savedProfile.department,
        degree: savedProfile.degree,
        year: savedProfile.year,
        courses: savedProfile.courses,
        studyStyle: savedProfile.studyPreferences.studyStyle ?? 'QUIET_FOCUSED',
        preferredPace: savedProfile.studyPreferences.preferredPace ?? 'STANDARD_REGULAR',
        preferredTimes: savedProfile.studyPreferences.preferredTimes,
        activeStatus: 'LOOKING',
      });
    } else {
      mockStore.publicStudyProfiles.delete(actor.userId);
    }

    if (request.socialConsent) {
      mockStore.publicSocialProfiles.set(actor.userId, {
        userId: actor.userId,
        displayName: savedProfile.displayName,
        bio: savedProfile.socialBio ?? '',
        interests: savedProfile.socialInterests ?? [],
      });
    } else {
      mockStore.publicSocialProfiles.delete(actor.userId);
    }

    return { ...savedProfile };
  }

  public async getPublicStudyProfile(
    targetUserId: string,
    context: ServiceContext
  ): Promise<PublicStudyProfile> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required');
    }

    const profile = mockStore.publicStudyProfiles.get(targetUserId);
    if (!profile || profile.activeStatus === 'UNAVAILABLE') {
      throw new AppError(ErrorCode.NOT_FOUND, `Student study profile ${targetUserId} not found or discovery is disabled`);
    }

    // Public profile strictly returns permission-filtered fields (no email, no rollNumber)
    return { ...profile };
  }

  public async getSelfStudyPreview(
    context: ServiceContext
  ): Promise<SelfPreviewResult<PublicStudyProfile>> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to view preview');
    }

    const privateProfile = await this.getPrivateProfile(context);
    const isDiscoverable = privateProfile.studyConsent.hasConsent;

    const publicStudy: PublicStudyProfile = {
      userId: privateProfile.userId,
      displayName: privateProfile.displayName,
      department: privateProfile.department,
      degree: privateProfile.degree,
      year: privateProfile.year,
      courses: privateProfile.courses,
      studyStyle: privateProfile.studyPreferences.studyStyle ?? 'QUIET_FOCUSED',
      preferredPace: privateProfile.studyPreferences.preferredPace ?? 'STANDARD_REGULAR',
      preferredTimes: privateProfile.studyPreferences.preferredTimes,
      activeStatus: isDiscoverable ? 'LOOKING' : 'UNAVAILABLE',
    };

    return {
      profile: publicStudy,
      isDiscoverable,
      previewNotice: isDiscoverable ? undefined : 'Preview only — not currently discoverable',
    };
  }

  public async getSelfSocialPreview(
    context: ServiceContext
  ): Promise<SelfPreviewResult<PublicSocialProfile>> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to view preview');
    }

    const privateProfile = await this.getPrivateProfile(context);
    const isDiscoverable = privateProfile.socialConsent.hasConsent;

    const publicSocial: PublicSocialProfile = {
      userId: privateProfile.userId,
      displayName: privateProfile.displayName,
      bio: privateProfile.socialBio ?? '',
      interests: privateProfile.socialInterests ?? [],
    };

    return {
      profile: publicSocial,
      isDiscoverable,
      previewNotice: isDiscoverable ? undefined : 'Preview only — not currently discoverable',
    };
  }
}
