import { Pool, PoolClient } from 'pg';

let migratorPool: Pool | null = null;
let migratorVerificationPromise: Promise<void> | null = null;

async function verifyMigratorConnection(rawConnect: () => Promise<PoolClient>): Promise<void> {
  const client = await rawConnect();
  try {
    const res = await client.query<{ database_name: string; database_user: string }>(
      'SELECT current_database() AS database_name, current_user AS database_user'
    );
    const row = res.rows[0];
    if (!row || row.database_name !== 'campus_duo_test') {
      throw new Error(
        `Test migrator database mismatch: expected "campus_duo_test", got "${row?.database_name}"`
      );
    }
    if (row.database_user !== 'campus_duo_test_migrator') {
      throw new Error(
        `Test migrator user mismatch: expected "campus_duo_test_migrator", got "${row?.database_user}"`
      );
    }
  } finally {
    client.release();
  }
}

export function getMigratorPool(): Pool {
  if (!migratorPool) {
    const password = process.env.CAMPUS_DUO_TEST_MIGRATOR_PASSWORD;
    if (!password) {
      throw new Error('CAMPUS_DUO_TEST_MIGRATOR_PASSWORD environment variable is required.');
    }

    const host = process.env.PGHOST || '127.0.0.1';
    const port = parseInt(process.env.PGPORT || '5432', 10);

    migratorPool = new Pool({
      host,
      port,
      database: 'campus_duo_test',
      user: 'campus_duo_test_migrator',
      password
    });

    const originalConnect = migratorPool.connect.bind(migratorPool);

    migratorPool.connect = ((cb?: any): any => {
      if (!migratorVerificationPromise) {
        migratorVerificationPromise = verifyMigratorConnection(originalConnect).catch((err) => {
          migratorVerificationPromise = null;
          throw err;
        });
      }

      if (typeof cb === 'function') {
        migratorVerificationPromise
          .then(() => originalConnect(cb))
          .catch((err) => cb(err, undefined as any, () => {}));
        return;
      }

      return migratorVerificationPromise.then(() => originalConnect());
    }) as any;
  }
  return migratorPool;
}

export async function closeMigratorPool(): Promise<void> {
  if (migratorPool) {
    await migratorPool.end();
    migratorPool = null;
    migratorVerificationPromise = null;
  }
}

interface AuthorizedSyntheticLocation {
  locationId: string;
  name: string;
  building: string;
}

const AUTHORIZED_SYNTHETIC_LOCATIONS: readonly AuthorizedSyntheticLocation[] = [
  {
    locationId: '00000000-0000-0000-0000-00000000d571',
    name: '[SYNTHETIC TEST] Campus Duo Test Library',
    building: '[SYNTHETIC] TEST-BUILDING'
  },
  {
    locationId: '00000000-0000-0000-0000-00000000d571',
    name: '[SYNTHETIC DEV SEED] Campus Duo Test Library',
    building: '[SYNTHETIC] DEV-BUILDING'
  }
];

