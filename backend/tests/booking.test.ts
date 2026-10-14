import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { closeDbPool, getDbPool } from '../src/config/db';
import { setupTestSlot, cleanupTestData, closeMigratorPool, getMigratorPool } from './testDbHelper';
import { BookingService } from '../src/services/bookingService';
import { BookingRepository } from '../src/repository/bookingRepo';
import { DomainError } from '../src/types';

const ALEX_ID = '00000000-0000-0000-0000-00000000D501';   // Creator
const SAM_ID = '00000000-0000-0000-0000-00000000D502';    // Companion (Mutual STUDY connected with Alex)
const JORDAN_ID = '00000000-0000-0000-0000-00000000D503'; // Student with NO connection to Alex

const SEED_LOCATION_ID = '00000000-0000-0000-0000-00000000D571';
const SEED_TABLE_ID = '00000000-0000-0000-0000-00000000D572';

const TEST_DATE_1 = '2026-12-01';
const TEST_SLOT_1 = '00000000-0000-0000-0000-00000000E001';

const TEST_DATE_2 = '2026-12-02';
const TEST_SLOT_2 = '00000000-0000-0000-0000-00000000E002';

const TEST_DATE_3 = '2026-12-03';
const TEST_SLOT_3 = '00000000-0000-0000-0000-00000000E003';

