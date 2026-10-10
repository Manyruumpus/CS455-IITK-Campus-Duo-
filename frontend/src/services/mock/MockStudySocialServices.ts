import {
  IStudyService,
  ISocialService,
  IConnectionService,
  ServiceContext,
} from '@/services/interfaces';
import {
  StudyRecommendation,
  StudyPreferences,
  AgentMatchResult,
  StudyConsentRecord,
  SocialConsentRecord,
  SocialRecommendation,
  ConnectionMode,
  PeerConnection,
  AppError,
  ErrorCode,
  StudyActionType,
  StudyDiscoveryFilters,
  StudyActionResult,
  CompatibilityBreakdown,
  CompatibilityFactorContribution,
  PrivateUserProfile,
  PublicStudyProfile,
  RelationshipStatus,
  ConnectionSummaryItem,
  ConnectionDetailView,
  ConnectionCounts,
  ConnectionViewBucket,
} from '@/types';
import { SocialActionType, SocialActionResult, SocialDiscoveryFilters as SocialFilters } from '@/types/social';
import { mockStore } from '@/mocks/store';
import { scenarioManager } from '@/mocks/scenarios';
import { emitNotification } from './notificationEvents';

/**
 * Deterministic hash generator for stable near-tie rotation within clusters.
 * Scope: Combines actor user ID with candidate user ID to yield a deterministic, stable rotation score.
 */
