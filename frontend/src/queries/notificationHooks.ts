import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appServices } from '@/services';
import { AppError, NotificationMode, NotificationItem } from '@/types';
import { useDemoAuth } from '@/app/context/DemoAuthContext';
import { queryKeys } from './queryKeys';

export function useNotifications(filters: { unreadOnly?: boolean; type?: NotificationMode | 'ALL' } = {}) {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';
  return useQuery<NotificationItem[], AppError>({
    queryKey: queryKeys.notifications.list(actorId, filters),
    enabled: !!session,
    queryFn: ({ signal }) => {
      if (!session) throw new AppError('UNAUTHENTICATED', 'Sign in required');
      return appServices.notification.listNotifications(filters, { actorSession: session, signal });
    },
  });
}

export function useUnreadNotificationCount() {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';
  return useQuery<number, AppError>({
    queryKey: queryKeys.notifications.unread(actorId),
    enabled: !!session,
    queryFn: ({ signal }) => {
      if (!session) throw new AppError('UNAUTHENTICATED', 'Sign in required');
      return appServices.notification.getUnreadCount({ actorSession: session, signal });
    },
  });
}

function useNotificationMutation(action: 'read' | 'unread' | 'all') {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';
  const queryClient = useQueryClient();
  return useMutation<void, AppError, string | undefined>({
    mutationFn: (notificationId) => {
      if (!session) return Promise.reject(new AppError('UNAUTHENTICATED', 'Sign in required'));
      const context = { actorSession: session };
      if (action === 'read') return appServices.notification.markAsRead(notificationId!, context);
      if (action === 'unread') return appServices.notification.markAsUnread(notificationId!, context);
      return appServices.notification.markAllAsRead(context);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all(actorId) });
    },
  });
}

export const useMarkNotificationRead = () => useNotificationMutation('read');
export const useMarkNotificationUnread = () => useNotificationMutation('unread');
export const useMarkAllNotificationsRead = () => useNotificationMutation('all');
