import { PoolClient } from 'pg';
import { query } from '../config/db';
import {
  AdminResourceSummary,
  AdminTableResource,
  CampusLocation,
  StudyTableSlot,
  AdminLocationCreateRequest,
  AdminLocationUpdateRequest,
  AdminTableCreateRequest,
  AdminTableUpdateRequest,
  AdminSlotCreateRequest,
  AdminSlotUpdateRequest,
} from '../types';

export class AdminRepository {
  /**
   * Retrieves all campus locations with aggregated active table count and future confirmed booking counts.
   */
  async listResources(client?: PoolClient): Promise<AdminResourceSummary[]> {
    const sql = `
      SELECT
          l.location_id AS "locationId",
          l.name AS "locationName",
          l.building,
          l.open_time::text AS "openTime",
          l.close_time::text AS "closeTime",
          l.has_power_outlets AS "hasPowerOutlets",
          l.has_wifi6 AS "hasWifi6",
          l.noise_policy AS "noisePolicy",
          l.active,
          coalesce(count(DISTINCT t.table_id) FILTER (WHERE t.active), 0)::integer AS "tableCount",
          coalesce(count(DISTINCT b.booking_id) FILTER (WHERE b.status = 'CONFIRMED' AND b.local_date >= CURRENT_DATE), 0)::integer AS "futureConfirmedBookings"
      FROM campus_duo.study_location l
      LEFT JOIN campus_duo.study_table t ON t.location_id = l.location_id
      LEFT JOIN campus_duo.booking b ON b.location_id = l.location_id
      GROUP BY l.location_id, l.name, l.building, l.open_time, l.close_time, l.has_power_outlets, l.has_wifi6, l.noise_policy, l.active
      ORDER BY l.name;
    `;
    const res = client ? await client.query<AdminResourceSummary>(sql) : await query<AdminResourceSummary>(sql);
    return res.rows;
  }

  async getLocationById(locationId: string, client?: PoolClient): Promise<CampusLocation | null> {
    const sql = `
      SELECT
          location_id AS id,
          name,
          building,
          open_time::text AS "openTime",
          close_time::text AS "closeTime",
          has_power_outlets AS "hasPowerOutlets",
          has_wifi6 AS "hasWifi6",
          noise_policy AS "noisePolicy",
          active,
          (SELECT coalesce(count(*), 0)::integer FROM campus_duo.study_table WHERE location_id = l.location_id AND active = true) AS "totalTables"
      FROM campus_duo.study_location l
      WHERE location_id = $1;
    `;
    const res = client
      ? await client.query<CampusLocation>(sql, [locationId])
      : await query<CampusLocation>(sql, [locationId]);
    return res.rows[0] || null;
  }

  async createLocation(data: AdminLocationCreateRequest, client?: PoolClient): Promise<CampusLocation> {
    const sql = `
      INSERT INTO campus_duo.study_location (
          name, building, open_time, close_time, has_power_outlets, has_wifi6, noise_policy, active
      ) VALUES ($1, $2, $3::time, $4::time, $5, $6, $7, true)
      RETURNING
          location_id AS id,
          name,
          building,
          open_time::text AS "openTime",
          close_time::text AS "closeTime",
          has_power_outlets AS "hasPowerOutlets",
          has_wifi6 AS "hasWifi6",
          noise_policy AS "noisePolicy",
          active;
    `;
    const res = client
      ? await client.query<CampusLocation>(sql, [
          data.name,
          data.building,
          data.openTime,
          data.closeTime,
          data.hasPowerOutlets ?? true,
          data.hasWifi6 ?? true,
          data.noisePolicy ?? 'WHISPER_COLLAB',
        ])
      : await query<CampusLocation>(sql, [
          data.name,
          data.building,
          data.openTime,
          data.closeTime,
          data.hasPowerOutlets ?? true,
          data.hasWifi6 ?? true,
          data.noisePolicy ?? 'WHISPER_COLLAB',
        ]);
    return res.rows[0];
  }