export function getStableRotationScore(actorId: string, candidateId: string): number {
  const str = `${actorId}:${candidateId}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return hash;
}

export function calculateStudyCompatibility(
  actorProfile: PrivateUserProfile,
  candidateProfile: PublicStudyProfile,
  candidatePrivate?: PrivateUserProfile
): {
  aiMatchScore: number;
  unroundedScore: number;
  aiMatchReasons: string[];
  dataCompletenessScore: number;
  compatibilityBreakdown: CompatibilityBreakdown;
} {
  // Required Factor 1: Course overlap (base weight: 35)
  const actorCourses = (actorProfile.courses || []).map((c) => c.code.trim().toUpperCase());
  const candidateCourses = (candidateProfile.courses || []).map((c) => c.code.trim().toUpperCase());
  const sharedCourses = actorCourses.filter((code) => candidateCourses.includes(code));

  const courseNorm =
    sharedCourses.length > 0
      ? Math.min(1.0, sharedCourses.length / Math.max(1, Math.min(actorCourses.length, candidateCourses.length)))
      : 0;

  // Required Factor 2: Available time overlap (base weight: 25)
  const actorTimes = actorProfile.studyPreferences?.preferredTimes || [];
  const candidateTimes = candidateProfile.preferredTimes || [];
  const sharedTimes = actorTimes.filter((t) => candidateTimes.includes(t));

  const timeNorm =
    sharedTimes.length > 0
      ? Math.min(1.0, sharedTimes.length / Math.max(1, Math.min(actorTimes.length, candidateTimes.length)))
      : 0;

  // Optional Subfactor 3a: Study Style (base weight: 10)
  // Included ONLY when both students provide comparable data; missing data is not penalized as incompatibility
  const actorStyle = actorProfile.studyPreferences?.studyStyle;
  const candidateStyle = candidateProfile.studyStyle;
  const hasStyle = Boolean(actorStyle && candidateStyle);
  let styleNorm = 0;
  if (hasStyle) {
    if (actorStyle === candidateStyle) styleNorm = 1.0;
    else if (actorStyle === 'HYBRID' || candidateStyle === 'HYBRID') styleNorm = 0.8;
    else if (
      (actorStyle === 'QUIET_FOCUSED' && candidateStyle === 'DISCUSSION_HEAVY') ||
      (actorStyle === 'DISCUSSION_HEAVY' && candidateStyle === 'QUIET_FOCUSED')
    )
      styleNorm = 0.3;
    else styleNorm = 0.6;
  }

  // Optional Subfactor 3b: Target Pace (base weight: 10)
  // Included ONLY when both students provide comparable data
  const actorPace = actorProfile.studyPreferences?.preferredPace;
  const candidatePace = candidateProfile.preferredPace;
  const hasPace = Boolean(actorPace && candidatePace);
  let paceNorm = 0;
  if (hasPace) {
    if (actorPace === candidatePace) paceNorm = 1.0;
    else if (
      (actorPace === 'STANDARD_REGULAR' && candidatePace === 'AHEAD_OF_CLASS') ||
      (actorPace === 'AHEAD_OF_CLASS' && candidatePace === 'STANDARD_REGULAR')
    )
      paceNorm = 0.6;
    else paceNorm = 0.3;
  }

  // Optional Factor 4: Preferred Location (base weight: 10)
  const actorLocation = actorProfile.studyPreferences?.preferredLocation?.trim();
  const candidateLocation = candidatePrivate?.studyPreferences?.preferredLocation?.trim();
  const hasLocation = Boolean(actorLocation && candidateLocation);
  let locNorm = 0;
  if (hasLocation) {
    const isLocMatch = actorLocation!.toLowerCase() === candidateLocation!.toLowerCase();
    locNorm = isLocMatch ? 1.0 : 0.4;
  }

  // Optional Factor 5: Study Goals (base weight: 10)
  const actorGoals = actorProfile.studyPreferences?.studyGoals?.trim();
  const candidateGoals = candidatePrivate?.studyPreferences?.studyGoals?.trim();
  const hasGoals = Boolean(actorGoals && candidateGoals);
  const goalsNorm = hasGoals ? 0.8 : 0;

  // Active base weights total and independent completeness definition
  // Minimum valid input completeness is (35 + 25) / 100 = 0.60; complete data is 1.00
  const activeBaseWeightTotal =
    35 + 25 + (hasStyle ? 10 : 0) + (hasPace ? 10 : 0) + (hasLocation ? 10 : 0) + (hasGoals ? 10 : 0);
  const dataCompletenessScore = Number((activeBaseWeightTotal / 100).toFixed(2));

  // Compute effective renormalized weights (each factor scales to sum to 100%)
  const createContribution = (
    name: string,
    baseWeight: number,
    normalizedScore: number,
    explanation: string
  ): CompatibilityFactorContribution => {
    const effectiveWeight = (baseWeight / activeBaseWeightTotal) * 100;
    const weightedScore = Number(((effectiveWeight * normalizedScore)).toFixed(1));
    return {
      name,
      baseWeight,
      effectiveWeight: Number(effectiveWeight.toFixed(1)),
      weight: Math.round(effectiveWeight),
      normalizedScore: Number(normalizedScore.toFixed(2)),
      weightedScore,
      explanation,
    };
  };

  const courseFactor = createContribution(
    'Course Overlap',
    35,
    courseNorm,
    sharedCourses.length > 0
      ? `Shared courses: ${sharedCourses.join(', ')}`
      : 'No shared active enrolled courses'
  );

  const timeFactor = createContribution(
    'Time Availability',
    25,
    timeNorm,
    sharedTimes.length > 0
      ? `Overlapping study slots: ${sharedTimes.map((t) => t.toLowerCase()).join(', ')}`
      : 'No overlapping preferred time windows'
  );

  const styleFactor = hasStyle
    ? createContribution(
        'Study Style',
        10,
        styleNorm,
        `Style: ${candidateStyle!.toLowerCase().replace(/_/g, ' ')}`
      )
    : undefined;

  const paceFactor = hasPace
    ? createContribution(
        'Study Pace',
        10,
        paceNorm,
        `Pace: ${candidatePace!.toLowerCase().replace(/_/g, ' ')}`
      )
    : undefined;

  // Backward-compatible compound paceStyleFactor
  let paceStyleFactor: CompatibilityFactorContribution | undefined;
  if (hasStyle || hasPace) {
    const compoundBase = (hasStyle ? 10 : 0) + (hasPace ? 10 : 0);
    const compoundNorm = hasStyle && hasPace ? (styleNorm + paceNorm) / 2 : hasStyle ? styleNorm : paceNorm;
    paceStyleFactor = createContribution(
      'Pace & Style Alignment',
      compoundBase,
      compoundNorm,
      [
        hasPace ? `Pace: ${candidatePace!.toLowerCase().replace(/_/g, ' ')}` : null,
        hasStyle ? `Style: ${candidateStyle!.toLowerCase().replace(/_/g, ' ')}` : null,
      ]
        .filter(Boolean)
        .join(', ')
    );
  }

  const locationFactor = hasLocation
    ? createContribution(
        'Preferred Location',
        10,
        locNorm,
        actorLocation!.toLowerCase() === candidateLocation!.toLowerCase()
          ? `Common study base: ${candidateLocation}`
          : `Preferred base: ${candidateLocation}`
      )
    : undefined;

  const goalsFactor = hasGoals
    ? createContribution('Study Goals', 10, goalsNorm, `Goal focus: ${candidateGoals}`)
    : undefined;

  // Unrounded continuous score calculation across active factors
  const activeWeightedSum =
    35 * courseNorm +
    25 * timeNorm +
    (hasStyle ? 10 * styleNorm : 0) +
    (hasPace ? 10 * paceNorm : 0) +
    (hasLocation ? 10 * locNorm : 0) +
    (hasGoals ? 10 * goalsNorm : 0);

  const unroundedScore = (activeWeightedSum / activeBaseWeightTotal) * 100;
  const overallScore = Math.min(100, Math.max(0, Math.round(unroundedScore)));

  const omittedFactors: string[] = [];
  if (!hasStyle) omittedFactors.push('Study Style');
  if (!hasPace) omittedFactors.push('Study Pace');
  if (!hasLocation) omittedFactors.push('Preferred Location');
  if (!hasGoals) omittedFactors.push('Study Goals');

  const reasons: string[] = [];
  if (sharedCourses.length > 0) reasons.push(`Enrolled in matching courses: ${sharedCourses.join(', ')}`);
  if (sharedTimes.length > 0) reasons.push(`Compatible availability: ${sharedTimes.map((t) => t.toLowerCase()).join(', ')}`);
  if (hasPace) reasons.push(`Pace: ${candidatePace!.toLowerCase().replace(/_/g, ' ')}`);
  if (hasStyle) reasons.push(`Style: ${candidateStyle!.toLowerCase().replace(/_/g, ' ')}`);
  if (locationFactor) reasons.push(locationFactor.explanation);
  if (goalsFactor) reasons.push(goalsFactor.explanation);

  return {
    aiMatchScore: overallScore,
    unroundedScore,
    aiMatchReasons: reasons,
    dataCompletenessScore,
    compatibilityBreakdown: {
      overallScore,
      courseFactor,
      timeFactor,
      styleFactor,
      paceFactor,
      paceStyleFactor,
      locationFactor,
      goalsFactor,
      omittedFactors,
      activeBaseWeightTotal,
      dataCompletenessScore,
    },
  };
}

interface StoredAgentQuery {
  ownerId: string;
  result: AgentMatchResult;
}

const mockAgentQueries = new Map<string, StoredAgentQuery>();

export class MockStudyService implements IStudyService {
  /** Coordinated reset for all demo state — Stage 07.
   *  Clears the store (sessions, profiles, bookings, connections, study likes,
   *  moderation blocks, notifications, audits, agent queries), social action
   *  maps (pass/hide/likes) and scenario manager state in a single call so UI
   *  and tests can reset deterministically.
   */
  public static resetAllDemoState(): void {
    mockStore.reset();
    MockStudyService.resetQueries();
    MockSocialService.resetActions();
    scenarioManager.reset();
  }

  /** Reset helper for testing */
  public static resetQueries(): void {
    mockAgentQueries.clear();
  }

  public async getStudyConsent(context: ServiceContext): Promise<StudyConsentRecord> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) {
      return { hasConsent: false };
    }
    const profile = mockStore.privateProfiles.get(actor.userId);
    return profile?.studyConsent ?? { hasConsent: actor.hasStudyConsent };
  }

  public async updateStudyConsent(
    optIn: boolean,
    context: ServiceContext
  ): Promise<StudyConsentRecord> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to update study consent');
    }

    const profile = mockStore.privateProfiles.get(actor.userId);
    if (!profile) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Student profile not found');
    }

    if (optIn) {
      // Required study fields validation before enabling
      if (!profile.courses || profile.courses.length === 0) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Cannot enable study discovery without enrolled courses. Complete your course enrollments in Profile first.'
        );
      }
      if (!profile.studyPreferences?.preferredTimes || profile.studyPreferences.preferredTimes.length === 0) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Cannot enable study discovery without valid study availability. Set your preferred study times in Profile first.'
        );
      }

      profile.studyConsent = {
        hasConsent: true,
        consentedAt: mockStore.getDemoClock(),
      };

      // Add to public study discovery pool
      mockStore.publicStudyProfiles.set(actor.userId, {
        userId: actor.userId,
        displayName: profile.displayName,
        department: profile.department,
        degree: profile.degree,
        year: profile.year,
        courses: profile.courses,
        studyStyle: profile.studyPreferences.studyStyle ?? 'QUIET_FOCUSED',
        preferredPace: profile.studyPreferences.preferredPace ?? 'STANDARD_REGULAR',
        preferredTimes: profile.studyPreferences.preferredTimes,
        activeStatus: 'LOOKING',
      });
    } else {
      profile.studyConsent = {
        hasConsent: false,
      };
      // Remove from public study discovery pool
      mockStore.publicStudyProfiles.delete(actor.userId);
    }

    // Synchronize session store
    const session = mockStore.sessions.get(actor.userId);
    if (session) {
      session.hasStudyConsent = optIn;
    }
    actor.hasStudyConsent = optIn;

    return { ...profile.studyConsent };
  }

  public async listStudyPartners(
    options?: StudyDiscoveryFilters,
    context?: ServiceContext
  ): Promise<StudyRecommendation[]> {
    if (context) {
      await scenarioManager.applyScenario(context.signal);
    }
    const actor = context?.actorSession;
    if (!actor) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to view study partners');
    }

    if (!actor.hasStudyConsent) {
      return [];
    }

    const actorProfile = mockStore.privateProfiles.get(actor.userId) ?? {
      userId: actor.userId,
      email: actor.email,
      rollNumber: actor.rollNumber ?? '210000',
      displayName: actor.name,
      department: 'Engineering',
      degree: 'B.Tech' as const,
      year: 4,
      isOnboarded: true,
      courses: [],
      studyPreferences: { preferredTimes: [] },
      studyConsent: { hasConsent: true },
      socialConsent: { hasConsent: false },
    };

    const hiddenSet = mockStore.hiddenStudyPartners.get(actor.userId);
    const passedSet = mockStore.passedStudyPartners.get(actor.userId);

    let candidates = Array.from(mockStore.publicStudyProfiles.values()).filter((p) => {
      // Exclude self
      if (p.userId === actor.userId) return false;
      // Exclude unavailable
      if (p.activeStatus === 'UNAVAILABLE') return false;
      // Exclude hidden within demo store
      if (hiddenSet?.has(p.userId)) return false;
      // Exclude passed in current discovery round
      if (passedSet?.has(p.userId)) return false;
      // Candidate must have active study consent
      const candPrivate = mockStore.privateProfiles.get(p.userId);
      if (candPrivate?.studyConsent && candPrivate.studyConsent.hasConsent === false) return false;
      return true;
    });

    // Apply Filter: Course Code
    if (options?.courseCode && options.courseCode !== 'ALL') {
      const code = options.courseCode.trim().toLowerCase();
      candidates = candidates.filter((p) =>
        p.courses.some((c) => c.code.toLowerCase() === code)
      );
    }

    // Apply Filter: Preferred Time
    if (options?.preferredTime) {
      candidates = candidates.filter((p) =>
        p.preferredTimes.includes(options.preferredTime!)
      );
    }

    // Apply Filter: Study Style
    if (options?.studyStyle) {
      candidates = candidates.filter((p) => p.studyStyle === options.studyStyle);
    }

    // Apply Filter: Preferred Pace
    if (options?.preferredPace) {
      candidates = candidates.filter((p) => p.preferredPace === options.preferredPace);
    }

    // Apply Filter: Text Search
    if (options?.search && options.search.trim().length > 0) {
      const q = options.search.trim().toLowerCase();
      candidates = candidates.filter(
        (p) =>
          p.displayName.toLowerCase().includes(q) ||
          p.department.toLowerCase().includes(q) ||
          p.courses.some((c) => c.code.toLowerCase().includes(q))
      );
    }

    const items = candidates.map((candidateProfile) => {
      const candidatePrivate = mockStore.privateProfiles.get(candidateProfile.userId);
      const compatibility = calculateStudyCompatibility(actorProfile, candidateProfile, candidatePrivate);

      // Resolve relationship status
      const connection = Array.from(mockStore.connections.values()).find(
        (c) =>
          c.mode === 'STUDY' &&
          ((c.studentAId === actor.userId && c.studentBId === candidateProfile.userId) ||
            (c.studentBId === actor.userId && c.studentAId === candidateProfile.userId))
      );

      const relationshipStatus: RelationshipStatus = connection ? connection.status : 'NONE';

      return {
        rec: {
          profile: candidateProfile,
          aiMatchScore: compatibility.aiMatchScore,
          aiMatchReasons: compatibility.aiMatchReasons,
          dataCompletenessScore: compatibility.dataCompletenessScore,
          relationshipStatus,
          compatibilityBreakdown: compatibility.compatibilityBreakdown,
        },
        unroundedScore: compatibility.unroundedScore,
      };
    });

    // Step 1: Initial sort by unrounded score descending, stable tie-break by userId (strictly transitive)
    items.sort((a, b) => {
      if (Math.abs(b.unroundedScore - a.unroundedScore) > 1e-6) {
        return b.unroundedScore - a.unroundedScore;
      }
      return a.rec.profile.userId.localeCompare(b.rec.profile.userId);
    });

    // Step 2: Deterministic clustering anchored to each group's highest score.
    // Group membership within 1.0 point of that anchor.
    const clusters: (typeof items)[] = [];
    let currentCluster: typeof items = [];
    let anchorScore = -1;

    for (const item of items) {
      if (currentCluster.length === 0) {
        currentCluster = [item];
        anchorScore = item.unroundedScore;
      } else {
        if (anchorScore - item.unroundedScore <= 1.0 + 1e-6) {
          currentCluster.push(item);
        } else {
          clusters.push(currentCluster);
          currentCluster = [item];
          anchorScore = item.unroundedScore;
        }
      }
    }
    if (currentCluster.length > 0) {
      clusters.push(currentCluster);
    }

    // Step 3: Within each cluster, sort by:
    // a) availability overlap count, then
    // b) documented stable rotation ordering (hash of actorId:candidateId), then
    // c) stable ID as final fallback
    const sortedRecommendations: StudyRecommendation[] = [];
    for (const cluster of clusters) {
      const isNearTied = cluster.length > 1;
      for (const item of cluster) {
        if (item.rec.compatibilityBreakdown) {
          item.rec.compatibilityBreakdown.isNearTied = isNearTied;
        }
      }

      cluster.sort((a, b) => {
        // Within-group availability overlap count
        const aTimes = a.rec.profile.preferredTimes || [];
        const bTimes = b.rec.profile.preferredTimes || [];
        const actorTimes = actorProfile.studyPreferences?.preferredTimes || [];
        const aTimeOverlap = aTimes.filter((t) => actorTimes.includes(t)).length;
        const bTimeOverlap = bTimes.filter((t) => actorTimes.includes(t)).length;
        if (bTimeOverlap !== aTimeOverlap) {
          return bTimeOverlap - aTimeOverlap;
        }

        // Documented stable seed/rotation ordering
        const aRot = getStableRotationScore(actor.userId, a.rec.profile.userId);
        const bRot = getStableRotationScore(actor.userId, b.rec.profile.userId);
        if (aRot !== bRot) {
          return aRot - bRot;
        }

        // Stable ID as final fallback
        return a.rec.profile.userId.localeCompare(b.rec.profile.userId);
      });

      sortedRecommendations.push(...cluster.map((c) => c.rec));
    }

    return sortedRecommendations;
  }

  public async getStudyPartner(
    targetStudentId: string,
    context: ServiceContext
  ): Promise<StudyRecommendation | null> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to view study partner detail');
    }
    if (!actor.hasStudyConsent) {
      return null;
    }
    // Reject self-lookup
    if (targetStudentId === actor.userId) {
      return null;
    }

    // Candidate must exist in public study profiles and not be unavailable
    const candidateProfile = mockStore.publicStudyProfiles.get(targetStudentId);
    if (!candidateProfile || candidateProfile.activeStatus === 'UNAVAILABLE') {
      return null;
    }

    // Check candidate study consent
    const candidatePrivate = mockStore.privateProfiles.get(targetStudentId);
    if (candidatePrivate?.studyConsent && candidatePrivate.studyConsent.hasConsent === false) {
      return null;
    }

    // Exclude hidden
    const hiddenSet = mockStore.hiddenStudyPartners.get(actor.userId);
    if (hiddenSet?.has(targetStudentId)) {
      return null;
    }

    const actorProfile = mockStore.privateProfiles.get(actor.userId) ?? {
      userId: actor.userId,
      email: actor.email,
      rollNumber: actor.rollNumber ?? '210000',
      displayName: actor.name,
      department: 'Engineering',
      degree: 'B.Tech' as const,
      year: 4,
      isOnboarded: true,
      courses: [],
      studyPreferences: { preferredTimes: [] },
      studyConsent: { hasConsent: true },
      socialConsent: { hasConsent: false },
    };

    const compatibility = calculateStudyCompatibility(actorProfile, candidateProfile, candidatePrivate);

    // Resolve relationship status
    const connection = Array.from(mockStore.connections.values()).find(
      (c) =>
        c.mode === 'STUDY' &&
        ((c.studentAId === actor.userId && c.studentBId === targetStudentId) ||
          (c.studentBId === actor.userId && c.studentAId === targetStudentId))
    );

    return {
      profile: candidateProfile,
      aiMatchScore: compatibility.aiMatchScore,
      aiMatchReasons: compatibility.aiMatchReasons,
      dataCompletenessScore: compatibility.dataCompletenessScore,
      relationshipStatus: connection ? connection.status : 'NONE',
      compatibilityBreakdown: compatibility.compatibilityBreakdown,
    };
  }

  public async recordStudyAction(
    targetStudentId: string,
    action: StudyActionType,
    context: ServiceContext
  ): Promise<StudyActionResult> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to record study action');
    }
    if (!actor.hasStudyConsent) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Study discovery must be enabled to record actions');
    }

    // Reject self-actions
    if (targetStudentId === actor.userId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Cannot perform study action on yourself');
    }

    // Recheck candidate eligibility at mutation time
    const targetPublic = mockStore.publicStudyProfiles.get(targetStudentId);
    if (!targetPublic || targetPublic.activeStatus === 'UNAVAILABLE') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Target student is not eligible for study interactions');
    }
    const targetPrivate = mockStore.privateProfiles.get(targetStudentId);
    if (targetPrivate?.studyConsent && targetPrivate.studyConsent.hasConsent === false) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Target student is not eligible for study interactions');
    }

    const now = mockStore.getCampusLocalDate();

    if (action === 'HIDE') {
      let hidden = mockStore.hiddenStudyPartners.get(actor.userId);
      if (!hidden) {
        hidden = new Set();
        mockStore.hiddenStudyPartners.set(actor.userId, hidden);
      }
      hidden.add(targetStudentId);
      return {
        targetStudentId,
        action: 'HIDE',
        relationshipStatus: 'NONE',
        recordedAt: now,
      };
    }

    if (action === 'PASS') {
      let passed = mockStore.passedStudyPartners.get(actor.userId);
      if (!passed) {
        passed = new Set();
        mockStore.passedStudyPartners.set(actor.userId, passed);
      }
      passed.add(targetStudentId);
      return {
        targetStudentId,
        action: 'PASS',
        relationshipStatus: 'NONE',
        recordedAt: now,
      };
    }

    if (action === 'LIKE') {
      // Recheck if already liked (Idempotent handling: no duplicate connection, no timestamp overwrite)
      let likes = mockStore.studyLikes.get(actor.userId);
      if (!likes) {
        likes = new Set();
        mockStore.studyLikes.set(actor.userId, likes);
      }

      const connectionId = `conn-${[actor.userId, targetStudentId].sort().join('-')}-study`;
      const existingConnection = mockStore.connections.get(connectionId);

      if (likes.has(targetStudentId) && existingConnection) {
        return {
          targetStudentId,
          action: 'LIKE',
          relationshipStatus: existingConnection.status,
          recordedAt: existingConnection.updatedAt || existingConnection.createdAt,
        };
      }

      likes.add(targetStudentId);

      const relationshipStatus = handleConnectionLike(actor.userId, targetStudentId, 'STUDY');

      return {
        targetStudentId,
        action: 'LIKE',
        relationshipStatus,
        recordedAt: now,
      };
    }

    throw new AppError(ErrorCode.VALIDATION_ERROR, `Unsupported study action: ${action}`);
  }

  /**
   * Submit an AI matching query.
   * Grounded results or deterministic fallback are produced on completion.
   */
  public async submitMatchingQuery(
    courseCode: string,
    _preferences: Partial<StudyPreferences>,
    context: ServiceContext
  ): Promise<AgentMatchResult> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to request matching');
    }

    const queryId = `query-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    // Distinct Deterministic Fallback on Agent failure / unavailability
    if (scenarioManager.getScenario().forceAgentFallback) {
      const allRecs = await this.listStudyPartners(undefined, context);
      const fallbackResult: AgentMatchResult = {
        queryId,
        status: 'FALLBACK',
        fallbackReason:
          'Agent recommendation service temporarily unreachable. Deterministic fallback candidate recommendations provided.',
        results: allRecs.slice(0, 2),
        generatedAt: mockStore.getCampusLocalDate(),
      };
      mockAgentQueries.set(queryId, { ownerId: actor.userId, result: fallbackResult });
      return fallbackResult;
    }

    const recommendations = await this.listStudyPartners({ courseCode }, context);
    if (recommendations.length === 0) {
      // Empty exact-match result when no eligible peers match the requested course
      // Broader suggestions returned separately as alternatives with explicit disclaimers
      const allRecs = await this.listStudyPartners(undefined, context);
      const alternatives = allRecs.slice(0, 3).map((rec) => ({
        ...rec,
        aiMatchReasons: [
          `Broader alternative: Peer does NOT satisfy ${courseCode} filter (enrolled in ${rec.profile.courses.map((c) => c.code).join(', ')}).`,
          ...rec.aiMatchReasons.filter((r) => !r.toLowerCase().includes('enrolled in matching courses')),
        ],
      }));

      const emptyExactResult: AgentMatchResult = {
        queryId,
        status: 'COMPLETED',
        results: [], // empty exact-match result
        suggestedAlternatives: alternatives,
        fallbackReason: `No eligible peers currently enrolled in ${courseCode}. Showing broader alternative suggestions.`,
        generatedAt: mockStore.getCampusLocalDate(),
      };
      mockAgentQueries.set(queryId, { ownerId: actor.userId, result: emptyExactResult });
      return emptyExactResult;
    }

    const completedResult: AgentMatchResult = {
      queryId,
      status: 'COMPLETED',
      results: recommendations,
      generatedAt: mockStore.getCampusLocalDate(),
    };
    mockAgentQueries.set(queryId, { ownerId: actor.userId, result: completedResult });
    return completedResult;
  }

  public async getMatchingStatus(
    queryId: string,
    context: ServiceContext
  ): Promise<AgentMatchResult> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to view query status');
    }

    const stored = mockAgentQueries.get(queryId);
    if (!stored) {
      throw new AppError(ErrorCode.NOT_FOUND, `Matching query ${queryId} not found`);
    }

    if (stored.ownerId !== actor.userId) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Private query results belong exclusively to the submitting student.'
      );
    }

    return { ...stored.result };
  }

  public async resetDiscoveryRound(context: ServiceContext): Promise<void> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to reset discovery round');
    }
    mockStore.resetDiscoveryRound(actor.userId);
  }
}

