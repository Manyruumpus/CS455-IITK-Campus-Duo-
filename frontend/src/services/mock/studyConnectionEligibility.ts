import { mockStore } from '@/mocks/store';

/**
 * Canonical mock resolver for booking-eligible study companions.
 * Eligibility is derived only from reciprocal STUDY Likes.
 */
export function hasMutualStudyConnection(actorUserId: string, companionUserId: string): boolean {
  if (!actorUserId || !companionUserId || actorUserId === companionUserId) {
    return false;
  }

  const actorLikes = mockStore.studyLikes.get(actorUserId);
  const companionLikes = mockStore.studyLikes.get(companionUserId);

  return Boolean(
    actorLikes?.has(companionUserId) &&
      companionLikes?.has(actorUserId)
  );
}
