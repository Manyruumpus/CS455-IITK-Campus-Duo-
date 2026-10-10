import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import { appServices } from '@/services';
import { useDemoAuth } from '@/app/context/DemoAuthContext';
import { useToast } from '@/components/ui/Toast';
import {
  StudyRecommendation,
  StudyDiscoveryFilters,
  StudyActionType,
  StudyActionResult,
  StudyPreferences,
  AgentMatchResult,
  AppError,
  ErrorCode,
} from '@/types';

/**
 * Fetch list of academic study partner recommendations with filters.
 */
export const useStudyRecommendations = (filters?: StudyDiscoveryFilters) => {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';

  return useQuery<StudyRecommendation[], AppError>({
    queryKey: queryKeys.study.recommendations(actorId, (filters ?? {}) as Record<string, unknown>),
    queryFn: async ({ signal }) => {
      if (!session) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to view study partners');
      }
      return appServices.study.listStudyPartners(filters, { actorSession: session, signal });
    },
    enabled: !!session && session.role === 'ROLE_STUDENT' && session.hasStudyConsent,
    staleTime: 30000,
  });
};

/**
 * Fetch candidate study partner detail.
 */
export const useStudyPartnerDetail = (studentId: string | undefined) => {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';

  return useQuery<StudyRecommendation | null, AppError>({
    queryKey: queryKeys.study.detail(actorId, studentId ?? ''),
    queryFn: async ({ signal }) => {
      if (!session) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to view candidate detail');
      }
      if (!studentId) {
        return null;
      }
      return appServices.study.getStudyPartner(studentId, { actorSession: session, signal });
    },
    enabled: !!session && session.role === 'ROLE_STUDENT' && session.hasStudyConsent && !!studentId,
  });
};

/**
 * Record a study interaction (Like, Pass, Hide).
 */
export const useRecordStudyAction = () => {
  const queryClient = useQueryClient();
  const { session } = useDemoAuth();
  const { addToast } = useToast();

  return useMutation<
    StudyActionResult,
    AppError,
    { targetStudentId: string; action: StudyActionType; candidateName?: string }
  >({
    mutationFn: async ({ targetStudentId, action }) => {
      if (!session) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to record action');
      }
      return appServices.study.recordStudyAction(targetStudentId, action, {
        actorSession: session,
      });
    },
    onSuccess: (result, variables) => {
      const actorId = session?.userId ?? 'anonymous';
      // Invalidate study discovery recommendations, detail, and connections
      queryClient.invalidateQueries({ queryKey: queryKeys.study.all(actorId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.study.detail(actorId, variables.targetStudentId) });
      // Stage 07: Invalidate connection keys
      queryClient.invalidateQueries({ queryKey: queryKeys.connections.all(actorId) });

      if (variables.action === 'LIKE') {
        if (result.relationshipStatus === 'MUTUAL_CONNECTED') {
          addToast({
            type: 'success',
            title: 'Mutual Study Partnership Formed!',
            description: `You and ${variables.candidateName ?? 'your peer'} are now connected for study collaborations.`,
          });
        } else {
          addToast({
            type: 'success',
            title: 'Study Like Sent',
            description: `Your interest was recorded for ${variables.candidateName ?? 'the peer'}.`,
          });
        }
      } else if (variables.action === 'PASS') {
        addToast({
          type: 'info',
          title: 'Candidate Passed',
          description: 'Candidate dismissed from immediate recommendation feed.',
        });
      } else if (variables.action === 'HIDE') {
        addToast({
          type: 'info',
          title: 'Candidate Hidden',
          description: 'Candidate will no longer appear in your study discovery feeds.',
        });
      }
    },
    onError: (err) => {
      addToast({
        type: 'error',
        title: 'Action Failed',
        description: err.message,
      });
    },
  });
};

/**
 * Submit an AI matching query.
 */
export const useSubmitMatchingQuery = () => {
  const queryClient = useQueryClient();
  const { session } = useDemoAuth();
  const { addToast } = useToast();

  return useMutation<
    AgentMatchResult,
    AppError,
    { courseCode: string; preferences: Partial<StudyPreferences> }
  >({
    mutationFn: async ({ courseCode, preferences }) => {
      if (!session) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to request matching');
      }
      return appServices.study.submitMatchingQuery(courseCode, preferences, {
        actorSession: session,
      });
    },
    onSuccess: (result) => {
      const actorId = session?.userId ?? 'anonymous';
      queryClient.setQueryData(queryKeys.study.matchingQuery(actorId, result.queryId), result);
      addToast({
        type: 'success',
        title: result.status === 'FALLBACK' ? 'Matching Query Completed (Fallback)' : 'Agent Matching Completed',
        description:
          result.status === 'FALLBACK'
            ? 'Heuristic match returned: Deep agent recommendation service currently unreachable.'
            : `Found ${result.results?.length ?? 0} grounded candidate study partners.`,
      });
    },
    onError: (err) => {
      addToast({
        type: 'error',
        title: 'Matching Request Failed',
        description: err.message,
      });
    },
  });
};

/**
 * Fetch matching query result status.
 */
export const useMatchingQueryStatus = (queryId: string | undefined) => {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';

  return useQuery<AgentMatchResult, AppError>({
    queryKey: queryKeys.study.matchingQuery(actorId, queryId ?? ''),
    queryFn: async ({ signal }) => {
      if (!session) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to view query status');
      }
      if (!queryId) {
        throw new AppError(ErrorCode.NOT_FOUND, 'Query ID required');
      }
      return appServices.study.getMatchingStatus(queryId, { actorSession: session, signal });
    },
    enabled: !!session && session.role === 'ROLE_STUDENT' && !!queryId,
  });
};
