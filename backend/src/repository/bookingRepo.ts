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

export interface DbStudyLocationRow {
  location_id: string;
  name: string;
  building: string;
  open_time: string;
  close_time: string;
  has_power_outlets: boolean;
  has_wifi6: boolean;
  noise_policy: string;
  active: boolean;
  total_tables: number;
}

export interface DbBookingParticipantJson {
  userId: string;
  displayName: string;
  role: 'CREATOR' | 'COMPANION';
  joinedAt: string;
  removedAt: string | null;
}

export interface DbBookingDetailRow {
  booking_id: string;
  booker_id: string;
  connection_id: string;
  table_id: string;
  location_id: string;
  location_name: string;
  table_number: string;
  slot_id: string;
  local_date: string;
  start_time: string;
  end_time: string;
  status: string;
  partner_approval_status: string;
  booking_version: number;
  created_at: string;
  cancelled_at: string | null;
  rescheduled_from_booking_id: string | null;
  participants: DbBookingParticipantJson[];
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
   * Retrieves all active campus study locations along with the count of their active tables.
   */
  async getLocations(): Promise<DbStudyLocationRow[]> {
    const sql = `
      SELECT
          l.location_id,
          l.name,
          l.building,
          l.open_time::text,
          l.close_time::text,
          l.has_power_outlets,
          l.has_wifi6,
          l.noise_policy,
          l.active,
          coalesce(count(t.table_id) FILTER (WHERE t.active), 0)::integer AS total_tables
      FROM campus_duo.study_location l
      LEFT JOIN campus_duo.study_table t ON t.location_id = l.location_id
      WHERE l.active
      GROUP BY l.location_id, l.name, l.building, l.open_time, l.close_time, l.has_power_outlets, l.has_wifi6, l.noise_policy, l.active
      ORDER BY l.name, l.location_id;
    `;
    const res = await query<DbStudyLocationRow>(sql);
    return res.rows;
  }

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
      action?: string;
    }
  ): Promise<void> {
    const sql = `
      INSERT INTO campus_duo.audit_event (
        actor_user_id, actor_role, action, target_type, target_id, outcome,
        correlation_id, operation_id, safe_reason
      ) VALUES (
        $1, $2, $7, 'BOOKING', $3, 'SUCCESS',
        $4, $5, $6
      );
    `;
    await client.query(sql, [
      params.actorUserId,
      params.actorRole,
      params.targetId,
      params.correlationId,
      params.operationId,
      params.safeReason,
      params.action || 'BOOKING_CREATED'
    ]);
  }

  async insertOutboxEvent(
    client: PoolClient,
    params: {
      aggregateId: string;
      dedupeKey: string;
      payload: any;
      correlationId: string;
      eventType?: string;
    }
  ): Promise<void> {
    const sql = `
      INSERT INTO campus_duo.outbox_event (
        event_type, aggregate_type, aggregate_id, dedupe_key, payload, correlation_id
      ) VALUES (
        $5, 'BOOKING', $1, $2, $3, $4
      );
    `;
    await client.query(sql, [
      params.aggregateId,
      params.dedupeKey,
      JSON.stringify(params.payload),
      params.correlationId,
      params.eventType || 'BOOKING_CREATED'
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
      operationType?: string;
    }
  ): Promise<void> {
    const sql = `
      INSERT INTO campus_duo.idempotency_record (
        actor_user_id, operation_type, client_operation_id, request_fingerprint,
        outcome_status, booking_id, response_reference
      ) VALUES (
        $1, $7, $2, $3, $4, $5, $6
      );
    `;
    await client.query(sql, [
      params.actorUserId,
      params.clientOperationId,
      params.requestFingerprint,
      params.outcomeStatus,
      params.bookingId,
      JSON.stringify(params.responseReference),
      params.operationType || 'CREATE_BOOKING'
    ]);
  }

  /**
   * Locks the booking row FOR UPDATE and returns its current details and active participants.
   */
  async findBookingForUpdate(
    client: PoolClient,
    bookingId: string
  ): Promise<(DbBookingRow & { participants: DbBookingParticipantJson[] }) | null> {
    const lockSql = `
      SELECT booking_id, connection_id, booker_id, table_id, location_id, slot_id,
             local_date, status, partner_approval_status, booking_version,
             created_at, updated_at
      FROM campus_duo.booking
      WHERE booking_id = $1
      FOR UPDATE;
    `;
    const res = await client.query<DbBookingRow>(lockSql, [bookingId]);
    if (res.rows.length === 0) return null;
    const booking = res.rows[0];

    const partSql = `
      SELECT p.user_id AS "userId", u.display_name AS "displayName", p.participant_role AS "role",
             p.joined_at::text AS "joinedAt", p.removed_at::text AS "removedAt"
      FROM campus_duo.booking_participant p
      JOIN campus_duo.user_account u ON u.user_id = p.user_id
      WHERE p.booking_id = $1 AND p.removed_at IS NULL
      ORDER BY p.participant_role, p.user_id;
    `;
    const partRes = await client.query<DbBookingParticipantJson>(partSql, [bookingId]);
    return {
      ...booking,
      participants: partRes.rows
    };
  }

  /**
   * Updates an existing booking row to CANCELLED within the active transaction.
   * Satisfies check constraint booking_cancel_fields_ck.
   */
  async cancelBookingInTx(
    client: PoolClient,
    bookingId: string,
    actorUserId: string,
    reason: string
  ): Promise<DbBookingRow> {
    const sql = `
      UPDATE campus_duo.booking
      SET status = 'CANCELLED',
          cancelled_at = now(),
          cancelled_by = $2,
          cancellation_reason = $3,
          booking_version = booking_version + 1,
          updated_at = now()
      WHERE booking_id = $1
      RETURNING booking_id, connection_id, booker_id, table_id, location_id, slot_id, local_date,
                status, partner_approval_status, booking_version, created_at, updated_at;
    `;
    const res = await client.query<DbBookingRow>(sql, [bookingId, actorUserId, reason]);
    return res.rows[0];
  }

  /**
   * Checks whether a booking has already been rescheduled into a direct successor.
   * Enforces partial unique index booking_direct_successor_uk at the service level.
   */
  async hasDirectSuccessor(client: PoolClient, bookingId: string): Promise<boolean> {
    const sql = `
      SELECT 1 FROM campus_duo.booking
      WHERE rescheduled_from_booking_id = $1;
    `;
    const res = await client.query(sql, [bookingId]);
    return res.rows.length > 0;
  }

  /**
   * Finds a study slot and its related table/location details by slot_id and local_date.
   */
  async findSlotBySlotIdAndDate(
    client: PoolClient,
    slotId: string,
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
        AND s.local_date = $2;
    `;
    const res = await client.query<DbSlotValidationRow>(sql, [slotId, localDate]);
    return res.rows[0] || null;
  }

  /**
   * Inserts a new booking row that is linked as a direct successor of a previous booking.
   */
  async insertRescheduledBooking(
    client: PoolClient,
    params: {
      connectionId: string;
      bookerId: string;
      tableId: string;
      locationId: string;
      slotId: string;
      localDate: string;
      bookingVersion: number;
      rescheduledFromBookingId: string;
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
        booking_version,
        rescheduled_from_booking_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 'CONFIRMED', 'NOT_REQUIRED', $7, $8
      ) RETURNING booking_id, connection_id, booker_id, table_id, location_id, slot_id, local_date,
                  status, partner_approval_status, booking_version, created_at, updated_at;
    `;
    const res = await client.query<DbBookingRow>(sql, [
      params.connectionId,
      params.bookerId,
      params.tableId,
      params.locationId,
      params.slotId,
      params.localDate,
      params.bookingVersion,
      params.rescheduledFromBookingId
    ]);
    return res.rows[0];
  }

  /**
   * Copies participants from a source booking to a new booking row.
   */
  async copyParticipants(
    client: PoolClient,
    sourceBookingId: string,
    targetBookingId: string
  ): Promise<void> {
    const sql = `
      INSERT INTO campus_duo.booking_participant (booking_id, user_id, participant_role, joined_at)
      SELECT $2, user_id, participant_role, now()
      FROM campus_duo.booking_participant
      WHERE booking_id = $1 AND removed_at IS NULL;
    `;
    await client.query(sql, [sourceBookingId, targetBookingId]);
  }

  /**
   * Checks whether a booking exists in campus_duo.booking.
   */
  async checkBookingExists(bookingId: string): Promise<boolean> {
    const sql = `
      SELECT 1 FROM campus_duo.booking
      WHERE booking_id = $1;
    `;
    const res = await query(sql, [bookingId]);
    return res.rows.length > 0;
  }

  /**
   * DB-06 Query Contract (07_booking_history.sql)
   * Retrieves detail for a specific booking IF the viewer is the booker or active participant.
   */
  async getBookingDetail(
    bookingId: string,
    actorUserId: string,
    client?: PoolClient,
    isAdmin: boolean = false
  ): Promise<DbBookingDetailRow | null> {
    const sql = `
      SELECT
          b.booking_id,
          b.booker_id,
          b.connection_id,
          b.table_id,
          b.location_id,
          l.name AS location_name,
          t.table_number,
          b.slot_id,
          b.local_date::text,
          s.start_time::text,
          s.end_time::text,
          b.status,
          b.partner_approval_status,
          b.booking_version,
          b.created_at,
          b.cancelled_at,
          b.rescheduled_from_booking_id,
          COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                  'userId', p.user_id,
                  'displayName', u.display_name,
                  'role', p.participant_role,
                  'joinedAt', p.joined_at,
                  'removedAt', p.removed_at
              ) ORDER BY p.participant_role, p.user_id)
              FROM campus_duo.booking_participant p
              JOIN campus_duo.user_account u ON u.user_id = p.user_id
              WHERE p.booking_id = b.booking_id
          ), '[]'::jsonb) AS participants
      FROM campus_duo.booking b
      JOIN campus_duo.study_location l ON l.location_id = b.location_id
      JOIN campus_duo.study_table t ON t.table_id = b.table_id
      JOIN campus_duo.study_slot s ON s.slot_id = b.slot_id
      WHERE b.booking_id = $1
        AND (
            $3 = true
            OR b.booker_id = $2
            OR EXISTS (
                SELECT 1 FROM campus_duo.booking_participant bp
                WHERE bp.booking_id = b.booking_id
                  AND bp.user_id = $2
                  AND bp.removed_at IS NULL
            )
        );
    `;
    const res = client
      ? await client.query<DbBookingDetailRow>(sql, [bookingId, actorUserId, isAdmin])
      : await query<DbBookingDetailRow>(sql, [bookingId, actorUserId, isAdmin]);
    return res.rows[0] || null;
  }

  /**
   * DB-06 Query Contract (07_booking_history.sql)
   * Retrieves participant-authorized booking history for the current viewer.
   */
  async getMyBookings(
    actorUserId: string,
    limit: number = 50
  ): Promise<DbBookingDetailRow[]> {
    const sql = `
      SELECT
          b.booking_id,
          b.booker_id,
          b.connection_id,
          b.table_id,
          b.location_id,
          l.name AS location_name,
          t.table_number,
          b.slot_id,
          b.local_date::text,
          s.start_time::text,
          s.end_time::text,
          b.status,
          b.partner_approval_status,
          b.booking_version,
          b.created_at,
          b.cancelled_at,
          b.rescheduled_from_booking_id,
          COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                  'userId', p.user_id,
                  'displayName', u.display_name,
                  'role', p.participant_role,
                  'joinedAt', p.joined_at,
                  'removedAt', p.removed_at
              ) ORDER BY p.participant_role, p.user_id)
              FROM campus_duo.booking_participant p
              JOIN campus_duo.user_account u ON u.user_id = p.user_id
              WHERE p.booking_id = b.booking_id
          ), '[]'::jsonb) AS participants
      FROM campus_duo.booking b
      JOIN campus_duo.study_location l ON l.location_id = b.location_id
      JOIN campus_duo.study_table t ON t.table_id = b.table_id
      JOIN campus_duo.study_slot s ON s.slot_id = b.slot_id
      WHERE (
          b.booker_id = $1
          OR EXISTS (
              SELECT 1 FROM campus_duo.booking_participant bp
              WHERE bp.booking_id = b.booking_id
                AND bp.user_id = $1
                AND bp.removed_at IS NULL
          )
      )
      ORDER BY b.created_at DESC, b.booking_id DESC
      LIMIT $2;
    `;
    const res = await query<DbBookingDetailRow>(sql, [actorUserId, limit]);
    return res.rows;
  }
}
