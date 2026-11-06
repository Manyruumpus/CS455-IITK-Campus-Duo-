import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { closeDbPool } from '../src/config/db';
import { deleteTestUser, closeMigratorPool } from './testDbHelper';

describe('Profile Lifecycle & Persistence Suite', () => {
  const TEST_STUDENT_EMAIL = 'profile.lifecycle.student@iitk.ac.in';
  const TEST_STUDENT_NAME = 'Profile Test Student';
  const TEST_STUDENT_PASS = 'StudentSecret123!';

  const OTHER_STUDENT_EMAIL = 'other.lifecycle.student@iitk.ac.in';
  const OTHER_STUDENT_NAME = 'Other Test Student';
  const OTHER_STUDENT_PASS = 'OtherSecret123!';

  let studentToken: string;
  let studentUserId: string;

  let otherToken: string;
  let otherUserId: string;

  beforeEach(async () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_TEST_HARNESS_AUTH = 'true';

    await deleteTestUser(TEST_STUDENT_EMAIL);
    await deleteTestUser(OTHER_STUDENT_EMAIL);

    // Register primary student
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: TEST_STUDENT_EMAIL,
        displayName: TEST_STUDENT_NAME,
        password: TEST_STUDENT_PASS,
      });
    expect(regRes.status).toBe(201);
    studentToken = regRes.body.data.token;
    studentUserId = regRes.body.data.user.userId;

    // Register other student for cross-user tests
    const otherRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: OTHER_STUDENT_EMAIL,
        displayName: OTHER_STUDENT_NAME,
        password: OTHER_STUDENT_PASS,
      });
    expect(otherRes.status).toBe(201);
    otherToken = otherRes.body.data.token;
    otherUserId = otherRes.body.data.user.userId;
  });

  afterEach(async () => {
    await deleteTestUser(TEST_STUDENT_EMAIL);
    await deleteTestUser(OTHER_STUDENT_EMAIL);
  });

  afterAll(async () => {
    await closeDbPool();
    await closeMigratorPool();
  });

  describe('1. Authentication & Authorization Enforcement', () => {
    it('rejects unauthenticated GET /api/profile with 401', async () => {
      const res = await request(app).get('/api/profile/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rejects unauthenticated PUT /api/profile with 401', async () => {
      const res = await request(app)
        .put('/api/profile/me')
        .send({ displayName: 'Hacker' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rejects admin access to student profile with 403', async () => {
      const res = await request(app)
        .get('/api/profile/me')
        .set('X-Campus-Duo-Test-Actor', '00000000-0000-0000-0000-00000000D599'); // Senate Admin
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('2. Graceful Retrieval for Fresh User', () => {
    it('returns default profile for newly registered user without prior student_profile row', async () => {
      const res = await request(app)
        .get('/api/profile/me')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.userId).toBe(studentUserId);
      expect(res.body.data.email).toBe(TEST_STUDENT_EMAIL);
      expect(res.body.data.displayName).toBe(TEST_STUDENT_NAME);
      expect(res.body.data.studyPreferences).toBeDefined();
      expect(['QUIET_FOCUSED', 'PROBLEM_SOLVING']).toContain(res.body.data.studyPreferences.studyStyle);
      expect(res.body.data.studyPreferences.preferredPace).toBe('STANDARD_REGULAR');
      expect(Array.isArray(res.body.data.studyPreferences.preferredTimes)).toBe(true);
      expect(Array.isArray(res.body.data.courses)).toBe(true);
      expect(res.body.data.studyConsent).toBeDefined();
      expect(res.body.data.studyConsent.hasConsent).toBe(true); // Given at student registration
    });
  });

  describe('3. Profile Update and Persistence Across Requests', () => {
    it('updates profile fields and persists changes across subsequent GET requests', async () => {
      const updatePayload = {
        displayName: 'Updated Test Student',
        studyPreferences: {
          studyStyle: 'DISCUSSION_HEAVY',
          preferredPace: 'EXAM_CRAMMING',
          preferredTimes: ['EVENING', 'LATE_NIGHT'],
          studyGoals: 'Master dynamic programming and graph algorithms.',
          preferredLocation: 'PK Kelkar 2F Room A',
        },
        socialBio: 'Looking for peer study partners in algorithms and distributed systems.',
      };

      const putRes = await request(app)
        .put('/api/profile/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(updatePayload);

      expect(putRes.status).toBe(200);
      expect(putRes.body.data.displayName).toBe('Updated Test Student');
      expect(putRes.body.data.studyPreferences.studyStyle).toBe('DISCUSSION_HEAVY');
      expect(putRes.body.data.studyPreferences.preferredPace).toBe('EXAM_CRAMMING');
      expect(putRes.body.data.studyPreferences.preferredTimes).toEqual(['EVENING', 'LATE_NIGHT']);
      expect(putRes.body.data.studyPreferences.studyGoals).toBe('Master dynamic programming and graph algorithms.');
      expect(putRes.body.data.studyPreferences.preferredLocation).toBe('PK Kelkar 2F Room A');
      expect(putRes.body.data.socialBio).toBe('Looking for peer study partners in algorithms and distributed systems.');

      // Subsequent GET request verifies persistence in PostgreSQL
      const getRes = await request(app)
        .get('/api/profile/me')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.displayName).toBe('Updated Test Student');
      expect(getRes.body.data.studyPreferences.studyStyle).toBe('DISCUSSION_HEAVY');
      expect(getRes.body.data.studyPreferences.preferredPace).toBe('EXAM_CRAMMING');
      expect(getRes.body.data.studyPreferences.preferredTimes).toEqual(['EVENING', 'LATE_NIGHT']);
      expect(getRes.body.data.studyPreferences.studyGoals).toBe('Master dynamic programming and graph algorithms.');
      expect(getRes.body.data.studyPreferences.preferredLocation).toBe('PK Kelkar 2F Room A');
      expect(getRes.body.data.socialBio).toBe('Looking for peer study partners in algorithms and distributed systems.');
    });

    it('preserves unrelated fields during partial updates', async () => {
      // First update full state
      await request(app)
        .put('/api/profile/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          displayName: 'Base Student',
          studyPreferences: {
            studyStyle: 'QUIET_FOCUSED',
            preferredPace: 'STANDARD_REGULAR',
            preferredTimes: ['MORNING'],
            studyGoals: 'Finish semester project',
            preferredLocation: 'Library',
          },
          socialBio: 'Initial bio',
        });

      // Partial update modifying ONLY studyStyle
      const patchRes = await request(app)
        .patch('/api/profile/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          studyPreferences: {
            studyStyle: 'PROBLEM_SOLVING',
          },
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.studyPreferences.studyStyle).toBe('PROBLEM_SOLVING');
      // All other fields must remain intact
      expect(patchRes.body.data.displayName).toBe('Base Student');
      expect(patchRes.body.data.studyPreferences.preferredPace).toBe('STANDARD_REGULAR');
      expect(patchRes.body.data.studyPreferences.preferredTimes).toEqual(['MORNING']);
      expect(patchRes.body.data.studyPreferences.studyGoals).toBe('Finish semester project');
      expect(patchRes.body.data.studyPreferences.preferredLocation).toBe('Library');
      expect(patchRes.body.data.socialBio).toBe('Initial bio');
    });
  });

  describe('4. Cross-User Rejection and Identity Enforcement', () => {
    it('rejects attempt to modify another user profile by specifying a different userId', async () => {
      const res = await request(app)
        .put('/api/profile/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          userId: otherUserId,
          displayName: 'Cross User Overwrite Attempt',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');

      // Verify other student was NOT modified
      const otherGet = await request(app)
        .get('/api/profile/me')
        .set('Authorization', `Bearer ${otherToken}`);
      expect(otherGet.body.data.displayName).toBe(OTHER_STUDENT_NAME);
    });
  });

  describe('5. Validation Guardrails', () => {
    it('rejects modification of protected fields', async () => {
      const protectedFields = [
        { field: 'email', value: 'hacker@iitk.ac.in' },
        { field: 'role', value: 'ROLE_ADMIN' },
        { field: 'isOnboarded', value: false },
        { field: 'department', value: 'Aerospace' },
        { field: 'degree', value: 'PhD' },
        { field: 'year', value: 1 },
      ];

      for (const item of protectedFields) {
        const res = await request(app)
          .put('/api/profile/me')
          .set('Authorization', `Bearer ${studentToken}`)
          .send({ [item.field]: item.value });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('rejects invalid studyStyle enum', async () => {
      const res = await request(app)
        .put('/api/profile/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          studyPreferences: {
            studyStyle: 'NON_EXISTENT_STYLE',
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid preferredPace enum', async () => {
      const res = await request(app)
        .put('/api/profile/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          studyPreferences: {
            preferredPace: 'ULTRA_FAST_CRAM',
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid preferredTimes items', async () => {
      const res = await request(app)
        .put('/api/profile/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          studyPreferences: {
            preferredTimes: ['MIDNIGHT_SNACK'],
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects empty display name', async () => {
      const res = await request(app)
        .put('/api/profile/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ displayName: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
