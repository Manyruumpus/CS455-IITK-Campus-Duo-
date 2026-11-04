import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { closeDbPool } from '../src/config/db';
import { getMigratorPool, closeMigratorPool } from './testDbHelper';

const VALID_ACTOR_ID = '00000000-0000-0000-0000-00000000D501'; // Dev Student Alex
const COMPANION_ID = '00000000-0000-0000-0000-00000000D502';   // Dev Student Sam
const SEED_CONNECTION_ID = '00000000-0000-0000-0000-00000000D561';
const SEED_LOCATION_ID = '00000000-0000-0000-0000-00000000D571';
const SEED_TABLE_ID = '00000000-0000-0000-0000-00000000D572';

// Dynamic, isolated test fixtures dedicated to this test suite (KAN-71)
const TEST_DATE = '2026-12-28';
const TEST_END_DATE = '2026-12-30';

const TEST_SLOT_OCCUPIED = '00000000-0000-0000-0000-00000000a574';
const TEST_SLOT_CANCELLED = '00000000-0000-0000-0000-00000000a575';
const TEST_SLOT_AVAILABLE = '00000000-0000-0000-0000-00000000a576';

const TEST_BOOKING_CONFIRMED = '00000000-0000-0000-0000-00000000a581';
const TEST_BOOKING_CANCELLED = '00000000-0000-0000-0000-00000000a582';

async function cleanupAvailabilityFixtures(): Promise<void> {
  const pool = getMigratorPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN;');
    await client.query(
      `DELETE FROM campus_duo.booking_participant WHERE booking_id = ANY($1::uuid[])`,
      [[TEST_BOOKING_CONFIRMED, TEST_BOOKING_CANCELLED]]
    );
    await client.query(
      `DELETE FROM campus_duo.booking WHERE booking_id = ANY($1::uuid[])`,
      [[TEST_BOOKING_CONFIRMED, TEST_BOOKING_CANCELLED]]
    );
    await client.query(
      `DELETE FROM campus_duo.study_slot WHERE slot_id = ANY($1::uuid[])`,
      [[TEST_SLOT_OCCUPIED, TEST_SLOT_CANCELLED, TEST_SLOT_AVAILABLE]]
    );
    await client.query('COMMIT;');
  } catch (err) {
    await client.query('ROLLBACK;');
    throw err;
  } finally {
    client.release();
  }
}

async function setupAvailabilityFixtures(): Promise<void> {
  const pool = getMigratorPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN;');

    // 1. Insert 3 dynamic test slots for TEST_DATE
    await client.query(
      `INSERT INTO campus_duo.study_slot (
        slot_id, table_id, location_id, local_date, start_time, end_time, zone, status, active
      ) VALUES
        ($1, $4, $5, $6, '09:00:00', '11:00:00', 'COLLABORATIVE_STUDY', 'AVAILABLE', true),
        ($2, $4, $5, $6, '11:00:00', '13:00:00', 'COLLABORATIVE_STUDY', 'AVAILABLE', true),
        ($3, $4, $5, $6, '13:00:00', '15:00:00', 'COLLABORATIVE_STUDY', 'AVAILABLE', true)
      ON CONFLICT (slot_id) DO UPDATE
        SET local_date = EXCLUDED.local_date, status = 'AVAILABLE', active = true;`,
      [TEST_SLOT_OCCUPIED, TEST_SLOT_CANCELLED, TEST_SLOT_AVAILABLE, SEED_TABLE_ID, SEED_LOCATION_ID, TEST_DATE]
    );

    // 2. Insert Confirmed Booking for TEST_SLOT_OCCUPIED
    await client.query(
      `INSERT INTO campus_duo.booking (
        booking_id, connection_id, booker_id, table_id, location_id, slot_id, local_date, status
      ) VALUES
        ($1, $2, $3, $4, $5, $6, $7, 'CONFIRMED')
      ON CONFLICT (booking_id) DO UPDATE
        SET status = 'CONFIRMED', cancelled_at = NULL, cancelled_by = NULL, cancellation_reason = NULL;`,
      [TEST_BOOKING_CONFIRMED, SEED_CONNECTION_ID, VALID_ACTOR_ID, SEED_TABLE_ID, SEED_LOCATION_ID, TEST_SLOT_OCCUPIED, TEST_DATE]
    );

    await client.query(
      `INSERT INTO campus_duo.booking_participant (booking_id, user_id, participant_role)
      VALUES
        ($1, $2, 'CREATOR'),
        ($1, $3, 'COMPANION')
      ON CONFLICT (booking_id, user_id) DO NOTHING;`,
      [TEST_BOOKING_CONFIRMED, VALID_ACTOR_ID, COMPANION_ID]
    );

    // 3. Insert Cancelled Booking for TEST_SLOT_CANCELLED
    await client.query(
      `INSERT INTO campus_duo.booking (
        booking_id, connection_id, booker_id, table_id, location_id, slot_id, local_date, status, cancelled_at, cancelled_by, cancellation_reason
      ) VALUES
        ($1, $2, $3, $4, $5, $6, $7, 'CANCELLED', now(), $3, '[SYNTHETIC TEST] Historical cancellation')
      ON CONFLICT (booking_id) DO UPDATE
        SET status = 'CANCELLED', cancelled_at = now(), cancelled_by = $3;`,
      [TEST_BOOKING_CANCELLED, SEED_CONNECTION_ID, VALID_ACTOR_ID, SEED_TABLE_ID, SEED_LOCATION_ID, TEST_SLOT_CANCELLED, TEST_DATE]
    );

    await client.query(
      `INSERT INTO campus_duo.booking_participant (booking_id, user_id, participant_role)
      VALUES
        ($1, $2, 'CREATOR'),
        ($1, $3, 'COMPANION')
      ON CONFLICT (booking_id, user_id) DO NOTHING;`,
      [TEST_BOOKING_CANCELLED, VALID_ACTOR_ID, COMPANION_ID]
    );

    await client.query('COMMIT;');
  } catch (err) {
    await client.query('ROLLBACK;');
    throw err;
  } finally {
    client.release();
  }
}

