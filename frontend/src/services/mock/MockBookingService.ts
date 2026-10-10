import {
  IBookingService,
  ServiceContext,
} from '@/services/interfaces';
import {
  StudyTableSlot,
  BookingRecord,
  BookingCreationRequest,
  BookingRescheduleRequest,
  BookingParticipant,
  UserRole,
  AppError,
} from '@/types';
import { mockStore, SEED_LOCATIONS } from '@/mocks/store';
import { scenarioManager } from '@/mocks/scenarios';
import { getAppConfig } from '@/config/features';
import { hasMutualStudyConnection } from './studyConnectionEligibility';
import { emitNotification } from './notificationEvents';

function computeAllowedActions(
  booking: BookingRecord,
  actorUserId: string,
  actorRole: UserRole
): ('CANCEL' | 'RESCHEDULE')[] {
  if (booking.status === 'CANCELLED') return [];
  if (actorRole === 'ROLE_ADMIN') return ['CANCEL', 'RESCHEDULE'];

  const participant = booking.participants.find((p) => p.userId === actorUserId);
  if (!participant) return [];

  // Provisional Demo Policy: Only the booking creator may cancel or reschedule.
  if (participant.role === 'CREATOR') {
    return ['CANCEL', 'RESCHEDULE'];
  }

  // Companion participants have read-only access under current demo policy
  return [];
}

export class MockBookingService implements IBookingService {
  private static configuredPolicyOverride?: 'AUTO_APPROVED_DEMO' | 'REQUIRES_EXPLICIT_APPROVAL';

  public static setPartnerApprovalPolicy(
    policy?: 'AUTO_APPROVED_DEMO' | 'REQUIRES_EXPLICIT_APPROVAL'
  ): void {
    MockBookingService.configuredPolicyOverride = policy;
  }

  public static getPartnerApprovalPolicy(): 'AUTO_APPROVED_DEMO' | 'REQUIRES_EXPLICIT_APPROVAL' {
    if (MockBookingService.configuredPolicyOverride) {
      return MockBookingService.configuredPolicyOverride;
    }
    return getAppConfig().demoPartnerApprovalPolicy;
  }

  public async listTableAvailability(
    locationId: string,
    date: string,
    context: ServiceContext
  ): Promise<StudyTableSlot[]> {
    await scenarioManager.applyScenario(context.signal);

    if (!mockStore.locations.has(locationId) || mockStore.locations.get(locationId)?.active === false) {
      throw new AppError('NOT_FOUND', 'Selected booking location is unavailable');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
      throw new AppError('VALIDATION_ERROR', 'A valid local campus date is required');
    }

    const baseSlots = Array.from(mockStore.slots.values()).filter(
      (s) => s.locationId === locationId &&
        s.date === date &&
        s.status !== 'LOCKED_MAINTENANCE' &&
        (s.tableId ? mockStore.tables.get(s.tableId)?.active !== false : true)
    );

    // Compute live slot occupancy based on active bookings
    return baseSlots.map((slot) => {
      const activeBooking = Array.from(mockStore.bookings.values()).find(
        (b) =>
          b.locationId === slot.locationId &&
          b.localDate === slot.date &&
          b.slotId === slot.slotId &&
          b.status === 'CONFIRMED'
      );

      return {
        ...slot,
        status: activeBooking ? 'OCCUPIED' : 'AVAILABLE',
        reservedCount: activeBooking ? 2 : 0,
      };
    });
  }

  public async listLocations(context: ServiceContext) {
    await scenarioManager.applyScenario(context.signal);
    return Array.from(mockStore.locations.values())
      .filter((location) => location.active !== false)
      .map((location) => ({ ...location }));
  }

  public async getBooking(
    bookingId: string,
    context: ServiceContext
  ): Promise<BookingRecord> {
    await scenarioManager.applyScenario(context.signal);

    const actor = context.actorSession;
    if (!actor) {
      throw new AppError('UNAUTHENTICATED', 'Sign in required to view booking');
    }

    const booking = mockStore.bookings.get(bookingId);
    if (!booking) {
      throw new AppError('NOT_FOUND', `Booking ${bookingId} not found`);
    }

    // Both explicit participants (creator & companion) and admins can read booking detail
    const isParticipant = booking.participants.some((p) => p.userId === actor.userId);
    const isAdmin = actor.role === 'ROLE_ADMIN';

    if (!isParticipant && !isAdmin) {
      throw new AppError(
        'FORBIDDEN',
        'You do not have permission to view this reservation record'
      );
    }

    return {
      ...booking,
      allowedActions: computeAllowedActions(booking, actor.userId, actor.role),
    };
  }

