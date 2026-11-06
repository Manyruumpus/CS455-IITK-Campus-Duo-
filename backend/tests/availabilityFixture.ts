import { Pool, PoolClient } from 'pg';
import { getEnvConfig } from '../src/config/env';
import { getDbPool } from '../src/config/db';

const TEST_DATABASE = 'campus_duo_test';
const MIGRATOR_USER = 'campus_duo_migrator';

export const AVAILABILITY_FIXTURE = {
  actorId: '00000000-0000-0000-0000-00000000D501',
  companionId: '00000000-0000-0000-0000-00000000D502',
  connectionId: '00000000-0000-0000-0000-00000000D561',
  locationId: '00000000-0000-0000-0000-00000000F711',
  tableId: '00000000-0000-0000-0000-00000000F712',
  slotIds: [
    '00000000-0000-0000-0000-00000000F713',
    '00000000-0000-0000-0000-00000000F714',
    '00000000-0000-0000-0000-00000000F715'
  ],
  confirmedBookingId: '00000000-0000-0000-0000-00000000F716',
  cancelledBookingId: '00000000-0000-0000-0000-00000000F717',
  date: '2026-11-14'
} as const;

let fixturePool: Pool | null = null;

function getFixturePool(): Pool {
  if (!process.env.CAMPUS_DUO_MIGRATOR_PASSWORD) {
    throw new Error(
      'CAMPUS_DUO_MIGRATOR_PASSWORD is required for the availability fixture helper'
    );
  }

  if (!fixturePool) {
    const config = getEnvConfig();
    fixturePool = new Pool({
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: MIGRATOR_USER,
      password: process.env.CAMPUS_DUO_MIGRATOR_PASSWORD
    });
  }

  return fixturePool;
}

async function assertTestDatabase(client: PoolClient): Promise<void> {
  const result = await client.query<{ database_name: string }>(
    'SELECT current_database() AS database_name'
  );
  if (result.rows[0]?.database_name !== TEST_DATABASE) {
    throw new Error(
      `Availability fixture requires database ${TEST_DATABASE}; refusing connected database ${result.rows[0]?.database_name ?? 'unknown'}`
    );
  }
}

async function assertApplicationDatabase(): Promise<void> {
  const config = getEnvConfig();
  if (config.db.connectionString) {
    throw new Error(
      'Availability fixture does not support DATABASE_URL; unset DATABASE_URL so the application uses PGHOST/PGPORT/PGDATABASE for campus_duo_test'
    );
  }

  const result = await getDbPool().query<{ database_name: string }>(
    'SELECT current_database() AS database_name'
  );
  if (result.rows[0]?.database_name !== TEST_DATABASE) {
    throw new Error(
      `Availability fixture requires the application pool to use database ${TEST_DATABASE}; refusing connected database ${result.rows[0]?.database_name ?? 'unknown'}`
    );
  }
}

async function verifySeededPrerequisite(client: PoolClient): Promise<void> {
  const result = await client.query(
    `SELECT 1
       FROM campus_duo.user_account actor
       JOIN campus_duo.user_account companion
         ON companion.user_id = $2::uuid
       JOIN campus_duo.connection c
         ON c.connection_id = $3::uuid
        AND c.mode = 'STUDY'
        AND c.status = 'MUTUAL_CONNECTED'
        AND (
          (c.user_a_id = actor.user_id AND c.user_b_id = companion.user_id)
          OR
          (c.user_a_id = companion.user_id AND c.user_b_id = actor.user_id)
        )
      WHERE actor.user_id = $1::uuid
        AND actor.role = 'ROLE_STUDENT'
        AND actor.account_status = 'ACTIVE'
        AND actor.verification_status = 'VERIFIED'
        AND companion.role = 'ROLE_STUDENT'
        AND companion.account_status = 'ACTIVE'
        AND companion.verification_status = 'VERIFIED'
        AND EXISTS (
          SELECT 1
            FROM campus_duo.consent_record consent
           WHERE consent.user_id = actor.user_id
             AND consent.mode = 'STUDY'
             AND consent.has_consent
        )
        AND EXISTS (
          SELECT 1
            FROM campus_duo.consent_record consent
           WHERE consent.user_id = companion.user_id
             AND consent.mode = 'STUDY'
             AND consent.has_consent
        )`,
    [
      AVAILABILITY_FIXTURE.actorId,
      AVAILABILITY_FIXTURE.companionId,
      AVAILABILITY_FIXTURE.connectionId
    ]
  );

  if (result.rowCount !== 1) {
    throw new Error(
      'Availability fixture prerequisite is missing: expected active verified seeded STUDY actors, consent, and mutual connection'
    );
  }
}

