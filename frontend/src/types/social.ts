/**
 * Campus Duo — Stage 06 Social Discovery Supplementary Types
 *
 * These types extend src/types/index.ts social contracts.
 * - SocialActionType, SocialActionResult, SocialDiscoveryFilters are new for Stage 06.
 * - Do NOT re-export PublicSocialProfile, SocialCategory, SocialRecommendation, or
 *   SocialInterestTag here; those are canonical in src/types/index.ts.
 */

export type SocialActionType = 'LIKE' | 'PASS' | 'HIDE';

/**
 * Result returned by recordSocialAction.
 * relationshipStatus uses the canonical RelationshipStatus union from index.ts.
 */
export interface SocialActionResult {
  targetUserId: string;
  action: SocialActionType;
  /** Canonical RelationshipStatus value after the action is applied. */
  relationshipStatus: 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'MUTUAL_CONNECTED' | 'DISCONNECTED';
  recordedAt: string;
}

export interface SocialDiscoveryFilters {
  category?: string; // SocialCategory | 'ALL'
  search?: string;
}
