import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { closeDbPool, query } from '../src/config/db';
import { setupTestSlot, cleanupTestData, closeMigratorPool, getMigratorPool } from './testDbHelper';

const ALEX_ID = '00000000-0000-0000-0000-00000000D501';   // Creator
const SAM_ID = '00000000-0000-0000-0000-00000000D502';    // Companion (Mutual STUDY connected with Alex)
const JORDAN_ID = '00000000-0000-0000-0000-00000000D503'; // Student with NO connection to Alex
const ADMIN_ID = '00000000-0000-0000-0000-00000000d599';  // Admin

const SEED_LOCATION_ID = '00000000-0000-0000-0000-00000000D571';
const SEED_TABLE_ID = '00000000-0000-0000-0000-00000000D572';

const TEST_DATE = '2026-12-15';
const SLOT_1 = '00000000-0000-0000-0000-00000000F001';
const SLOT_2 = '00000000-0000-0000-0000-00000000F002';
const SLOT_3 = '00000000-0000-0000-0000-00000000F003';
const SLOT_4 = '00000000-0000-0000-0000-00000000F004';

describe('Booking Cancellation and Rescheduling Lifecycle Suite (FR-08 & FR-09)', () => {
  beforeAll(async () => {
    await cleanupTestData(['test-lc-%'], [SLOT_1, SLOT_2, SLOT_3, SLOT_4]);

    await setupTestSlot({
      slotId: SLOT_1,
      tableId: SEED_TABLE_ID,
      locationId: SEED_LOCATION_ID,
      localDate: TEST_DATE,
      startTime: '09:00:00',
      endTime: '11:00:00',
      zone: 'COLLABORATIVE_STUDY'
    });

    await setupTestSlot({
      slotId: SLOT_2,
      tableId: SEED_TABLE_ID,
      locationId: SEED_LOCATION_ID,
      localDate: TEST_DATE,
      startTime: '11:00:00',
      endTime: '13:00:00',
      zone: 'COLLABORATIVE_STUDY'
    });

    await setupTestSlot({
      slotId: SLOT_3,
      tableId: SEED_TABLE_ID,
      locationId: SEED_LOCATION_ID,
      localDate: TEST_DATE,
      startTime: '13:00:00',
      endTime: '15:00:00',
      zone: 'COLLABORATIVE_STUDY'
    });

    await setupTestSlot({
      slotId: SLOT_4,
      tableId: SEED_TABLE_ID,
      locationId: SEED_LOCATION_ID,
      localDate: TEST_DATE,
      startTime: '18:00:00',
      endTime: '20:00:00',
      zone: 'COLLABORATIVE_STUDY'
    });
  });

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_TEST_HARNESS_AUTH = 'true';
  });

  afterAll(async () => {
    await cleanupTestData(['test-lc-%'], [SLOT_1, SLOT_2, SLOT_3, SLOT_4]);
    await closeDbPool();
    await closeMigratorPool();
  });

  describe('1. Cancellation Authorization & Execution (FR-09)', () => {
    let bookingId: string;

    it('creates an initial confirmed booking for cancellation tests', async () => {
      const res = await request(app)
        .post('/api/booking')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          clientOperationId: 'test-lc-create-1',
          tableId: SEED_TABLE_ID,
          locationId: SEED_LOCATION_ID,
          localDate: TEST_DATE,
          slotId: SLOT_1,
          companionStudentId: SAM_ID
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('CONFIRMED');
      bookingId = res.body.data.bookingId;
    });

    it('rejects companion cancellation with 403 Forbidden and demo policy message', async () => {
      const res = await request(app)
        .post(`/api/booking/${bookingId}/cancel`)
        .set('X-Campus-Duo-Test-Actor', SAM_ID)
        .send({ reason: 'Companion trying to cancel' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain(
        'Under current demo policy, only the booking creator or administrator may cancel or reschedule this reservation.'
      );
    });

    it('rejects unrelated student (Jordan) cancellation with 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/booking/${bookingId}/cancel`)
        .set('X-Campus-Duo-Test-Actor', JORDAN_ID)
        .send({ reason: 'Intruder trying to cancel' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('creator successfully cancels booking and releases slot capacity', async () => {
      const res = await request(app)
        .post(`/api/booking/${bookingId}/cancel`)
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          reason: 'Schedule conflict on exam day',
          clientOperationId: 'test-lc-cancel-1'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');
      expect(res.body.data.cancelledAt).toBeDefined();

      // Verify row in database
      const dbRes = await query(
        `SELECT status, cancelled_by, cancellation_reason, cancelled_at
         FROM campus_duo.booking WHERE booking_id = $1`,
        [bookingId]
      );
      expect(dbRes.rows[0].status).toBe('CANCELLED');
      expect(dbRes.rows[0].cancelled_by.toLowerCase()).toBe(ALEX_ID.toLowerCase());
      expect(dbRes.rows[0].cancellation_reason).toBe('Schedule conflict on exam day');
      expect(dbRes.rows[0].cancelled_at).not.toBeNull();

      // Verify audit event
      const pool = getMigratorPool();
      const auditRes = await pool.query(
        `SELECT action, outcome, target_id, safe_reason
         FROM campus_duo.audit_event
         WHERE target_id = $1 AND action = 'BOOKING_CANCELLED'`,
        [bookingId]
      );
      expect(auditRes.rows.length).toBeGreaterThan(0);
      expect(auditRes.rows[0].outcome).toBe('SUCCESS');
      expect(auditRes.rows[0].safe_reason).toBe('Schedule conflict on exam day');

      // Verify outbox event
      const outboxRes = await pool.query(
        `SELECT event_type, aggregate_id, dedupe_key
         FROM campus_duo.outbox_event
         WHERE aggregate_id = $1 AND event_type = 'BOOKING_CANCELLED'`,
        [bookingId]
      );
      expect(outboxRes.rows.length).toBeGreaterThan(0);
      expect(outboxRes.rows[0].dedupe_key).toMatch(new RegExp(`^booking-cancelled:${bookingId}`));
    });

    it('makes repeat cancellation safe and idempotent returning cancelled state', async () => {
      const res = await request(app)
        .post(`/api/booking/${bookingId}/cancel`)
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          reason: 'Repeat cancellation call',
          clientOperationId: 'test-lc-cancel-1'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');
    });

    it('verifies freed slot can now be re-booked by another student pair', async () => {
      // Re-booking slot 1
      const res = await request(app)
        .post('/api/booking')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          clientOperationId: 'test-lc-rebook-1',
          tableId: SEED_TABLE_ID,
          locationId: SEED_LOCATION_ID,
          localDate: TEST_DATE,
          slotId: SLOT_1,
          companionStudentId: SAM_ID
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('CONFIRMED');
      expect(res.body.data.slotId.toLowerCase()).toBe(SLOT_1.toLowerCase());
    });

    it('rejects cancellation of malformed booking UUID with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/booking/invalid-uuid-format/cancel')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({ reason: 'Malformed test' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 Not Found when attempting to cancel non-existent booking ID', async () => {
      const nonExistentId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
      const res = await request(app)
        .post(`/api/booking/${nonExistentId}/cancel`)
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({ reason: 'Non-existent test' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('regression: pre-existing outbox dedupe key does not crash cancellation with HTTP 500', async () => {
      // 1. Create a fresh booking on isolated SLOT_4
      const createRes = await request(app)
        .post('/api/booking')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          clientOperationId: 'test-lc-dedupe-collision-prep',
          tableId: SEED_TABLE_ID,
          locationId: SEED_LOCATION_ID,
          localDate: TEST_DATE,
          slotId: SLOT_4,
          companionStudentId: SAM_ID
        });
      expect(createRes.status).toBe(201);
      const testBookingId = createRes.body.data.bookingId;

      // 2. Pre-insert a colliding outbox event key before cancellation
      const pool = getMigratorPool();
      await pool.query(
        `INSERT INTO campus_duo.outbox_event (event_type, aggregate_type, aggregate_id, dedupe_key, payload, correlation_id)
         VALUES ('BOOKING_CANCELLED', 'BOOKING', $1, $2, '{"dummy":true}'::jsonb, 'pre-seeded-corr-id')
         ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,
        [testBookingId, `booking-cancelled:${testBookingId}:2`]
      );

      // 3. Cancel the booking; savepoint absorbs dedupe key collision cleanly without HTTP 500
      const cancelRes = await request(app)
        .post(`/api/booking/${testBookingId}/cancel`)
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({ reason: 'Collision regression test' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('CANCELLED');
    });
  });

  describe('2. Atomic Rescheduling & Conflict Safety (FR-08)', () => {
    let sourceBookingId: string;
    let occupiedBookingId: string;

    beforeAll(async () => {
      // Create a confirmed booking on SLOT_3 to act as an occupied conflict target
      const resOcc = await request(app)
        .post('/api/booking')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          clientOperationId: 'test-lc-occ-target',
          tableId: SEED_TABLE_ID,
          locationId: SEED_LOCATION_ID,
          localDate: TEST_DATE,
          slotId: SLOT_3,
          companionStudentId: SAM_ID
        });
      expect(resOcc.status).toBe(201);
      occupiedBookingId = resOcc.body.data.bookingId;
    });

    it('creates source confirmed booking on SLOT_2 for rescheduling', async () => {
      const res = await request(app)
        .post('/api/booking')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          clientOperationId: 'test-lc-source-booking',
          tableId: SEED_TABLE_ID,
          locationId: SEED_LOCATION_ID,
          localDate: TEST_DATE,
          slotId: SLOT_2,
          companionStudentId: SAM_ID
        });
      expect(res.status).toBe(201);
      sourceBookingId = res.body.data.bookingId;
    });

    it('rejects companion rescheduling with 403 Forbidden and demo policy message', async () => {
      const res = await request(app)
        .post(`/api/booking/${sourceBookingId}/reschedule`)
        .set('X-Campus-Duo-Test-Actor', SAM_ID)
        .send({
          newLocalDate: TEST_DATE,
          newSlotId: SLOT_1
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain(
        'Under current demo policy, only the booking creator or administrator may cancel or reschedule this reservation.'
      );
    });

    it('rejects rescheduling to identical slot with 400 Bad Request', async () => {
      const res = await request(app)
        .post(`/api/booking/${sourceBookingId}/reschedule`)
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          newLocalDate: TEST_DATE,
          newSlotId: SLOT_2
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('atomic swap rollback: target conflict preserves original source booking intact', async () => {
      // Attempt to reschedule to SLOT_3 which is already booked by occupiedBookingId
      const res = await request(app)
        .post(`/api/booking/${sourceBookingId}/reschedule`)
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          newLocalDate: TEST_DATE,
          newSlotId: SLOT_3
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');

      // Crucial verification: source booking MUST remain CONFIRMED and untouched!
      const dbSource = await query(
        `SELECT status, cancelled_at, cancelled_by, cancellation_reason
         FROM campus_duo.booking WHERE booking_id = $1`,
        [sourceBookingId]
      );
      expect(dbSource.rows[0].status).toBe('CONFIRMED');
      expect(dbSource.rows[0].cancelled_at).toBeNull();
      expect(dbSource.rows[0].cancellation_reason).toBeNull();
    });

    it('creator successfully reschedules booking to an available slot', async () => {
      // We first cancel the re-booked SLOT_1 so it becomes available as a target
      const pool = getMigratorPool();
      await pool.query(
        `UPDATE campus_duo.booking
         SET status = 'CANCELLED', cancelled_at = now(), cancelled_by = $1, cancellation_reason = 'Freeing slot 1'
         WHERE slot_id = $2 AND status = 'CONFIRMED'`,
        [ALEX_ID, SLOT_1]
      );

      const res = await request(app)
        .post(`/api/booking/${sourceBookingId}/reschedule`)
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          newLocalDate: TEST_DATE,
          newSlotId: SLOT_1,
          clientOperationId: 'test-lc-resched-success'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CONFIRMED');
      expect(res.body.data.slotId.toLowerCase()).toBe(SLOT_1.toLowerCase());
      expect(res.body.data.bookingVersion).toBe(2);
      expect(res.body.data.rescheduledFromBookingId).toBe(sourceBookingId);

      const newBookingId = res.body.data.bookingId;

      // Verify source booking was marked CANCELLED with RESCHEDULED reason
      const dbSource = await query(
        `SELECT status, cancellation_reason, cancelled_by, cancelled_at
         FROM campus_duo.booking WHERE booking_id = $1`,
        [sourceBookingId]
      );
      expect(dbSource.rows[0].status).toBe('CANCELLED');
      expect(dbSource.rows[0].cancellation_reason).toBe('RESCHEDULED');
      expect(dbSource.rows[0].cancelled_by.toLowerCase()).toBe(ALEX_ID.toLowerCase());

      // Verify participants were copied to new booking
      const parts = await query(
        `SELECT user_id, participant_role
         FROM campus_duo.booking_participant
         WHERE booking_id = $1 ORDER BY participant_role`,
        [newBookingId]
      );
      expect(parts.rows.length).toBe(2);
      expect(parts.rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ user_id: ALEX_ID.toLowerCase(), participant_role: 'CREATOR' }),
          expect.objectContaining({ user_id: SAM_ID.toLowerCase(), participant_role: 'COMPANION' })
        ])
      );

      // Verify audit events
      const auditRes = await pool.query(
        `SELECT action, outcome, target_id
         FROM campus_duo.audit_event
         WHERE target_id = $1 AND action = 'BOOKING_RESCHEDULED'`,
        [newBookingId]
      );
      expect(auditRes.rows.length).toBeGreaterThan(0);
      expect(auditRes.rows[0].outcome).toBe('SUCCESS');
    });

    it('rejects second reschedule of the same source booking (single successor rule)', async () => {
      const res = await request(app)
        .post(`/api/booking/${sourceBookingId}/reschedule`)
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          newLocalDate: TEST_DATE,
          newSlotId: SLOT_2
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('3. Admin Authorization Suite', () => {
    it('allows an administrator to cancel a confirmed booking', async () => {
      // Create a booking
      const createRes = await request(app)
        .post('/api/booking')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          clientOperationId: 'test-lc-admin-cancel-prep',
          tableId: SEED_TABLE_ID,
          locationId: SEED_LOCATION_ID,
          localDate: TEST_DATE,
          slotId: SLOT_2,
          companionStudentId: SAM_ID
        });
      expect(createRes.status).toBe(201);
      const bookingId = createRes.body.data.bookingId;

      // Admin cancels
      const cancelRes = await request(app)
        .post(`/api/booking/${bookingId}/cancel`)
        .set('X-Campus-Duo-Test-Actor', ADMIN_ID)
        .send({ reason: 'Admin emergency facility maintenance' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('CANCELLED');

      const dbRes = await query(
        `SELECT status, cancelled_by, cancellation_reason
         FROM campus_duo.booking WHERE booking_id = $1`,
        [bookingId]
      );
      expect(dbRes.rows[0].status).toBe('CANCELLED');
      expect(dbRes.rows[0].cancelled_by.toLowerCase()).toBe(ADMIN_ID.toLowerCase());
      expect(dbRes.rows[0].cancellation_reason).toBe('Admin emergency facility maintenance');
    });
  });

  describe('4. Idempotency Request Fingerprint Enforcement (F-03)', () => {
    it('cancellation idempotency: identical retry succeeds, altered bookingId rejected with 409 Conflict', async () => {
      // 1. Create booking A
      const createA = await request(app)
        .post('/api/booking')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          clientOperationId: 'test-f03-cancel-prep-a',
          tableId: SEED_TABLE_ID,
          locationId: SEED_LOCATION_ID,
          localDate: TEST_DATE,
          slotId: SLOT_2,
          companionStudentId: SAM_ID
        });
      expect(createA.status).toBe(201);
      const bookingIdA = createA.body.data.bookingId;

      // 2. Create booking B
      const createB = await request(app)
        .post('/api/booking')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          clientOperationId: 'test-f03-cancel-prep-b',
          tableId: SEED_TABLE_ID,
          locationId: SEED_LOCATION_ID,
          localDate: TEST_DATE,
          slotId: SLOT_4,
          companionStudentId: SAM_ID
        });
      expect(createB.status).toBe(201);
      const bookingIdB = createB.body.data.bookingId;

      const opId = 'op-cancel-fingerprint-test';

      // 3. First cancel on booking A succeeds
      const c1 = await request(app)
        .post(`/api/booking/${bookingIdA}/cancel`)
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({ clientOperationId: opId, reason: 'Cancelling booking A' });
      expect(c1.status).toBe(200);
      expect(c1.body.data.status).toBe('CANCELLED');

      // 4. Repeating same operation ID with identical booking ID returns idempotent 200 replay
      const c1Retry = await request(app)
        .post(`/api/booking/${bookingIdA}/cancel`)
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({ clientOperationId: opId, reason: 'Cancelling booking A retry' });
      expect(c1Retry.status).toBe(200);
      expect(c1Retry.body.data.status).toBe('CANCELLED');

      // 5. Reusing operation ID with a different booking ID is rejected with HTTP 409 Conflict
      const c2 = await request(app)
        .post(`/api/booking/${bookingIdB}/cancel`)
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({ clientOperationId: opId, reason: 'Cancelling booking B with reused opId' });
      expect(c2.status).toBe(409);
      expect(c2.body.error.code).toBe('CONFLICT');
      expect(c2.body.error.message).toContain('different request payload');

      // 6. A new operation ID on booking B succeeds normally
      const c3 = await request(app)
        .post(`/api/booking/${bookingIdB}/cancel`)
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({ clientOperationId: 'op-cancel-b-fresh', reason: 'Fresh cancel booking B' });
      expect(c3.status).toBe(200);
      expect(c3.body.data.status).toBe('CANCELLED');
    });

    it('rescheduling idempotency: identical retry succeeds, altered target rejected with 409 Conflict', async () => {
      // 1. Create source booking on SLOT_2 (which was just freed by booking A cancellation above)
      const createRes = await request(app)
        .post('/api/booking')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          clientOperationId: 'test-f03-resched-idem-prep',
          tableId: SEED_TABLE_ID,
          locationId: SEED_LOCATION_ID,
          localDate: TEST_DATE,
          slotId: SLOT_2,
          companionStudentId: SAM_ID
        });
      expect(createRes.status).toBe(201);
      const bookingId = createRes.body.data.bookingId;

      const opId = 'op-resched-fingerprint-test';

      // 2. First reschedule targeting SLOT_4 (freed by booking B cancellation above) succeeds
      const r1 = await request(app)
        .post(`/api/booking/${bookingId}/reschedule`)
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          clientOperationId: opId,
          newLocalDate: TEST_DATE,
          newSlotId: SLOT_4
        });
      expect(r1.status).toBe(200);
      expect(r1.body.data.status).toBe('CONFIRMED');
      expect(r1.body.data.slotId.toLowerCase()).toBe(SLOT_4.toLowerCase());

      // 3. Repeating same operation ID with identical payload returns idempotent 200 replay
      const r1Retry = await request(app)
        .post(`/api/booking/${bookingId}/reschedule`)
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          clientOperationId: opId,
          newLocalDate: TEST_DATE,
          newSlotId: SLOT_4
        });
      expect(r1Retry.status).toBe(200);
      expect(r1Retry.body.data.status).toBe('CONFIRMED');

      // 4. Reusing operation ID with altered target slot/date is rejected with 409 Conflict
      const r2 = await request(app)
        .post(`/api/booking/${bookingId}/reschedule`)
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          clientOperationId: opId,
          newLocalDate: '2026-11-20',
          newSlotId: SLOT_2
        });
      expect(r2.status).toBe(409);
      expect(r2.body.error.code).toBe('CONFLICT');
      expect(r2.body.error.message).toContain('different request payload');
    });
  });
});