  async updateLocation(
    locationId: string,
    data: AdminLocationUpdateRequest,
    client?: PoolClient
  ): Promise<CampusLocation> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(data.name);
    }
    if (data.building !== undefined) {
      fields.push(`building = $${idx++}`);
      values.push(data.building);
    }
    if (data.openTime !== undefined) {
      fields.push(`open_time = $${idx++}::time`);
      values.push(data.openTime);
    }
    if (data.closeTime !== undefined) {
      fields.push(`close_time = $${idx++}::time`);
      values.push(data.closeTime);
    }
    if (data.hasPowerOutlets !== undefined) {
      fields.push(`has_power_outlets = $${idx++}`);
      values.push(data.hasPowerOutlets);
    }
    if (data.hasWifi6 !== undefined) {
      fields.push(`has_wifi6 = $${idx++}`);
      values.push(data.hasWifi6);
    }
    if (data.noisePolicy !== undefined) {
      fields.push(`noise_policy = $${idx++}`);
      values.push(data.noisePolicy);
    }
    if (data.active !== undefined) {
      fields.push(`active = $${idx++}`);
      values.push(data.active);
    }

    fields.push(`updated_at = NOW()`);
    values.push(locationId);

    const sql = `
      UPDATE campus_duo.study_location
      SET ${fields.join(', ')}
      WHERE location_id = $${idx}
      RETURNING
          location_id AS id,
          name,
          building,
          open_time::text AS "openTime",
          close_time::text AS "closeTime",
          has_power_outlets AS "hasPowerOutlets",
          has_wifi6 AS "hasWifi6",
          noise_policy AS "noisePolicy",
          active,
          (SELECT coalesce(count(*), 0)::integer FROM campus_duo.study_table WHERE location_id = $${idx} AND active = true) AS "totalTables";
    `;

    const res = client
      ? await client.query<CampusLocation>(sql, values)
      : await query<CampusLocation>(sql, values);
    return res.rows[0];
  }

  async countFutureBookingsForLocation(locationId: string, client?: PoolClient): Promise<number> {
    const sql = `
      SELECT count(*)::integer AS count
      FROM campus_duo.booking
      WHERE location_id = $1 AND status = 'CONFIRMED' AND local_date >= CURRENT_DATE;
    `;
    const res = client
      ? await client.query<{ count: number }>(sql, [locationId])
      : await query<{ count: number }>(sql, [locationId]);
    return res.rows[0]?.count || 0;
  }

  async countFutureBookingsForTable(tableId: string, client?: PoolClient): Promise<number> {
    const sql = `
      SELECT count(*)::integer AS count
      FROM campus_duo.booking
      WHERE table_id = $1 AND status = 'CONFIRMED' AND local_date >= CURRENT_DATE;
    `;
    const res = client
      ? await client.query<{ count: number }>(sql, [tableId])
      : await query<{ count: number }>(sql, [tableId]);
    return res.rows[0]?.count || 0;
  }

  async countFutureBookingsForSlot(slotId: string, client?: PoolClient): Promise<number> {
    const sql = `
      SELECT count(*)::integer AS count
      FROM campus_duo.booking
      WHERE slot_id = $1 AND status = 'CONFIRMED' AND local_date >= CURRENT_DATE;
    `;
    const res = client
      ? await client.query<{ count: number }>(sql, [slotId])
      : await query<{ count: number }>(sql, [slotId]);
    return res.rows[0]?.count || 0;
  }

  async getTablesForLocation(locationId: string, client?: PoolClient): Promise<AdminTableResource[]> {
    const sql = `
      SELECT
          t.table_id AS "tableId",
          t.location_id AS "locationId",
          l.name AS "locationName",
          t.table_number AS "tableNumber",
          t.capacity,
          l.has_power_outlets AS "hasPowerOutlets",
          t.active
      FROM campus_duo.study_table t
      JOIN campus_duo.study_location l ON t.location_id = l.location_id
      WHERE t.location_id = $1
      ORDER BY t.table_number ASC;
    `;
    const res = client
      ? await client.query<AdminTableResource>(sql, [locationId])
      : await query<AdminTableResource>(sql, [locationId]);
    return res.rows;
  }

  async listTables(locationId?: string, client?: PoolClient): Promise<AdminTableResource[]> {
    const sql = `
      SELECT
          t.table_id AS "tableId",
          t.location_id AS "locationId",
          l.name AS "locationName",
          t.table_number AS "tableNumber",
          t.capacity,
          l.has_power_outlets AS "hasPowerOutlets",
          t.active
      FROM campus_duo.study_table t
      JOIN campus_duo.study_location l ON t.location_id = l.location_id
      WHERE ($1::uuid IS NULL OR t.location_id = $1::uuid)
      ORDER BY l.name, t.table_number ASC;
    `;
    const res = client
      ? await client.query<AdminTableResource>(sql, [locationId || null])
      : await query<AdminTableResource>(sql, [locationId || null]);
    return res.rows;
  }

  async getTableById(tableId: string, client?: PoolClient): Promise<AdminTableResource | null> {
    const sql = `
      SELECT
          t.table_id AS "tableId",
          t.location_id AS "locationId",
          l.name AS "locationName",
          t.table_number AS "tableNumber",
          t.capacity,
          l.has_power_outlets AS "hasPowerOutlets",
          t.active
      FROM campus_duo.study_table t
      JOIN campus_duo.study_location l ON t.location_id = l.location_id
      WHERE t.table_id = $1;
    `;
    const res = client
      ? await client.query<AdminTableResource>(sql, [tableId])
      : await query<AdminTableResource>(sql, [tableId]);
    return res.rows[0] || null;
  }

  async createTable(data: AdminTableCreateRequest, client?: PoolClient): Promise<AdminTableResource> {
    const sql = `
      INSERT INTO campus_duo.study_table (
          location_id, table_number, capacity, active
      ) VALUES ($1, $2, 2, true)
      RETURNING
          table_id AS "tableId",
          location_id AS "locationId",
          table_number AS "tableNumber",
          capacity,
          true AS "hasPowerOutlets",
          active;
    `;
    const res = client
      ? await client.query<AdminTableResource>(sql, [data.locationId, data.tableNumber])
      : await query<AdminTableResource>(sql, [data.locationId, data.tableNumber]);
    return res.rows[0];
  }

  async updateTable(
    tableId: string,
    data: AdminTableUpdateRequest,
    client?: PoolClient
  ): Promise<AdminTableResource> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.tableNumber !== undefined) {
      fields.push(`table_number = $${idx++}`);
      values.push(data.tableNumber);
    }
    if (data.locationId !== undefined) {
      fields.push(`location_id = $${idx++}`);
      values.push(data.locationId);
    }
    if (data.active !== undefined) {
      fields.push(`active = $${idx++}`);
      values.push(data.active);
    }

    fields.push(`updated_at = NOW()`);
    values.push(tableId);

    const sql = `
      UPDATE campus_duo.study_table
      SET ${fields.join(', ')}
      WHERE table_id = $${idx}
      RETURNING
          table_id AS "tableId",
          location_id AS "locationId",
          table_number AS "tableNumber",
          capacity,
          true AS "hasPowerOutlets",
          active;
    `;
    const res = client
      ? await client.query<AdminTableResource>(sql, values)
      : await query<AdminTableResource>(sql, values);
    return res.rows[0];
  }

  async listSlots(
    locationId?: string,
    tableId?: string,
    date?: string,
    client?: PoolClient
  ): Promise<StudyTableSlot[]> {
    const sql = `
      SELECT
          s.slot_id AS "slotId",
          s.location_id AS "locationId",
          l.name AS "locationName",
          l.building,
          s.table_id AS "tableId",
          t.table_number AS "tableNumber",
          s.local_date::text AS "date",
          to_char(s.start_time, 'HH24:MI') AS "startTime",
          to_char(s.end_time, 'HH24:MI') AS "endTime",
          s.zone,
          s.status,
          2::smallint AS capacity,
          coalesce((SELECT count(*) FROM campus_duo.booking b WHERE b.slot_id = s.slot_id AND b.status = 'CONFIRMED'), 0)::integer AS "reservedCount",
          s.active
      FROM campus_duo.study_slot s
      JOIN campus_duo.study_table t ON s.table_id = t.table_id
      JOIN campus_duo.study_location l ON s.location_id = l.location_id
      WHERE ($1::uuid IS NULL OR s.location_id = $1::uuid)
        AND ($2::uuid IS NULL OR s.table_id = $2::uuid)
        AND ($3::date IS NULL OR s.local_date = $3::date)
      ORDER BY s.local_date DESC, s.start_time ASC;
    `;
    const res = client
      ? await client.query<StudyTableSlot>(sql, [locationId || null, tableId || null, date || null])
      : await query<StudyTableSlot>(sql, [locationId || null, tableId || null, date || null]);
    return res.rows;
  }

  async getSlotById(slotId: string, client?: PoolClient): Promise<StudyTableSlot | null> {
    const sql = `
      SELECT
          s.slot_id AS "slotId",
          s.location_id AS "locationId",
          l.name AS "locationName",
          l.building,
          s.table_id AS "tableId",
          t.table_number AS "tableNumber",
          s.local_date::text AS "date",
          to_char(s.start_time, 'HH24:MI') AS "startTime",
          to_char(s.end_time, 'HH24:MI') AS "endTime",
          s.zone,
          s.status,
          2::smallint AS capacity,
          coalesce((SELECT count(*) FROM campus_duo.booking b WHERE b.slot_id = s.slot_id AND b.status = 'CONFIRMED'), 0)::integer AS "reservedCount",
          s.active
      FROM campus_duo.study_slot s
      JOIN campus_duo.study_table t ON s.table_id = t.table_id
      JOIN campus_duo.study_location l ON s.location_id = l.location_id
      WHERE s.slot_id = $1;
    `;
    const res = client
      ? await client.query<StudyTableSlot>(sql, [slotId])
      : await query<StudyTableSlot>(sql, [slotId]);
    return res.rows[0] || null;
  }

  async checkSlotOverlap(
    tableId: string,
    date: string,
    startTime: string,
    endTime: string,
    excludeSlotId?: string,
    client?: PoolClient
  ): Promise<boolean> {
    const sql = `
      SELECT 1
      FROM campus_duo.study_slot
      WHERE table_id = $1
        AND local_date = $2::date
        AND active = true
        AND ($5::uuid IS NULL OR slot_id <> $5::uuid)
        AND (start_time < $4::time AND end_time > $3::time);
    `;
    const res = client
      ? await client.query(sql, [tableId, date, startTime, endTime, excludeSlotId || null])
      : await query(sql, [tableId, date, startTime, endTime, excludeSlotId || null]);
    return (res.rowCount ?? 0) > 0;
  }

  async createSlot(data: AdminSlotCreateRequest, client?: PoolClient): Promise<StudyTableSlot> {
    const sql = `
      INSERT INTO campus_duo.study_slot (
          table_id, location_id, local_date, start_time, end_time, zone, status, active
      ) VALUES ($1, $2, $3::date, $4::time, $5::time, $6, $7, true)
      RETURNING
          slot_id AS "slotId",
          location_id AS "locationId",
          table_id AS "tableId",
          local_date::text AS "date",
          to_char(start_time, 'HH24:MI') AS "startTime",
          to_char(end_time, 'HH24:MI') AS "endTime",
          zone,
          status,
          2::smallint AS capacity,
          0 AS "reservedCount",
          active;
    `;
    const res = client
      ? await client.query<StudyTableSlot>(sql, [
          data.tableId,
          data.locationId,
          data.date,
          data.startTime,
          data.endTime,
          data.zone ?? 'COLLABORATIVE_STUDY',
          data.status ?? 'AVAILABLE',
        ])
      : await query<StudyTableSlot>(sql, [
          data.tableId,
          data.locationId,
          data.date,
          data.startTime,
          data.endTime,
          data.zone ?? 'COLLABORATIVE_STUDY',
          data.status ?? 'AVAILABLE',
        ]);
    return res.rows[0];
  }

  async updateSlot(
    slotId: string,
    data: AdminSlotUpdateRequest,
    client?: PoolClient
  ): Promise<StudyTableSlot> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.zone !== undefined) {
      fields.push(`zone = $${idx++}`);
      values.push(data.zone);
    }
    if (data.startTime !== undefined) {
      fields.push(`start_time = $${idx++}::time`);
      values.push(data.startTime);
    }
    if (data.endTime !== undefined) {
      fields.push(`end_time = $${idx++}::time`);
      values.push(data.endTime);
    }
    if (data.date !== undefined) {
      fields.push(`local_date = $${idx++}::date`);
      values.push(data.date);
    }
    if (data.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(data.status);
    }
    if (data.active !== undefined) {
      fields.push(`active = $${idx++}`);
      values.push(data.active);
    }

    fields.push(`updated_at = NOW()`);
    values.push(slotId);

    const sql = `
      UPDATE campus_duo.study_slot
      SET ${fields.join(', ')}
      WHERE slot_id = $${idx}
      RETURNING
          slot_id AS "slotId",
          location_id AS "locationId",
          table_id AS "tableId",
          local_date::text AS "date",
          to_char(start_time, 'HH24:MI') AS "startTime",
          to_char(end_time, 'HH24:MI') AS "endTime",
          zone,
          status,
          2::smallint AS capacity,
          (SELECT coalesce(count(*), 0)::integer FROM campus_duo.booking b WHERE b.slot_id = $${idx} AND b.status = 'CONFIRMED') AS "reservedCount",
          active;
    `;
    const res = client
      ? await client.query<StudyTableSlot>(sql, values)
      : await query<StudyTableSlot>(sql, values);
    return res.rows[0];
  }

  async listAllBookings(
    status?: string,
    search?: string,
    limit: number = 100,
    client?: PoolClient
  ): Promise<any[]> {
    const statusParam = status && status !== 'ALL' ? status.toUpperCase() : null;
    const searchParam = search && search.trim().length > 0 ? search.trim() : null;

    const sql = `
      SELECT
          b.booking_id AS "bookingId",
          b.booker_id AS "bookerId",
          b.connection_id AS "connectionId",
          b.table_id AS "tableId",
          b.location_id AS "locationId",
          l.name AS "locationName",
          t.table_number AS "tableNumber",
          b.slot_id AS "slotId",
          b.local_date::text AS "localDate",
          to_char(s.start_time, 'HH24:MI') || ' - ' || to_char(s.end_time, 'HH24:MI') AS "timeWindow",
          b.status,
          b.partner_approval_status AS "partnerApprovalStatus",
          b.booking_version AS "bookingVersion",
          b.created_at AS "createdAt",
          b.cancelled_at AS "cancelledAt",
          b.rescheduled_from_booking_id AS "rescheduledFromBookingId",
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
      WHERE ($1::text IS NULL OR b.status = $1)
        AND (
          $2::text IS NULL
          OR l.name ILIKE ('%' || $2 || '%')
          OR t.table_number ILIKE ('%' || $2 || '%')
          OR b.booking_id::text ILIKE ('%' || $2 || '%')
        )
      ORDER BY b.created_at DESC, b.booking_id DESC
      LIMIT $3;
    `;
    const res = client
      ? await client.query(sql, [statusParam, searchParam, limit])
      : await query(sql, [statusParam, searchParam, limit]);

    return res.rows.map((row: any) => {
      const companion = row.participants?.find((p: any) => p.role === 'COMPANION');
      return {
        ...row,
        companionStudentId: companion?.userId,
        companionDisplayName: companion?.displayName,
        allowedActions: row.status === 'CONFIRMED' ? ['CANCEL'] : [],
        createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date(row.createdAt).toISOString(),
        cancelledAt: row.cancelledAt ? (typeof row.cancelledAt === 'string' ? row.cancelledAt : new Date(row.cancelledAt).toISOString()) : null,
      };
    });
  }
}