describe('GET /api/booking/availability', () => {
  beforeAll(async () => {
    await cleanupAvailabilityFixtures();
    await setupAvailabilityFixtures();
  });

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_TEST_HARNESS_AUTH = 'true';
  });

  afterAll(async () => {
    await cleanupAvailabilityFixtures();
    await closeDbPool();
    await closeMigratorPool();
  });

  describe('Valid Availability Queries', () => {
    it('returns study slots for a valid campus date with derived occupancy states', async () => {
      const res = await request(app)
        .get(`/api/booking/availability?date=${TEST_DATE}`)
        .set('X-Campus-Duo-Test-Actor', VALID_ACTOR_ID);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('requestId');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(3);

      // Verify occupied slot (confirmed booking) -> OCCUPIED, reservedCount = 2
      const slotOccupied = res.body.data.find(
        (s: any) => s.slotId === TEST_SLOT_OCCUPIED
      );
      expect(slotOccupied).toBeDefined();
      expect(slotOccupied.status).toBe('OCCUPIED');
      expect(slotOccupied.reservedCount).toBe(2);
      expect(slotOccupied.capacity).toBe(2);
      expect(slotOccupied.tableNumber).toBe('DB05-A');

      // Verify cancelled slot (cancelled booking) -> AVAILABLE, reservedCount = 0
      const slotCancelled = res.body.data.find(
        (s: any) => s.slotId === TEST_SLOT_CANCELLED
      );
      expect(slotCancelled).toBeDefined();
      expect(slotCancelled.status).toBe('AVAILABLE');
      expect(slotCancelled.reservedCount).toBe(0);

      // Verify available slot (no booking) -> AVAILABLE, reservedCount = 0
      const slotAvailable = res.body.data.find(
        (s: any) => s.slotId === TEST_SLOT_AVAILABLE
      );
      expect(slotAvailable).toBeDefined();
      expect(slotAvailable.status).toBe('AVAILABLE');
      expect(slotAvailable.reservedCount).toBe(0);
    });

    it('filters correctly by locationId', async () => {
      const res = await request(app)
        .get(`/api/booking/availability?date=${TEST_DATE}&locationId=${SEED_LOCATION_ID}`)
        .set('X-Campus-Duo-Test-Actor', VALID_ACTOR_ID);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3);
      for (const slot of res.body.data) {
        expect(slot.locationId).toBe(SEED_LOCATION_ID.toLowerCase());
      }
    });

    it('supports startDate and endDate range query with limit', async () => {
      const res = await request(app)
        .get(`/api/booking/availability?startDate=${TEST_DATE}&endDate=${TEST_END_DATE}&limit=2`)
        .set('X-Campus-Duo-Test-Actor', VALID_ACTOR_ID);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });
  });

  describe('Invalid Query Parameters Validation', () => {
    it('rejects request missing date or startDate with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .get('/api/booking/availability')
        .set('X-Campus-Duo-Test-Actor', VALID_ACTOR_ID);

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(res.body.error.message).toContain('startDate');
    });

    it('rejects malformed date format with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .get('/api/booking/availability?date=14-11-2026')
        .set('X-Campus-Duo-Test-Actor', VALID_ACTOR_ID);

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(res.body.error.message).toContain('YYYY-MM-DD');
    });

    it('rejects startDate > endDate with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .get(`/api/booking/availability?startDate=${TEST_END_DATE}&endDate=${TEST_DATE}`)
        .set('X-Campus-Duo-Test-Actor', VALID_ACTOR_ID);

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(res.body.error.message).toContain('startDate must be less than or equal to endDate');
    });

    it('rejects malformed locationId with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .get(`/api/booking/availability?date=${TEST_DATE}&locationId=not-a-uuid`)
        .set('X-Campus-Duo-Test-Actor', VALID_ACTOR_ID);

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Invalid UUID');
    });
  });
});
