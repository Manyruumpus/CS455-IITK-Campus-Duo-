import { mockStore } from '@/mocks/store';
import {
  NotificationDestination,
  NotificationEventType,
  NotificationItem,
  NotificationMode,
} from '@/types';

export function emitNotification(input: {
  recipientId: string;
  eventType: NotificationEventType;
  mode: NotificationMode;
  title: string;
  body: string;
  destination?: NotificationDestination;
  dedupeKey: string;
}): NotificationItem {
  const existing = Array.from(mockStore.notifications.values()).find(
    (notification) =>
      notification.recipientId === input.recipientId &&
      notification.eventType === input.eventType &&
      notification.destination &&
      JSON.stringify(notification.destination) === JSON.stringify(input.destination) &&
      notification.body === input.body
  );
  if (existing) return existing;

  const id = `notif-${input.dedupeKey}-${input.recipientId}`;
  const notification: NotificationItem = {
    id,
    recipientId: input.recipientId,
    title: input.title,
    body: input.body,
    type:
      input.mode === 'BOOKING'
        ? 'BOOKING'
        : input.mode === 'MODERATION'
        ? 'MODERATION'
        : input.mode === 'SYSTEM'
        ? 'SYSTEM'
        : 'CONNECTION',
    eventType: input.eventType,
    mode: input.mode,
    destination: input.destination,
    isRead: false,
    timestamp: mockStore.getDemoClock(),
  };
  mockStore.notifications.set(id, notification);
  return notification;
}
