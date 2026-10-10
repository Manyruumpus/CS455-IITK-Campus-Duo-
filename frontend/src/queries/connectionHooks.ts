/**
 * Campus Duo — Stage 07 Connection Query Hooks
 *
 * Actor-scoped keys include mode, bucket and connection IDs.
 * Reads are disabled without a valid student session or when mode consent is missing.
 * AbortSignal propagates through service reads.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appServices } from '@/services';
import { useDemoAuth } from '@/app/context/DemoAuthContext';
import { useToast } from '@/components/ui/Toast';
import { queryKeys } from './queryKeys';
import {
  AppError,
  ConnectionMode,
  ConnectionViewBucket,
  ConnectionCounts,
  ConnectionSummaryItem,
  ConnectionDetailView,
  PeerConnection,
  ErrorCode,
} from '@/types';

const STUDY_BUCKETS: (ConnectionViewBucket | 'ALL')[] = ['ALL', 'OUTGOING', 'INCOMING', 'MUTUAL'];

function hasStudyConsent(session: ReturnType<typeof useDemoAuth>['session']): boolean {
  return Boolean(session?.hasStudyConsent);
}
function hasSocialConsent(session: ReturnType<typeof useDemoAuth>['session']): boolean {
  return Boolean(session?.hasSocialConsent);
}

export function useConnections(mode: ConnectionMode) {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? '';
  const consent = mode === 'STUDY' ? hasStudyConsent(session) : hasSocialConsent(session);

  return useQuery<PeerConnection[], AppError>({
    queryKey: queryKeys.connections.list(actorId, mode),
    queryFn: async ({ signal }) => {
      if (!session) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to view connections');
      }
      return appServices.connection.listConnections(mode, { actorSession: session, signal });
    },
    enabled: Boolean(session) && session?.role === 'ROLE_STUDENT' && consent,
    staleTime: 30000,
  });
}

export function useConnectionDetail(connectionId: string) {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? '';

  return useQuery<ConnectionDetailView, AppError>({
    queryKey: queryKeys.connections.detail(actorId, connectionId),
    queryFn: async ({ signal }) => {
      if (!session) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to view connection detail');
      }
      if (!connectionId) {
        throw new AppError(ErrorCode.NOT_FOUND, 'Connection ID missing');
      }
      return appServices.connection.getConnectionDetail(connectionId, { actorSession: session, signal });
    },
    enabled: Boolean(session) && session?.role === 'ROLE_STUDENT' && Boolean(connectionId),
    staleTime: 30000,
  });
}

/** Stage 07: Summary lists bucketed by outgoing/incoming/mutual for a specific mode. */
export function useConnectionSummaries(
  mode: ConnectionMode,
  bucket: ConnectionViewBucket | 'ALL' = 'ALL'
) {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? '';
  const consent = mode === 'STUDY' ? hasStudyConsent(session) : hasSocialConsent(session);

  return useQuery<ConnectionSummaryItem[], AppError>({
    queryKey: queryKeys.connections.summaries(actorId, mode, bucket),
    queryFn: async ({ signal }) => {
      if (!session) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to view connection summaries');
      }
      return appServices.connection.listConnectionSummaries(mode, bucket, { actorSession: session, signal });
    },
    enabled: Boolean(session) && session?.role === 'ROLE_STUDENT' && consent,
    staleTime: 30000,
  });
}

/** Stage 07: Counts derived from the same deterministic summary derivation. */
export function useConnectionCounts(mode: ConnectionMode) {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? '';
  const consent = mode === 'STUDY' ? hasStudyConsent(session) : hasSocialConsent(session);

  return useQuery<ConnectionCounts, AppError>({
    queryKey: queryKeys.connections.counts(actorId, mode),
    queryFn: async ({ signal }) => {
      if (!session) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to view connection counts');
      }
      return appServices.connection.getConnectionCounts(mode, { actorSession: session, signal });
    },
    enabled: Boolean(session) && session?.role === 'ROLE_STUDENT' && consent,
    staleTime: 30000,
  });
}

