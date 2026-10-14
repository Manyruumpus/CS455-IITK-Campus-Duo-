import { PoolClient } from 'pg';
import { query } from '../config/db';

export interface DbStudySlotRow {
  slot_id: string;
  location_id: string;
  location_name: string;
  building: string;
  table_id: string;
  table_number: string;
  local_date: string;
  start_time: string;
  end_time: string;
  zone: string;
  status: string;
  capacity: number;
  reserved_count: number;
}

export interface DbIdempotencyRow {
  idempotency_id: string;
  actor_user_id: string;
  operation_type: string;
  client_operation_id: string;
  request_fingerprint: string;
  outcome_status: string;
  booking_id: string | null;
  response_reference: any;
  created_at: string;
  expires_at: string | null;
}

export interface DbUserAccountRow {
  user_id: string;
  role: string;
  display_name: string;
  account_status: string;
  verification_status: string;
}

export interface DbConnectionRow {
  connection_id: string;
  status: string;
}

export interface DbSlotValidationRow {
  slot_id: string;
  table_id: string;
  location_id: string;
  local_date: string;
  start_time: string;
  end_time: string;
  status: string;
  active: boolean;
  table_number: string;
  capacity: number;
  table_active: boolean;
  location_name: string;
  location_active: boolean;
}

export interface DbBookingRow {
  booking_id: string;
  connection_id: string;
  booker_id: string;
  table_id: string;
  location_id: string;
  slot_id: string;
  local_date: string;
  status: string;
  partner_approval_status: string;
  booking_version: number;
  created_at: string;
  updated_at: string;
}

export class BookingRepository {
  /**
   * DB-06 Availability Query Contract (queries/06_resource_availability.sql).
   * Parameters: $1 startDate, $2 endDate, $3 locationId (nullable uuid), $4 limit (1..100).
   */
  async getAvailability(
    startDate: string,
    endDate: string,
    locationId: string | null,
    limit: number
  ): Promise<DbStudySlotRow[]> {
    const sql = `
      SELECT
          s.slot_id,
          s.location_id,
          l.name AS location_name,
          l.building,
          s.table_id,
          t.table_number,
          s.local_date,
          s.start_time,
          s.end_time,
          s.zone,
          s.status,
          t.capacity,
          CASE WHEN confirmed.booking_id IS NULL THEN 0 ELSE 2 END AS reserved_count
      FROM campus_duo.study_slot s
      JOIN campus_duo.study_location l ON l.location_id = s.location_id AND l.active
      JOIN campus_duo.study_table t ON t.table_id = s.table_id AND t.active
      LEFT JOIN campus_duo.booking confirmed
        ON confirmed.table_id = s.table_id
       AND confirmed.local_date = s.local_date
       AND confirmed.slot_id = s.slot_id
       AND confirmed.status = 'CONFIRMED'
      WHERE s.active
        AND s.status = 'AVAILABLE'
        AND $4::integer BETWEEN 1 AND 100
        AND $1::date IS NOT NULL
        AND $2::date IS NOT NULL
        AND $1::date <= $2::date
        AND s.local_date BETWEEN $1::date AND $2::date
        AND ($3::uuid IS NULL OR s.location_id = $3)
      ORDER BY s.local_date, s.start_time, s.location_id, s.table_id, s.slot_id
      LIMIT CASE
          WHEN $4::integer BETWEEN 1 AND 100 THEN $4::integer
          ELSE 0
      END;
    `;
    const res = await query<DbStudySlotRow>(sql, [startDate, endDate, locationId, limit]);
    return res.rows;
  }

  async findIdempotencyRecord(
    client: PoolClient,
    actorUserId: string,
    operationType: string,
    clientOperationId: string
  ): Promise<DbIdempotencyRow | null> {
    const sql = `
      SELECT idempotency_id, actor_user_id, operation_type, client_operation_id,
             request_fingerprint, outcome_status, booking_id, response_reference,
             created_at, expires_at
      FROM campus_duo.idempotency_record
      WHERE actor_user_id = $1
        AND operation_type = $2
        AND client_operation_id = $3;
    `;
    const res = await client.query<DbIdempotencyRow>(sql, [actorUserId, operationType, clientOperationId]);
    return res.rows[0] || null;
  }

  async findUserAccount(client: PoolClient, userId: string): Promise<DbUserAccountRow | null> {
    const sql = `
      SELECT user_id, role, display_name, account_status, verification_status
      FROM campus_duo.user_account
      WHERE user_id = $1;
    `;
    const res = await client.query<DbUserAccountRow>(sql, [userId]);
    return res.rows[0] || null;
  }

  async findActiveMutualStudyConnection(
    client: PoolClient,
    userA: string,
    userB: string
  ): Promise<DbConnectionRow | null> {
    const sql = `
      SELECT connection_id, status
      FROM campus_duo.connection
      WHERE mode = 'STUDY'
        AND status = 'MUTUAL_CONNECTED'
        AND (
          (user_a_id = $1 AND user_b_id = $2)
          OR
          (user_a_id = $2 AND user_b_id = $1)
        );
    `;
    const res = await client.query<DbConnectionRow>(sql, [userA, userB]);
    return res.rows[0] || null;
  }