// Actor-scoped, isolated social Pass and Hide sets (separate from study sets)
const socialPassedSet: Map<string, Set<string>> = new Map();
const socialHiddenSet: Map<string, Set<string>> = new Map();

// Actor-scoped social likes tracking (separate from studyLikes on mockStore)
const socialLikes: Map<string, Set<string>> = new Map();

function getSocialPassSet(actorId: string): Set<string> {
  if (!socialPassedSet.has(actorId)) socialPassedSet.set(actorId, new Set());
  return socialPassedSet.get(actorId)!;
}
function getSocialHideSet(actorId: string): Set<string> {
  if (!socialHiddenSet.has(actorId)) socialHiddenSet.set(actorId, new Set());
  return socialHiddenSet.get(actorId)!;
}
function getSocialLikes(actorId: string): Set<string> {
  if (!socialLikes.has(actorId)) socialLikes.set(actorId, new Set());
  return socialLikes.get(actorId)!;
}

/**
 * Blocking/ineligibility rule (Stage 06): a candidate is ineligible for social
 * interaction with the actor when either side has blocked the other.
 * Uses the existing supported moderation block store; no new block machines.
 */
function isSociallyBlocked(actorId: string, candidateId: string): boolean {
  if (mockStore.blockedBy.get(actorId)?.has(candidateId)) return true;
  if (mockStore.blockedBy.get(candidateId)?.has(actorId)) return true;
  return false;
}

