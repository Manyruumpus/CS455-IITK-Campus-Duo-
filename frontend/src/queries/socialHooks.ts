/**
 * Campus Duo — Stage 06 Social Discovery Query Hooks
 *
 * Follows the same actor-scoped, session-gated pattern as studyHooks.ts.
 * All reads require a valid student session and social consent.
 * Mutations are retry:0 (committed mutations cannot be reversed).
 * Session changes invalidate social query cache via actor-scoped keys.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import { appServices } from '@/services';
import { useDemoAuth } from '@/app/context/DemoAuthContext';
import { useToast } from '@/components/ui/Toast';
import { SocialRecommendation, AppError, ErrorCode } from '@/types';
import { SocialActionType, SocialActionResult, SocialDiscoveryFilters } from '@/types/social';

/**
 * Fetch social peer recommendations for the current actor.
 * Enabled only when session exists, role is ROLE_STUDENT, and hasSocialConsent is true.
 * Filters are actor-scoped in the query key.
 */
export const useSocialRecommendations = (filters?: SocialDiscoveryFilters) => {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';

  return useQuery<SocialRecommendation[], AppError>({
    queryKey: queryKeys.social.discover(actorId, (filters ?? {}) as Record<string, unknown>),
    queryFn: async ({ signal }) => {
      if (!session) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to view social peers');
      }
      return appServices.social.listSocialPeers(filters, { actorSession: session, signal });
    },
    enabled: !!session && session.role === 'ROLE_STUDENT' && session.hasSocialConsent,
    staleTime: 30000,
  });
};

/**
 * Fetch a single social peer detail.
 * Enforces actor consent and candidate opt-in via the mock service.
 * Direct URLs cannot bypass these checks.
 */
export const useSocialPeerDetail = (targetUserId: string | undefined) => {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';

  return useQuery<SocialRecommendation | null, AppError>({
    queryKey: queryKeys.social.detail(actorId, targetUserId ?? ''),
    queryFn: async ({ signal }) => {
      if (!session) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to view peer detail');
      }
      if (!targetUserId) return null;
      return appServices.social.getSocialPeer(targetUserId, { actorSession: session, signal });
    },
    enabled: !!session && session.role === 'ROLE_STUDENT' && session.hasSocialConsent && !!targetUserId,
  });
};

/**
 * Fetch actor's mutual SOCIAL connections for the connections summary page.
 */
export const useSocialConnections = () => {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';

  return useQuery<SocialRecommendation[], AppError>({
    queryKey: queryKeys.social.connections(actorId),
    queryFn: async ({ signal }) => {
      if (!session) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to view connections');
      }
      return appServices.social.listSocialConnections({ actorSession: session, signal });
    },
    enabled: !!session && session.role === 'ROLE_STUDENT' && session.hasSocialConsent,
    staleTime: 30000,
  });
};

/**
 * Record a SOCIAL interaction: Like, Pass, or Hide.
 * Completely isolated from study actions — no study side effects.
 * Mutations are retry:0; committed mutations cannot be reversed.
 * Refreshes discovery list and detail after success.
 */
export const useRecordSocialAction = () => {
  const queryClient = useQueryClient();
  const { session } = useDemoAuth();
  const { addToast } = useToast();

  return useMutation<
    SocialActionResult,
    AppError,
    { targetUserId: string; action: SocialActionType; candidateName?: string }
  >({
    retry: 0,
    mutationFn: async ({ targetUserId, action }) => {
      if (!session) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to record action');
      }
      return appServices.social.recordSocialAction(targetUserId, action, { actorSession: session });
    },
    onSuccess: (result, variables) => {
      const actorId = session?.userId ?? 'anonymous';
      // Invalidate discovery list and candidate detail; also refresh connections on LIKE
      queryClient.invalidateQueries({ queryKey: queryKeys.social.all(actorId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.social.detail(actorId, variables.targetUserId) });
      // Stage 07: Invalidate connection keys
      queryClient.invalidateQueries({ queryKey: queryKeys.connections.all(actorId) });

      if (variables.action === 'LIKE') {
        queryClient.invalidateQueries({ queryKey: queryKeys.social.connections(actorId) });
        if (result.relationshipStatus === 'MUTUAL_CONNECTED') {
          addToast({
            type: 'success',
            title: 'Mutual Social Connection!',
            description: `You and ${variables.candidateName ?? 'your peer'} are now mutually connected. No contact details are exchanged.`,
          });
        } else {
          addToast({
            type: 'success',
            title: 'Social Like Sent',
            description: `Your interest was recorded for ${variables.candidateName ?? 'the peer'}.`,
          });
        }
      } else if (variables.action === 'PASS') {
        addToast({
          type: 'info',
          title: 'Candidate Passed',
          description: 'Dismissed from current social discovery round.',
        });
      } else if (variables.action === 'HIDE') {
        addToast({
          type: 'info',
          title: 'Candidate Hidden',
          description: 'Candidate will no longer appear in your social discovery feeds.',
        });
      }
    },
    onError: (err) => {
      addToast({
        type: 'error',
        title: 'Social Action Failed',
        description: err.message,
      });
    },
  });
};
