import crypto from 'crypto';
import { getClient } from '../config/db';
import { BookingRepository, DbBookingDetailRow, DbSlotValidationRow } from '../repository/bookingRepo';
import {
  ActorContext,
  BookingCreationRequest,
  BookingCancelRequest,
  BookingRescheduleRequest,
  BookingRecord,
  CampusLocation,
  DomainError,
  StudyTableSlot,
  SlotStatus
} from '../types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function computePayloadFingerprint(payload: {
  tableId: string;
  locationId: string;
  localDate: string;
  slotId: string;
  companionStudentId: string;
}): string {
  const canonical = JSON.stringify({
    companionStudentId: payload.companionStudentId.toLowerCase(),
    localDate: payload.localDate,
    locationId: payload.locationId.toLowerCase(),
    slotId: payload.slotId.toLowerCase(),
    tableId: payload.tableId.toLowerCase()
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

export class BookingService {
  constructor(private readonly repo: BookingRepository = new BookingRepository()) {}

  async getLocations(): Promise<CampusLocation[]> {
    const rows = await this.repo.getLocations();

    return rows.map((r): CampusLocation => {
      const formatTime = (t: string): string => {
        if (!t) return '';
        const parts = t.split(':');
        if (parts.length >= 2) {
          return `${parts[0]}:${parts[1]}`;
        }
        return t;
      };

      return {
        id: r.location_id,
        name: r.name,
        building: r.building,
        totalTables: Number(r.total_tables) || 0,
        openTime: formatTime(r.open_time),
        closeTime: formatTime(r.close_time),
        hasPowerOutlets: Boolean(r.has_power_outlets),
        hasWifi6: Boolean(r.has_wifi6),
        noisePolicy: r.noise_policy as any,
        active: Boolean(r.active)
      };
    });
  }

  private mapDbRowToBookingRecord(row: DbBookingDetailRow, actorUserId: string): BookingRecord {
    const formatTime = (t: string): string => {
      if (!t) return '';
      const parts = t.split(':');
      return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : t;
    };

    const startTimeFormatted = formatTime(row.start_time);
    const endTimeFormatted = formatTime(row.end_time);
    const timeWindow = `${startTimeFormatted} - ${endTimeFormatted}`;

    const participants = (row.participants || []).map((p) => ({
      userId: p.userId,
      displayName: p.displayName || (p.role === 'CREATOR' ? 'Booking Creator' : 'Study Companion'),
      role: p.role
    }));

    const companion = participants.find((p) => p.role === 'COMPANION');
    const isCreator = row.booker_id.toLowerCase() === actorUserId.toLowerCase();

    return {
      bookingId: row.booking_id,
      bookerId: row.booker_id,
      participants,
      companionStudentId: companion?.userId,
      companionDisplayName: companion?.displayName,
      tableId: row.table_id,
      tableNumber: row.table_number,
      locationId: row.location_id,
      locationName: row.location_name,
      localDate: row.local_date,
      slotId: row.slot_id,
      timeWindow,
      status: row.status as any,
      allowedActions: isCreator && row.status === 'CONFIRMED' ? ['CANCEL', 'RESCHEDULE'] : [],
      partnerApprovalStatus: (row.partner_approval_status as any) || 'NOT_REQUIRED',
      bookingVersion: row.booking_version,
      createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(row.created_at).toISOString(),
      cancelledAt: row.cancelled_at
        ? (typeof row.cancelled_at === 'string' ? row.cancelled_at : new Date(row.cancelled_at).toISOString())
        : undefined,
      rescheduledFromBookingId: row.rescheduled_from_booking_id || undefined
    };
  }

  /**
   * Retrieves single authenticated booking record if the actor is authorized.
   */
  async getBooking(actor: ActorContext, bookingId: string): Promise<BookingRecord> {
    if (!bookingId || !UUID_REGEX.test(bookingId)) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Invalid UUID format for bookingId');
    }

    const exists = await this.repo.checkBookingExists(bookingId);
    if (!exists) {
      throw new DomainError('NOT_FOUND', 404, `Booking with ID ${bookingId} not found`);
    }

    const isAdmin = actor.role === 'ROLE_ADMIN';
    const row = await this.repo.getBookingDetail(bookingId, actor.userId, undefined, isAdmin);
    if (!row) {
      throw new DomainError('FORBIDDEN', 403, 'You are not authorized to view this booking');
    }

    return this.mapDbRowToBookingRecord(row, actor.userId);
  }

  /**
   * Retrieves participant-authorized booking history for the current viewer.
   */
  async getMyBookings(actor: ActorContext, limit: number = 50): Promise<BookingRecord[]> {
    const clampedLimit = Math.max(1, Math.min(50, Math.floor(limit)));
    const rows = await this.repo.getMyBookings(actor.userId, clampedLimit);
    return rows.map((r) => this.mapDbRowToBookingRecord(r, actor.userId));
  }

  async getAvailability(
    startDate: string,
    endDate: string,
    locationId: string | null,
    limit: number = 100
  ): Promise<StudyTableSlot[]> {
    if (!startDate || !DATE_REGEX.test(startDate)) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Invalid or missing startDate (expected YYYY-MM-DD)');
    }
    if (!endDate || !DATE_REGEX.test(endDate)) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Invalid or missing endDate (expected YYYY-MM-DD)');
    }
    if (startDate > endDate) {
      throw new DomainError('VALIDATION_ERROR', 400, 'startDate must be less than or equal to endDate');
    }
    if (locationId !== null && !UUID_REGEX.test(locationId)) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Invalid UUID format for locationId');
    }

    const clampedLimit = Math.max(1, Math.min(100, Math.floor(limit)));

    const rows = await this.repo.getAvailability(startDate, endDate, locationId, clampedLimit);

    return rows.map((r): StudyTableSlot => {
      let derivedStatus: SlotStatus = 'AVAILABLE';
      if (r.reserved_count >= 2) {
        derivedStatus = 'OCCUPIED';
      } else if (r.status !== 'AVAILABLE') {
        derivedStatus = r.status as SlotStatus;
      }

      return {
        slotId: r.slot_id,
        locationId: r.location_id,
        locationName: r.location_name,
        building: r.building,
        tableId: r.table_id,
        tableNumber: r.table_number,
        date: r.local_date,
        startTime: r.start_time,
        endTime: r.end_time,
        zone: r.zone as any,
        status: derivedStatus,
        capacity: r.capacity,
        reservedCount: Number(r.reserved_count)
      };
    });
  }

  async createBooking(
    actor: ActorContext,
    request: BookingCreationRequest,
    requestId: string
  ): Promise<{ record: BookingRecord; isReplay: boolean }> {
    // 1. Strict Validation
    if (!request.clientOperationId || typeof request.clientOperationId !== 'string' || request.clientOperationId.trim().length === 0) {
      throw new DomainError('VALIDATION_ERROR', 400, 'clientOperationId is required and must not be blank');
    }
    if (!request.tableId || !UUID_REGEX.test(request.tableId)) {
      throw new DomainError('VALIDATION_ERROR', 400, 'tableId must be a valid UUID');
    }
    if (!request.locationId || !UUID_REGEX.test(request.locationId)) {
      throw new DomainError('VALIDATION_ERROR', 400, 'locationId must be a valid UUID');
    }
    if (!request.slotId || !UUID_REGEX.test(request.slotId)) {
      throw new DomainError('VALIDATION_ERROR', 400, 'slotId must be a valid UUID');
    }
    if (!request.companionStudentId || !UUID_REGEX.test(request.companionStudentId)) {
      throw new DomainError('VALIDATION_ERROR', 400, 'companionStudentId must be a valid UUID');
    }
    if (!request.localDate || !DATE_REGEX.test(request.localDate)) {
      throw new DomainError('VALIDATION_ERROR', 400, 'localDate must be a valid date formatted YYYY-MM-DD');
    }

    if (request.companionStudentId.toLowerCase() === actor.userId.toLowerCase()) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Actor cannot book a table with themselves as companion');
    }

    const fingerprint = computePayloadFingerprint(request);

    // 2. Transaction Orchestration
    const client = await getClient();

    try {
      await client.query('BEGIN;');

      // 2a. Idempotency Check: (actor_user_id, client_operation_id)
      const existingIdempotency = await this.repo.findIdempotencyRecord(
        client,
        actor.userId,
        'CREATE_BOOKING',
        request.clientOperationId
      );

      if (existingIdempotency) {
        if (existingIdempotency.request_fingerprint === fingerprint) {
          // Identical retry: return stored outcome
          await client.query('ROLLBACK;');
          return {
            record: existingIdempotency.response_reference as BookingRecord,
            isReplay: true
          };
        } else {
          // Reused operation ID with altered payload: 409 Conflict
          await client.query('ROLLBACK;');
          throw new DomainError(
            'CONFLICT',
            409,
            'Client operation ID was already used with a different request payload'
          );
        }
      }

      // 2b. Companion Eligibility & Existence Check
      const companion = await this.repo.findUserAccount(client, request.companionStudentId);
      if (
        !companion ||
        companion.role !== 'ROLE_STUDENT' ||
        companion.account_status !== 'ACTIVE' ||
        companion.verification_status !== 'VERIFIED'
      ) {
        throw new DomainError('FORBIDDEN', 403, 'Companion is not an active verified student');
      }

      // 2c. Mutual STUDY Connection Authorization
      const connection = await this.repo.findActiveMutualStudyConnection(
        client,
        actor.userId,
        request.companionStudentId
      );
      if (!connection) {
        throw new DomainError(
          'FORBIDDEN',
          403,
          'No active mutual STUDY connection exists between participants'
        );
      }

      // 2d. Consent Policy: Both participants must have active STUDY consent
      const consentedUsers = await this.repo.getStudyConsentUserIds(client, [
        actor.userId,
        request.companionStudentId
      ]);
      if (consentedUsers.length !== 2) {
        throw new DomainError(
          'FORBIDDEN',
          403,
          'Both participants must have active STUDY consent'
        );
      }

      // 2e. Block Policy: Neither participant may block the other
      const isBlocked = await this.repo.hasActiveBlock(client, actor.userId, request.companionStudentId);
      if (isBlocked) {
        throw new DomainError(
          'FORBIDDEN',
          403,
          'An active block exists between participants'
        );
      }

      // 2f. Resource & Slot Validation
      const slotResource = await this.repo.findSlotResource(
        client,
        request.slotId,
        request.tableId,
        request.locationId,
        request.localDate
      );
      if (!slotResource) {
        throw new DomainError('NOT_FOUND', 404, 'The requested study slot or resource was not found');
      }
      if (
        !slotResource.active ||
        slotResource.status !== 'AVAILABLE' ||
        !slotResource.table_active ||
        !slotResource.location_active
      ) {
        throw new DomainError(
          'CONFLICT',
          409,
          'The requested study slot or resource is not available for reservation'
        );
      }

      // 2g. Insert Booking with Partial Unique Index Guard
      let bookingRow;
      try {
        bookingRow = await this.repo.insertBooking(client, {
          connectionId: connection.connection_id,
          bookerId: actor.userId,
          tableId: request.tableId,
          locationId: request.locationId,
          slotId: request.slotId,
          localDate: request.localDate
        });
      } catch (insertErr: any) {
        // Translate the specific unique constraint collision to 409 Conflict
        if (insertErr && insertErr.code === '23505' && insertErr.constraint === 'booking_confirmed_resource_uk') {
          throw new DomainError(
            'CONFLICT',
            409,
            'The study table slot is already booked for this date and time'
          );
        }
        // Do not mask unrelated database errors
        throw insertErr;
      }

      // 2h. Insert Both Participants (CREATOR and COMPANION)
      await this.repo.insertParticipants(
        client,
        bookingRow.booking_id,
        actor.userId,
        request.companionStudentId
      );

      // 2i. Insert Audit Event
      await this.repo.insertAuditEvent(client, {
        actorUserId: actor.userId,
        actorRole: actor.role,
        targetId: bookingRow.booking_id,
        correlationId: requestId,
        operationId: request.clientOperationId,
        safeReason: 'Study table reservation confirmed'
      });

      // 2j. Insert Outbox Event
      const outboxPayload = {
        bookingId: bookingRow.booking_id,
        bookerId: actor.userId,
        companionStudentId: request.companionStudentId,
        tableId: request.tableId,
        locationId: request.locationId,
        slotId: request.slotId,
        localDate: request.localDate
      };

      await this.repo.insertOutboxEvent(client, {
        aggregateId: bookingRow.booking_id,
        dedupeKey: `booking-created:${bookingRow.booking_id}`,
        payload: outboxPayload,
        correlationId: requestId
      });

      const formatTime = (t: string): string => {
        if (!t) return '';
        const parts = t.split(':');
        return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : t;
      };
      const timeWindow = `${formatTime(slotResource.start_time)} - ${formatTime(slotResource.end_time)}`;

      // Assemble final response record
      const bookingRecord: BookingRecord = {
        bookingId: bookingRow.booking_id,
        bookerId: bookingRow.booker_id,
        clientOperationId: request.clientOperationId,
        participants: [
          { userId: actor.userId, displayName: actor.displayName, role: 'CREATOR' },
          { userId: companion.user_id, displayName: companion.display_name, role: 'COMPANION' }
        ],
        companionStudentId: companion.user_id,
        companionDisplayName: companion.display_name,
        tableId: bookingRow.table_id,
        tableNumber: slotResource.table_number,
        locationId: bookingRow.location_id,
        locationName: slotResource.location_name,
        localDate: bookingRow.local_date,
        slotId: bookingRow.slot_id,
        timeWindow,
        status: 'CONFIRMED',
        allowedActions: ['CANCEL', 'RESCHEDULE'],
        partnerApprovalStatus: 'NOT_REQUIRED',
        bookingVersion: bookingRow.booking_version,
        createdAt: bookingRow.created_at
      };

      // 2k. Insert Final Outcome Idempotency Record
      await this.repo.insertIdempotencyRecord(client, {
        actorUserId: actor.userId,
        clientOperationId: request.clientOperationId,
        requestFingerprint: fingerprint,
        outcomeStatus: 'SUCCEEDED',
        bookingId: bookingRow.booking_id,
        responseReference: bookingRecord
      });

      // Commit only if every required write succeeds!
      await client.query('COMMIT;');

      return { record: bookingRecord, isReplay: false };
    } catch (err) {
      await client.query('ROLLBACK;');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Transactionally cancels an existing reservation.
   * Authorization: Only booking CREATOR (booker) or ROLE_ADMIN may cancel.
   * COMPANION or unrelated users are rejected with 403.
   * Repeat cancellation is safe and returns the cancelled booking record.
   */
  async cancelBooking(
    actor: ActorContext,
    bookingId: string,
    reason?: string,
    clientOperationId?: string,
    requestId?: string
  ): Promise<{ record: BookingRecord; isReplay: boolean }> {
    if (!bookingId || !UUID_REGEX.test(bookingId)) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Invalid UUID format for bookingId');
    }

    const exists = await this.repo.checkBookingExists(bookingId);
    if (!exists) {
      throw new DomainError('NOT_FOUND', 404, `Booking with ID ${bookingId} not found`);
    }

    const client = await getClient();

    try {
      await client.query('BEGIN;');

      const safeReason = reason && reason.trim().length > 0 ? reason.trim() : 'User requested cancellation';
      const canonicalCancel = JSON.stringify({
        bookingId: bookingId.toLowerCase()
      });
      const cancelFingerprint = crypto.createHash('sha256').update(canonicalCancel).digest('hex');

      // 1. Idempotency replay check
      if (clientOperationId && clientOperationId.trim().length > 0) {
        const existingIdem = await this.repo.findIdempotencyRecord(
          client,
          actor.userId,
          'CANCEL_BOOKING',
          clientOperationId
        );
        if (existingIdem) {
          if (existingIdem.request_fingerprint === cancelFingerprint) {
            await client.query('ROLLBACK;');
            return {
              record: existingIdem.response_reference as BookingRecord,
              isReplay: true
            };
          } else {
            await client.query('ROLLBACK;');
            throw new DomainError(
              'CONFLICT',
              409,
              'Client operation ID was already used with a different request payload'
            );
          }
        }
      }

      // 2. Lock booking FOR UPDATE
      const booking = await this.repo.findBookingForUpdate(client, bookingId);
      if (!booking) {
        await client.query('ROLLBACK;');
        throw new DomainError('NOT_FOUND', 404, `Booking with ID ${bookingId} not found`);
      }

      // 3. Authorization check
      const isCreator = booking.booker_id.toLowerCase() === actor.userId.toLowerCase();
      const isAdmin = actor.role === 'ROLE_ADMIN';
      if (!isCreator && !isAdmin) {
        const isCompanion = booking.participants.some(
          (p) => p.userId.toLowerCase() === actor.userId.toLowerCase() && p.role === 'COMPANION'
        );
        await client.query('ROLLBACK;');
        if (isCompanion) {
          throw new DomainError(
            'FORBIDDEN',
            403,
            'Under current demo policy, only the booking creator or administrator may cancel or reschedule this reservation.'
          );
        } else {
          throw new DomainError('FORBIDDEN', 403, 'You are not authorized to cancel this reservation');
        }
      }

      // 4. Repeated cancellation idempotency: if already cancelled, return existing cancelled state
      if (booking.status === 'CANCELLED') {
        const cancelledDetail = await this.repo.getBookingDetail(bookingId, actor.userId, client, isAdmin);
        await client.query('COMMIT;');
        const safeRecord: BookingRecord = cancelledDetail
          ? this.mapDbRowToBookingRecord(cancelledDetail, actor.userId)
          : {
              bookingId: booking.booking_id,
              bookerId: booking.booker_id,
              tableId: booking.table_id,
              locationId: booking.location_id,
              slotId: booking.slot_id,
              localDate: booking.local_date,
              status: 'CANCELLED',
              allowedActions: [],
              partnerApprovalStatus: (booking.partner_approval_status as any) || 'NOT_REQUIRED',
              bookingVersion: booking.booking_version,
              createdAt: typeof booking.created_at === 'string' ? booking.created_at : new Date(booking.created_at).toISOString(),
              cancelledAt: typeof booking.updated_at === 'string' ? booking.updated_at : new Date(booking.updated_at).toISOString(),
              participants: booking.participants.map(p => ({
                userId: p.userId,
                displayName: p.displayName,
                role: p.role,
                joinedAt: p.joinedAt,
                removedAt: p.removedAt || undefined
              }))
            };
        return {
          record: safeRecord,
          isReplay: true
        };
      }

      if (booking.status !== 'CONFIRMED') {
        await client.query('ROLLBACK;');
        throw new DomainError('CONFLICT', 409, `Only confirmed bookings can be cancelled (current status: ${booking.status})`);
      }

      // 5. Update booking status to CANCELLED (satisfies booking_cancel_fields_ck)
      const updatedRow = await this.repo.cancelBookingInTx(client, bookingId, actor.userId, safeReason);
      const newVersion = updatedRow.booking_version;

      // 6. Insert audit event
      const correlationId = requestId || `req-cancel-${bookingId}`;
      const opId = clientOperationId || `op-cancel-${bookingId}`;
      await this.repo.insertAuditEvent(client, {
        actorUserId: actor.userId,
        actorRole: actor.role,
        targetId: bookingId,
        correlationId,
        operationId: opId,
        safeReason,
        action: 'BOOKING_CANCELLED'
      });

      // 7. Insert outbox event
      await client.query('SAVEPOINT outbox_savepoint;');
      try {
        await this.repo.insertOutboxEvent(client, {
          aggregateId: bookingId,
          dedupeKey: `booking-cancelled:${bookingId}:${newVersion}`,
          payload: {
            bookingId,
            bookerId: booking.booker_id,
            cancelledBy: actor.userId,
            reason: safeReason,
            version: newVersion
          },
          correlationId,
          eventType: 'BOOKING_CANCELLED'
        });
        await client.query('RELEASE SAVEPOINT outbox_savepoint;');
      } catch (outboxErr: any) {
        await client.query('ROLLBACK TO SAVEPOINT outbox_savepoint;');
        if (outboxErr && outboxErr.code === '23505' && (outboxErr.constraint === 'outbox_event_dedupe_uk' || String(outboxErr.message).includes('outbox_event_dedupe_uk'))) {
          // Outbox event with this dedupe_key already present; continue cleanly
        } else {
          throw outboxErr;
        }
      }

      // 8. Retrieve complete updated booking record
      const detailRow = await this.repo.getBookingDetail(bookingId, actor.userId, client, isAdmin);
      const cancelledRecord: BookingRecord = detailRow
        ? this.mapDbRowToBookingRecord(detailRow, actor.userId)
        : {
            bookingId: updatedRow.booking_id,
            bookerId: updatedRow.booker_id,
            tableId: updatedRow.table_id,
            locationId: updatedRow.location_id,
            slotId: updatedRow.slot_id,
            localDate: updatedRow.local_date,
            status: 'CANCELLED',
            allowedActions: [],
            partnerApprovalStatus: (updatedRow.partner_approval_status as any) || 'NOT_REQUIRED',
            bookingVersion: updatedRow.booking_version,
            createdAt: typeof updatedRow.created_at === 'string' ? updatedRow.created_at : new Date(updatedRow.created_at).toISOString(),
            cancelledAt: new Date().toISOString(),
            participants: booking.participants.map(p => ({
              userId: p.userId,
              displayName: p.displayName,
              role: p.role,
              joinedAt: p.joinedAt,
              removedAt: p.removedAt || undefined
            }))
          };

      // 9. Insert idempotency record if clientOperationId was provided
      if (clientOperationId && clientOperationId.trim().length > 0) {
        await this.repo.insertIdempotencyRecord(client, {
          actorUserId: actor.userId,
          clientOperationId,
          requestFingerprint: cancelFingerprint,
          outcomeStatus: 'SUCCEEDED',
          bookingId,
          responseReference: cancelledRecord,
          operationType: 'CANCEL_BOOKING'
        });
      }

      await client.query('COMMIT;');
      return { record: cancelledRecord, isReplay: false };
    } catch (err) {
      await client.query('ROLLBACK;');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Atomically reschedules an existing reservation to a new table slot and date.
   * Guarantees that the original booking remains completely intact if the replacement conflicts.
   * Authorization: Only booking CREATOR (booker) or ROLE_ADMIN may reschedule.
   * Single direct successor rule enforced: cannot reschedule an already rescheduled booking.
   */
  async rescheduleBooking(
    actor: ActorContext,
    request: BookingRescheduleRequest,
    requestId?: string
  ): Promise<{ record: BookingRecord; isReplay: boolean }> {
    const bookingId = request.bookingId;
    if (!bookingId || !UUID_REGEX.test(bookingId)) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Invalid UUID format for bookingId');
    }
    if (!request.newLocalDate || !DATE_REGEX.test(request.newLocalDate)) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Invalid or missing newLocalDate (expected YYYY-MM-DD)');
    }
    if (!request.newSlotId || !UUID_REGEX.test(request.newSlotId)) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Invalid UUID format for newSlotId');
    }
    if (request.newTableId && !UUID_REGEX.test(request.newTableId)) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Invalid UUID format for newTableId');
    }
    if (request.newLocationId && !UUID_REGEX.test(request.newLocationId)) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Invalid UUID format for newLocationId');
    }

    const exists = await this.repo.checkBookingExists(bookingId);
    if (!exists) {
      throw new DomainError('NOT_FOUND', 404, `Booking with ID ${bookingId} not found`);
    }

    const client = await getClient();

    try {
      await client.query('BEGIN;');

      const canonicalResched = JSON.stringify({
        bookingId: bookingId.toLowerCase(),
        newLocalDate: request.newLocalDate,
        newLocationId: request.newLocationId ? request.newLocationId.toLowerCase() : undefined,
        newSlotId: request.newSlotId.toLowerCase(),
        newTableId: request.newTableId ? request.newTableId.toLowerCase() : undefined
      });
      const reschedFingerprint = crypto.createHash('sha256').update(canonicalResched).digest('hex');

      // 1. Idempotency replay check
      if (request.clientOperationId && request.clientOperationId.trim().length > 0) {
        const existingIdem = await this.repo.findIdempotencyRecord(
          client,
          actor.userId,
          'RESCHEDULE_BOOKING',
          request.clientOperationId
        );
        if (existingIdem) {
          if (existingIdem.request_fingerprint === reschedFingerprint) {
            await client.query('ROLLBACK;');
            return {
              record: existingIdem.response_reference as BookingRecord,
              isReplay: true
            };
          } else {
            await client.query('ROLLBACK;');
            throw new DomainError(
              'CONFLICT',
              409,
              'Client operation ID was already used with a different request payload'
            );
          }
        }
      }

      // 2. Lock source booking FOR UPDATE
      const source = await this.repo.findBookingForUpdate(client, bookingId);
      if (!source) {
        await client.query('ROLLBACK;');
        throw new DomainError('NOT_FOUND', 404, `Booking with ID ${bookingId} not found`);
      }

      // 3. Authorization check
      const isCreator = source.booker_id.toLowerCase() === actor.userId.toLowerCase();
      const isAdmin = actor.role === 'ROLE_ADMIN';
      if (!isCreator && !isAdmin) {
        const isCompanion = source.participants.some(
          (p) => p.userId.toLowerCase() === actor.userId.toLowerCase() && p.role === 'COMPANION'
        );
        await client.query('ROLLBACK;');
        if (isCompanion) {
          throw new DomainError(
            'FORBIDDEN',
            403,
            'Under current demo policy, only the booking creator or administrator may cancel or reschedule this reservation.'
          );
        } else {
          throw new DomainError('FORBIDDEN', 403, 'You are not authorized to reschedule this reservation');
        }
      }

      // 4. Source booking status check
      if (source.status === 'CANCELLED') {
        await client.query('ROLLBACK;');
        throw new DomainError('CONFLICT', 409, 'Cannot reschedule an already cancelled reservation.');
      }
      if (source.status !== 'CONFIRMED') {
        await client.query('ROLLBACK;');
        throw new DomainError('CONFLICT', 409, `Only confirmed bookings can be rescheduled (current status: ${source.status})`);
      }

      // 5. Lineage check: booking can only be rescheduled once (booking_direct_successor_uk)
      const hasSuccessor = await this.repo.hasDirectSuccessor(client, bookingId);
      if (hasSuccessor) {
        await client.query('ROLLBACK;');
        throw new DomainError('CONFLICT', 409, 'Reservation has already been rescheduled into a replacement booking.');
      }

      // 6. Validate target slot resource
      let targetSlot: DbSlotValidationRow | null;
      if (request.newTableId && request.newLocationId) {
        targetSlot = await this.repo.findSlotResource(
          client,
          request.newSlotId,
          request.newTableId,
          request.newLocationId,
          request.newLocalDate
        );
      } else {
        targetSlot = await this.repo.findSlotBySlotIdAndDate(client, request.newSlotId, request.newLocalDate);
      }

      if (!targetSlot) {
        await client.query('ROLLBACK;');
        throw new DomainError('NOT_FOUND', 404, 'The target study slot or resource was not found for the specified date');
      }

      if (
        !targetSlot.active ||
        targetSlot.status !== 'AVAILABLE' ||
        !targetSlot.table_active ||
        !targetSlot.location_active
      ) {
        await client.query('ROLLBACK;');
        throw new DomainError('CONFLICT', 409, 'The target study slot or resource is not available for reservation');
      }

      // Self-identity check: target cannot be identical to source
      if (targetSlot.slot_id === source.slot_id && targetSlot.local_date === source.local_date) {
        await client.query('ROLLBACK;');
        throw new DomainError('VALIDATION_ERROR', 400, 'The proposed slot is identical to the current reservation.');
      }

      // 7. Atomic Swap:
      // 7a. Mark source as CANCELLED with reason 'RESCHEDULED'
      await this.repo.cancelBookingInTx(client, bookingId, actor.userId, 'RESCHEDULED');

      // 7b. Insert new replacement booking
      let newBookingRow;
      try {
        newBookingRow = await this.repo.insertRescheduledBooking(client, {
          connectionId: source.connection_id,
          bookerId: source.booker_id,
          tableId: targetSlot.table_id,
          locationId: targetSlot.location_id,
          slotId: targetSlot.slot_id,
          localDate: targetSlot.local_date,
          bookingVersion: source.booking_version + 1,
          rescheduledFromBookingId: source.booking_id
        });
      } catch (insertErr: any) {
        if (insertErr && insertErr.code === '23505' && insertErr.constraint === 'booking_confirmed_resource_uk') {
          // Rollback preserves original source booking!
          throw new DomainError(
            'CONFLICT',
            409,
            'The selected study slot is no longer available'
          );
        }
        if (insertErr && insertErr.code === '23505' && insertErr.constraint === 'booking_direct_successor_uk') {
          throw new DomainError(
            'CONFLICT',
            409,
            'Reservation has already been rescheduled into a replacement booking.'
          );
        }
        throw insertErr;
      }

      // 7c. Copy participants from source to new replacement booking
      await this.repo.copyParticipants(client, source.booking_id, newBookingRow.booking_id);

      // 7d. Insert audit events for both transition states
      const correlationId = requestId || `req-resched-${newBookingRow.booking_id}`;
      const opId = request.clientOperationId || `op-resched-${newBookingRow.booking_id}`;

      await this.repo.insertAuditEvent(client, {
        actorUserId: actor.userId,
        actorRole: actor.role,
        targetId: source.booking_id,
        correlationId,
        operationId: opId,
        safeReason: 'Reservation cancelled due to reschedule',
        action: 'BOOKING_CANCELLED'
      });

      await this.repo.insertAuditEvent(client, {
        actorUserId: actor.userId,
        actorRole: actor.role,
        targetId: newBookingRow.booking_id,
        correlationId,
        operationId: opId,
        safeReason: `Reservation rescheduled from ${source.booking_id}`,
        action: 'BOOKING_RESCHEDULED'
      });

      // 7e. Insert outbox event for the reschedule
      await this.repo.insertOutboxEvent(client, {
        aggregateId: newBookingRow.booking_id,
        dedupeKey: `booking-rescheduled:${newBookingRow.booking_id}`,
        payload: {
          sourceBookingId: source.booking_id,
          newBookingId: newBookingRow.booking_id,
          bookerId: source.booker_id,
          tableId: targetSlot.table_id,
          locationId: targetSlot.location_id,
          slotId: targetSlot.slot_id,
          localDate: targetSlot.local_date
        },
        correlationId,
        eventType: 'BOOKING_RESCHEDULED'
      });

      // 7f. Assemble response record
      const detail = await this.repo.getBookingDetail(newBookingRow.booking_id, actor.userId, client, isAdmin);
      const newBookingRecord = this.mapDbRowToBookingRecord(detail!, actor.userId);

      // 7g. Insert idempotency record if requested
      if (request.clientOperationId && request.clientOperationId.trim().length > 0) {
        await this.repo.insertIdempotencyRecord(client, {
          actorUserId: actor.userId,
          clientOperationId: request.clientOperationId,
          requestFingerprint: reschedFingerprint,
          outcomeStatus: 'SUCCEEDED',
          bookingId: newBookingRow.booking_id,
          responseReference: newBookingRecord,
          operationType: 'RESCHEDULE_BOOKING'
        });
      }

      await client.query('COMMIT;');
      return { record: newBookingRecord, isReplay: false };
    } catch (err) {
      await client.query('ROLLBACK;');
      throw err;
    } finally {
      client.release();
    }
  }
}