/** Derive grounded reasons from stored public data. No fabrication. */
function buildGroundedReasons(
  actorInterests: Array<{ id: string; name: string }>,
  candidateInterests: Array<{ id: string; name: string }>
): string[] {
  const shared = actorInterests
    .filter((ai) => candidateInterests.some((ci) => ci.id === ai.id))
    .map((t) => t.name);
  if (shared.length > 0) {
    return [`Shared interests: ${shared.join(', ')}` ];
  }
  return ['No explicit shared interests identified from public data'];
}

export class MockSocialService implements ISocialService {
  /** Reset helper for testing — clears all per-actor social action state */
  public static resetActions(): void {
    socialPassedSet.clear();
    socialHiddenSet.clear();
    socialLikes.clear();
  }

  public async getSocialConsent(context: ServiceContext): Promise<SocialConsentRecord> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) {
      return { hasConsent: false };
    }
    const profile = mockStore.privateProfiles.get(actor.userId);
    return profile?.socialConsent ?? { hasConsent: actor.hasSocialConsent };
  }

  public async updateSocialConsent(
    optIn: boolean,
    context: ServiceContext
  ): Promise<SocialConsentRecord> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to update consent');
    }

    const profile = mockStore.privateProfiles.get(actor.userId);
    if (!profile) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Student profile not found');
    }

    if (optIn) {
      profile.socialConsent = {
        hasConsent: true,
        consentedAt: mockStore.getDemoClock(),
      };
      mockStore.publicSocialProfiles.set(actor.userId, {
        userId: actor.userId,
        displayName: profile.displayName,
        bio: profile.socialBio ?? '',
        interests: profile.socialInterests ?? [],
      });
    } else {
      profile.socialConsent = {
        hasConsent: false,
      };
      // Remove from public social discovery pool on opt-out
      mockStore.publicSocialProfiles.delete(actor.userId);
    }

    const session = mockStore.sessions.get(actor.userId);
    if (session) {
      session.hasSocialConsent = optIn;
    }
    actor.hasSocialConsent = optIn;

    return { ...profile.socialConsent };
  }

  public async listSocialPeers(
    options: SocialFilters | undefined,
    context: ServiceContext
  ): Promise<SocialRecommendation[]> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required');
    }

    // Enforce actor social consent
    if (!actor.hasSocialConsent) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Social discovery consent is required to view campus peer directory.'
      );
    }

    const passedSet = getSocialPassSet(actor.userId);
    const hiddenSet = getSocialHideSet(actor.userId);
    const actorPrivate = mockStore.privateProfiles.get(actor.userId);
    const actorPublicSocial = mockStore.publicSocialProfiles.get(actor.userId);

    let candidates = Array.from(mockStore.publicSocialProfiles.values()).filter((p) => {
      // Self-exclusion
      if (p.userId === actor.userId) return false;
      // Candidate must have social consent
      const candPrivate = mockStore.privateProfiles.get(p.userId);
      if (candPrivate && !candPrivate.socialConsent?.hasConsent) return false;
      // Pass and Hide exclusions (actor-scoped, mode-isolated)
      if (passedSet.has(p.userId)) return false;
      if (hiddenSet.has(p.userId)) return false;
      // Blocking/ineligibility rule (either direction)
      if (isSociallyBlocked(actor.userId, p.userId)) return false;
      return true;
    });

    // Category filter
    if (options?.category && options.category !== 'ALL') {
      candidates = candidates.filter((p) =>
        p.interests.some((i) => i.category === options.category)
      );
    }

    // Text search filter
    if (options?.search && options.search.trim().length > 0) {
      const q = options.search.trim().toLowerCase();
      candidates = candidates.filter(
        (p) =>
          p.displayName.toLowerCase().includes(q) ||
          p.bio?.toLowerCase().includes(q) ||
          p.interests.some(
            (i) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)
          )
      );
    }

    // Deterministic ordering: by number of shared interests desc, then displayName asc for stable tie-break
    const actorInterests = actorPublicSocial?.interests ?? actorPrivate?.socialInterests ?? [];
    const withScore = candidates.map((p) => {
      const sharedCount = actorInterests.filter((ai) =>
        p.interests.some((pi) => pi.id === ai.id)
      ).length;
      return { profile: p, sharedCount };
    });
    withScore.sort((a, b) => {
      if (b.sharedCount !== a.sharedCount) return b.sharedCount - a.sharedCount;
      return a.profile.displayName.localeCompare(b.profile.displayName);
    });

    return withScore.map(({ profile }) => {
      const connection = Array.from(mockStore.connections.values()).find(
        (c) =>
          c.mode === 'SOCIAL' &&
          ((c.studentAId === actor.userId && c.studentBId === profile.userId) ||
            (c.studentBId === actor.userId && c.studentAId === profile.userId))
      );
      const groundedReasons = buildGroundedReasons(
        actorInterests,
        profile.interests
      );
      return {
        profile,
        // matchScore removed per Stage-06 spec: no numeric social score
        matchScore: 0,
        sharedInterests: actorInterests
          .filter((ai) => profile.interests.some((pi) => pi.id === ai.id))
          .map((t) => t.name),
        groundedReasons,
        relationshipStatus: (connection ? connection.status : 'NONE') as RelationshipStatus,
      };
    });
  }

  public async getSocialPeer(
    targetStudentId: string,
    context: ServiceContext
  ): Promise<SocialRecommendation | null> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required');
    }

    // Enforce actor social consent even for direct detail URL access
    if (!actor.hasSocialConsent) {
      return null;
    }

    // Self-exclusion
    if (targetStudentId === actor.userId) return null;

    // Candidate must have social consent and be in public pool
    const profile = mockStore.publicSocialProfiles.get(targetStudentId);
    if (!profile) return null;
    const candidatePrivate = mockStore.privateProfiles.get(targetStudentId);
    if (candidatePrivate && !candidatePrivate.socialConsent?.hasConsent) return null;

    // Hidden candidates are also excluded from direct detail
    const hiddenSet = getSocialHideSet(actor.userId);
    if (hiddenSet.has(targetStudentId)) return null;

    // Blocking/ineligibility rule: blocked parties are not reachable via direct URL either
    if (isSociallyBlocked(actor.userId, targetStudentId)) return null;

    const actorPublicSocial = mockStore.publicSocialProfiles.get(actor.userId);
    const actorPrivate = mockStore.privateProfiles.get(actor.userId);
    const actorInterests = actorPublicSocial?.interests ?? actorPrivate?.socialInterests ?? [];

    const connection = Array.from(mockStore.connections.values()).find(
      (c) =>
        c.mode === 'SOCIAL' &&
        ((c.studentAId === actor.userId && c.studentBId === targetStudentId) ||
          (c.studentBId === actor.userId && c.studentAId === targetStudentId))
    );

    const groundedReasons = buildGroundedReasons(actorInterests, profile.interests);

    return {
      profile,
      matchScore: 0,
      sharedInterests: actorInterests
        .filter((ai) => profile.interests.some((pi) => pi.id === ai.id))
        .map((t) => t.name),
      groundedReasons,
      relationshipStatus: (connection ? connection.status : 'NONE') as RelationshipStatus,
    };
  }

  public async recordSocialAction(
    targetStudentId: string,
    action: SocialActionType,
    context: ServiceContext
  ): Promise<SocialActionResult> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to record social action');
    }
    if (!actor.hasSocialConsent) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Social discovery must be enabled to record actions');
    }

    // Reject self-actions
    if (targetStudentId === actor.userId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Cannot perform social action on yourself');
    }

    // Recheck candidate eligibility at mutation time
    const targetProfile = mockStore.publicSocialProfiles.get(targetStudentId);
    const targetPrivate = mockStore.privateProfiles.get(targetStudentId);
    if (!targetProfile || (targetPrivate && !targetPrivate.socialConsent?.hasConsent)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Target student is not eligible for social interactions');
    }

    // Blocking/ineligibility rule at execution time
    if (isSociallyBlocked(actor.userId, targetStudentId)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Target student is not eligible for social interactions');
    }

    const now = mockStore.getDemoClock();

    if (action === 'HIDE') {
      getSocialHideSet(actor.userId).add(targetStudentId);
      return {
        targetUserId: targetStudentId,
        action: 'HIDE',
        relationshipStatus: 'NONE',
        recordedAt: now,
      };
    }

    if (action === 'PASS') {
      getSocialPassSet(actor.userId).add(targetStudentId);
      return {
        targetUserId: targetStudentId,
        action: 'PASS',
        relationshipStatus: 'NONE',
        recordedAt: now,
      };
    }

    if (action === 'LIKE') {
      // SOCIAL likes are independent from study likes (mockStore.studyLikes)
      const actorLikes = getSocialLikes(actor.userId);
      const connectionId = `conn-${[actor.userId, targetStudentId].sort().join('-')}-social`;
      const existingConnection = mockStore.connections.get(connectionId);

      // Idempotent: if already liked and connection exists, return current state
      if (actorLikes.has(targetStudentId) && existingConnection) {
        return {
          targetUserId: targetStudentId,
          action: 'LIKE',
          relationshipStatus: existingConnection.status as 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'MUTUAL_CONNECTED' | 'DISCONNECTED',
          recordedAt: existingConnection.updatedAt ?? existingConnection.createdAt,
        };
      }

      actorLikes.add(targetStudentId);

      const relationshipStatus = handleConnectionLike(actor.userId, targetStudentId, 'SOCIAL');

      return {
        targetUserId: targetStudentId,
        action: 'LIKE',
        relationshipStatus,
        recordedAt: now,
      };
    }

    throw new AppError(ErrorCode.VALIDATION_ERROR, `Unsupported social action: ${action}`);
  }

  public async resetSocialDiscoveryRound(context: ServiceContext): Promise<void> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to reset social discovery round');
    }
    // Clear pass set only; hidden set persists across rounds
    socialPassedSet.delete(actor.userId);
  }

  public async listSocialConnections(context: ServiceContext): Promise<SocialRecommendation[]> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required');
    }
    if (!actor.hasSocialConsent) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Social consent required to view connections');
    }

    // List all social connections where actor is a participant
    const actorConnections = Array.from(mockStore.connections.values()).filter(
      (c) =>
        c.mode === 'SOCIAL' &&
        (c.studentAId === actor.userId || c.studentBId === actor.userId)
    );

    const actorPublicSocial = mockStore.publicSocialProfiles.get(actor.userId);
    const actorPrivate = mockStore.privateProfiles.get(actor.userId);
    const actorInterests = actorPublicSocial?.interests ?? actorPrivate?.socialInterests ?? [];

    const results: SocialRecommendation[] = [];
    for (const conn of actorConnections) {
      const peerId = conn.studentAId === actor.userId ? conn.studentBId : conn.studentAId;
      const profile = mockStore.publicSocialProfiles.get(peerId);
      if (!profile) continue;
      
      const groundedReasons = buildGroundedReasons(actorInterests, profile.interests);
      
      let status = conn.status;
      if (status === 'PENDING_SENT' && conn.studentBId === actor.userId) {
        status = 'PENDING_RECEIVED';
      }

      results.push({
        profile,
        matchScore: 0,
        sharedInterests: actorInterests
          .filter((ai) => profile.interests.some((pi) => pi.id === ai.id))
          .map((t) => t.name),
        groundedReasons,
        relationshipStatus: status as RelationshipStatus,
      });
    }
    return results;
  }
}


