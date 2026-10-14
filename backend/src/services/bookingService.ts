import crypto from 'crypto';
import { getClient } from '../config/db';
import { BookingRepository } from '../repository/bookingRepo';
import {
  ActorContext,
  BookingCreationRequest,
  BookingRecord,
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

      // Assemble final response record
      const bookingRecord: BookingRecord = {
        bookingId: bookingRow.booking_id,
        bookerId: bookingRow.booker_id,
        clientOperationId: request.clientOperationId,
        participants: [
          { userId: actor.userId, displayName: actor.displayName, role: 'CREATOR' },
          { userId: companion.user_id, displayName: companion.display_name, role: 'COMPANION' }
        ],
        tableId: bookingRow.table_id,
        tableNumber: slotResource.table_number,
        locationId: bookingRow.location_id,
        locationName: slotResource.location_name,
        localDate: bookingRow.local_date,
        slotId: bookingRow.slot_id,
        status: 'CONFIRMED',
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
}
