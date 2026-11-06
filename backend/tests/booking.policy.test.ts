import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Pool, PoolClient } from 'pg';
import { app } from '../src/app';
import { closeDbPool, getDbPool } from '../src/config/db';
import { getEnvConfig } from '../src/config/env';
import { closeMigratorPool, getMigratorPool } from './testDbHelper';

const FIXTURE = {
  actorId: '00000000-0000-0000-0000-00000000F801',
  companionId: '00000000-0000-0000-0000-00000000F802',
  ineligibleCompanionId: '00000000-0000-0000-0000-00000000F803',
  nonexistentCompanionId: '00000000-0000-0000-0000-00000000F817',
  connectionId: '00000000-0000-0000-0000-00000000F804',
  actorConsentId: '00000000-0000-0000-0000-00000000F805',
  companionConsentId: '00000000-0000-0000-0000-00000000F806',
  ineligibleConsentId: '00000000-0000-0000-0000-00000000F807',
  locationId: '00000000-0000-0000-0000-00000000F811',
  tableId: '00000000-0000-0000-0000-00000000F812',
  slotId: '00000000-0000-0000-0000-00000000F813',
  blockId: '00000000-0000-0000-0000-00000000F814',
  localDate: '2027-01-11'
} as const;

const TEST_DATABASE = 'campus_duo_test';
const BASE_OPERATION_PREFIX = 'test-policy-';
const originalTestEnvironment = {
  nodeEnv: process.env.NODE_ENV,
  allowTestHarnessAuth: process.env.ALLOW_TEST_HARNESS_AUTH
};

function restoreTestEnvironment(): void {
  if (originalTestEnvironment.nodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalTestEnvironment.nodeEnv;
  }
  if (originalTestEnvironment.allowTestHarnessAuth === undefined) {
    delete process.env.ALLOW_TEST_HARNESS_AUTH;
  } else {
    process.env.ALLOW_TEST_HARNESS_AUTH = originalTestEnvironment.allowTestHarnessAuth;
  }
}

function assertMigratorPassword(): void {
  if (!process.env.CAMPUS_DUO_MIGRATOR_PASSWORD) {
    throw new Error(
      'CAMPUS_DUO_MIGRATOR_PASSWORD is required for booking policy fixture setup'
    );
  }
}

async function assertDatabase(pool: Pool | PoolClient, label: string): Promise<void> {
  const result = await pool.query<{ database_name: string }>(
    'SELECT current_database() AS database_name'
  );
  if (result.rows[0]?.database_name !== TEST_DATABASE) {
    throw new Error(
      `${label} requires database ${TEST_DATABASE}; refusing connected database ${result.rows[0]?.database_name ?? 'unknown'}`
    );
  }
}

async function assertApplicationDatabase(): Promise<void> {
  const config = getEnvConfig();
  if (config.db.connectionString) {
    throw new Error(
      'Booking policy tests do not support DATABASE_URL; unset DATABASE_URL so the application uses campus_duo_test'
    );
  }
  await assertDatabase(getDbPool(), 'Booking policy application pool');
}

