import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { closeDbPool, getDbPool } from '../src/config/db';
import { setupTestSlot, cleanupTestData, closeMigratorPool } from './testDbHelper';

const ALEX_ID = '00000000-0000-0000-0000-00000000D501'; // Booker
const SAM_ID = '00000000-0000-0000-0000-00000000D502';  // Companion

const CONTESTED_LOCATION_ID = '00000000-0000-0000-0000-00000000D571';
const CONTESTED_TABLE_ID = '00000000-0000-0000-0000-00000000D572';
const CONTESTED_DATE = '2026-12-15';
const CONTESTED_SLOT_ID = '00000000-0000-0000-0000-00000000E099';

describe('Real PostgreSQL Concurrency Race Test (UC-01 & NFR-01)', () => {
  beforeAll(async () => {
    await cleanupTestData(['test-race-%'], [CONTESTED_SLOT_ID]);

    // Setup fresh contested slot on PostgreSQL
    await setupTestSlot({
      slotId: CONTESTED_SLOT_ID,
      tableId: CONTESTED_TABLE_ID,
      locationId: CONTESTED_LOCATION_ID,
      localDate: CONTESTED_DATE,
      startTime: '16:00:00',
      endTime: '18:00:00',
      zone: 'COLLABORATIVE_STUDY'
    });
  });

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_TEST_HARNESS_AUTH = 'true';
  });

  afterAll(async () => {
    await cleanupTestData(['test-race-%'], [CONTESTED_SLOT_ID]);
    await closeDbPool();
    await closeMigratorPool();
  });

  it('demonstrates exactly one confirmed booking under 10 concurrent competing requests for the same slot', async () => {
    const CONCURRENCY_COUNT = 10;
    const clientOpIds = Array.from({ length: CONCURRENCY_COUNT }, (_, i) => `test-race-op-${i + 1}`);

    // Fire 10 simultaneous concurrent requests competing for the exact same slot
    const promises = clientOpIds.map((opId) =>
      request(app)
        .post('/api/booking')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          clientOperationId: opId,
          tableId: CONTESTED_TABLE_ID,
          locationId: CONTESTED_LOCATION_ID,
          localDate: CONTESTED_DATE,
          slotId: CONTESTED_SLOT_ID,
          companionStudentId: SAM_ID
        })
    );

    const responses = await Promise.all(promises);

    const successes = responses.filter((r) => r.status === 201);
    const conflicts = responses.filter((r) => r.status === 409);
    const others = responses.filter((r) => r.status !== 201 && r.status !== 409);

    // Assert that no internal server errors or unhandled crashes occurred
    expect(others).toHaveLength(0);

    // Assert that EXACTLY ONE request succeeded with 201 Created
    expect(successes).toHaveLength(1);

    // Assert that EXACTLY N-1 requests were rejected with 409 Conflict
    expect(conflicts).toHaveLength(CONCURRENCY_COUNT - 1);

    for (const conflictRes of conflicts) {
      expect(conflictRes.body.error).toHaveProperty('code', 'CONFLICT');
      expect(conflictRes.body.error.message).toContain('already booked');
    }

    // Direct PostgreSQL inspection: Assert that exactly ONE confirmed booking row exists
    const pool = getDbPool();
    const countRes = await pool.query(
      `SELECT count(*) FROM campus_duo.booking
       WHERE table_id = $1 AND local_date = $2 AND slot_id = $3 AND status = 'CONFIRMED'`,
      [CONTESTED_TABLE_ID, CONTESTED_DATE, CONTESTED_SLOT_ID]
    );

    const confirmedCount = Number(countRes.rows[0].count);
    expect(confirmedCount).toBe(1);

    // Direct PostgreSQL inspection: Assert winning booking has exactly two participant rows
    const winningBookingId = successes[0].body.data.bookingId;
    const participantCountRes = await pool.query(
      `SELECT count(*) FROM campus_duo.booking_participant WHERE booking_id = $1`,
      [winningBookingId]
    );
    expect(Number(participantCountRes.rows[0].count)).toBe(2);
  });
});
