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

export async function cleanupTestData(prefixes: string[] = ['test-%']): Promise<void> {
  const pool = getMigratorPool();

  for (const prefix of prefixes) {
    // 1. Find all booking_ids linked to these client_operation_ids
    const linkedBookings = await pool.query<{ booking_id: string }>(
      `SELECT booking_id FROM campus_duo.idempotency_record
       WHERE client_operation_id LIKE $1 AND booking_id IS NOT NULL`,
      [prefix]
    );

    // Also find any bookings on test slots
    const testSlotBookings = await pool.query<{ booking_id: string }>(
      `SELECT booking_id FROM campus_duo.booking
       WHERE slot_id IN (
         '00000000-0000-0000-0000-00000000E001'::uuid,
         '00000000-0000-0000-0000-00000000E002'::uuid,
         '00000000-0000-0000-0000-00000000E003'::uuid,
         '00000000-0000-0000-0000-00000000E004'::uuid
       )`
    );

    const bookingIds = new Set<string>();
    for (const r of linkedBookings.rows) {
      if (r.booking_id) bookingIds.add(r.booking_id);
    }
    for (const r of testSlotBookings.rows) {
      if (r.booking_id) bookingIds.add(r.booking_id);
    }

    for (const bid of bookingIds) {
      await pool.query(`DELETE FROM campus_duo.idempotency_record WHERE booking_id = $1`, [bid]);
      await pool.query(`DELETE FROM campus_duo.outbox_event WHERE aggregate_id = $1`, [bid]);
      await pool.query(`DELETE FROM campus_duo.booking_participant WHERE booking_id = $1`, [bid]);
      await pool.query(`DELETE FROM campus_duo.booking WHERE booking_id = $1`, [bid]);
    }

    // 2. Delete any remaining idempotency records
    await pool.query(
      `DELETE FROM campus_duo.idempotency_record WHERE client_operation_id LIKE $1`,
      [prefix]
    );

    // 3. Delete any remaining audit events
    await pool.query(
      `DELETE FROM campus_duo.audit_event WHERE operation_id LIKE $1 OR correlation_id LIKE $1`,
      [prefix]
    );
  }
}
