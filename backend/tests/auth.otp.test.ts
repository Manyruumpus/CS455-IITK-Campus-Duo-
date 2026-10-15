import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import type { Transporter } from 'nodemailer';
import { app } from '../src/app';
import * as dbModule from '../src/config/db';
import { closeDbPool, query } from '../src/config/db';
import {
  defaultEmailService,
  DevelopmentEmailTransport,
  EmailService,
  SmtpEmailTransport
} from '../src/services/emailService';
import { AuthService } from '../src/services/authService';
import { closeMigratorPool, deleteTestUser } from './testDbHelper';

const TEST_EMAIL = 'otp.student@iitk.ac.in';
const originalTransport = defaultEmailService.getTransport();
const transport = new DevelopmentEmailTransport();

describe('OTP-Based Email Ownership & Authentication Lifecycle Suite (FR-01 & FR-02)', () => {
  beforeEach(async () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_TEST_HARNESS_AUTH = 'true';
    defaultEmailService.setTransport(transport);
    transport.clear();

    // Clean up test user
    await deleteTestUser(TEST_EMAIL);
    await query(`DELETE FROM campus_duo.otp_challenge WHERE lower(email) = $1`, [TEST_EMAIL]);
  });

  afterEach(async () => {
    await deleteTestUser(TEST_EMAIL);
    await query(`DELETE FROM campus_duo.otp_challenge WHERE lower(email) = $1`, [TEST_EMAIL]);
    transport.clear();
  });

  afterAll(async () => {
    defaultEmailService.setTransport(originalTransport);
    await closeDbPool();
    await closeMigratorPool();
  });

  describe('1. Registration Email Domain Guardrails & OTP Dispatch', () => {
    it('rejects registration OTP request for non-IITK or lookalike domains', async () => {
      const invalidEmails = [
        'attacker@gmail.com',
        'student@iitk.ac.in.attacker.com',
        'student@sub.iitk.ac.in',
        '@iitk.ac.in',
        'invalid-email',
      ];

      for (const email of invalidEmails) {
        const res = await request(app)
          .post('/api/auth/otp/request-registration')
          .send({ email, displayName: 'Test Student' });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('successfully dispatches a 6-digit OTP challenge to a valid @iitk.ac.in email', async () => {
      const res = await request(app)
        .post('/api/auth/otp/request-registration')
        .send({ email: TEST_EMAIL, displayName: 'Newton Issac' });

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(TEST_EMAIL);
      expect(res.body.data.message).toContain('Verification code sent');

      // The raw OTP must NEVER be exposed in the HTTP response
      expect(res.body.data).not.toHaveProperty('otp');

      // Check that transport received the email with 6-digit code
      const dispatchedOtp = transport.getLatestOtp(TEST_EMAIL);
      expect(dispatchedOtp).toBeDefined();
      expect(dispatchedOtp).toMatch(/^\d{6}$/);

      // Verify challenge row in PostgreSQL
      const challengeRes = await query<{ purpose: string; attempts: number }>(
        `SELECT purpose, attempts FROM campus_duo.otp_challenge WHERE lower(email) = $1`,
        [TEST_EMAIL]
      );
      expect(challengeRes.rows.length).toBe(1);
      expect(challengeRes.rows[0].purpose).toBe('REGISTRATION');
      expect(challengeRes.rows[0].attempts).toBe(0);
    });
  });

  describe('2. Registration Verification & Authentic First-Login Experience', () => {
    it('rejects incorrect OTP and enforces maximum attempt limits', async () => {
      await request(app)
        .post('/api/auth/otp/request-registration')
        .send({ email: TEST_EMAIL, displayName: 'Newton Issac' });

      // Attempt with wrong code 3 times
      for (let attempt = 1; attempt <= 3; attempt++) {
        const res = await request(app)
          .post('/api/auth/otp/verify-registration')
          .send({ email: TEST_EMAIL, otp: '000000' });

        expect(res.status).toBe(attempt < 3 ? 400 : 403);
        expect(res.body.error.message).toContain(attempt < 3 ? 'attempts remaining' : 'Maximum verification attempts exceeded');
      }
    });

    it('successfully verifies OTP, creates account without auto-connections, and returns isFirstLogin: true', async () => {
      await request(app)
        .post('/api/auth/otp/request-registration')
        .send({ email: TEST_EMAIL, displayName: 'Newton Issac' });

      const otp = transport.getLatestOtp(TEST_EMAIL)!;
      expect(otp).toBeDefined();

      const verifyRes = await request(app)
        .post('/api/auth/otp/verify-registration')
        .send({ email: TEST_EMAIL, otp });

      expect(verifyRes.status).toBe(201);
      expect(verifyRes.body.data.user.email).toBe(TEST_EMAIL);
      expect(verifyRes.body.data.user.displayName).toBe('Newton Issac');
      expect(verifyRes.body.data.user.role).toBe('ROLE_STUDENT');
      expect(verifyRes.body.data.user.verificationStatus).toBe('VERIFIED');
      expect(verifyRes.body.data.isFirstLogin).toBe(true);
      expect(verifyRes.body.data.token).toBeDefined();

      const newUserId = verifyRes.body.data.user.userId;

      // Invariant: fresh student MUST start with ZERO unearned mutual connections!
      const connRes = await query(
        `SELECT connection_id FROM campus_duo.connection WHERE user_a_id = $1 OR user_b_id = $1`,
        [newUserId]
      );
      expect(connRes.rows.length).toBe(0);
    });
  });

  describe('3. Login OTP Flow & Returning User Session State', () => {
    it('completes login via OTP and marks isFirstLogin: false for returning users', async () => {
      // Step A: Register the user
      await request(app)
        .post('/api/auth/otp/request-registration')
        .send({ email: TEST_EMAIL, displayName: 'Newton Issac' });

      const regOtp = transport.getLatestOtp(TEST_EMAIL)!;
      const regVerify = await request(app)
        .post('/api/auth/otp/verify-registration')
        .send({ email: TEST_EMAIL, otp: regOtp });

      const sessionToken1 = regVerify.body.data.token;

      // Step B: Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${sessionToken1}`);

      // Step C: Request Login OTP
      transport.clear();
      const loginReq = await request(app)
        .post('/api/auth/otp/request-login')
        .send({ email: TEST_EMAIL });

      expect(loginReq.status).toBe(200);
      expect(loginReq.body.data.message).toContain('Login verification code sent');

      const loginOtp = transport.getLatestOtp(TEST_EMAIL)!;
      expect(loginOtp).toBeDefined();

      // Step D: Verify Login OTP
      const loginVerify = await request(app)
        .post('/api/auth/otp/verify-login')
        .send({ email: TEST_EMAIL, otp: loginOtp });

      expect(loginVerify.status).toBe(200);
      expect(loginVerify.body.data.user.email).toBe(TEST_EMAIL);
      expect(loginVerify.body.data.isFirstLogin).toBe(false); // Returning user!
      expect(loginVerify.body.data.token).toBeDefined();

      const sessionToken2 = loginVerify.body.data.token;

      // Verify token can access protected GET /api/auth/me
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${sessionToken2}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.user.email).toBe(TEST_EMAIL);

      // Verify student cannot access admin API (RBAC)
      const adminRes = await request(app)
        .get('/api/admin/summary')
        .set('Authorization', `Bearer ${sessionToken2}`);

      expect(adminRes.status).toBe(403);
    });

    it('refuses to instantiate DevelopmentEmailTransport when NODE_ENV is production', () => {
      const prevEnv = process.env.NODE_ENV;
      const prevHost = process.env.SMTP_HOST;
      const prevTransport = process.env.EMAIL_TRANSPORT;
      try {
        process.env.NODE_ENV = 'production';
        delete process.env.SMTP_HOST;
        delete process.env.EMAIL_TRANSPORT;
        expect(() => new EmailService()).toThrow(
          /Production email transport not configured/
        );
      } finally {
        process.env.NODE_ENV = prevEnv;
        if (prevHost !== undefined) process.env.SMTP_HOST = prevHost;
        if (prevTransport !== undefined) process.env.EMAIL_TRANSPORT = prevTransport;
      }
    });
  });

  describe('4. SmtpEmailTransport Unit & Failure Isolation Suite', () => {
    it('successfully delivers email via underlying transporter', async () => {
      const mockTransporter: Partial<Transporter> = {
        sendMail: vi.fn().mockResolvedValue({ messageId: 'msg-success-123' }) as any,
      };

      const smtpTransport = new SmtpEmailTransport(
        { host: 'smtp.iitk.ac.in', port: 587, secure: false, from: 'Campus Duo <noreply@campusduo.iitk.ac.in>' },
        mockTransporter as Transporter
      );

      await expect(
        smtpTransport.sendMail({
          to: 'recipient@iitk.ac.in',
          subject: 'Your OTP Code',
          text: 'Your code is 654321',
        })
      ).resolves.not.toThrow();

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'recipient@iitk.ac.in',
          subject: 'Your OTP Code',
          text: 'Your code is 654321',
        })
      );
    });

    it('wraps SMTP provider rejection into 503 SERVICE_UNAVAILABLE without leaking raw secrets', async () => {
      const mockTransporter: Partial<Transporter> = {
        sendMail: vi.fn().mockRejectedValue(new Error('550 5.1.1 User unknown / mailbox unavailable')) as any,
      };

      const smtpTransport = new SmtpEmailTransport(
        { host: 'smtp.iitk.ac.in', port: 587, secure: false, from: 'Campus Duo <noreply@campusduo.iitk.ac.in>' },
        mockTransporter as Transporter
      );

      await expect(
        smtpTransport.sendMail({
          to: 'recipient@iitk.ac.in',
          subject: 'Your OTP Code',
          text: 'Your code is 654321',
        })
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'SERVICE_UNAVAILABLE',
        message: expect.stringContaining('Email delivery failed'),
      });
    });

    it('wraps network timeout into 503 SERVICE_UNAVAILABLE', async () => {
      const mockTransporter: Partial<Transporter> = {
        sendMail: vi.fn().mockRejectedValue(new Error('ETIMEDOUT: Connection to mail server timed out')) as any,
      };

      const smtpTransport = new SmtpEmailTransport(
        { host: 'smtp.iitk.ac.in', port: 587, secure: false, from: 'Campus Duo <noreply@campusduo.iitk.ac.in>' },
        mockTransporter as Transporter
      );

      await expect(
        smtpTransport.sendMail({
          to: 'recipient@iitk.ac.in',
          subject: 'Your OTP Code',
          text: 'Your code is 654321',
        })
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'SERVICE_UNAVAILABLE',
      });
    });
  });

  describe('5. Delivery Failure Database Consistency & Rollback Suite', () => {
    it('rolls back database challenge when registration email dispatch fails so user is not locked out by cooldown', async () => {
      // Create failing email transport
      const failingTransport: Partial<Transporter> = {
        sendMail: vi.fn().mockRejectedValue(new Error('SMTP connection refused')) as any,
      };
      const failingSmtp = new SmtpEmailTransport(
        { host: 'smtp.iitk.ac.in', port: 587, secure: false, from: 'Campus Duo <noreply@campusduo.iitk.ac.in>' },
        failingTransport as Transporter
      );
      const failingEmailService = new EmailService(failingSmtp);
      const testAuthService = new AuthService(failingEmailService);

      // Attempt registration OTP request
      await expect(
        testAuthService.requestRegistrationOtp({
          email: TEST_EMAIL,
          displayName: 'Test Student',
        })
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'SERVICE_UNAVAILABLE',
      });

      // Verify NO orphaned challenge remains in database
      const challenges = await query(
        `SELECT challenge_id FROM campus_duo.otp_challenge WHERE lower(email) = $1`,
        [TEST_EMAIL]
      );
      expect(challenges.rows.length).toBe(0);

      // User can immediately retry using normal transport without being blocked by 30-second cooldown
      const workingAuthService = new AuthService(defaultEmailService);
      await expect(
        workingAuthService.requestRegistrationOtp({
          email: TEST_EMAIL,
          displayName: 'Test Student',
        })
      ).resolves.toHaveProperty('challengeId');
    });

    it('rolls back database challenge when login email dispatch fails so user is not locked out by cooldown', async () => {
      // Pre-register user
      await request(app)
        .post('/api/auth/otp/request-registration')
        .send({ email: TEST_EMAIL, displayName: 'Issac Newton' });
      const regOtp = transport.getLatestOtp(TEST_EMAIL)!;
      await request(app)
        .post('/api/auth/otp/verify-registration')
        .send({ email: TEST_EMAIL, otp: regOtp });

      // Clean out challenges
      await query(`DELETE FROM campus_duo.otp_challenge WHERE lower(email) = $1`, [TEST_EMAIL]);

      // Failing email service
      const failingTransport: Partial<Transporter> = {
        sendMail: vi.fn().mockRejectedValue(new Error('Relay access denied')) as any,
      };
      const failingSmtp = new SmtpEmailTransport(
        { host: 'smtp.iitk.ac.in', port: 587, secure: false, from: 'Campus Duo <noreply@campusduo.iitk.ac.in>' },
        failingTransport as Transporter
      );
      const failingEmailService = new EmailService(failingSmtp);
      const testAuthService = new AuthService(failingEmailService);

      await expect(
        testAuthService.requestLoginOtp({ email: TEST_EMAIL })
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'SERVICE_UNAVAILABLE',
      });

      // Confirm no pending login challenge remained in DB
      const challenges = await query(
        `SELECT challenge_id FROM campus_duo.otp_challenge WHERE lower(email) = $1 AND purpose = 'LOGIN'`,
        [TEST_EMAIL]
      );
      expect(challenges.rows.length).toBe(0);
    });
  });

  describe('6. ChallengeId Harmonization, Resend Cooldown & Replay Protection Suite', () => {
    it('returns challengeId in request response and verifies using challengeId alone or with email', async () => {
      const reqRes = await request(app)
        .post('/api/auth/otp/request-registration')
        .send({ email: TEST_EMAIL, displayName: 'Albert Einstein' });

      expect(reqRes.status).toBe(200);
      expect(reqRes.body.data.challengeId).toBeDefined();
      expect(typeof reqRes.body.data.challengeId).toBe('string');
      const challengeId = reqRes.body.data.challengeId;

      const otp = transport.getLatestOtp(TEST_EMAIL)!;
      expect(otp).toBeDefined();

      // Verify using challengeId alone (as LoginPage sends)
      const verifyRes = await request(app)
        .post('/api/auth/otp/verify-registration')
        .send({ challengeId, otp });

      expect(verifyRes.status).toBe(201);
      expect(verifyRes.body.data.user.email).toBe(TEST_EMAIL);
      expect(verifyRes.body.data.user.displayName).toBe('Albert Einstein');
    });

    it('enforces 30-second resend cooldown when challenge is active', async () => {
      const res1 = await request(app)
        .post('/api/auth/otp/request-registration')
        .send({ email: TEST_EMAIL, displayName: 'Marie Curie' });
      expect(res1.status).toBe(200);

      // Immediate second request within 30s
      const res2 = await request(app)
        .post('/api/auth/otp/request-registration')
        .send({ email: TEST_EMAIL, displayName: 'Marie Curie' });

      expect(res2.status).toBe(429);
      expect(res2.body.error.message).toContain('30 seconds');
    });

    it('prevents replay attack on already verified OTP code', async () => {
      const reqRes = await request(app)
        .post('/api/auth/otp/request-registration')
        .send({ email: TEST_EMAIL, displayName: 'Max Planck' });

      const challengeId = reqRes.body.data.challengeId;
      const otp = transport.getLatestOtp(TEST_EMAIL)!;

      // First verification succeeds
      const v1 = await request(app)
        .post('/api/auth/otp/verify-registration')
        .send({ challengeId, email: TEST_EMAIL, otp });
      expect(v1.status).toBe(201);

      // Replay attack with same code fails
      const v2 = await request(app)
        .post('/api/auth/otp/verify-registration')
        .send({ challengeId, email: TEST_EMAIL, otp });
      expect(v2.status).toBe(400);
      expect(v2.body.error.message).toContain('Invalid or expired verification code');
    });

    it('regression: accepts earlier unexpired OTP code if user enters first code after a resend', async () => {
      // 1. First request
      const req1 = await request(app)
        .post('/api/auth/otp/request-registration')
        .send({ email: TEST_EMAIL, displayName: 'Niels Bohr' });
      expect(req1.status).toBe(200);
      const otp1 = transport.getLatestOtp(TEST_EMAIL)!;
      const challengeId1 = req1.body.data.challengeId;

      // Fast-forward cooldown by updating created_at in DB
      await query(
        `UPDATE campus_duo.otp_challenge SET created_at = clock_timestamp() - interval '35 seconds' WHERE challenge_id = $1`,
        [challengeId1]
      );

      // 2. Second request (resend)
      const req2 = await request(app)
        .post('/api/auth/otp/request-registration')
        .send({ email: TEST_EMAIL, displayName: 'Niels Bohr' });
      expect(req2.status).toBe(200);
      const challengeId2 = req2.body.data.challengeId;
      expect(challengeId2).not.toBe(challengeId1);

      // User's email client was slow and user enters otp1 with challengeId2
      const verifyRes = await request(app)
        .post('/api/auth/otp/verify-registration')
        .send({ challengeId: challengeId2, email: TEST_EMAIL, otp: otp1 });

      expect(verifyRes.status).toBe(201);
      expect(verifyRes.body.data.user.email).toBe(TEST_EMAIL);

      // And both challenges are now marked verified (no replay possible)
      const remainingUnverified = await query(
        `SELECT challenge_id FROM campus_duo.otp_challenge WHERE lower(email) = $1 AND verified_at IS NULL`,
        [TEST_EMAIL]
      );
      expect(remainingUnverified.rows.length).toBe(0);
    });
  });

  describe('7. OTP Concurrency, Atomic Lockout & Race Condition Resilience', () => {
    it('concurrency regression: 10 concurrent wrong OTP submissions cannot exceed max_attempts (3) in DB and lock out cleanly', async () => {
      const reqRes = await request(app)
        .post('/api/auth/otp/request-registration')
        .send({ email: TEST_EMAIL, displayName: 'Concurrency Tester' });
      expect(reqRes.status).toBe(200);
      const challengeId = reqRes.body.data.challengeId;

      // Fire 10 concurrent invalid verification requests
      const promises = Array.from({ length: 10 }).map(() =>
        request(app)
          .post('/api/auth/otp/verify-registration')
          .send({ challengeId, email: TEST_EMAIL, otp: '999999' })
      );

      const responses = await Promise.all(promises);
      const status400s = responses.filter((r) => r.status === 400);
      const status403s = responses.filter((r) => r.status === 403);

      // Exactly 2 attempts can fail with 400 (attempts 1 and 2, with 2 and 1 remaining)
      // Attempt 3 and all subsequent attempts must be locked out with 403
      expect(status400s.length).toBe(2);
      expect(status403s.length).toBe(8);

      // Verify the persisted database attempts counter is exactly 3 (never exceeded)
      const chk = await query<{ attempts: number; max_attempts: number }>(
        `SELECT attempts, max_attempts FROM campus_duo.otp_challenge WHERE challenge_id = $1`,
        [challengeId]
      );
      expect(chk.rows[0].attempts).toBe(3);
      expect(chk.rows[0].attempts).toBe(chk.rows[0].max_attempts);
    });

    it('concurrency regression: concurrent valid OTP verifications succeed exactly once (single-use)', async () => {
      const reqRes = await request(app)
        .post('/api/auth/otp/request-registration')
        .send({ email: TEST_EMAIL, displayName: 'Single Use Tester' });
      expect(reqRes.status).toBe(200);
      const challengeId = reqRes.body.data.challengeId;
      const otp = transport.getLatestOtp(TEST_EMAIL)!;

      // Fire 5 concurrent requests with the valid OTP
      const promises = Array.from({ length: 5 }).map(() =>
        request(app)
          .post('/api/auth/otp/verify-registration')
          .send({ challengeId, email: TEST_EMAIL, otp })
      );

      const responses = await Promise.all(promises);
      const successResponses = responses.filter((r) => r.status === 201);
      const failureResponses = responses.filter((r) => r.status === 400);

      expect(successResponses.length).toBe(1);
      expect(failureResponses.length).toBe(4);
      for (const fail of failureResponses) {
        expect(fail.body.error.message).toMatch(/(already been used|Invalid or expired)/i);
      }
    });

    it('rejects expired challenge and prevents verification even with correct OTP', async () => {
      const reqRes = await request(app)
        .post('/api/auth/otp/request-registration')
        .send({ email: TEST_EMAIL, displayName: 'Expiry Tester' });
      expect(reqRes.status).toBe(200);
      const challengeId = reqRes.body.data.challengeId;
      const otp = transport.getLatestOtp(TEST_EMAIL)!;

      // Force challenge to be expired in PostgreSQL
      await query(
        `UPDATE campus_duo.otp_challenge SET expires_at = clock_timestamp() - interval '5 seconds' WHERE challenge_id = $1`,
        [challengeId]
      );

      const res = await request(app)
        .post('/api/auth/otp/verify-registration')
        .send({ challengeId, email: TEST_EMAIL, otp });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Invalid or expired verification code');
    });

    it('rejects verification with correct OTP if challenge is locked (attempts >= max_attempts)', async () => {
      const reqRes = await request(app)
        .post('/api/auth/otp/request-registration')
        .send({ email: TEST_EMAIL, displayName: 'Lockout Tester' });
      expect(reqRes.status).toBe(200);
      const challengeId = reqRes.body.data.challengeId;
      const otp = transport.getLatestOtp(TEST_EMAIL)!;

      // Lock the challenge
      await query(
        `UPDATE campus_duo.otp_challenge SET attempts = 3 WHERE challenge_id = $1`,
        [challengeId]
      );

      const res = await request(app)
        .post('/api/auth/otp/verify-registration')
        .send({ challengeId, email: TEST_EMAIL, otp });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Maximum verification attempts exceeded');
    });

    it('login concurrency regression: 10 concurrent wrong login OTP submissions lock out cleanly at 3 attempts', async () => {
      // 1. Pre-register user
      await request(app)
        .post('/api/auth/otp/request-registration')
        .send({ email: TEST_EMAIL, displayName: 'Login Lockout' });
      const regOtp = transport.getLatestOtp(TEST_EMAIL)!;
      await request(app)
        .post('/api/auth/otp/verify-registration')
        .send({ email: TEST_EMAIL, otp: regOtp });

      // Clean up challenges
      await query(`DELETE FROM campus_duo.otp_challenge WHERE lower(email) = $1`, [TEST_EMAIL]);

      // 2. Request login OTP
      const loginReq = await request(app)
        .post('/api/auth/otp/request-login')
        .send({ email: TEST_EMAIL });
      expect(loginReq.status).toBe(200);
      const challengeId = loginReq.body.data.challengeId;

      // 3. Fire 10 concurrent wrong code attempts
      const promises = Array.from({ length: 10 }).map(() =>
        request(app)
          .post('/api/auth/otp/verify-login')
          .send({ challengeId, email: TEST_EMAIL, otp: '000000' })
      );

      const responses = await Promise.all(promises);
      const status400s = responses.filter((r) => r.status === 400);
      const status403s = responses.filter((r) => r.status === 403);

      expect(status400s.length).toBe(2);
      expect(status403s.length).toBe(8);

      const chk = await query<{ attempts: number }>(
        `SELECT attempts FROM campus_duo.otp_challenge WHERE challenge_id = $1`,
        [challengeId]
      );
      expect(chk.rows[0].attempts).toBe(3);
    });

    it('concurrency regression (F-02): concurrent challenge requests for the same email serialize and enforce the 30-second cooldown', async () => {
      const concurrentEmail = 'cooldown.race@iitk.ac.in';
      await query(`DELETE FROM campus_duo.otp_challenge WHERE lower(email) = $1`, [concurrentEmail]);

      try {
        // Fire 5 simultaneous requests for the same email
        const promises = Array.from({ length: 5 }).map(() =>
          request(app)
            .post('/api/auth/otp/request-registration')
            .send({ email: concurrentEmail, displayName: 'Race Tester' })
        );

        const responses = await Promise.all(promises);
        const status200s = responses.filter((r) => r.status === 200);
        const status429s = responses.filter((r) => r.status === 429);

        // Exactly 1 request succeeds in issuing a challenge; the other 4 are throttled by 30-second cooldown
        expect(status200s.length).toBe(1);
        expect(status429s.length).toBe(4);

        const countRes = await query<{ count: string }>(
          `SELECT count(*)::text as count FROM campus_duo.otp_challenge WHERE lower(email) = $1`,
          [concurrentEmail]
        );
        expect(parseInt(countRes.rows[0].count, 10)).toBe(1);
      } finally {
        await query(`DELETE FROM campus_duo.otp_challenge WHERE lower(email) = $1`, [concurrentEmail]);
      }
    });

    it('concurrency isolation (F-02): concurrent challenge requests for distinct emails execute without cross-blocking', async () => {
      const emailA = 'distinct.a@iitk.ac.in';
      const emailB = 'distinct.b@iitk.ac.in';
      await query(`DELETE FROM campus_duo.otp_challenge WHERE lower(email) IN ($1, $2)`, [emailA, emailB]);

      try {
        const [resA, resB] = await Promise.all([
          request(app).post('/api/auth/otp/request-registration').send({ email: emailA, displayName: 'User A' }),
          request(app).post('/api/auth/otp/request-registration').send({ email: emailB, displayName: 'User B' })
        ]);

        expect(resA.status).toBe(200);
        expect(resB.status).toBe(200);
        expect(resA.body.data.challengeId).toBeDefined();
        expect(resB.body.data.challengeId).toBeDefined();
        expect(resA.body.data.challengeId).not.toBe(resB.body.data.challengeId);
      } finally {
        await query(`DELETE FROM campus_duo.otp_challenge WHERE lower(email) IN ($1, $2)`, [emailA, emailB]);
      }
    });

    it('transaction rollback on failure (F-01): injected failure during session creation rolls back registration challenge consumption and permits retry', async () => {
      const rollbackEmail = 'rollback.reg@iitk.ac.in';
      await deleteTestUser(rollbackEmail);
      await query(`DELETE FROM campus_duo.otp_challenge WHERE lower(email) = $1`, [rollbackEmail]);

      const reqRes = await request(app)
        .post('/api/auth/otp/request-registration')
        .send({ email: rollbackEmail, displayName: 'Rollback Student' });
      expect(reqRes.status).toBe(200);
      const challengeId = reqRes.body.data.challengeId;
      const otp = transport.getLatestOtp(rollbackEmail)!;

      // Spy on getClient to intercept transaction and fail session insertion
      const originalGetClient = dbModule.getClient;
      let targetClient: any = null;
      let originalQueryFn: any = null;
      const spy = vi.spyOn(dbModule, 'getClient').mockImplementationOnce(async () => {
        const client = await originalGetClient();
        targetClient = client;
        originalQueryFn = client.query;
        const origQuery = client.query.bind(client);
        (client as any).query = async (...args: any[]) => {
          const sql = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].text ? args[0].text : '');
          if (sql.includes('INSERT INTO campus_duo.auth_session')) {
            throw new Error('Injected database disk failure on auth_session');
          }
          return (origQuery as any)(...args);
        };
        return client;
      });

      // Attempt verification - should fail with 500 / error
      const failRes = await request(app)
        .post('/api/auth/otp/verify-registration')
        .send({ challengeId, email: rollbackEmail, otp });

      expect(failRes.status).toBe(500);

      // Restore pooled client query method immediately
      if (targetClient && originalQueryFn) {
        targetClient.query = originalQueryFn;
      }
      spy.mockRestore();

      // Verify transaction rolled back:
      // 1. otp_challenge.verified_at MUST STILL BE NULL!
      const challengeDb = await query<{ verified_at: string | null }>(
        `SELECT verified_at FROM campus_duo.otp_challenge WHERE challenge_id = $1`,
        [challengeId]
      );
      expect(challengeDb.rows[0].verified_at).toBeNull();

      // 2. user_account MUST NOT EXIST!
      const userDb = await query(
        `SELECT user_id FROM campus_duo.user_account WHERE lower(email) = $1`,
        [rollbackEmail]
      );
      expect(userDb.rows.length).toBe(0);

      // 3. User CAN RETRY with the exact same OTP code now that error has cleared!
      const retryRes = await request(app)
        .post('/api/auth/otp/verify-registration')
        .send({ challengeId, email: rollbackEmail, otp });

      expect(retryRes.status).toBe(201);
      expect(retryRes.body.data.user.email).toBe(rollbackEmail);
      expect(retryRes.body.data.token).toBeDefined();

      // Challenge is now verified
      const challengeDbAfter = await query<{ verified_at: string | null }>(
        `SELECT verified_at FROM campus_duo.otp_challenge WHERE challenge_id = $1`,
        [challengeId]
      );
      expect(challengeDbAfter.rows[0].verified_at).not.toBeNull();

      // Clean up
      await deleteTestUser(rollbackEmail);
      await query(`DELETE FROM campus_duo.otp_challenge WHERE lower(email) = $1`, [rollbackEmail]);
    });

    it('transaction rollback on failure (F-01): injected failure during login session creation rolls back challenge consumption and permits retry', async () => {
      const rollbackLoginEmail = 'rollback.login@iitk.ac.in';
      await deleteTestUser(rollbackLoginEmail);
      await query(`DELETE FROM campus_duo.otp_challenge WHERE lower(email) = $1`, [rollbackLoginEmail]);

      // Pre-register user
      await request(app)
        .post('/api/auth/otp/request-registration')
        .send({ email: rollbackLoginEmail, displayName: 'Login Rollback' });
      const regOtp = transport.getLatestOtp(rollbackLoginEmail)!;
      await request(app)
        .post('/api/auth/otp/verify-registration')
        .send({ email: rollbackLoginEmail, otp: regOtp });

      // Request login OTP
      const loginReq = await request(app)
        .post('/api/auth/otp/request-login')
        .send({ email: rollbackLoginEmail });
      expect(loginReq.status).toBe(200);
      const challengeId = loginReq.body.data.challengeId;
      const loginOtp = transport.getLatestOtp(rollbackLoginEmail)!;

      // Injected failure on session insertion
      const originalGetClient = dbModule.getClient;
      let targetClient: any = null;
      let originalQueryFn: any = null;
      const spy = vi.spyOn(dbModule, 'getClient').mockImplementationOnce(async () => {
        const client = await originalGetClient();
        targetClient = client;
        originalQueryFn = client.query;
        const origQuery = client.query.bind(client);
        (client as any).query = async (...args: any[]) => {
          const sql = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].text ? args[0].text : '');
          if (sql.includes('INSERT INTO campus_duo.auth_session')) {
            throw new Error('Injected crash on login session creation');
          }
          return (origQuery as any)(...args);
        };
        return client;
      });

      const failRes = await request(app)
        .post('/api/auth/otp/verify-login')
        .send({ challengeId, email: rollbackLoginEmail, otp: loginOtp });

      expect(failRes.status).toBe(500);

      // Restore pooled client query method immediately
      if (targetClient && originalQueryFn) {
        targetClient.query = originalQueryFn;
      }
      spy.mockRestore();

      // Verify challenge verified_at was NOT permanently consumed
      const challengeDb = await query<{ verified_at: string | null }>(
        `SELECT verified_at FROM campus_duo.otp_challenge WHERE challenge_id = $1`,
        [challengeId]
      );
      expect(challengeDb.rows[0].verified_at).toBeNull();

      // Retry with same OTP code succeeds
      const retryRes = await request(app)
        .post('/api/auth/otp/verify-login')
        .send({ challengeId, email: rollbackLoginEmail, otp: loginOtp });

      expect(retryRes.status).toBe(200);
      expect(retryRes.body.data.token).toBeDefined();

      await deleteTestUser(rollbackLoginEmail);
      await query(`DELETE FROM campus_duo.otp_challenge WHERE lower(email) = $1`, [rollbackLoginEmail]);
    });
  });
});
