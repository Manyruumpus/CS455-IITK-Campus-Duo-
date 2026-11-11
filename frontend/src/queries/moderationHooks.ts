import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appServices } from '@/services';
import { AppError, ReportReceipt } from '@/types';
import { useDemoAuth } from '@/app/context/DemoAuthContext';
import { queryKeys } from './queryKeys';

export function useReportUser() {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';
  const queryClient = useQueryClient();
  return useMutation<ReportReceipt, AppError, { reportedUserId: string; category: string; description?: string }>({
    mutationFn: (request) => {
      if (!session) return Promise.reject(new AppError('UNAUTHENTICATED', 'Sign in required'));
      return appServices.moderation.reportUser(
        request.reportedUserId,
        request.category,
        request.description,
        { actorSession: session }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all(actorId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.moderation.all(actorId) });
    },
  });
}

export function useBlockUser() {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';
  const queryClient = useQueryClient();
  return useMutation<{ blocked: boolean }, AppError, string>({
    mutationFn: (targetUserId) => {
      if (!session) return Promise.reject(new AppError('UNAUTHENTICATED', 'Sign in required'));
      return appServices.moderation.blockUser(targetUserId, { actorSession: session });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.moderation.all(actorId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.social.all(actorId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.connections.all(actorId) });
    },
  });
}

export function useMyReports() {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';
  return useQuery<ReportReceipt[], AppError>({
    queryKey: [...queryKeys.moderation.all(actorId), 'reports'],
    enabled: !!session,
    queryFn: ({ signal }) => {
      if (!session) throw new AppError('UNAUTHENTICATED', 'Sign in required');
      return appServices.moderation.listMyReports({ actorSession: session, signal });
    },
  });
}