/**
 * Shared logic for recording a Like and managing the resulting connection.
 * Stage 07: Derives PENDING_SENT or MUTUAL_CONNECTED based on reciprocal Likes.
 */
function handleConnectionLike(
  actorId: string,
  targetId: string,
  mode: ConnectionMode,
  note?: string
): RelationshipStatus {
  const connectionId = `conn-${[actorId, targetId].sort().join('-')}-${mode.toLowerCase()}`;
  const existing = mockStore.connections.get(connectionId);

  // Determine reciprocity based on existing Likes in the specific mode
  const targetLikes = mode === 'STUDY'
    ? mockStore.studyLikes.get(targetId)
    : socialLikes.get(targetId);
  const isReciprocal = targetLikes?.has(actorId) ?? false;

  const status: RelationshipStatus = isReciprocal ? 'MUTUAL_CONNECTED' : 'PENDING_SENT';
  const now = mockStore.getDemoClock();

  mockStore.connections.set(connectionId, {
    connectionId,
    studentAId: actorId,
    studentBId: targetId,
    mode,
    status,
    note: note || existing?.note,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

  if (isReciprocal) {
    for (const recipientId of [actorId, targetId]) {
      emitNotification({
        recipientId,
        eventType: 'CONNECTION_MUTUAL',
        mode,
        title: `${mode === 'STUDY' ? 'Study' : 'Social'} connection active`,
        body: 'A reciprocal Like created an active mutual connection.',
        destination: { kind: 'CONNECTION', connectionId },
        dedupeKey: `connection-${connectionId}`,
      });
    }
  }

  return status;
}

function deriveRelationshipStatus(
  connection: PeerConnection,
  likes: Map<string, Set<string>>,
  actorId: string
): RelationshipStatus {
  const aLikesB = likes.get(connection.studentAId)?.has(connection.studentBId) ?? false;
  const bLikesA = likes.get(connection.studentBId)?.has(connection.studentAId) ?? false;
  if (aLikesB && bLikesA) return 'MUTUAL_CONNECTED';
  if (aLikesB || bLikesA) {
    const actorLikedPeer = likes.get(actorId)?.has(
      actorId === connection.studentAId ? connection.studentBId : connection.studentAId
    ) ?? false;
    return actorLikedPeer ? 'PENDING_SENT' : 'PENDING_RECEIVED';
  }
  return 'NONE';
}

export class MockConnectionService implements IConnectionService {
  public async sendConnectionRequest(
    targetStudentId: string,
    mode: ConnectionMode,
    note: string | undefined,
    context: ServiceContext
  ): Promise<PeerConnection> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required');
    }

    // Add to Likes store first to ensure derivation is correct
    if (mode === 'STUDY') {
      let likes = mockStore.studyLikes.get(actor.userId);
      if (!likes) {
        likes = new Set();
        mockStore.studyLikes.set(actor.userId, likes);
      }
      likes.add(targetStudentId);
    } else {
      let likes = socialLikes.get(actor.userId);
      if (!likes) {
        likes = new Set();
        socialLikes.set(actor.userId, likes);
      }
      likes.add(targetStudentId);
    }

    handleConnectionLike(actor.userId, targetStudentId, mode, note);
    const connectionId = `conn-${[actor.userId, targetStudentId].sort().join('-')}-${mode.toLowerCase()}`;
    return this.getConnection(connectionId, context);
  }

  public async listConnections(
    mode: ConnectionMode,
    context: ServiceContext
  ): Promise<PeerConnection[]> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required');
    }

    // Filter connections by mode and participant
    const studyLikes = mockStore.studyLikes;
    const socialLikesMap = socialLikes;
    const likes = mode === 'STUDY' ? studyLikes : socialLikesMap;
    const derived = new Map<string, PeerConnection>();

    for (const [sourceId, targets] of likes.entries()) {
      for (const targetId of targets) {
        if (sourceId === targetId) continue;
        const [studentAId, studentBId] = [sourceId, targetId].sort();
        if (studentAId !== actor.userId && studentBId !== actor.userId) continue;
        const connectionId = `conn-${studentAId}-${studentBId}-${mode.toLowerCase()}`;
        const stored = mockStore.connections.get(connectionId);
        derived.set(connectionId, {
          connectionId,
          studentAId,
          studentBId,
          mode,
          status: 'PENDING_SENT',
          note: stored?.note,
          createdAt: stored?.createdAt ?? new Date(0).toISOString(),
          updatedAt: stored?.updatedAt ?? new Date(0).toISOString(),
        });
      }
    }

    // Refresh status from the mode-specific Like records on every read.
    return Array.from(derived.values()).map(c => {
      const status = deriveRelationshipStatus(c, likes, actor.userId);
      const isRestricted = isSociallyBlocked(c.studentAId, c.studentBId);
      return { ...c, status, isRestricted };
    });
  }

  public async getConnection(
    connectionId: string,
    context: ServiceContext
  ): Promise<PeerConnection> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required');
    }

    const conn = mockStore.connections.get(connectionId) ?? this.deriveConnectionFromId(connectionId);
    if (!conn) {
      throw new AppError(ErrorCode.NOT_FOUND, `Connection ${connectionId} not found`);
    }

    // Enforce participant-level authorization
    if (conn.studentAId !== actor.userId && conn.studentBId !== actor.userId) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Access to private relationship record denied');
    }

    const likes = conn.mode === 'STUDY' ? mockStore.studyLikes : socialLikes;
    const status = deriveRelationshipStatus(conn, likes, actor.userId);

    const isRestricted = isSociallyBlocked(conn.studentAId, conn.studentBId);

    return { ...conn, status, isRestricted };
  }

  private deriveConnectionFromId(connectionId: string): PeerConnection | undefined {
    const mode: ConnectionMode = connectionId.endsWith('-study') ? 'STUDY' : 'SOCIAL';
    if (!connectionId.endsWith('-study') && !connectionId.endsWith('-social')) return undefined;
    const likes = mode === 'STUDY' ? mockStore.studyLikes : socialLikes;
    for (const [sourceId, targets] of likes.entries()) {
      for (const targetId of targets) {
        const [studentAId, studentBId] = [sourceId, targetId].sort();
        if (`conn-${studentAId}-${studentBId}-${mode.toLowerCase()}` !== connectionId) continue;
        return {
          connectionId,
          studentAId,
          studentBId,
          mode,
          status: 'PENDING_SENT',
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        };
      }
    }
    return undefined;
  }

  /** Map a connection (plus participant context) to a summary/details peer projection. */
  private projectPeer(
    conn: PeerConnection,
    actorId: string
  ): Omit<ConnectionSummaryItem, 'bucket' | 'isRestricted' | 'restrictedReason' | 'isStudyBookingEligible'> {
    const peerId = conn.studentAId === actorId ? conn.studentBId : conn.studentAId;

    const studyProfile = mockStore.publicStudyProfiles.get(peerId);
    const socialProfile = mockStore.publicSocialProfiles.get(peerId);
    const peerPrivate = mockStore.privateProfiles.get(peerId);

    let peerDisplayName = peerId;
    // Fallback display from whatever public/private source is available (no contact details)
    if (conn.mode === 'STUDY' && studyProfile) {
      peerDisplayName = studyProfile.displayName;
    } else if (conn.mode === 'SOCIAL' && socialProfile) {
      peerDisplayName = socialProfile.displayName;
    } else if (peerPrivate) {
      peerDisplayName = peerPrivate.displayName;
    } else if (studyProfile) {
      peerDisplayName = studyProfile.displayName;
    } else if (socialProfile) {
      peerDisplayName = socialProfile.displayName;
    }

    return {
      connectionId: conn.connectionId,
      mode: conn.mode,
      peerId,
      peerDisplayName,
      peerDepartment: studyProfile?.department,
      peerDegree: studyProfile?.degree,
      peerYear: studyProfile?.year,
      peerBio: socialProfile?.bio ?? peerPrivate?.socialBio,
      peerInterests: (socialProfile?.interests ?? peerPrivate?.socialInterests ?? []).map((i) => ({
        id: i.id,
        name: i.name,
        category: (i as { category?: string }).category,
      })),
      peerCourses: (studyProfile?.courses ?? peerPrivate?.courses ?? []).map((c) => ({
        code: c.code,
        name: c.name,
      })),
      note: conn.note,
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt,
    };
  }

  private determineBucket(conn: PeerConnection, actorId: string): ConnectionViewBucket {
    if (conn.status === 'MUTUAL_CONNECTED') return 'MUTUAL';
    const likes = conn.mode === 'STUDY' ? mockStore.studyLikes : socialLikes;
    const peerId = conn.studentAId === actorId ? conn.studentBId : conn.studentAId;
    return likes.get(actorId)?.has(peerId) ? 'OUTGOING' : 'INCOMING';
  }

  private buildRestricted(
    conn: PeerConnection
  ): { isRestricted: boolean; restrictedReason?: 'BLOCKED' | 'OPTED_OUT' | 'PENDING_POLICY' } {
    if (isSociallyBlocked(conn.studentAId, conn.studentBId)) {
      return { isRestricted: true, restrictedReason: 'BLOCKED' };
    }
    const peerPrivateA = mockStore.privateProfiles.get(conn.studentAId);
    const peerPrivateB = mockStore.privateProfiles.get(conn.studentBId);
    const aConsent = conn.mode === 'STUDY' ? peerPrivateA?.studyConsent : peerPrivateA?.socialConsent;
    const bConsent = conn.mode === 'STUDY' ? peerPrivateB?.studyConsent : peerPrivateB?.socialConsent;
    if ((aConsent && !aConsent.hasConsent) || (bConsent && !bConsent.hasConsent)) {
      return { isRestricted: true, restrictedReason: 'OPTED_OUT' };
    }
    // Default unresolved policy is not restricted; caller decides UI message separately
    return { isRestricted: false };
  }

  public async listConnectionSummaries(
    mode: ConnectionMode,
    bucket: ConnectionViewBucket | 'ALL',
    context: ServiceContext
  ): Promise<ConnectionSummaryItem[]> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required');
    }
    const modeConsent = mode === 'STUDY' ? actor.hasStudyConsent : actor.hasSocialConsent;
    if (!modeConsent) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        mode === 'STUDY'
          ? 'Study consent is required to view study connections.'
          : 'Social consent is required to view social connections.'
      );
    }

    const connections = await this.listConnections(mode, context);
    const summaries: ConnectionSummaryItem[] = [];
    for (const conn of connections) {
      const effectiveBucket = this.determineBucket(conn, actor.userId);
      if (bucket !== 'ALL' && bucket !== effectiveBucket) {
        continue;
      }
      const peer = this.projectPeer(conn, actor.userId);
      const restricted = this.buildRestricted(conn);
      summaries.push({
        ...peer,
        bucket: effectiveBucket,
        isRestricted: restricted.isRestricted,
        restrictedReason: restricted.restrictedReason,
        isStudyBookingEligible: mode === 'STUDY' && conn.status === 'MUTUAL_CONNECTED',
      });
    }
    // Deterministic ordering: mutual first, then by updatedAt desc, then peerId asc
    summaries.sort((a, b) => {
      const bucketOrder = (x: ConnectionViewBucket) => (x === 'MUTUAL' ? 0 : x === 'INCOMING' ? 1 : 2);
      const bo = bucketOrder(a.bucket) - bucketOrder(b.bucket);
      if (bo !== 0) return bo;
      const ta = new Date(a.updatedAt).getTime();
      const tb = new Date(b.updatedAt).getTime();
      if (tb !== ta) return tb - ta;
      return a.peerId.localeCompare(b.peerId);
    });
    return summaries;
  }

  public async getConnectionDetail(
    connectionId: string,
    context: ServiceContext
  ): Promise<ConnectionDetailView> {
    await scenarioManager.applyScenario(context.signal);
    // getConnection enforces participant-level auth + signal + scenario
    const conn = await this.getConnection(connectionId, context);
    const actor = context.actorSession!;
    const peer = this.projectPeer(conn, actor.userId);
    const restricted = this.buildRestricted(conn);
    const isStudyBookingEligible = conn.mode === 'STUDY' && conn.status === 'MUTUAL_CONNECTED';
    return {
      connectionId: conn.connectionId,
      mode: conn.mode,
      peerId: peer.peerId,
      peerDisplayName: peer.peerDisplayName,
      peerDepartment: peer.peerDepartment,
      peerDegree: peer.peerDegree,
      peerYear: peer.peerYear,
      peerBio: peer.peerBio,
      peerInterests: peer.peerInterests,
      peerCourses: peer.peerCourses,
      relationshipStatus: conn.status,
      note: conn.note,
      isRestricted: restricted.isRestricted,
      restrictedReason: restricted.restrictedReason,
      // Documented demo policy: one-sided Likes are visible in demo (not declared a production rule)
      visibilityPolicy: 'ONE_SIDED_VISIBLE_DEMO',
      isStudyBookingEligible,
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt,
    };
  }

  public async getConnectionCounts(
    mode: ConnectionMode,
    context: ServiceContext
  ): Promise<ConnectionCounts> {
    const summaries = await this.listConnectionSummaries(mode, 'ALL', context);
    return summaries.reduce<ConnectionCounts>(
      (acc, s) => {
        if (s.bucket === 'OUTGOING') acc.outgoing += 1;
        else if (s.bucket === 'INCOMING') acc.incoming += 1;
        else if (s.bucket === 'MUTUAL') acc.mutual += 1;
        return acc;
      },
      { outgoing: 0, incoming: 0, mutual: 0 }
    );
  }

  public async resetDemoState(_context: ServiceContext): Promise<void> {
    // Actor identity is intentionally ignored — this resets the whole demo
    // in-memory database and action maps, as documented for the mock only.
    MockStudyService.resetAllDemoState();
  }
}
