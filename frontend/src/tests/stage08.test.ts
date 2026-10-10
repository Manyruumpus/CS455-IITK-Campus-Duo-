import { beforeEach, describe, expect, it } from 'vitest';
import { MockBookingService } from '@/services/mock/MockBookingService';
import { mockStore } from '@/mocks/store';
import { ErrorCode, UserSession } from '@/types';

const ALEX: UserSession = {
  userId: 'usr-student-alex',
  email: 'alex.rivera@campusduo.test',
  name: 'Alex Rivera',
  rollNumber: '200001',
  role: 'ROLE_STUDENT',
  isOnboarded: true,
  hasStudyConsent: true,
  hasSocialConsent: true,
};

const SAM: UserSession = {
  userId: 'usr-student-sam',
  email: 'samira.patel@campusduo.test',
  name: 'Samira Patel',
  rollNumber: '200002',
  role: 'ROLE_STUDENT',
  isOnboarded: true,
  hasStudyConsent: true,
  hasSocialConsent: true,
};

const context = (actorSession: UserSession) => ({ actorSession });

describe('Stage 08 — canonical study-table booking workflow', () => {
  beforeEach(() => {
    mockStore.reset();
  });

  it('rejects the former legacy pair when reciprocal STUDY Likes are absent', async () => {
    mockStore.studyLikes.clear();
    const service = new MockBookingService();

    await expect(service.createBooking({
      tableId: 'tbl-pk-2f-10',
      locationId: 'loc-pk-kelkar-2f',
      localDate: '2026-10-08',
      slotId: 'slot-pk-10-14',
      companionStudentId: SAM.userId,
    }, context(ALEX))).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });

  it('accepts reciprocal STUDY Likes and rejects SOCIAL-only relationships', async () => {
    const service = new MockBookingService();
    const booking = await service.createBooking({
      tableId: 'tbl-pk-2f-10',
      locationId: 'loc-pk-kelkar-2f',
      localDate: '2026-10-08',
      slotId: 'slot-pk-10-14',
      companionStudentId: SAM.userId,
      clientOperationId: 'stage08-study-eligible',
    }, context(ALEX));
    expect(booking.participants).toHaveLength(2);

    await service.cancelBooking(booking.bookingId, context(ALEX));
    mockStore.studyLikes.clear();
    mockStore.studyLikes.set(ALEX.userId, new Set());
    mockStore.studyLikes.set(SAM.userId, new Set());
    const socialOnly = await service.createBooking({
      tableId: 'tbl-pk-2f-10',
      locationId: 'loc-pk-kelkar-2f',
      localDate: '2026-10-08',
      slotId: 'slot-pk-10-14',
      companionStudentId: SAM.userId,
    }, context(ALEX)).catch((error) => error);
    expect(socialOnly.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('rejects tampered resources and slots before mutation', async () => {
    const service = new MockBookingService();
    await expect(service.listTableAvailability('loc-missing', '2026-10-08', context(ALEX)))
      .rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    await expect(service.createBooking({
      tableId: 'tbl-pk-2f-10',
      locationId: 'loc-pk-kelkar-2f',
      localDate: '2026-10-08',
      slotId: 'slot-missing',
    }, context(ALEX))).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
  });

  it('conflicts atomically and preserves the original booking during failed reschedule', async () => {
    const service = new MockBookingService();
    const original = await service.createBooking({
      tableId: 'tbl-pk-2f-10',
      locationId: 'loc-pk-kelkar-2f',
      localDate: '2026-10-08',
      slotId: 'slot-pk-10-14',
      companionStudentId: SAM.userId,
      clientOperationId: 'stage08-conflict-original',
    }, context(ALEX));

    await expect(service.rescheduleBooking({
      bookingId: original.bookingId,
      newLocalDate: '2026-10-08',
      newSlotId: 'slot-pk-10-16',
    }, context(ALEX))).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
    const unchanged = await service.getBooking(original.bookingId, context(ALEX));
    expect(unchanged.localDate).toBe('2026-10-08');
    expect(unchanged.slotId).toBe('slot-pk-10-14');
  });

  it('cancellation converges and releases occupancy', async () => {
    const service = new MockBookingService();
    const booking = await service.createBooking({
      tableId: 'tbl-pk-2f-10',
      locationId: 'loc-pk-kelkar-2f',
      localDate: '2026-10-08',
      slotId: 'slot-pk-10-14',
      companionStudentId: SAM.userId,
      clientOperationId: 'stage08-cancel-idempotent',
    }, context(ALEX));
    await service.cancelBooking(booking.bookingId, context(ALEX));
    const repeated = await service.cancelBooking(booking.bookingId, context(ALEX));
    expect(repeated.status).toBe('CANCELLED');
    expect((await service.listTableAvailability('loc-pk-kelkar-2f', '2026-10-08', context(ALEX)))
      .find((slot) => slot.slotId === 'slot-pk-10-14')?.status).toBe('AVAILABLE');
  });
});
