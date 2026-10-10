import { beforeEach, describe, expect, it } from 'vitest';
import { mockStore } from '@/mocks/store';
import { scenarioManager } from '@/mocks/scenarios';
import { MockBookingService } from '@/services/mock/MockBookingService';
import { MockModerationService, MockNotificationService } from '@/services/mock/MockAdminModerationServices';
import { MockStudyService } from '@/services/mock/MockStudySocialServices';
import { AppError } from '@/types';

const alex = {
  userId: 'usr-student-alex',
  email: 'alex@campusduo.test',
  name: 'Alex Rivera',
  rollNumber: '200001',
  role: 'ROLE_STUDENT' as const,
  isOnboarded: true,
  hasStudyConsent: true,
  hasSocialConsent: true,
};
const sam = {
  userId: 'usr-student-sam',
  email: 'sam@campusduo.test',
  name: 'Samira Patel',
  rollNumber: '200002',
  role: 'ROLE_STUDENT' as const,
  isOnboarded: true,
  hasStudyConsent: true,
  hasSocialConsent: true,
};

describe('Stage 09 notifications, reporting, and blocking', () => {
  beforeEach(() => {
    mockStore.reset();
    scenarioManager.reset();
  });

  it('restricts notification reads and mutations to the recipient', async () => {
    const service = new MockNotificationService();
    await expect(service.markAsRead('notif-1', { actorSession: sam })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(service.listNotifications({}, { actorSession: sam })).resolves.toEqual([]);
  });

  it('emits one mutual connection notification per participant and deduplicates repeats', async () => {
    mockStore.studyLikes.clear();
    const service = new MockStudyService();
    await service.recordStudyAction('usr-student-sam', 'LIKE', { actorSession: alex });
    await service.recordStudyAction('usr-student-alex', 'LIKE', { actorSession: sam });
    await service.recordStudyAction('usr-student-alex', 'LIKE', { actorSession: sam });
    const notifications = Array.from(mockStore.notifications.values()).filter(
      (notification) => notification.eventType === 'CONNECTION_MUTUAL'
    );
    expect(notifications).toHaveLength(2);
    expect(new Set(notifications.map((notification) => notification.recipientId))).toEqual(
      new Set([alex.userId, sam.userId])
    );
  });

  it('notifies both booking participants only after a committed creation', async () => {
    const service = new MockBookingService();
    await service.createBooking(
      {
        tableId: 'tbl-pk-2f-10',
        locationId: 'loc-pk-kelkar-2f',
        localDate: '2026-10-08',
        slotId: 'slot-pk-10-18',
        companionStudentId: sam.userId,
        clientOperationId: 'stage09-booking',
      },
      { actorSession: alex }
    );
    const bookingNotifications = Array.from(mockStore.notifications.values()).filter(
      (notification) => notification.eventType === 'BOOKING_CREATED'
    );
    expect(bookingNotifications.map((notification) => notification.recipientId).sort()).toEqual(
      [alex.userId, sam.userId].sort()
    );
  });

  it('does not emit success notification for a failed booking', async () => {
    scenarioManager.setScenario({ forceError: 'SERVICE_UNAVAILABLE' });
    const service = new MockBookingService();
    await expect(
      service.createBooking(
        {
          tableId: 'tbl-pk-2f-10',
          locationId: 'loc-pk-kelkar-2f',
          localDate: '2026-10-08',
          slotId: 'slot-pk-10-18',
          companionStudentId: sam.userId,
          clientOperationId: 'stage09-failed',
        },
        { actorSession: alex }
      )
    ).rejects.toBeInstanceOf(AppError);
    expect(Array.from(mockStore.notifications.values()).some((n) => n.eventType === 'BOOKING_CREATED')).toBe(false);
  });

  it('supports read, unread, and mark-all transitions with refreshed counts', async () => {
    const service = new MockNotificationService();
    expect(await service.getUnreadCount({ actorSession: alex })).toBe(1);
    await service.markAsRead('notif-1', { actorSession: alex });
    expect(await service.getUnreadCount({ actorSession: alex })).toBe(0);
    await service.markAsUnread('notif-1', { actorSession: alex });
    expect(await service.getUnreadCount({ actorSession: alex })).toBe(1);
    await service.markAllAsRead({ actorSession: alex });
    expect(await service.getUnreadCount({ actorSession: alex })).toBe(0);
  });

  it('creates private report receipts without automatic target penalty', async () => {
    const service = new MockModerationService();
    const receipt = await service.reportUser(sam.userId, 'HARASSMENT', 'Unsafe conduct', { actorSession: alex });
    expect(receipt.reporterUserId).toBe(alex.userId);
    expect((await service.listMyReports({ actorSession: alex }))).toHaveLength(1);
    await expect(service.listMyReports({ actorSession: sam })).resolves.toEqual([]);
    expect(mockStore.reports.get(receipt.reportId)?.status).toBe('PENDING_REVIEW');
  });

  it('keeps block scope social-only and symmetric', async () => {
    const moderation = new MockModerationService();
    await moderation.blockUser(sam.userId, { actorSession: alex });
    const social = new (await import('@/services/mock/MockStudySocialServices')).MockSocialService();
    expect(await social.getSocialPeer(sam.userId, { actorSession: alex })).toBeNull();
    expect(await social.getSocialPeer(alex.userId, { actorSession: sam })).toBeNull();
    expect(mockStore.bookings.has('bk-existing-99')).toBe(true);
  });

  it('reset clears generated notifications, reports, and blocks deterministically', async () => {
    const moderation = new MockModerationService();
    await moderation.blockUser(sam.userId, { actorSession: alex });
    await moderation.reportUser(sam.userId, 'OTHER', 'A report', { actorSession: alex });
    expect(mockStore.notifications.size).toBeGreaterThan(0);
    MockStudyService.resetAllDemoState();
    expect(mockStore.blockedBy.size).toBe(0);
    expect(mockStore.reports).toHaveProperty('size', 1);
    expect(Array.from(mockStore.notifications.values()).every((n) => n.id === 'notif-1')).toBe(true);
  });

  it('production notification and moderation adapters remain unavailable', async () => {
    const unavailable = new (await import('@/services/unavailable/UnavailableServiceAdapter')).UnavailableServiceAdapter();
    await expect(unavailable.notification.getUnreadCount({ actorSession: alex })).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
    await expect(unavailable.moderation.listMyReports({ actorSession: alex })).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
  });
});
