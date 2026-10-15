import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { closeDbPool, query } from '../src/config/db';
import { defaultEmailService, DevelopmentEmailTransport } from '../src/services/emailService';
import {
  setupTestSlot,
  cleanupTestData,
  closeMigratorPool,
  getMigratorPool,
  deleteTestUser
} from './testDbHelper';

const transport = new DevelopmentEmailTransport();
const originalTransport = defaultEmailService.getTransport();

const ADMIN_ID = '00000000-0000-0000-0000-00000000d599';
const SEED_LOCATION_ID = '00000000-0000-0000-0000-00000000D571';
const SEED_TABLE_ID = '00000000-0000-0000-0000-00000000D572';

const E2E_DATE = '2026-12-20';
const E2E_SLOT_1 = '00000000-0000-0000-0000-00000000E101';
const E2E_SLOT_2 = '00000000-0000-0000-0000-00000000E102';
const E2E_SLOT_3 = '00000000-0000-0000-0000-00000000E103';

const STUDENT_A_EMAIL = 'e2e.alex@iitk.ac.in';
const STUDENT_B_EMAIL = 'e2e.sam@iitk.ac.in';
const STUDENT_C_EMAIL = 'e2e.jordan@iitk.ac.in';

describe('Campus Duo D2 — Critical End-to-End Acceptance Verification Suite', () => {
  let studentAId: string;
  let studentAToken: string;
  let studentBId: string;
  let studentBToken: string;
  let studentCId: string;
  let studentCToken: string;

  beforeAll(async () => {
    defaultEmailService.setTransport(transport);
    transport.clear();

    // Clean up any lingering data
    await cleanupTestData(['e2e-%'], [E2E_SLOT_1, E2E_SLOT_2, E2E_SLOT_3]);
    await deleteTestUser(STUDENT_A_EMAIL);
    await deleteTestUser(STUDENT_B_EMAIL);
    await deleteTestUser(STUDENT_C_EMAIL);

    // Setup isolated slots for E2E testing
    await setupTestSlot({
      slotId: E2E_SLOT_1,
      tableId: SEED_TABLE_ID,
      locationId: SEED_LOCATION_ID,
      localDate: E2E_DATE,
      startTime: '09:00:00',
      endTime: '11:00:00',
      zone: 'COLLABORATIVE_STUDY'
    });

    await setupTestSlot({
      slotId: E2E_SLOT_2,
      tableId: SEED_TABLE_ID,
      locationId: SEED_LOCATION_ID,
      localDate: E2E_DATE,
      startTime: '11:00:00',
      endTime: '13:00:00',
      zone: 'COLLABORATIVE_STUDY'
    });

    await setupTestSlot({
      slotId: E2E_SLOT_3,
      tableId: SEED_TABLE_ID,
      locationId: SEED_LOCATION_ID,
      localDate: E2E_DATE,
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
    await cleanupTestData(['e2e-%'], [E2E_SLOT_1, E2E_SLOT_2, E2E_SLOT_3]);
    await deleteTestUser(STUDENT_A_EMAIL);
    await deleteTestUser(STUDENT_B_EMAIL);
    await deleteTestUser(STUDENT_C_EMAIL);
    defaultEmailService.setTransport(originalTransport);
    await closeDbPool();
    await closeMigratorPool();
  });

  describe('Flow 1: Real-Time OTP Registration, Verification & Returning User Login (FR-01, FR-02)', () => {
    it('registers Student A via OTP and issues authenticated session with isFirstLogin: true', async () => {
      // 1. Request registration OTP
      const reqRes = await request(app)
        .post('/api/auth/otp/request-registration')
        .send({ email: STUDENT_A_EMAIL, displayName: 'Alex Rivera' });

      expect(reqRes.status).toBe(200);
      expect(reqRes.body.data.challengeId).toBeDefined();
      const challengeId = reqRes.body.data.challengeId;

      const otp = transport.getLatestOtp(STUDENT_A_EMAIL);
      expect(otp).toBeDefined();
      expect(otp).toMatch(/^\d{6}$/);

      // 2. Verify registration OTP
      const verifyRes = await request(app)
        .post('/api/auth/otp/verify-registration')
        .send({ email: STUDENT_A_EMAIL, challengeId, otp });

      expect(verifyRes.status).toBe(201);
      expect(verifyRes.body.data.user.email).toBe(STUDENT_A_EMAIL);
      expect(verifyRes.body.data.user.displayName).toBe('Alex Rivera');
      expect(verifyRes.body.data.user.role).toBe('ROLE_STUDENT');
      expect(verifyRes.body.data.isFirstLogin).toBe(true);
      expect(verifyRes.body.data.token).toBeDefined();

      studentAId = verifyRes.body.data.user.userId;
      studentAToken = verifyRes.body.data.token;

      // 3. Authenticated session access via Bearer token
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${studentAToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.user.userId).toBe(studentAId);
    });

    it('registers Student B and Student C via OTP', async () => {
      // Student B
      await request(app)
        .post('/api/auth/otp/request-registration')
        .send({ email: STUDENT_B_EMAIL, displayName: 'Sam Chen' });
      const otpB = transport.getLatestOtp(STUDENT_B_EMAIL)!;
      const resB = await request(app)
        .post('/api/auth/otp/verify-registration')
        .send({ email: STUDENT_B_EMAIL, otp: otpB });
      expect(resB.status).toBe(201);
      studentBId = resB.body.data.user.userId;
      studentBToken = resB.body.data.token;

      // Student C
      await request(app)
        .post('/api/auth/otp/request-registration')
        .send({ email: STUDENT_C_EMAIL, displayName: 'Jordan Lee' });
      const otpC = transport.getLatestOtp(STUDENT_C_EMAIL)!;
      const resC = await request(app)
        .post('/api/auth/otp/verify-registration')
        .send({ email: STUDENT_C_EMAIL, otp: otpC });
      expect(resC.status).toBe(201);
      studentCId = resC.body.data.user.userId;
      studentCToken = resC.body.data.token;
    });

    it('authenticates returning Student A via Login OTP with isFirstLogin: false', async () => {
      transport.clear();
      const loginReq = await request(app)
        .post('/api/auth/otp/request-login')
        .send({ email: STUDENT_A_EMAIL });

      expect(loginReq.status).toBe(200);
      const loginOtp = transport.getLatestOtp(STUDENT_A_EMAIL)!;

      const loginVerify = await request(app)
        .post('/api/auth/otp/verify-login')
        .send({ email: STUDENT_A_EMAIL, otp: loginOtp });

      expect(loginVerify.status).toBe(200);
      expect(loginVerify.body.data.isFirstLogin).toBe(false);
      studentAToken = loginVerify.body.data.token;
    });
  });

  describe('Flow 2: Reciprocal Like Formation & Mutual STUDY Connection Display (FR-05, KAN-32)', () => {
    it('directional like records preference without creating mutual connection', async () => {
      const resA = await request(app)
        .post('/api/discovery/actions')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({ targetUserId: studentBId, mode: 'STUDY', actionType: 'LIKE' });

      expect(resA.status).toBe(200);
      expect(resA.body.data.relationshipStatus).toBe('LIKE_SENT');
      expect(resA.body.data.connectionId).toBeNull();

      // Verify DB: No mutual connection exists yet
      const conn = await query(
        `SELECT connection_id FROM campus_duo.connection
         WHERE (user_a_id = $1 AND user_b_id = $2) OR (user_a_id = $2 AND user_b_id = $1)`,
        [studentAId, studentBId]
      );
      expect(conn.rows.length).toBe(0);
    });

    it('reciprocal like detects mutual interest, forms connection, and displays to both students', async () => {
      const resB = await request(app)
        .post('/api/discovery/actions')
        .set('Authorization', `Bearer ${studentBToken}`)
        .send({ targetUserId: studentAId, mode: 'STUDY', actionType: 'LIKE' });

      expect(resB.status).toBe(200);
      expect(resB.body.data.relationshipStatus).toBe('MUTUAL_CONNECTED');
      expect(resB.body.data.connectionId).toBeDefined();

      // Both query GET /api/discovery/connections and observe each other
      const connA = await request(app)
        .get('/api/discovery/connections?mode=STUDY')
        .set('Authorization', `Bearer ${studentAToken}`);

      expect(connA.status).toBe(200);
      const partnerForA = connA.body.data.find((c: any) => c.peerId === studentBId);
      expect(partnerForA).toBeDefined();
      expect(partnerForA.status).toBe('MUTUAL_CONNECTED');

      const connB = await request(app)
        .get('/api/discovery/connections?mode=STUDY')
        .set('Authorization', `Bearer ${studentBToken}`);

      expect(connB.status).toBe(200);
      const partnerForB = connB.body.data.find((c: any) => c.peerId === studentAId);
      expect(partnerForB).toBeDefined();
      expect(partnerForB.status).toBe('MUTUAL_CONNECTED');
    });
  });

  describe('Flow 3: Create Booking & Retrieve Details and History (FR-03, FR-04, FR-06)', () => {
    let bookingId: string;

    it('creates a confirmed booking between mutual study partners', async () => {
      const res = await request(app)
        .post('/api/booking')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({
          clientOperationId: 'e2e-create-flow3-1',
          tableId: SEED_TABLE_ID,
          locationId: SEED_LOCATION_ID,
          localDate: E2E_DATE,
          slotId: E2E_SLOT_1,
          companionStudentId: studentBId
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('CONFIRMED');
      expect(res.body.data.allowedActions).toEqual(['CANCEL', 'RESCHEDULE']);
      bookingId = res.body.data.bookingId;
    });

    it('retrieves single booking pass with full participant metadata for creator', async () => {
      const res = await request(app)
        .get(`/api/booking/${bookingId}`)
        .set('Authorization', `Bearer ${studentAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.bookingId).toBe(bookingId);
      expect(res.body.data.status).toBe('CONFIRMED');
      expect(res.body.data.allowedActions).toEqual(['CANCEL', 'RESCHEDULE']);
      expect(res.body.data.participants.length).toBe(2);
    });

    it('retrieves booking list in history for creator and companion', async () => {
      const resA = await request(app)
        .get('/api/booking')
        .set('Authorization', `Bearer ${studentAToken}`);
      expect(resA.status).toBe(200);
      expect(resA.body.data.some((b: any) => b.bookingId === bookingId)).toBe(true);

      const resB = await request(app)
        .get('/api/booking')
        .set('Authorization', `Bearer ${studentBToken}`);
      expect(resB.status).toBe(200);
      expect(resB.body.data.some((b: any) => b.bookingId === bookingId)).toBe(true);
    });
  });

  describe('Flow 4: Administrator Cancellation & Inventory Restoral (FR-09)', () => {
    let adminBookingId: string;

    it('creates booking for admin cancellation test', async () => {
      const res = await request(app)
        .post('/api/booking')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({
          clientOperationId: 'e2e-create-admin-cancel',
          tableId: SEED_TABLE_ID,
          locationId: SEED_LOCATION_ID,
          localDate: E2E_DATE,
          slotId: E2E_SLOT_2,
          companionStudentId: studentBId
        });
      expect(res.status).toBe(201);
      adminBookingId = res.body.data.bookingId;
    });

    it('admin cancels booking and persisted status becomes CANCELLED', async () => {
      const res = await request(app)
        .post(`/api/booking/${adminBookingId}/cancel`)
        .set('X-Campus-Duo-Test-Actor', ADMIN_ID)
        .send({ reason: 'Emergency maintenance closure' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');
      expect(res.body.data.allowedActions).toEqual([]);

      // Verify row in PostgreSQL
      const dbRes = await query(
        `SELECT status, cancelled_by, cancellation_reason, cancelled_at
         FROM campus_duo.booking WHERE booking_id = $1`,
        [adminBookingId]
      );
      expect(dbRes.rows[0].status).toBe('CANCELLED');
      expect(dbRes.rows[0].cancelled_by.toLowerCase()).toBe(ADMIN_ID.toLowerCase());
      expect(dbRes.rows[0].cancellation_reason).toBe('Emergency maintenance closure');
      expect(dbRes.rows[0].cancelled_at).not.toBeNull();
    });
  });

  describe('Flow 5: Student Cancellation, Authorization & Idempotency (FR-09)', () => {
    let cancelBookingId: string;

    it('creates confirmed booking for student cancellation tests', async () => {
      const res = await request(app)
        .post('/api/booking')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({
          clientOperationId: 'e2e-create-student-cancel',
          tableId: SEED_TABLE_ID,
          locationId: SEED_LOCATION_ID,
          localDate: E2E_DATE,
          slotId: E2E_SLOT_3,
          companionStudentId: studentBId
        });
      expect(res.status).toBe(201);
      cancelBookingId = res.body.data.bookingId;
    });

    it('rejects companion cancellation with 403 Forbidden and demo policy notice', async () => {
      const res = await request(app)
        .post(`/api/booking/${cancelBookingId}/cancel`)
        .set('Authorization', `Bearer ${studentBToken}`)
        .send({ reason: 'Companion wants out' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('only the booking creator or administrator may cancel');
    });

    it('rejects unrelated student (Jordan) cancellation with 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/booking/${cancelBookingId}/cancel`)
        .set('Authorization', `Bearer ${studentCToken}`)
        .send({ reason: 'Intruder' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('creator successfully cancels booking; status is CANCELLED and allowedActions is empty', async () => {
      const res = await request(app)
        .post(`/api/booking/${cancelBookingId}/cancel`)
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({
          reason: 'Student change of plans',
          clientOperationId: 'e2e-cancel-student-1'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');
      expect(res.body.data.allowedActions).toEqual([]);

      const dbRes = await query(
        `SELECT status, cancelled_by, cancellation_reason
         FROM campus_duo.booking WHERE booking_id = $1`,
        [cancelBookingId]
      );
      expect(dbRes.rows[0].status).toBe('CANCELLED');
      expect(dbRes.rows[0].cancelled_by.toLowerCase()).toBe(studentAId.toLowerCase());
    });

    it('repeat cancellation is safe and returns CANCELLED with empty allowedActions', async () => {
      const res = await request(app)
        .post(`/api/booking/${cancelBookingId}/cancel`)
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({
          reason: 'Repeat click',
          clientOperationId: 'e2e-cancel-student-repeat'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');
      expect(res.body.data.allowedActions).toEqual([]);
    });
  });

  describe('Flow 6: Atomic Rescheduling, Lineage & Single Successor Invariant (FR-08)', () => {
    let sourceBookingId: string;
    let replacementBookingId: string;

    it('creates source confirmed booking on E2E_SLOT_2', async () => {
      const res = await request(app)
        .post('/api/booking')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({
          clientOperationId: 'e2e-create-resched-source',
          tableId: SEED_TABLE_ID,
          locationId: SEED_LOCATION_ID,
          localDate: E2E_DATE,
          slotId: E2E_SLOT_2,
          companionStudentId: studentBId
        });
      expect(res.status).toBe(201);
      sourceBookingId = res.body.data.bookingId;
    });

    it('rejects companion rescheduling with 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/booking/${sourceBookingId}/reschedule`)
        .set('Authorization', `Bearer ${studentBToken}`)
        .send({ newLocalDate: E2E_DATE, newSlotId: E2E_SLOT_3 });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects rescheduling to identical slot with 400 Bad Request', async () => {
      const res = await request(app)
        .post(`/api/booking/${sourceBookingId}/reschedule`)
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({ newLocalDate: E2E_DATE, newSlotId: E2E_SLOT_2 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('creator successfully reschedules source booking to available E2E_SLOT_3', async () => {
      const res = await request(app)
        .post(`/api/booking/${sourceBookingId}/reschedule`)
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({
          newLocalDate: E2E_DATE,
          newSlotId: E2E_SLOT_3,
          clientOperationId: 'e2e-resched-success'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CONFIRMED');
      expect(res.body.data.slotId.toLowerCase()).toBe(E2E_SLOT_3.toLowerCase());
      expect(res.body.data.rescheduledFromBookingId).toBe(sourceBookingId);
      expect(res.body.data.bookingVersion).toBe(2);

      replacementBookingId = res.body.data.bookingId;

      // Verify source booking was marked CANCELLED with RESCHEDULED reason
      const dbSource = await query(
        `SELECT status, cancellation_reason, cancelled_by, cancelled_at
         FROM campus_duo.booking WHERE booking_id = $1`,
        [sourceBookingId]
      );
      expect(dbSource.rows[0].status).toBe('CANCELLED');
      expect(dbSource.rows[0].cancellation_reason).toBe('RESCHEDULED');
      expect(dbSource.rows[0].cancelled_by.toLowerCase()).toBe(studentAId.toLowerCase());
    });

    it('rejects second reschedule of source booking enforcing single successor rule', async () => {
      const res = await request(app)
        .post(`/api/booking/${sourceBookingId}/reschedule`)
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({ newLocalDate: E2E_DATE, newSlotId: E2E_SLOT_1 });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('Flow 7: Admin Resource Inventory CRUD & Slot Overlap Rejection (FR-07)', () => {
    it('lists study locations via admin endpoint', async () => {
      const res = await request(app)
        .get('/api/admin/resources')
        .set('X-Campus-Duo-Test-Actor', ADMIN_ID);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((l: any) => l.locationId.toLowerCase() === SEED_LOCATION_ID.toLowerCase())).toBe(true);
    });

    it('rejects overlapping study slot creation with 409 Conflict', async () => {
      // E2E_SLOT_1 is from 09:00:00 to 11:00:00 on SEED_TABLE_ID and E2E_DATE
      // Attempting to add an overlapping slot (10:00 to 12:00) on same table must fail with 409
      const res = await request(app)
        .post('/api/admin/slots')
        .set('X-Campus-Duo-Test-Actor', ADMIN_ID)
        .send({
          tableId: SEED_TABLE_ID,
          locationId: SEED_LOCATION_ID,
          date: E2E_DATE,
          startTime: '10:00:00',
          endTime: '12:00:00',
          zone: 'COLLABORATIVE_STUDY'
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('overlaps an existing slot');
    });
  });
});