/** Stage 07: Reciprocate a one-sided incoming Like (creates mutual STUDY/SOCIAL). */
export function useReciprocateLike() {
  const queryClient = useQueryClient();
  const { session } = useDemoAuth();
  const { addToast } = useToast();

  return useMutation<
    { relationshipStatus: string },
    AppError,
    { mode: ConnectionMode; targetStudentId: string; candidateName?: string }
  >({
    retry: 0,
    mutationFn: async ({ mode, targetStudentId }) => {
      if (!session) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required');
      }
      if (mode === 'STUDY') {
        const res = await appServices.study.recordStudyAction(targetStudentId, 'LIKE', {
          actorSession: session,
        });
        return { relationshipStatus: res.relationshipStatus };
      }
      const res = await appServices.social.recordSocialAction(targetStudentId, 'LIKE', {
        actorSession: session,
      });
      return { relationshipStatus: res.relationshipStatus };
    },
    onSuccess: (res, variables) => {
      const actorId = session?.userId ?? 'anonymous';
      // Refresh all connection views for the affected mode
      queryClient.invalidateQueries({ queryKey: queryKeys.connections.all(actorId) });
      for (const b of STUDY_BUCKETS) {
        queryClient.invalidateQueries({ queryKey: queryKeys.connections.summaries(actorId, variables.mode, b) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.connections.counts(actorId, variables.mode) });
      // Refresh discovery/recommendation feeds so cards reflect the new status
      if (variables.mode === 'STUDY') {
        queryClient.invalidateQueries({ queryKey: queryKeys.study.all(actorId) });
      } else {
        queryClient.invalidateQueries({ queryKey: queryKeys.social.all(actorId) });
      }
      // Dashboard summary uses social connections; study bookings refresh uses study keys
      queryClient.invalidateQueries({ queryKey: ['bookings', actorId] });

      if (res.relationshipStatus === 'MUTUAL_CONNECTED') {
        addToast({
          type: 'success',
          title: variables.mode === 'STUDY' ? 'Mutual Study Partnership Formed' : 'Mutual Social Connection',
          description: `You and ${variables.candidateName ?? 'your peer'} are now connected.`,
        });
      } else {
        addToast({
          type: 'success',
          title: variables.mode === 'STUDY' ? 'Study Like Recorded' : 'Social Like Recorded',
          description: `Your interest was recorded for ${variables.candidateName ?? 'the peer'}.`,
        });
      }
    },
    onError: (err, variables) => {
      addToast({
        type: 'error',
        title: variables.mode === 'STUDY' ? 'Study Action Failed' : 'Social Action Failed',
        description: err.message,
      });
    },
  });
}

export function useSendConnectionRequest() {
  const queryClient = useQueryClient();
  const { session } = useDemoAuth();
  const { addToast } = useToast();

  return useMutation<
    PeerConnection,
    AppError,
    { targetStudentId: string; mode: ConnectionMode; note?: string }
  >({
    retry: 0,
    mutationFn: async ({ targetStudentId, mode, note }) => {
      if (!session) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required');
      }
      return appServices.connection.sendConnectionRequest(targetStudentId, mode, note, {
        actorSession: session,
      });
    },
    onSuccess: (conn, variables) => {
      const actorId = session?.userId ?? 'anonymous';
      queryClient.invalidateQueries({ queryKey: queryKeys.connections.all(actorId) });
      for (const b of STUDY_BUCKETS) {
        queryClient.invalidateQueries({ queryKey: queryKeys.connections.summaries(actorId, variables.mode, b) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.connections.counts(actorId, variables.mode) });
      if (variables.mode === 'STUDY') {
        queryClient.invalidateQueries({ queryKey: queryKeys.study.all(actorId) });
      } else {
        queryClient.invalidateQueries({ queryKey: queryKeys.social.all(actorId) });
      }
      addToast({
        type: 'success',
        title: variables.mode === 'STUDY' ? 'Study Request Sent' : 'Social Request Sent',
        description: conn.status === 'MUTUAL_CONNECTED' ? 'Mutual connection confirmed.' : 'Awaiting reciprocal interest.',
      });
    },
    onError: (err, variables) => {
      addToast({
        type: 'error',
        title:
          variables.mode === 'STUDY'
            ? 'Study Request Failed'
            : 'Social Request Failed',
        description: err.message,
      });
    },
  });
}

/** Stage 07: Coordinated demo reset mutation. Invalidates all actor keys after reset. */
export function useResetDemoState() {
  const queryClient = useQueryClient();
  const { session } = useDemoAuth();
  const { addToast } = useToast();

  return useMutation<void, AppError, void>({
    retry: 0,
    mutationFn: async () => {
      if (!session) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to reset demo state');
      }
      return appServices.connection.resetDemoState({ actorSession: session });
    },
    onSuccess: () => {
      queryClient.clear();
      addToast({
        type: 'success',
        title: 'Demo State Reset',
        description: 'Store data, study/social action maps and scenario state have been cleared deterministically.',
      });
    },
    onError: (err) => {
      addToast({
        type: 'error',
        title: 'Demo Reset Failed',
        description: err.message,
      });
    },
  });
}