describe('POST /api/booking — Vertical Slice Integration Suite', () => {
  beforeAll(async () => {
    // Clean up any stale test records from previous runs
    await cleanupTestData(['test-booking-%', 'test-rollback-%']);

    // Set up test slots using migrator role
    await setupTestSlot({
      slotId: TEST_SLOT_1,
      tableId: SEED_TABLE_ID,
      locationId: SEED_LOCATION_ID,
      localDate: TEST_DATE_1,
      startTime: '09:00:00',
      endTime: '11:00:00',
      zone: 'COLLABORATIVE_STUDY'
    });

    await setupTestSlot({
      slotId: TEST_SLOT_2,
      tableId: SEED_TABLE_ID,
      locationId: SEED_LOCATION_ID,
      localDate: TEST_DATE_2,
      startTime: '11:00:00',
      endTime: '13:00:00',
      zone: 'COLLABORATIVE_STUDY'
    });

    await setupTestSlot({
      slotId: TEST_SLOT_3,
      tableId: SEED_TABLE_ID,
      locationId: SEED_LOCATION_ID,
      localDate: TEST_DATE_3,
      startTime: '13:00:00',
      endTime: '15:00:00',
      zone: 'COLLABORATIVE_STUDY'
    });
  });

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_TEST_HARNESS_AUTH = 'true';
  });

  afterAll(async () => {
    await cleanupTestData(['test-booking-%', 'test-rollback-%']);
    await closeDbPool();
    await closeMigratorPool();
  });

  describe('1. Valid Booking Success and Persisted Rows Verification', () => {
    let createdBookingId: string;
    const opId = 'test-booking-op-success-1';

    it('successfully books a table and commits all required records within one transaction', async () => {
      const payload = {
        clientOperationId: opId,
        tableId: SEED_TABLE_ID,
        locationId: SEED_LOCATION_ID,
        localDate: TEST_DATE_1,
        slotId: TEST_SLOT_1,
        companionStudentId: SAM_ID
      };

      const res = await request(app)
        .post('/api/booking')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('data');
      expect(res.body.operationId).toBe(opId);

      const booking = res.body.data;
      createdBookingId = booking.bookingId;
      expect(booking.bookingId).toBeDefined();
      expect(booking.bookerId).toBe(ALEX_ID.toLowerCase());
      expect(booking.status).toBe('CONFIRMED');
      expect(booking.partnerApprovalStatus).toBe('NOT_REQUIRED');
      expect(booking.bookingVersion).toBe(1);
      expect(booking.tableId).toBe(SEED_TABLE_ID.toLowerCase());
      expect(booking.locationId).toBe(SEED_LOCATION_ID.toLowerCase());
      expect(booking.slotId).toBe(TEST_SLOT_1.toLowerCase());
      expect(booking.localDate).toBe(TEST_DATE_1);
      expect(booking.participants).toHaveLength(2);

      const creator = booking.participants.find((p: any) => p.userId === ALEX_ID.toLowerCase());
      expect(creator).toBeDefined();
      expect(creator.role).toBe('CREATOR');

      const companion = booking.participants.find((p: any) => p.userId === SAM_ID.toLowerCase());
      expect(companion).toBeDefined();
      expect(companion.role).toBe('COMPANION');

      // Database verification: Assert all 5 tables persisted the expected rows
      const pool = getDbPool();

      // 1. Booking row
      const bRes = await pool.query(
        `SELECT booking_id, booker_id, table_id, location_id, slot_id, local_date, status, partner_approval_status, booking_version
         FROM campus_duo.booking WHERE booking_id = $1`,
        [createdBookingId]
      );
      expect(bRes.rows).toHaveLength(1);
      expect(bRes.rows[0].status).toBe('CONFIRMED');
      expect(bRes.rows[0].partner_approval_status).toBe('NOT_REQUIRED');
      expect(bRes.rows[0].booking_version).toBe(1);

      // 2. Booking participant rows (exactly 2)
      const pRes = await pool.query(
        `SELECT user_id, participant_role FROM campus_duo.booking_participant WHERE booking_id = $1 ORDER BY participant_role`,
        [createdBookingId]
      );
      expect(pRes.rows).toHaveLength(2);
      expect(pRes.rows[0]).toEqual({ user_id: SAM_ID.toLowerCase(), participant_role: 'COMPANION' });
      expect(pRes.rows[1]).toEqual({ user_id: ALEX_ID.toLowerCase(), participant_role: 'CREATOR' });

      // 3. Idempotency record row
      const iRes = await pool.query(
        `SELECT actor_user_id, operation_type, client_operation_id, outcome_status, booking_id
         FROM campus_duo.idempotency_record WHERE actor_user_id = $1 AND client_operation_id = $2`,
        [ALEX_ID, opId]
      );
      expect(iRes.rows).toHaveLength(1);
      expect(iRes.rows[0].outcome_status).toBe('SUCCEEDED');
      expect(iRes.rows[0].booking_id).toBe(createdBookingId);

      // 4. Audit event row (verified via migrator pool since campus_duo_app has no SELECT grant on audit_event)
      const aRes = await getMigratorPool().query(
        `SELECT actor_user_id, action, target_type, target_id, outcome, operation_id
         FROM campus_duo.audit_event WHERE target_id = $1`,
        [createdBookingId]
      );
      expect(aRes.rows).toHaveLength(1);
      expect(aRes.rows[0].action).toBe('BOOKING_CREATED');
      expect(aRes.rows[0].outcome).toBe('SUCCESS');
      expect(aRes.rows[0].operation_id).toBe(opId);

      // 5. Outbox event row (verified via migrator pool since campus_duo_app has INSERT-only on outbox_event)
      const oRes = await getMigratorPool().query(
        `SELECT event_type, aggregate_type, aggregate_id, dedupe_key, payload
         FROM campus_duo.outbox_event WHERE aggregate_id = $1`,
        [createdBookingId]
      );
      expect(oRes.rows).toHaveLength(1);
      expect(oRes.rows[0].event_type).toBe('BOOKING_CREATED');
      expect(oRes.rows[0].aggregate_type).toBe('BOOKING');
      expect(oRes.rows[0].dedupe_key).toBe(`booking-created:${createdBookingId}`);
    });

    it('translates confirmed-slot collision to 409 CONFLICT on duplicate claim', async () => {
      // Attempt to book the exact same slot with a NEW clientOperationId
      const res = await request(app)
        .post('/api/booking')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          clientOperationId: 'test-booking-op-duplicate-conflict',
          tableId: SEED_TABLE_ID,
          locationId: SEED_LOCATION_ID,
          localDate: TEST_DATE_1,
          slotId: TEST_SLOT_1,
          companionStudentId: SAM_ID
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toHaveProperty('code', 'CONFLICT');
      expect(res.body.error.message).toContain('already booked');

      // Verify database still has exactly 1 confirmed booking for this slot
      const pool = getDbPool();
      const countRes = await pool.query(
        `SELECT count(*) FROM campus_duo.booking
         WHERE table_id = $1 AND local_date = $2 AND slot_id = $3 AND status = 'CONFIRMED'`,
        [SEED_TABLE_ID, TEST_DATE_1, TEST_SLOT_1]
      );
      expect(Number(countRes.rows[0].count)).toBe(1);
    });

    it('returns stored outcome on identical idempotency replay without duplicate writes', async () => {
      // Re-send with same opId and identical payload
      const res = await request(app)
        .post('/api/booking')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          clientOperationId: opId,
          tableId: SEED_TABLE_ID,
          locationId: SEED_LOCATION_ID,
          localDate: TEST_DATE_1,
          slotId: TEST_SLOT_1,
          companionStudentId: SAM_ID
        });

      expect(res.status).toBe(200);
      expect(res.body.data.bookingId).toBe(createdBookingId);
      expect(res.body.data.status).toBe('CONFIRMED');

      // Database verification: total bookings and participants remained unchanged
      const pool = getDbPool();
      const countRes = await pool.query(
        `SELECT count(*) FROM campus_duo.booking WHERE booking_id = $1`,
        [createdBookingId]
      );
      expect(Number(countRes.rows[0].count)).toBe(1);
    });

    it('returns 409 CONFLICT when clientOperationId is reused with an altered payload', async () => {
      // Re-send with same opId but different date/slot
      const res = await request(app)
        .post('/api/booking')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          clientOperationId: opId,
          tableId: SEED_TABLE_ID,
          locationId: SEED_LOCATION_ID,
          localDate: TEST_DATE_2, // Altered date!
          slotId: TEST_SLOT_2,
          companionStudentId: SAM_ID
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toHaveProperty('code', 'CONFLICT');
      expect(res.body.error.message).toContain('different request payload');
    });
  });

  describe('2. Validation & Authorization Failures', () => {
    it('rejects booking when clientOperationId is missing or empty with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/booking')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          clientOperationId: '   ',
          tableId: SEED_TABLE_ID,
          locationId: SEED_LOCATION_ID,
          localDate: TEST_DATE_2,
          slotId: TEST_SLOT_2,
          companionStudentId: SAM_ID
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(res.body.error.message).toContain('clientOperationId');
    });

    it('rejects booking when companion has no mutual STUDY connection with 403 FORBIDDEN', async () => {
      // Jordan has no mutual study connection with Alex
      const res = await request(app)
        .post('/api/booking')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          clientOperationId: 'test-booking-op-no-connection',
          tableId: SEED_TABLE_ID,
          locationId: SEED_LOCATION_ID,
          localDate: TEST_DATE_2,
          slotId: TEST_SLOT_2,
          companionStudentId: JORDAN_ID
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toHaveProperty('code', 'FORBIDDEN');
      expect(res.body.error.message).toContain('No active mutual STUDY connection');
    });

    it('rejects booking when actor sets themselves as companion with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/booking')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          clientOperationId: 'test-booking-op-self-companion',
          tableId: SEED_TABLE_ID,
          locationId: SEED_LOCATION_ID,
          localDate: TEST_DATE_2,
          slotId: TEST_SLOT_2,
          companionStudentId: ALEX_ID // Self
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(res.body.error.message).toContain('themselves as companion');
    });

    it('rejects booking when slot resource does not exist with 404 NOT_FOUND', async () => {
      const nonExistentSlot = '00000000-0000-0000-0000-00000000FFFF';

      const res = await request(app)
        .post('/api/booking')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          clientOperationId: 'test-booking-op-slot-not-found',
          tableId: SEED_TABLE_ID,
          locationId: SEED_LOCATION_ID,
          localDate: TEST_DATE_2,
          slotId: nonExistentSlot,
          companionStudentId: SAM_ID
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toHaveProperty('code', 'NOT_FOUND');
    });

    it('rejects caller identity passed in request body and resolves strictly from header', async () => {
      // Pass a spoofed requesterId in body for another user; the backend must ignore it
      const res = await request(app)
        .post('/api/booking')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          clientOperationId: 'test-booking-op-spoof-attempt',
          requesterId: JORDAN_ID, // Maliciously spoofed body parameter
          bookerId: JORDAN_ID,
          tableId: SEED_TABLE_ID,
          locationId: SEED_LOCATION_ID,
          localDate: TEST_DATE_2,
          slotId: TEST_SLOT_2,
          companionStudentId: SAM_ID
        });

      expect(res.status).toBe(201);
      // Confirmed booker must be Alex (from header), NEVER Jordan
      expect(res.body.data.bookerId).toBe(ALEX_ID.toLowerCase());
      const creator = res.body.data.participants.find((p: any) => p.role === 'CREATOR');
      expect(creator.userId).toBe(ALEX_ID.toLowerCase());
    });
  });

  describe('3. Transaction Rollback on Failure', () => {
    it('rolls back all writes completely if a failure occurs during transaction execution', async () => {
      const opId = 'test-rollback-failure-op';

      // Create a mock repository subclass that fails on outbox insertion (step 7)
      class FailingBookingRepo extends BookingRepository {
        async insertOutboxEvent(): Promise<void> {
          throw new Error('Simulated outbox write failure for rollback proof');
        }
      }

      const failingService = new BookingService(new FailingBookingRepo());

      // Attempt to book slot 3 using failingService
      await expect(
        failingService.createBooking(
          { userId: ALEX_ID, role: 'ROLE_STUDENT', displayName: 'Dev Student Alex' },
          {
            clientOperationId: opId,
            tableId: SEED_TABLE_ID,
            locationId: SEED_LOCATION_ID,
            localDate: TEST_DATE_3,
            slotId: TEST_SLOT_3,
            companionStudentId: SAM_ID
          },
          'req-rollback-test'
        )
      ).rejects.toThrow('Simulated outbox write failure for rollback proof');

      // Verify that ZERO rows were committed in any table
      const pool = getDbPool();

      // Zero idempotency record
      const idempRes = await pool.query(
        `SELECT 1 FROM campus_duo.idempotency_record WHERE client_operation_id = $1`,
        [opId]
      );
      expect(idempRes.rows).toHaveLength(0);

      // Zero audit event (queried via migrator pool)
      const auditRes = await getMigratorPool().query(
        `SELECT 1 FROM campus_duo.audit_event WHERE operation_id = $1`,
        [opId]
      );
      expect(auditRes.rows).toHaveLength(0);

      // Slot 3 must still have ZERO confirmed bookings (it was rolled back)
      const bookingRes = await pool.query(
        `SELECT 1 FROM campus_duo.booking
         WHERE table_id = $1 AND local_date = $2 AND slot_id = $3`,
        [SEED_TABLE_ID, TEST_DATE_3, TEST_SLOT_3]
      );
      expect(bookingRes.rows).toHaveLength(0);
    });
  });
});
