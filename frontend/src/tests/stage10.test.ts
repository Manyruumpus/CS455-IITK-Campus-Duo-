import { beforeEach, describe, expect, it } from 'vitest';
import { mockStore } from '@/mocks/store';
import { MockAdminService, MockModerationService } from '@/services/mock/MockAdminModerationServices';
import { UnavailableServiceAdapter } from '@/services/unavailable/UnavailableServiceAdapter';
import { AppError } from '@/types';

const admin = {
  userId: 'usr-admin-senate',
  email: 'admin@campusduo.test',
  name: 'Senate Moderator',
  role: 'ROLE_ADMIN' as const,
  isOnboarded: true,
  hasStudyConsent: false,
  hasSocialConsent: false,
};
const student = {
  userId: 'usr-student-alex',
  email: 'alex@campusduo.test',
  name: 'Alex Rivera',
  rollNumber: '200001',
  role: 'ROLE_STUDENT' as const,
  isOnboarded: true,
  hasStudyConsent: true,
  hasSocialConsent: true,
};

describe('Stage 10 administrator workflows', () => {
  beforeEach(() => mockStore.reset());

  it('denies every privileged admin capability to students and unauthenticated actors', async () => {
    const service = new MockAdminService();
    const calls = [
      service.listModerationReports({ actorSession: student }),
      service.listAuditLogs({ actorSession: student }),
      service.getDashboardSummary({ actorSession: null }),
      service.listUsers(undefined, { actorSession: student }),
      service.listResources({ actorSession: student }),
      service.listTables({ actorSession: student }),
      service.createLocation({ locationId: 'forbidden', name: 'Nope', building: 'X', totalTables: 1, openTime: '08:00', closeTime: '17:00', hasPowerOutlets: true, hasWifi6: true, noisePolicy: 'WHISPER_COLLAB' }, { actorSession: student }),
      service.listBookings({}, { actorSession: student }),
    ];
    for (const call of calls) {
      await expect(call).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
  });

  it('returns minimal user projections without private contact or schedule fields', async () => {
    const service = new MockAdminService();
    const user = await service.getUser(student.userId, { actorSession: admin });
    expect(user.displayName).toBe('Alex Rivera');
    expect((user as unknown as Record<string, unknown>).email).toBeUndefined();
    expect((user as unknown as Record<string, unknown>).studyPreferences).toBeUndefined();
    expect((user as unknown as Record<string, unknown>).phone).toBeUndefined();
  });

  it('derives dashboard counts from current store state', async () => {
    const service = new MockAdminService();
    const summary = await service.getDashboardSummary({ actorSession: admin });
    expect(summary.activeLocations).toBe(2);
    expect(summary.confirmedBookings).toBe(2);
    expect(summary.pendingReports).toBe(1);
  });

  it('requires report reason and confirmation, rejects stale decisions, and preserves target status semantics', async () => {
    const moderation = new MockModerationService();
    const report = await moderation.reportUser('usr-student-sam', 'OTHER', undefined, { actorSession: student });
    const service = new MockAdminService();
    await expect(service.resolveReport(report.reportId, { action: 'DISMISS', reason: '', confirm: true }, { actorSession: admin }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    const resolved = await service.resolveReport(report.reportId, { action: 'DISMISS', reason: 'Insufficient evidence', confirm: true }, { actorSession: admin });
    expect(resolved.status).toBe('DISMISSED');
    expect(resolved.reviewedBy).toBe(admin.userId);
    await expect(service.resolveReport(report.reportId, { action: 'WARN_USER', reason: 'Late decision', confirm: true }, { actorSession: admin }))
      .rejects.toMatchObject({ code: 'CONFLICT' });
    expect(mockStore.privateProfiles.get('usr-student-sam')).toBeDefined();
  });

  it('blocks location deactivation when future confirmed bookings would be affected', async () => {
    const service = new MockAdminService();
    await expect(service.deactivateLocation('loc-pk-kelkar-2f', 'Maintenance', true, { actorSession: admin }))
      .rejects.toMatchObject({ code: 'CONFLICT' });
    expect(mockStore.bookings.get('bk-1001')?.status).toBe('CONFIRMED');
  });

  it('creates resources with integrity validation, fixed capacity and redacted audits', async () => {
    const service = new MockAdminService();
    const location = await service.createLocation({
      locationId: 'loc-new',
      name: 'Innovation Room',
      building: 'Block C',
      totalTables: 1,
      openTime: '08:00',
      closeTime: '20:00',
      hasPowerOutlets: true,
      hasWifi6: true,
      noisePolicy: 'WHISPER_COLLAB',
    }, { actorSession: admin });
    const table = await service.createTable({ tableId: 'table-new', locationId: location.id, tableNumber: 'C-01', hasPowerOutlets: true }, { actorSession: admin });
    const slot = await service.createSlot({
      slotId: 'slot-new',
      locationId: location.id,
      tableId: table.tableId,
      tableNumber: table.tableNumber,
      zone: 'COLLABORATIVE_STUDY',
      startTime: '10:00',
      endTime: '12:00',
      date: '2026-10-20',
    }, { actorSession: admin });
    expect(table.capacity).toBe(2);
    expect(slot.capacity).toBe(2);
    expect(mockStore.auditLogs.some((entry) => entry.action === 'CREATE_SLOT')).toBe(true);
    await expect(service.createSlot({
      slotId: 'slot-overlap',
      locationId: location.id,
      tableId: table.tableId,
      tableNumber: table.tableNumber,
      zone: 'COLLABORATIVE_STUDY',
      startTime: '11:00',
      endTime: '13:00',
      date: '2026-10-20',
    }, { actorSession: admin })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(service.createTable({ tableId: 'bad-parent', locationId: 'missing', tableNumber: 'X', hasPowerOutlets: false }, { actorSession: admin }))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('protects future booking identifiers from resource edits and deactivation', async () => {
    const service = new MockAdminService();
    await expect(service.updateTable('tbl-pk-2f-10', { tableNumber: 'renamed' }, { actorSession: admin }))
      .rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(service.setTableActive('tbl-pk-2f-10', false, 'Maintenance', true, { actorSession: admin }))
      .rejects.toMatchObject({ code: 'CONFLICT' });
    expect(mockStore.bookings.get('bk-1001')?.status).toBe('CONFIRMED');
  });

  it('records suspension recommendations without applying account suspension', async () => {
    const moderation = new MockModerationService();
    const report = await moderation.reportUser('usr-student-sam', 'OTHER', undefined, { actorSession: student });
    const service = new MockAdminService();
    const resolved = await service.resolveReport(report.reportId, { action: 'SUSPEND_USER', reason: 'Review required', confirm: true }, { actorSession: admin });
    expect(resolved.status).toBe('SUSPENDED');
    expect(mockStore.sessions.get('sam')?.role).toBe('ROLE_STUDENT');
    expect(mockStore.privateProfiles.get('usr-student-sam')?.studyConsent.hasConsent).toBe(true);
  });

  it('admin cancellation reuses booking service, notifies participants, and writes redacted audit data', async () => {
    const service = new MockAdminService();
    const booking = await service.cancelBooking('bk-1001', 'Facility closure', true, { actorSession: admin });
    expect(booking.status).toBe('CANCELLED');
    expect(mockStore.auditLogs.some((entry) => entry.action === 'ADMIN_CANCEL_BOOKING')).toBe(true);
    expect(mockStore.auditLogs.every((entry) => !entry.details.includes('email'))).toBe(true);
    const participantNotifications = Array.from(mockStore.notifications.values()).filter(
      (notification) => notification.eventType === 'BOOKING_CANCELLED'
    );
    expect(participantNotifications.map((item) => item.recipientId).sort()).toEqual(
      ['usr-student-alex', 'usr-student-sam'].sort()
    );
  });

  it('production admin adapter remains explicitly unavailable', async () => {
    const unavailable = new UnavailableServiceAdapter();
    await expect(unavailable.admin.getDashboardSummary({ actorSession: admin })).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  it('uses typed app errors for invalid direct operations', async () => {
    const service = new MockAdminService();
    await expect(service.getUser('missing', { actorSession: admin })).rejects.toBeInstanceOf(AppError);
  });
});
