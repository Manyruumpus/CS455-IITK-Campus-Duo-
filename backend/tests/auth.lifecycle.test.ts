import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { closeDbPool } from '../src/config/db';
import { deleteTestUser, cleanupTestData, closeMigratorPool, setupTestSlot } from './testDbHelper';

describe('Auth Lifecycle & Authoritative RBAC Suite', () => {
  const TEST_STUDENT_EMAIL = 'lifecycle.student@iitk.ac.in';
  const TEST_STUDENT_NAME = 'Lifecycle Test Student';
  const TEST_STUDENT_PASS = 'StudentSecret123!';
  const AUTH_TEST_SLOT_ID = '00000000-0000-0000-0000-00000000e060';
  const AUTH_TEST_DATE = '2026-11-27';

  beforeEach(async () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_TEST_HARNESS_AUTH = 'true';
    await deleteTestUser(TEST_STUDENT_EMAIL);
    await deleteTestUser('attacker%');
    await deleteTestUser('dup%');
    await cleanupTestData(['test-auth-%', 'op-auth-%'], [AUTH_TEST_SLOT_ID]);

    await setupTestSlot({
      slotId: AUTH_TEST_SLOT_ID,
      tableId: '00000000-0000-0000-0000-00000000d572',
      locationId: '00000000-0000-0000-0000-00000000d571',
      localDate: AUTH_TEST_DATE,
      startTime: '14:00:00',
      endTime: '16:00:00',
      zone: 'COLLABORATIVE_STUDY',
    });
  });

  afterEach(async () => {
    await deleteTestUser(TEST_STUDENT_EMAIL);
    await deleteTestUser('attacker%');
    await deleteTestUser('dup%');
    await cleanupTestData(['test-auth-%', 'op-auth-%'], [AUTH_TEST_SLOT_ID]);
  });

  afterAll(async () => {
    await closeDbPool();
    await closeMigratorPool();
  });

  describe('1. Student Registration & Validation Guardrails', () => {
    it('successfully registers student with valid @iitk.ac.in email and returns session', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: TEST_STUDENT_EMAIL,
          displayName: TEST_STUDENT_NAME,
          password: TEST_STUDENT_PASS,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(TEST_STUDENT_EMAIL);
      expect(res.body.data.user.displayName).toBe(TEST_STUDENT_NAME);
      expect(res.body.data.user.role).toBe('ROLE_STUDENT');
      expect(res.body.data.user.accountStatus).toBe('ACTIVE');
      expect(res.body.data.user.verificationStatus).toBe('VERIFIED');
      expect(res.body.data.token).toBeDefined();
      expect(typeof res.body.data.token).toBe('string');
      // Password hash must never leak in response payload
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
      expect(res.body.data.user).not.toHaveProperty('password_hash');
    });

    it('rejects registration with non-iitk domains', async () => {
      const invalidEmails = [
        'student@gmail.com',
        'student@outlook.com',
        'student@yahoo.in',
      ];

      for (const email of invalidEmails) {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            email,
            displayName: 'Invalid Domain Student',
            password: 'ValidPassword123!',
          });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
        expect(res.body.error.message).toContain('@iitk.ac.in');
      }
    });

    it('rejects registration with lookalike and subdomain attack patterns', async () => {
      const attackEmails = [
        'student@iitk.ac.in.attacker.com',
        'student@fake-iitk.ac.in',
        'student@iitk.ac.in.malicious.net',
        'student@sub.iitk.ac.in',
        '@iitk.ac.in',
      ];

      for (const email of attackEmails) {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            email,
            displayName: 'Lookalike Attacker',
            password: 'ValidPassword123!',
          });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('rejects passwords shorter than 8 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'shortpass@iitk.ac.in',
          displayName: 'Short Password Student',
          password: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('8 characters');
    });

    it('prevents privilege escalation when registering (role param ignored/enforced to ROLE_STUDENT)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'attacker.admin@iitk.ac.in',
          displayName: 'Privilege Escalation Attacker',
          password: 'AttackerPassword123!',
          role: 'ROLE_ADMIN', // Attempted privilege escalation
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('ROLE_STUDENT');
      await deleteTestUser('attacker.admin@iitk.ac.in');
    });

    it('rejects duplicate registration with HTTP 409 Conflict', async () => {
      const dupEmail = 'dup.student@iitk.ac.in';
      const firstRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: dupEmail,
          displayName: 'First Registration',
          password: 'Password123!',
        });
      expect(firstRes.status).toBe(201);

      const secondRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: dupEmail,
          displayName: 'Second Registration Attempt',
          password: 'Password123!',
        });
      expect(secondRes.status).toBe(409);
      expect(secondRes.body.error.code).toBe('CONFLICT');
      expect(secondRes.body.error.message).toContain('already exists');
    });
  });

  describe('2. Login & Credential Verification', () => {
    it('authenticates admin account and issues session token with ROLE_ADMIN', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@iitk.ac.in',
          password: 'AdminPass123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('admin@iitk.ac.in');
      expect(res.body.data.user.role).toBe('ROLE_ADMIN');
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('authenticates student account and issues session token with ROLE_STUDENT', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alex.rivera@iitk.ac.in',
          password: 'StudentPass123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('alex.rivera@iitk.ac.in');
      expect(res.body.data.user.role).toBe('ROLE_STUDENT');
      expect(res.body.data.token).toBeDefined();
    });

    it('rejects incorrect password with HTTP 401 UNAUTHENTICATED', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@iitk.ac.in',
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rejects non-existent account with HTTP 401 UNAUTHENTICATED', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'ghost.user@iitk.ac.in',
          password: 'SomePassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('3. Session Identity (/api/auth/me) and Invalidation (/api/auth/logout)', () => {
    it('returns current identity via Authorization Bearer token', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alex.rivera@iitk.ac.in',
          password: 'StudentPass123!',
        });
      const token = loginRes.body.data.token;

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.user.email).toBe('alex.rivera@iitk.ac.in');
      expect(meRes.body.data.user.role).toBe('ROLE_STUDENT');
    });

    it('invalidates session token on logout and rejects subsequent access', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alex.rivera@iitk.ac.in',
          password: 'StudentPass123!',
        });
      const token = loginRes.body.data.token;

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);
      expect(logoutRes.status).toBe(200);

      // Subsequent access with invalidated token must be rejected
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(meRes.status).toBe(401);
      expect(meRes.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rejects forged / invalid session tokens', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer forged-token-0000000000000000000000');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('4. Authoritative Role-Based Access Control (RBAC)', () => {
    it('permits ROLE_ADMIN to access /api/admin/summary', async () => {
      const adminLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@iitk.ac.in',
          password: 'AdminPass123!',
        });
      const adminToken = adminLogin.body.data.token;

      const res = await request(app)
        .get('/api/admin/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.systemStatus).toBe('OPERATIONAL');
      expect(res.body.data.requester.role).toBe('ROLE_ADMIN');
      expect(typeof res.body.data.activeLocationsCount).toBe('number');
      expect(typeof res.body.data.totalBookingsCount).toBe('number');
      expect(typeof res.body.data.totalUsersCount).toBe('number');
    });

    it('strictly forbids (HTTP 403) ROLE_STUDENT from accessing /api/admin/summary', async () => {
      const studentLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alex.rivera@iitk.ac.in',
          password: 'StudentPass123!',
        });
      const studentToken = studentLogin.body.data.token;

      const res = await request(app)
        .get('/api/admin/summary')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('Access denied');
    });

    it('rejects unauthenticated access to /api/admin/summary with HTTP 401', async () => {
      const res = await request(app).get('/api/admin/summary');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('5. End-to-End Fresh Registered Student Booking Integration', () => {
    it('allows a newly registered student to authenticate via Bearer token, query slots, and reserve a study table', async () => {
      // 1. Register fresh student
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: TEST_STUDENT_EMAIL,
          displayName: TEST_STUDENT_NAME,
          password: TEST_STUDENT_PASS,
        });
      expect(regRes.status).toBe(201);
      const studentToken = regRes.body.data.token;
      const studentId = regRes.body.data.user.userId;

      // 2. Query locations with Bearer token
      const locRes = await request(app)
        .get('/api/booking/locations')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(locRes.status).toBe(200);
      expect(locRes.body.data.length).toBeGreaterThan(0);

      // 3. Query availability with Bearer token
      const availRes = await request(app)
        .get('/api/booking/availability?date=2026-11-14')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(availRes.status).toBe(200);

      // 4. Form mutual STUDY connection between fresh student and companion Sam via discovery API
      const SAM_ID = '00000000-0000-0000-0000-00000000d502';

      const likeRes1 = await request(app)
        .post('/api/discovery/actions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ targetStudentId: SAM_ID, mode: 'STUDY', action: 'LIKE' });
      expect(likeRes1.status).toBe(200);

      const likeRes2 = await request(app)
        .post('/api/discovery/actions')
        .set('X-Campus-Duo-Test-Actor', SAM_ID)
        .send({ targetStudentId: studentId, mode: 'STUDY', action: 'LIKE' });
      expect(likeRes2.status).toBe(200);
      expect(likeRes2.body.data.relationshipStatus).toBe('MUTUAL_CONNECTED');

      // 5. Create booking with companion Sam
      const LOCATION_ID = '00000000-0000-0000-0000-00000000d571';
      const TABLE_ID = '00000000-0000-0000-0000-00000000d572';
      const CLIENT_OP_ID = 'op-auth-lifecycle-book-01';

      const bookRes = await request(app)
        .post('/api/booking')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          clientOperationId: CLIENT_OP_ID,
          tableId: TABLE_ID,
          locationId: LOCATION_ID,
          localDate: AUTH_TEST_DATE,
          slotId: AUTH_TEST_SLOT_ID,
          companionStudentId: SAM_ID,
        });

      expect(bookRes.status).toBe(201);
      expect(bookRes.body.data.status).toBe('CONFIRMED');
      expect(bookRes.body.data.bookerId).toBe(studentId);
      const createdBookingId = bookRes.body.data.bookingId;

      // 5. Retrieve booking details using Bearer token
      const getRes = await request(app)
        .get(`/api/booking/${createdBookingId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.bookingId).toBe(createdBookingId);
      expect(getRes.body.data.bookerId).toBe(studentId);
      expect(getRes.body.data.participants).toHaveLength(2);

      // 6. Assert student is blocked from administrative API
      const adminRes = await request(app)
        .get('/api/admin/summary')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(adminRes.status).toBe(403);
    });

    it('denies direct password registration and login when test harness auth is disabled', async () => {
      delete process.env.ALLOW_TEST_HARNESS_AUTH;

      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'blocked.direct@iitk.ac.in',
          displayName: 'Blocked Direct',
          password: 'Password123!',
        });
      expect(regRes.status).toBe(403);
      expect(regRes.body.error.code).toBe('FORBIDDEN');
      expect(regRes.body.error.message).toContain('Direct credential registration is disabled');

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'blocked.direct@iitk.ac.in',
          password: 'Password123!',
        });
      expect(loginRes.status).toBe(403);
      expect(loginRes.body.error.code).toBe('FORBIDDEN');
      expect(loginRes.body.error.message).toContain('Direct password login is disabled');

      // Restore flag for subsequent tests
      process.env.ALLOW_TEST_HARNESS_AUTH = 'true';
    });
  });
});