  async getStudyConsentUserIds(client: PoolClient, userIds: string[]): Promise<string[]> {
    const sql = `
      SELECT user_id
      FROM campus_duo.consent_record
      WHERE mode = 'STUDY'
        AND has_consent = true
        AND user_id = ANY($1::uuid[]);
    `;
    const res = await client.query<{ user_id: string }>(sql, [userIds]);
    return res.rows.map((r) => r.user_id);
  }

  async hasActiveBlock(client: PoolClient, userA: string, userB: string): Promise<boolean> {
    const sql = `
      SELECT 1
      FROM campus_duo.block
      WHERE active = true
        AND (
          (actor_user_id = $1 AND target_user_id = $2)
          OR
          (actor_user_id = $2 AND target_user_id = $1)
        );
    `;
    const res = await client.query(sql, [userA, userB]);
    return res.rows.length > 0;
  }

  async findSlotResource(
    client: PoolClient,
    slotId: string,
    tableId: string,
    locationId: string,
    localDate: string
  ): Promise<DbSlotValidationRow | null> {
    const sql = `
      SELECT s.slot_id, s.table_id, s.location_id, s.local_date, s.start_time, s.end_time, s.status, s.active,
             t.table_number, t.capacity, t.active AS table_active,
             l.name AS location_name, l.active AS location_active
      FROM campus_duo.study_slot s
      JOIN campus_duo.study_table t ON t.table_id = s.table_id
      JOIN campus_duo.study_location l ON l.location_id = s.location_id
      WHERE s.slot_id = $1
        AND s.table_id = $2
        AND s.location_id = $3
        AND s.local_date = $4;
    `;
    const res = await client.query<DbSlotValidationRow>(sql, [slotId, tableId, locationId, localDate]);
    return res.rows[0] || null;
  }

  async insertBooking(
    client: PoolClient,
    params: {
      connectionId: string;
      bookerId: string;
      tableId: string;
      locationId: string;
      slotId: string;
      localDate: string;
    }
  ): Promise<DbBookingRow> {
    const sql = `
      INSERT INTO campus_duo.booking (
        connection_id,
        booker_id,
        table_id,
        location_id,
        slot_id,
        local_date,
        status,
        partner_approval_status,
        booking_version
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 'CONFIRMED', 'NOT_REQUIRED', 1
      ) RETURNING booking_id, connection_id, booker_id, table_id, location_id, slot_id, local_date,
                  status, partner_approval_status, booking_version, created_at, updated_at;
    `;
    const res = await client.query<DbBookingRow>(sql, [
      params.connectionId,
      params.bookerId,
      params.tableId,
      params.locationId,
      params.slotId,
      params.localDate
    ]);
    return res.rows[0];
  }

  async insertParticipants(
    client: PoolClient,
    bookingId: string,
    creatorUserId: string,
    companionUserId: string
  ): Promise<void> {
    const sql = `
      INSERT INTO campus_duo.booking_participant (booking_id, user_id, participant_role, joined_at)
      VALUES
        ($1, $2, 'CREATOR', now()),
        ($1, $3, 'COMPANION', now());
    `;
    await client.query(sql, [bookingId, creatorUserId, companionUserId]);
  }

  async insertAuditEvent(
    client: PoolClient,
    params: {
      actorUserId: string;
      actorRole: string;
      targetId: string;
      correlationId: string;
      operationId: string;
      safeReason: string;
    }
  ): Promise<void> {
    const sql = `
      INSERT INTO campus_duo.audit_event (
        actor_user_id, actor_role, action, target_type, target_id, outcome,
        correlation_id, operation_id, safe_reason
      ) VALUES (
        $1, $2, 'BOOKING_CREATED', 'BOOKING', $3, 'SUCCESS',
        $4, $5, $6
      );
    `;
    await client.query(sql, [
      params.actorUserId,
      params.actorRole,
      params.targetId,
      params.correlationId,
      params.operationId,
      params.safeReason
    ]);
  }

  async insertOutboxEvent(
    client: PoolClient,
    params: {
      aggregateId: string;
      dedupeKey: string;
      payload: any;
      correlationId: string;
    }
  ): Promise<void> {
    const sql = `
      INSERT INTO campus_duo.outbox_event (
        event_type, aggregate_type, aggregate_id, dedupe_key, payload, correlation_id
      ) VALUES (
        'BOOKING_CREATED', 'BOOKING', $1, $2, $3, $4
      );
    `;
    await client.query(sql, [
      params.aggregateId,
      params.dedupeKey,
      JSON.stringify(params.payload),
      params.correlationId
    ]);
  }

  async insertIdempotencyRecord(
    client: PoolClient,
    params: {
      actorUserId: string;
      clientOperationId: string;
      requestFingerprint: string;
      outcomeStatus: string;
      bookingId: string;
      responseReference: any;
    }
  ): Promise<void> {
    const sql = `
      INSERT INTO campus_duo.idempotency_record (
        actor_user_id, operation_type, client_operation_id, request_fingerprint,
        outcome_status, booking_id, response_reference
      ) VALUES (
        $1, 'CREATE_BOOKING', $2, $3, $4, $5, $6
      );
    `;
    await client.query(sql, [
      params.actorUserId,
      params.clientOperationId,
      params.requestFingerprint,
      params.outcomeStatus,
      params.bookingId,
      JSON.stringify(params.responseReference)
    ]);
  }
}