async function setupPolicyFixture(): Promise<void> {
  assertMigratorPassword();
  await assertApplicationDatabase();
  const client = await getMigratorPool().connect();

  try {
    await assertDatabase(client, 'Booking policy migrator connection');
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO campus_duo.user_account (
         user_id, identity_subject, display_name, role, verification_status,
         onboarding_status, account_status
       ) VALUES
         ($1, 'kan79-policy-actor', 'KAN-79 Policy Actor', 'ROLE_STUDENT', 'VERIFIED', 'COMPLETED', 'ACTIVE'),
         ($2, 'kan79-policy-companion', 'KAN-79 Policy Companion', 'ROLE_STUDENT', 'VERIFIED', 'COMPLETED', 'ACTIVE'),
         ($3, 'kan79-policy-ineligible', 'KAN-79 Policy Ineligible', 'ROLE_STUDENT', 'VERIFIED', 'COMPLETED', 'SUSPENDED')`,
      [FIXTURE.actorId, FIXTURE.companionId, FIXTURE.ineligibleCompanionId]
    );
    await client.query(
      `INSERT INTO campus_duo.consent_record (
         consent_id, user_id, mode, has_consent, consented_at, policy_version
       ) VALUES
         ($1, $4, 'STUDY', true, now(), 'kan79-policy-v1'),
         ($2, $5, 'STUDY', true, now(), 'kan79-policy-v1'),
         ($3, $6, 'STUDY', true, now(), 'kan79-policy-v1')`,
      [
        FIXTURE.actorConsentId,
        FIXTURE.companionConsentId,
        FIXTURE.ineligibleConsentId,
        FIXTURE.actorId,
        FIXTURE.companionId,
        FIXTURE.ineligibleCompanionId
      ]
    );
    await client.query(
      `INSERT INTO campus_duo.connection (
         connection_id, user_a_id, user_b_id, mode, status, note
       ) VALUES ($1, $2, $3, 'STUDY', 'MUTUAL_CONNECTED', 'KAN-79 policy fixture')`,
      [FIXTURE.connectionId, FIXTURE.actorId, FIXTURE.companionId]
    );
    await client.query(
      `INSERT INTO campus_duo.study_location (
         location_id, name, building, open_time, close_time, noise_policy, active
       ) VALUES ($1, 'KAN-79 Policy Fixture', 'KAN-79-TEST', '08:00', '20:00',
                 'WHISPER_COLLAB', true)`,
      [FIXTURE.locationId]
    );
    await client.query(
      `INSERT INTO campus_duo.study_table (
         table_id, location_id, table_number, capacity, active
       ) VALUES ($1, $2, 'KAN-79-A', 2, true)`,
      [FIXTURE.tableId, FIXTURE.locationId]
    );
    await client.query(
      `INSERT INTO campus_duo.study_slot (
         slot_id, table_id, location_id, local_date, start_time, end_time,
         zone, status, active
       ) VALUES ($1, $2, $3, $4, '10:00', '12:00', 'COLLABORATIVE_STUDY', 'AVAILABLE', true)`,
      [
        FIXTURE.slotId,
        FIXTURE.tableId,
        FIXTURE.locationId,
        FIXTURE.localDate
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

async function cleanupPolicyFixture(): Promise<void> {
  const client = await getMigratorPool().connect();
  try {
    await assertDatabase(client, 'Booking policy migrator connection');
    await client.query('BEGIN');
    await client.query(
      'DELETE FROM campus_duo.block WHERE block_id = $1::uuid',
      [FIXTURE.blockId]
    );
    await client.query(
      'DELETE FROM campus_duo.study_slot WHERE slot_id = $1::uuid',
      [FIXTURE.slotId]
    );
    await client.query(
      'DELETE FROM campus_duo.study_table WHERE table_id = $1::uuid',
      [FIXTURE.tableId]
    );
    await client.query(
      'DELETE FROM campus_duo.study_location WHERE location_id = $1::uuid',
      [FIXTURE.locationId]
    );
    await client.query(
      'DELETE FROM campus_duo.connection WHERE connection_id = $1::uuid',
      [FIXTURE.connectionId]
    );
    await client.query(
      'DELETE FROM campus_duo.consent_record WHERE consent_id = ANY($1::uuid[])',
      [[
        FIXTURE.actorConsentId,
        FIXTURE.companionConsentId,
        FIXTURE.ineligibleConsentId
      ]]
    );
    await client.query(
      'DELETE FROM campus_duo.user_account WHERE user_id = ANY($1::uuid[])',
      [[FIXTURE.actorId, FIXTURE.companionId, FIXTURE.ineligibleCompanionId]]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function setSlotState(status: 'AVAILABLE' | 'LOCKED_MAINTENANCE', active: boolean) {
  const client = await getMigratorPool().connect();
  try {
    await assertDatabase(client, 'Booking policy migrator connection');
    await client.query(
      'UPDATE campus_duo.study_slot SET status = $1, active = $2 WHERE slot_id = $3::uuid',
      [status, active, FIXTURE.slotId]
    );
  } finally {
    client.release();
  }
}

async function setCompanionConsent(hasConsent: boolean): Promise<void> {
  const client = await getMigratorPool().connect();
  try {
    await assertDatabase(client, 'Booking policy migrator connection');
    await client.query(
      `UPDATE campus_duo.consent_record
          SET has_consent = $1,
              consented_at = CASE WHEN $1 THEN now() ELSE consented_at END,
              revoked_at = CASE WHEN $1 THEN NULL ELSE now() END
        WHERE consent_id = $2::uuid`,
      [hasConsent, FIXTURE.companionConsentId]
    );
  } finally {
    client.release();
  }
}

async function addActiveBlock(): Promise<void> {
  const client = await getMigratorPool().connect();
  try {
    await assertDatabase(client, 'Booking policy migrator connection');
    await client.query(
      `INSERT INTO campus_duo.block (
         block_id, actor_user_id, target_user_id, active, policy_version
       ) VALUES ($1, $2, $3, true, 'kan79-policy-v1')`,
      [FIXTURE.blockId, FIXTURE.actorId, FIXTURE.companionId]
    );
  } finally {
    client.release();
  }
}

async function countOperationWrites(operationId: string): Promise<{
  bookings: number;
  idempotency: number;
}> {
  const pool = getDbPool();
  const result = await pool.query<{ bookings: string; idempotency: string }>(
    `SELECT
       (SELECT count(*)::text FROM campus_duo.booking b
         JOIN campus_duo.idempotency_record i ON i.booking_id = b.booking_id
        WHERE i.client_operation_id = $1) AS bookings,
       (SELECT count(*)::text FROM campus_duo.idempotency_record
        WHERE client_operation_id = $1) AS idempotency`,
    [operationId]
  );
  return {
    bookings: Number(result.rows[0].bookings),
    idempotency: Number(result.rows[0].idempotency)
  };
}

function basePayload(clientOperationId: string) {
  return {
    clientOperationId,
    tableId: FIXTURE.tableId,
    locationId: FIXTURE.locationId,
    localDate: FIXTURE.localDate,
    slotId: FIXTURE.slotId,
    companionStudentId: FIXTURE.companionId
  };
}

describe('POST /api/booking — booking policy rejection coverage', () => {
  beforeAll(async () => {
    await setupPolicyFixture();
  });

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_TEST_HARNESS_AUTH = 'true';
  });

  afterAll(async () => {
    const failures: unknown[] = [];
    try {
      await cleanupPolicyFixture();
    } catch (error) {
      failures.push(error);
    }
    try {
      await closeDbPool();
    } catch (error) {
      failures.push(error);
    }
    try {
      await closeMigratorPool();
    } catch (error) {
      failures.push(error);
    }
    try {
      restoreTestEnvironment();
    } catch (error) {
      failures.push(error);
    }

    if (failures.length === 1) {
      throw failures[0];
    }
    if (failures.length > 1) {
      throw new AggregateError(failures, 'Booking policy cleanup failed');
    }
  });

  it('rejects booking when required STUDY consent is missing and persists no writes', async () => {
    const operationId = `${BASE_OPERATION_PREFIX}missing-consent`;
    await setCompanionConsent(false);

    try {
      const res = await request(app)
        .post('/api/booking')
        .set('X-Campus-Duo-Test-Actor', FIXTURE.actorId)
        .send(basePayload(operationId));

      expect(res.status).toBe(403);
      expect(res.body.error).toEqual({
        code: 'FORBIDDEN',
        message: 'Both participants must have active STUDY consent'
      });
      expect(await countOperationWrites(operationId)).toEqual({
        bookings: 0,
        idempotency: 0
      });
    } finally {
      await setCompanionConsent(true);
    }
  });

  it('rejects booking when an active block exists and persists no writes', async () => {
    const operationId = `${BASE_OPERATION_PREFIX}active-block`;
    await addActiveBlock();

    try {
      const res = await request(app)
        .post('/api/booking')
        .set('X-Campus-Duo-Test-Actor', FIXTURE.actorId)
        .send(basePayload(operationId));

      expect(res.status).toBe(403);
      expect(res.body.error).toEqual({
        code: 'FORBIDDEN',
        message: 'An active block exists between participants'
      });
      expect(await countOperationWrites(operationId)).toEqual({
        bookings: 0,
        idempotency: 0
      });
    } finally {
      const client = await getMigratorPool().connect();
      try {
        await assertDatabase(client, 'Booking policy migrator connection');
        await client.query('DELETE FROM campus_duo.block WHERE block_id = $1::uuid', [
          FIXTURE.blockId
        ]);
      } finally {
        client.release();
      }
    }
  });

  it('rejects an inactive companion before booking writes', async () => {
    const operationId = `${BASE_OPERATION_PREFIX}ineligible-companion`;
    const res = await request(app)
      .post('/api/booking')
      .set('X-Campus-Duo-Test-Actor', FIXTURE.actorId)
      .send({
        ...basePayload(operationId),
        companionStudentId: FIXTURE.ineligibleCompanionId
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toEqual({
      code: 'FORBIDDEN',
      message: 'Companion is not an active verified student'
    });
    expect(await countOperationWrites(operationId)).toEqual({
      bookings: 0,
      idempotency: 0
    });
  });

  it('rejects a syntactically valid companion UUID absent from user_account', async () => {
    const operationId = `${BASE_OPERATION_PREFIX}nonexistent-companion`;
    const accountResult = await getDbPool().query<{ count: string }>(
      'SELECT count(*)::text AS count FROM campus_duo.user_account WHERE user_id = $1::uuid',
      [FIXTURE.nonexistentCompanionId]
    );
    expect(Number(accountResult.rows[0].count)).toBe(0);

    const res = await request(app)
      .post('/api/booking')
      .set('X-Campus-Duo-Test-Actor', FIXTURE.actorId)
      .send({
        ...basePayload(operationId),
        companionStudentId: FIXTURE.nonexistentCompanionId
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toEqual({
      code: 'FORBIDDEN',
      message: 'Companion is not an active verified student'
    });
    expect(await countOperationWrites(operationId)).toEqual({
      bookings: 0,
      idempotency: 0
    });
  });

  it('rejects an unavailable slot/resource before booking writes', async () => {
    const operationId = `${BASE_OPERATION_PREFIX}unavailable-resource`;
    await setSlotState('LOCKED_MAINTENANCE', true);

    try {
      const res = await request(app)
        .post('/api/booking')
        .set('X-Campus-Duo-Test-Actor', FIXTURE.actorId)
        .send(basePayload(operationId));

      expect(res.status).toBe(409);
      expect(res.body.error).toEqual({
        code: 'CONFLICT',
        message: 'The requested study slot or resource is not available for reservation'
      });
      expect(await countOperationWrites(operationId)).toEqual({
        bookings: 0,
        idempotency: 0
      });
    } finally {
      await setSlotState('AVAILABLE', true);
    }
  });

  it.each([
    {
      label: 'table mismatch',
      payload: { tableId: '00000000-0000-0000-0000-00000000F815' }
    },
    {
      label: 'location mismatch',
      payload: { locationId: '00000000-0000-0000-0000-00000000F816' }
    },
    {
      label: 'date mismatch',
      payload: { localDate: '2027-01-12' }
    }
  ])('rejects a $label without booking writes', async ({ label, payload }) => {
    const operationId = `${BASE_OPERATION_PREFIX}${label.replaceAll(' ', '-')}`;
    const res = await request(app)
      .post('/api/booking')
      .set('X-Campus-Duo-Test-Actor', FIXTURE.actorId)
      .send({ ...basePayload(operationId), ...payload });

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({
      code: 'NOT_FOUND',
      message: 'The requested study slot or resource was not found'
    });
    expect(await countOperationWrites(operationId)).toEqual({
      bookings: 0,
      idempotency: 0
    });
  });
});