async function cleanupFixtureRows(client: PoolClient): Promise<void> {
  const bookingIds = [
    AVAILABILITY_FIXTURE.confirmedBookingId,
    AVAILABILITY_FIXTURE.cancelledBookingId
  ];

  await client.query(
    'DELETE FROM campus_duo.idempotency_record WHERE booking_id = ANY($1::uuid[])',
    [bookingIds]
  );
  await client.query(
    'DELETE FROM campus_duo.outbox_event WHERE aggregate_id = ANY($1::uuid[])',
    [bookingIds]
  );
  await client.query(
    'DELETE FROM campus_duo.audit_event WHERE target_id = ANY($1::uuid[])',
    [bookingIds]
  );
  await client.query(
    'UPDATE campus_duo.booking SET rescheduled_from_booking_id = NULL WHERE booking_id = ANY($1::uuid[])',
    [bookingIds]
  );
  await client.query(
    'DELETE FROM campus_duo.booking_participant WHERE booking_id = ANY($1::uuid[])',
    [bookingIds]
  );
  await client.query(
    'DELETE FROM campus_duo.booking WHERE booking_id = ANY($1::uuid[])',
    [bookingIds]
  );
  await client.query(
    'DELETE FROM campus_duo.study_slot WHERE slot_id = ANY($1::uuid[])',
    [AVAILABILITY_FIXTURE.slotIds]
  );
  await client.query('DELETE FROM campus_duo.study_table WHERE table_id = $1::uuid', [
    AVAILABILITY_FIXTURE.tableId
  ]);
  await client.query(
    'DELETE FROM campus_duo.study_location WHERE location_id = $1::uuid',
    [AVAILABILITY_FIXTURE.locationId]
  );
}

export async function setupAvailabilityFixture(): Promise<void> {
  await assertApplicationDatabase();
  const client = await getFixturePool().connect();
  try {
    await assertTestDatabase(client);
    await client.query('BEGIN');
    await verifySeededPrerequisite(client);
    await cleanupFixtureRows(client);

    await client.query(
      `INSERT INTO campus_duo.study_location (
         location_id, name, building, open_time, close_time,
         has_power_outlets, has_wifi6, noise_policy, active
       ) VALUES ($1, '[KAN-71] Availability fixture', '[KAN-71] TEST-BUILDING',
                 '08:00', '20:00', true, true, 'WHISPER_COLLAB', true)`,
      [AVAILABILITY_FIXTURE.locationId]
    );
    await client.query(
      `INSERT INTO campus_duo.study_table (
         table_id, location_id, table_number, capacity, active
       ) VALUES ($1, $2, '[KAN-71]-A', 2, true)`,
      [AVAILABILITY_FIXTURE.tableId, AVAILABILITY_FIXTURE.locationId]
    );
    await client.query(
      `INSERT INTO campus_duo.study_slot (
         slot_id, table_id, location_id, local_date, start_time, end_time,
         zone, status, active
       ) VALUES
         ($1, $4, $5, $6, '10:00', '12:00', 'COLLABORATIVE_STUDY', 'AVAILABLE', true),
         ($2, $4, $5, $6, '12:00', '14:00', 'COLLABORATIVE_STUDY', 'AVAILABLE', true),
         ($3, $4, $5, $6, '14:00', '16:00', 'SILENT_READING', 'AVAILABLE', true)`,
      [
        AVAILABILITY_FIXTURE.slotIds[0],
        AVAILABILITY_FIXTURE.slotIds[1],
        AVAILABILITY_FIXTURE.slotIds[2],
        AVAILABILITY_FIXTURE.tableId,
        AVAILABILITY_FIXTURE.locationId,
        AVAILABILITY_FIXTURE.date
      ]
    );
    await client.query(
      `INSERT INTO campus_duo.booking (
         booking_id, connection_id, booker_id, table_id, location_id, slot_id,
         local_date, status, partner_approval_status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'CONFIRMED', 'NOT_REQUIRED')`,
      [
        AVAILABILITY_FIXTURE.confirmedBookingId,
        AVAILABILITY_FIXTURE.connectionId,
        AVAILABILITY_FIXTURE.actorId,
        AVAILABILITY_FIXTURE.tableId,
        AVAILABILITY_FIXTURE.locationId,
        AVAILABILITY_FIXTURE.slotIds[0],
        AVAILABILITY_FIXTURE.date
      ]
    );
    await client.query(
      `INSERT INTO campus_duo.booking_participant (booking_id, user_id, participant_role)
       VALUES ($1, $2, 'CREATOR'), ($1, $3, 'COMPANION')`,
      [
        AVAILABILITY_FIXTURE.confirmedBookingId,
        AVAILABILITY_FIXTURE.actorId,
        AVAILABILITY_FIXTURE.companionId
      ]
    );
    await client.query(
      `INSERT INTO campus_duo.booking (
         booking_id, connection_id, booker_id, table_id, location_id, slot_id,
         local_date, status, cancelled_at, cancelled_by, cancellation_reason
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'CANCELLED', now(), $3,
                 '[KAN-71] Availability fixture cancellation')`,
      [
        AVAILABILITY_FIXTURE.cancelledBookingId,
        AVAILABILITY_FIXTURE.connectionId,
        AVAILABILITY_FIXTURE.actorId,
        AVAILABILITY_FIXTURE.tableId,
        AVAILABILITY_FIXTURE.locationId,
        AVAILABILITY_FIXTURE.slotIds[1],
        AVAILABILITY_FIXTURE.date
      ]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function teardownAvailabilityFixture(): Promise<void> {
  const client = await getFixturePool().connect();
  try {
    await assertTestDatabase(client);
    await client.query('BEGIN');
    await cleanupFixtureRows(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function closeAvailabilityFixturePool(): Promise<void> {
  if (fixturePool) {
    await fixturePool.end();
    fixturePool = null;
  }
}