/**
 * Ensures parent synthetic study_location and study_table fixtures exist and creates or updates a test study_slot.
 *
 * Synthetic Parent Fixture Lifecycle:
 * - Synthetic parent records (study_location and study_table) are intentionally retained as reusable,
 *   shared fixtures in campus_duo_test. They are not destroyed during per-test teardown because
 *   subsequent tests (availability, booking lifecycle, admin inventory) depend on their stable existence.
 * - Dynamic test slots (study_slot) and all test-generated bookings, participants, idempotency records,
 *   and audit events are strictly removed by cleanupTestData().
 */
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
  const client = await pool.connect();

  try {
    await client.query('BEGIN;');

    // 1. Ensure the supplied synthetic study_location exists and strictly matches authorized specifications
    const normalizedTargetId = params.locationId.toLowerCase();
    const authorizedSpec = AUTHORIZED_SYNTHETIC_LOCATIONS.find(
      (spec) => spec.locationId.toLowerCase() === normalizedTargetId
    );

    if (!authorizedSpec) {
      throw new Error(
        `Fixture inconsistency: location ID "${params.locationId}" is not in the authorized synthetic test location allowlist.`
      );
    }

    const existingLoc = await client.query<{
      name: string;
      building: string;
      active: boolean;
    }>(
      `SELECT name, building, active FROM campus_duo.study_location WHERE location_id = $1`,
      [params.locationId]
    );

    if (existingLoc.rows.length > 0) {
      const loc = existingLoc.rows[0];
      const matchesAuthorized = AUTHORIZED_SYNTHETIC_LOCATIONS.some(
        (spec) =>
          spec.locationId.toLowerCase() === normalizedTargetId &&
          spec.name === loc.name &&
          spec.building === loc.building
      );

      if (!matchesAuthorized) {
        throw new Error(
          `Fixture inconsistency: existing location "${params.locationId}" attributes (name="${loc.name}", building="${loc.building}") do not match authorized synthetic test location specifications.`
        );
      }

      if (!loc.active) {
        await client.query(
          `UPDATE campus_duo.study_location SET active = true WHERE location_id = $1`,
          [params.locationId]
        );
      }
    } else {
      await client.query(
        `INSERT INTO campus_duo.study_location (
          location_id, name, building, open_time, close_time,
          has_power_outlets, has_wifi6, noise_policy, active
        ) VALUES (
          $1, $2, $3,
          '08:00', '22:00', true, true, 'WHISPER_COLLAB', true
        );`,
        [params.locationId, authorizedSpec.name, authorizedSpec.building]
      );
    }

    // 2. Ensure the supplied synthetic study_table exists and belongs to the supplied location
    const existingTable = await client.query<{ location_id: string; active: boolean }>(
      `SELECT location_id, active FROM campus_duo.study_table WHERE table_id = $1`,
      [params.tableId]
    );

    if (existingTable.rows.length > 0) {
      const tableRow = existingTable.rows[0];
      if (tableRow.location_id !== params.locationId) {
        throw new Error(
          `Fixture inconsistency: study_table "${params.tableId}" already exists and belongs to location "${tableRow.location_id}", not expected location "${params.locationId}".`
        );
      }
      if (!tableRow.active) {
        await client.query(
          `UPDATE campus_duo.study_table SET active = true WHERE table_id = $1`,
          [params.tableId]
        );
      }
    } else {
      // Determine table number, respecting (location_id, table_number) uniqueness
      const defaultNumber = params.tableId.toLowerCase().endsWith('d572')
        ? 'DB05-A'
        : params.tableId.toLowerCase().endsWith('d573')
        ? 'DB05-B'
        : `T-${params.tableId.slice(-6)}`;

      const numCollision = await client.query<{ table_id: string }>(
        `SELECT table_id FROM campus_duo.study_table WHERE location_id = $1 AND table_number = $2`,
        [params.locationId, defaultNumber]
      );

      let tableNumber = defaultNumber;
      if (numCollision.rows.length > 0) {
        const fallbackNumber = `T-${params.tableId.replace(/-/g, '').slice(-8)}`;
        const fallbackCollision = await client.query<{ table_id: string }>(
          `SELECT table_id FROM campus_duo.study_table WHERE location_id = $1 AND table_number = $2`,
          [params.locationId, fallbackNumber]
        );
        if (fallbackCollision.rows.length > 0) {
          throw new Error(
            `Fixture inconsistency: unable to allocate a unique table_number for table "${params.tableId}" at location "${params.locationId}". Both "${defaultNumber}" and fallback "${fallbackNumber}" are occupied.`
          );
        }
        tableNumber = fallbackNumber;
      }

      await client.query(
        `INSERT INTO campus_duo.study_table (table_id, location_id, table_number, capacity, active)
         VALUES ($1, $2, $3, 2, true)
         ON CONFLICT (table_id) DO UPDATE
           SET active = true;`,
        [params.tableId, params.locationId, tableNumber]
      );
    }

    // 3. Insert or update the study_slot (composite foreign key satisfied)
    await client.query(
      `INSERT INTO campus_duo.study_slot (
        slot_id, table_id, location_id, local_date, start_time, end_time, zone, status, active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'AVAILABLE', true)
      ON CONFLICT (slot_id) DO UPDATE
        SET local_date = EXCLUDED.local_date,
            start_time = EXCLUDED.start_time,
            end_time = EXCLUDED.end_time,
            zone = EXCLUDED.zone,
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

    await client.query('COMMIT;');
  } catch (err) {
    // Suppress secondary rollback errors (e.g. if the connection or network dropped)
    // to guarantee the original primary transaction exception is preserved and re-thrown.
    await client.query('ROLLBACK;').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
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
        `UPDATE campus_duo.booking SET rescheduled_from_booking_id = NULL WHERE rescheduled_from_booking_id = ANY($1::uuid[]) OR booking_id = ANY($1::uuid[])`,
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

    // 5. Clean up explicit test slot records themselves (preserving shared parent location/table)
    if (resolvedSlotIds.length > 0) {
      await client.query(
        `DELETE FROM campus_duo.study_slot WHERE slot_id = ANY($1::uuid[])`,
        [resolvedSlotIds]
      );
    }

    await client.query('COMMIT;');
  } catch (err) {
    // Suppress secondary rollback errors (e.g. if the connection or network dropped)
    // to guarantee the original primary transaction exception is preserved and re-thrown.
    await client.query('ROLLBACK;').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteTestUser(emailPattern: string): Promise<void> {
  const pool = getMigratorPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN;');
    const userRes = await client.query<{ user_id: string }>(
      `SELECT user_id FROM campus_duo.user_account WHERE email = $1 OR email LIKE $1`,
      [emailPattern]
    );
    const userIds = userRes.rows.map((r) => r.user_id);
    if (userIds.length > 0) {
      await client.query(`DELETE FROM campus_duo.auth_session WHERE user_id = ANY($1::uuid[])`, [userIds]);
      await client.query(`DELETE FROM campus_duo.auth_credential WHERE user_id = ANY($1::uuid[])`, [userIds]);
      const bRes = await client.query<{ booking_id: string }>(
        `SELECT DISTINCT booking_id FROM campus_duo.booking_participant WHERE user_id = ANY($1::uuid[])
         UNION
         SELECT DISTINCT booking_id FROM campus_duo.booking WHERE booker_id = ANY($1::uuid[])`,
        [userIds]
      );
      const bIds = bRes.rows.map((r) => r.booking_id);
      if (bIds.length > 0) {
        await client.query(`DELETE FROM campus_duo.idempotency_record WHERE booking_id = ANY($1::uuid[])`, [bIds]);
        await client.query(`DELETE FROM campus_duo.outbox_event WHERE aggregate_id = ANY($1::uuid[])`, [bIds]);
        await client.query(`DELETE FROM campus_duo.audit_event WHERE target_id = ANY($1::uuid[])`, [bIds]);
        await client.query(`DELETE FROM campus_duo.booking_participant WHERE booking_id = ANY($1::uuid[])`, [bIds]);
        await client.query(`UPDATE campus_duo.booking SET rescheduled_from_booking_id = NULL WHERE booking_id = ANY($1::uuid[])`, [bIds]);
        await client.query(`DELETE FROM campus_duo.booking WHERE booking_id = ANY($1::uuid[])`, [bIds]);
      }
      await client.query(`DELETE FROM campus_duo.idempotency_record WHERE actor_user_id = ANY($1::uuid[])`, [userIds]);
      await client.query(`DELETE FROM campus_duo.audit_event WHERE actor_user_id = ANY($1::uuid[])`, [userIds]);
      await client.query(`DELETE FROM campus_duo.discovery_action WHERE actor_user_id = ANY($1::uuid[]) OR target_user_id = ANY($1::uuid[])`, [userIds]);
      await client.query(`DELETE FROM campus_duo.connection WHERE user_a_id = ANY($1::uuid[]) OR user_b_id = ANY($1::uuid[])`, [userIds]);
      await client.query(`DELETE FROM campus_duo.consent_record WHERE user_id = ANY($1::uuid[])`, [userIds]);
      await client.query(`DELETE FROM campus_duo.student_profile WHERE user_id = ANY($1::uuid[])`, [userIds]);
      await client.query(`DELETE FROM campus_duo.otp_challenge WHERE email = $1 OR email LIKE $1`, [emailPattern]);
      await client.query(`DELETE FROM campus_duo.user_account WHERE user_id = ANY($1::uuid[])`, [userIds]);
    }
    await client.query('COMMIT;');
  } catch (err) {
    await client.query('ROLLBACK;');
    throw err;
  } finally {
    client.release();
  }
}

export async function cleanupDiscoveryAndConnections(userIdA: string, userIdB: string): Promise<void> {
  const pool = getMigratorPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN;');
    await client.query(
      `DELETE FROM campus_duo.discovery_action
       WHERE (actor_user_id = $1 AND target_user_id = $2)
          OR (actor_user_id = $2 AND target_user_id = $1)`,
      [userIdA, userIdB]
    );

    const conns = await client.query<{ connection_id: string }>(
      `SELECT connection_id FROM campus_duo.connection
       WHERE (user_a_id = LEAST($1::uuid, $2::uuid) AND user_b_id = GREATEST($1::uuid, $2::uuid))
         AND connection_id != '00000000-0000-0000-0000-00000000d561'`,
      [userIdA, userIdB]
    );

    if (conns.rows.length > 0) {
      const connIds = conns.rows.map(r => r.connection_id);
      const bookings = await client.query<{ booking_id: string }>(
        `SELECT booking_id FROM campus_duo.booking WHERE connection_id = ANY($1::uuid[])`,
        [connIds]
      );
      if (bookings.rows.length > 0) {
        const bIds = bookings.rows.map(r => r.booking_id);
        await client.query(`DELETE FROM campus_duo.booking_participant WHERE booking_id = ANY($1::uuid[])`, [bIds]);
        await client.query(`DELETE FROM campus_duo.idempotency_record WHERE booking_id = ANY($1::uuid[])`, [bIds]);
        await client.query(`DELETE FROM campus_duo.audit_event WHERE target_id = ANY($1::uuid[])`, [bIds]);
        await client.query(`DELETE FROM campus_duo.outbox_event WHERE aggregate_id = ANY($1::uuid[])`, [bIds]);
        await client.query(`DELETE FROM campus_duo.booking WHERE booking_id = ANY($1::uuid[])`, [bIds]);
      }

      await client.query(
        `DELETE FROM campus_duo.connection WHERE connection_id = ANY($1::uuid[])`,
        [connIds]
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



