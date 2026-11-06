import { Pool, PoolClient } from 'pg';
import { getEnvConfig } from '../src/config/env';

let migratorPool: Pool | null = null;

export function getMigratorPool(): Pool {
  if (!migratorPool) {
    const config = getEnvConfig();
    migratorPool = new Pool({
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: 'campus_duo_migrator',
      password: process.env.CAMPUS_DUO_MIGRATOR_PASSWORD || 'cs455'
    });
  }
  return migratorPool;
}

export async function closeMigratorPool(): Promise<void> {
  if (migratorPool) {
    await migratorPool.end();
    migratorPool = null;
  }
}

export async function setupTestSlot(params: {
  slotId: string;
  tableId: string;
  locationId: string;
  localDate: string;
  startTime: string;
  endTime: string;
  zone: string;
}): Promise<void> {
  const pool = getMigratorPool();
  await pool.query(
    `INSERT INTO campus_duo.study_slot (
      slot_id, table_id, location_id, local_date, start_time, end_time, zone, status, active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'AVAILABLE', true)
    ON CONFLICT (slot_id) DO UPDATE
      SET local_date = EXCLUDED.local_date,
          status = 'AVAILABLE',
          active = true;`,
    [
      params.slotId,
      params.tableId,
      params.locationId,
      params.localDate,
      params.startTime,
      params.endTime,
      params.zone
    ]
  );
}

export interface CleanupOptions {
  prefixes?: string[];
  slotIds?: string[];
}

export async function cleanupTestData(
  prefixesOrOptions: string[] | CleanupOptions = ['test-%'],
  slotIds: string[] = []
): Promise<void> {
  let prefixes: string[];
  let resolvedSlotIds: string[];

  if (Array.isArray(prefixesOrOptions)) {
    prefixes = prefixesOrOptions;
    resolvedSlotIds = slotIds;
  } else if (prefixesOrOptions && typeof prefixesOrOptions === 'object') {
    prefixes = prefixesOrOptions.prefixes ?? ['test-%'];
    resolvedSlotIds = prefixesOrOptions.slotIds ?? slotIds;
  } else {
    prefixes = ['test-%'];
    resolvedSlotIds = slotIds;
  }

  const pool = getMigratorPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN;');

    const bookingIds = new Set<string>();

    // 1. Find all booking_ids linked to client_operation_ids matching prefixes
    for (const prefix of prefixes) {
      const linkedBookings = await client.query<{ booking_id: string }>(
        `SELECT DISTINCT booking_id FROM campus_duo.idempotency_record
         WHERE client_operation_id LIKE $1 AND booking_id IS NOT NULL`,
        [prefix]
      );
      for (const r of linkedBookings.rows) {
        if (r.booking_id) bookingIds.add(r.booking_id);
      }

      // Also check audit_event in case booking_id was recorded as target_id
      const auditBookings = await client.query<{ target_id: string }>(
        `SELECT DISTINCT target_id FROM campus_duo.audit_event
         WHERE (operation_id LIKE $1 OR correlation_id LIKE $1)
           AND target_type = 'BOOKING'
           AND target_id IS NOT NULL`,
        [prefix]
      );
      for (const r of auditBookings.rows) {
        if (r.target_id) bookingIds.add(r.target_id);
      }
    }

    // 2. If slot IDs were explicitly passed by the test owning them, find bookings on those slots
    if (resolvedSlotIds.length > 0) {
      const slotBookings = await client.query<{ booking_id: string }>(
        `SELECT DISTINCT booking_id FROM campus_duo.booking
         WHERE slot_id = ANY($1::uuid[])`,
        [resolvedSlotIds]
      );
      for (const r of slotBookings.rows) {
        if (r.booking_id) bookingIds.add(r.booking_id);
      }
    }

    const bIds = Array.from(bookingIds);

    // 3. For matching bookings, remove associated records before deleting the booking:
    // Respect database foreign-key constraints (ON DELETE RESTRICT):
    // - idempotency_record (idempotency_booking_fk)
    // - outbox_event (aggregate_id)
    // - booking_participant (booking_participant_booking_fk)
    // - booking (rescheduled_from_booking_id self-reference)
    if (bIds.length > 0) {
      await client.query(
        `DELETE FROM campus_duo.idempotency_record WHERE booking_id = ANY($1::uuid[])`,
        [bIds]
      );
      await client.query(
        `DELETE FROM campus_duo.outbox_event WHERE aggregate_id = ANY($1::uuid[])`,
        [bIds]
      );
      await client.query(
        `DELETE FROM campus_duo.booking_participant WHERE booking_id = ANY($1::uuid[])`,
        [bIds]
      );
      await client.query(
        `UPDATE campus_duo.booking SET rescheduled_from_booking_id = NULL WHERE booking_id = ANY($1::uuid[])`,
        [bIds]
      );
      await client.query(
        `DELETE FROM campus_duo.booking WHERE booking_id = ANY($1::uuid[])`,
        [bIds]
      );
    }

    // 4. Clean up matching audit_event records and any remaining matching idempotency/outbox records
    for (const prefix of prefixes) {
      await client.query(
        `DELETE FROM campus_duo.audit_event WHERE operation_id LIKE $1 OR correlation_id LIKE $1`,
        [prefix]
      );
      await client.query(
        `DELETE FROM campus_duo.idempotency_record WHERE client_operation_id LIKE $1`,
        [prefix]
      );
      await client.query(
        `DELETE FROM campus_duo.outbox_event WHERE correlation_id LIKE $1`,
        [prefix]
      );
    }

    if (bIds.length > 0) {
      await client.query(
        `DELETE FROM campus_duo.audit_event WHERE target_id = ANY($1::uuid[])`,
        [bIds]
      );
    }

    await client.query('COMMIT;');
  } catch (err) {
    await client.query('ROLLBACK;');
    throw err;
  } finally {
    client.release();
  }
}