  public async createBooking(
    request: BookingCreationRequest,
    context: ServiceContext
  ): Promise<BookingRecord> {
    await scenarioManager.applyScenario(context.signal);

    const actor = context.actorSession;
    if (!actor) {
      throw new AppError('UNAUTHENTICATED', 'Sign in required to create booking');
    }

    // Proposed frontend/mock contract: Check clientOperationId idempotency
    if (request.clientOperationId) {
      const existingAttempt = Array.from(mockStore.bookings.values()).find(
        (b) => b.clientOperationId === request.clientOperationId
      );
      if (existingAttempt) {
        if (existingAttempt.participants.some((p) => p.userId === actor.userId)) {
          return {
            ...existingAttempt,
            allowedActions: computeAllowedActions(existingAttempt, actor.userId, actor.role),
          };
        } else {
          throw new AppError(
            'FORBIDDEN',
            'Operation ID belongs to another session attempt.'
          );
        }
      }
    }

    // Validate distinct participants & prevent self-booking
    if (request.companionStudentId) {
      if (request.companionStudentId === actor.userId) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Self-booking is prohibited. Duo tables require exactly two distinct participants.'
        );
      }

      // Check configured partner approval policy
      const policy = MockBookingService.getPartnerApprovalPolicy();
      if (policy === 'REQUIRES_EXPLICIT_APPROVAL') {
        throw new AppError(
          'UNSUPPORTED_ACTION',
          'Explicit partner approval workflow is unsupported under current provisional policy pending team/user approval. No slot has been held or modified.'
        );
      }
    }

    // Validate location and slot exist
    const slot = Array.from(mockStore.slots.values()).find(
      (s) =>
        s.slotId === request.slotId &&
        s.locationId === request.locationId &&
        s.date === request.localDate &&
        (!request.tableId || !s.tableId || s.tableId === request.tableId)
    );
    if (!slot) {
      throw new AppError('VALIDATION_ERROR', 'Selected table slot does not exist');
    }
    if (slot.status === 'LOCKED_MAINTENANCE' || (slot.tableId && mockStore.tables.get(slot.tableId)?.active === false)) {
      throw new AppError('UNSUPPORTED_ACTION', 'Bookings are disabled for this inactive table slot');
    }
    if (mockStore.locations.get(request.locationId)?.active === false) {
      throw new AppError('UNSUPPORTED_ACTION', 'Bookings are disabled for this inactive location');
    }

    // Enforce companion pair eligibility: must have established mutual study connection
    let companionDisplayName: string | undefined;
    if (request.companionStudentId) {
      if (!hasMutualStudyConnection(actor.userId, request.companionStudentId)) {
        throw new AppError(
          'FORBIDDEN',
          'Companion is not an active mutual study partner. Social-only connections or unconfirmed requests are ineligible for study table reservations.'
        );
      }

      companionDisplayName =
        request.companionStudentId === 'usr-student-sam'
          ? 'Samira Patel'
          : request.companionStudentId === 'usr-student-aarav'
          ? 'Aarav Sharma'
          : 'Study Partner';
    }

    // Atomic conflict check: slot must not have an active confirmed reservation
    const isSlotOccupied = Array.from(mockStore.bookings.values()).some(
      (b) =>
        b.locationId === request.locationId &&
        b.localDate === request.localDate &&
        b.slotId === request.slotId &&
        b.status === 'CONFIRMED'
    );

    if (isSlotOccupied) {
      throw new AppError(
        'CONFLICT',
        'This table slot has already been reserved by another student.'
      );
    }

    const loc = SEED_LOCATIONS.find((l) => l.id === request.locationId);
    const locationName = loc ? loc.name : 'PK Kelkar Library 2F';
    const newBookingId = `bk-${Date.now().toString().slice(-4)}-${Math.random().toString(36).substring(2, 6)}`;

    const participants: BookingParticipant[] = [
      {
        userId: actor.userId,
        role: 'CREATOR',
        displayName: actor.name,
      },
    ];

    if (request.companionStudentId) {
      participants.push({
        userId: request.companionStudentId,
        role: 'COMPANION',
        displayName: companionDisplayName || 'Study Companion',
      });
    }

    const newBooking: BookingRecord = {
      bookingId: newBookingId,
      bookerId: actor.userId,
      companionStudentId: request.companionStudentId,
      companionDisplayName,
      participants,
      clientOperationId: request.clientOperationId,
      tableId: request.tableId,
      locationId: request.locationId,
      localDate: request.localDate,
      slotId: request.slotId,
      tableNumber: slot.tableNumber,
      locationName,
      timeWindow: `${slot.startTime} – ${slot.endTime}`,
      status: 'CONFIRMED',
      allowedActions: ['CANCEL', 'RESCHEDULE'],
      partnerApprovalStatus: request.companionStudentId ? 'AUTO_ACCEPTED' : 'NOT_REQUIRED',
      createdAt: new Date().toISOString(),
    };

    // Commit write to in-memory store
    mockStore.bookings.set(newBookingId, newBooking);
    for (const participant of newBooking.participants) {
      emitNotification({
        recipientId: participant.userId,
        eventType: 'BOOKING_CREATED',
        mode: 'BOOKING',
        title: 'Study table booking confirmed',
        body: `Your simulated study-table booking for ${newBooking.localDate} at ${newBooking.timeWindow} is confirmed.`,
        destination: { kind: 'BOOKING', bookingId: newBookingId },
        dedupeKey: `booking-created-${newBookingId}`,
      });
    }

    // Scenario control: simulated uncertain mutation response
    if (scenarioManager.getScenario().forceUncertainMutation) {
      throw new AppError(
        'UNCERTAIN_MUTATION',
        'Reservation committed but response acknowledged uncertainly; reconcile via booking operation token.',
        { details: { clientOperationId: request.clientOperationId, bookingId: newBookingId } }
      );
    }

    return {
      ...newBooking,
      allowedActions: computeAllowedActions(newBooking, actor.userId, actor.role),
    };
  }

  public async reconcileBooking(
    clientOperationId: string,
    context: ServiceContext
  ): Promise<BookingRecord | null> {
    await scenarioManager.applyScenario(context.signal);

    const actor = context.actorSession;
    if (!actor) {
      throw new AppError('UNAUTHENTICATED', 'Sign in required to reconcile booking');
    }

    // Resolve strictly by clientOperationId AND participant actor
    const matched = Array.from(mockStore.bookings.values()).find(
      (b) =>
        b.clientOperationId === clientOperationId &&
        b.participants.some((p) => p.userId === actor.userId)
    );

    if (!matched) {
      return null;
    }

    return {
      ...matched,
      allowedActions: computeAllowedActions(matched, actor.userId, actor.role),
    };
  }

  public async rescheduleBooking(
    request: BookingRescheduleRequest,
    context: ServiceContext
  ): Promise<BookingRecord> {
    await scenarioManager.applyScenario(context.signal);

    const actor = context.actorSession;
    if (!actor) {
      throw new AppError('UNAUTHENTICATED', 'Sign in required to reschedule booking');
    }

    const existing = mockStore.bookings.get(request.bookingId);
    if (!existing) {
      throw new AppError('NOT_FOUND', `Booking ${request.bookingId} not found`);
    }

    const isCreator = existing.participants.some(
      (p) => p.userId === actor.userId && p.role === 'CREATOR'
    );
    const isCompanion = existing.participants.some(
      (p) => p.userId === actor.userId && p.role === 'COMPANION'
    );
    const isAdmin = actor.role === 'ROLE_ADMIN';

    if (isCompanion) {
      throw new AppError(
        'FORBIDDEN',
        'Under current demo policy, only the booking creator or administrator may reschedule this reservation.'
      );
    }

    if (!isCreator && !isAdmin) {
      throw new AppError('FORBIDDEN', 'Permission denied to reschedule this reservation');
    }

    // Check target slot availability
    const targetLocationId = request.newLocationId ?? existing.locationId;
    if (mockStore.locations.get(targetLocationId)?.active === false) {
      throw new AppError('UNSUPPORTED_ACTION', 'Replacement location is inactive.');
    }
    const targetSlot = Array.from(mockStore.slots.values()).find(
      (slot) =>
        slot.locationId === targetLocationId &&
        slot.slotId === request.newSlotId &&
        slot.date === request.newLocalDate &&
        (!request.newTableId || !slot.tableId || slot.tableId === request.newTableId)
    );
    if (!targetSlot) {
      throw new AppError('VALIDATION_ERROR', 'Replacement table slot does not exist or is unavailable.');
    }
    const targetOccupied = Array.from(mockStore.bookings.values()).some(
      (b) =>
        b.bookingId !== request.bookingId &&
        b.locationId === targetLocationId &&
        b.localDate === request.newLocalDate &&
        b.slotId === request.newSlotId &&
        b.status === 'CONFIRMED'
    );

    if (targetOccupied) {
      // Failed reschedule preserves the original booking intact
      throw new AppError(
        'CONFLICT',
        'Target slot is already occupied; original reservation remains active.'
      );
    }

    const updated: BookingRecord = {
      ...existing,
      tableId: request.newTableId ?? targetSlot.tableId ?? existing.tableId,
      localDate: request.newLocalDate,
      slotId: request.newSlotId,
      tableNumber: targetSlot.tableNumber,
      timeWindow: `${targetSlot.startTime} – ${targetSlot.endTime}`,
      locationId: targetLocationId,
      locationName: SEED_LOCATIONS.find((location) => location.id === targetLocationId)?.name ?? existing.locationName,
      rescheduledFromBookingId: existing.bookingId,
    };

    mockStore.bookings.set(request.bookingId, updated);
    for (const participant of updated.participants) {
      emitNotification({
        recipientId: participant.userId,
        eventType: 'BOOKING_RESCHEDULED',
        mode: 'BOOKING',
        title: 'Study table booking rescheduled',
        body: `Your simulated booking moved to ${updated.localDate} at ${updated.timeWindow}.`,
        destination: { kind: 'BOOKING', bookingId: updated.bookingId },
        dedupeKey: `booking-rescheduled-${updated.bookingId}-${updated.localDate}-${updated.slotId}`,
      });
    }
    return {
      ...updated,
      allowedActions: computeAllowedActions(updated, actor.userId, actor.role),
    };
  }

  public async cancelBooking(
    bookingId: string,
    context: ServiceContext
  ): Promise<BookingRecord> {
    await scenarioManager.applyScenario(context.signal);

    const actor = context.actorSession;
    if (!actor) {
      throw new AppError('UNAUTHENTICATED', 'Sign in required to cancel booking');
    }

    const booking = mockStore.bookings.get(bookingId);
    if (!booking) {
      throw new AppError('NOT_FOUND', `Booking ${bookingId} not found`);
    }

    const isCreator = booking.participants.some(
      (p) => p.userId === actor.userId && p.role === 'CREATOR'
    );
    const isCompanion = booking.participants.some(
      (p) => p.userId === actor.userId && p.role === 'COMPANION'
    );
    const isAdmin = actor.role === 'ROLE_ADMIN';

    if (isCompanion) {
      throw new AppError(
        'FORBIDDEN',
        'Under current demo policy, only the booking creator or administrator may cancel this reservation.'
      );
    }

    if (!isCreator && !isAdmin) {
      throw new AppError('FORBIDDEN', 'Permission denied to cancel this reservation');
    }

    // Idempotent: repeated cancellation converges to cancelled
    if (booking.status === 'CANCELLED') {
      return {
        ...booking,
        allowedActions: [],
      };
    }

    const cancelled: BookingRecord = {
      ...booking,
      status: 'CANCELLED',
      allowedActions: [],
      cancelledAt: new Date().toISOString(),
    };

    mockStore.bookings.set(bookingId, cancelled);
    for (const participant of cancelled.participants) {
      emitNotification({
        recipientId: participant.userId,
        eventType: 'BOOKING_CANCELLED',
        mode: 'BOOKING',
        title: 'Study table booking cancelled',
        body: `Your simulated study-table booking for ${cancelled.localDate} was cancelled.`,
        destination: { kind: 'BOOKING', bookingId },
        dedupeKey: `booking-cancelled-${bookingId}`,
      });
    }
    return {
      ...cancelled,
      allowedActions: [],
    };
  }

  public async getMyBookings(context: ServiceContext): Promise<BookingRecord[]> {
    await scenarioManager.applyScenario(context.signal);

    const actor = context.actorSession;
    if (!actor) {
      throw new AppError('UNAUTHENTICATED', 'Sign in required to view reservations');
    }

    // Both creators and companions see the booking in their reservation history
    return Array.from(mockStore.bookings.values())
      .filter((b) => b.participants.some((p) => p.userId === actor.userId))
      .map((b) => ({
        ...b,
        allowedActions: computeAllowedActions(b, actor.userId, actor.role),
      }));
  }
}
