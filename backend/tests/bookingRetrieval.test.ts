import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { closeDbPool } from '../src/config/db';

const ALEX_ID = '00000000-0000-0000-0000-00000000D501'; // Dev Student Alex (Creator)
const SAM_ID = '00000000-0000-0000-0000-00000000D502'; // Dev Student Sam (Companion)
const JORDAN_ID = '00000000-0000-0000-0000-00000000D503'; // Dev Student Jordan (Stranger / Non-participant)

const SEED_BOOKING_CONFIRMED = '00000000-0000-0000-0000-00000000d581';
const NONEXISTENT_BOOKING_ID = '00000000-0000-0000-0000-000000009999';

describe('Booking Retrieval & History Integration (GET /api/booking/:bookingId & GET /api/booking)', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_TEST_HARNESS_AUTH = 'true';
  });

  afterAll(async () => {
    await closeDbPool();
  });

  describe('GET /api/booking/:bookingId (Single Booking Retrieval)', () => {
    it('allows booking creator (Alex) to retrieve booking details with full record metadata', async () => {
      const res = await request(app)
        .get(`/api/booking/${SEED_BOOKING_CONFIRMED}`)
        .set('X-Campus-Duo-Test-Actor', ALEX_ID);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('requestId');

      const data = res.body.data;
      expect(data.bookingId).toBe(SEED_BOOKING_CONFIRMED);
      expect(data.bookerId.toLowerCase()).toBe(ALEX_ID.toLowerCase());
      expect(data.status).toBe('CONFIRMED');
      expect(data.locationName).toContain('Campus Duo Test Library');
      expect(data.tableNumber).toBe('DB05-A');
      expect(data.timeWindow).toMatch(/^\d{2}:\d{2} - \d{2}:\d{2}$/);
      expect(data.allowedActions).toContain('CANCEL');
      expect(data.allowedActions).toContain('RESCHEDULE');
      expect(data.participants.length).toBe(2);

      const creator = data.participants.find((p: any) => p.role === 'CREATOR');
      expect(creator.userId.toLowerCase()).toBe(ALEX_ID.toLowerCase());
      expect(creator.displayName).toBe('Dev Student Alex');

      const companion = data.participants.find((p: any) => p.role === 'COMPANION');
      expect(companion.userId.toLowerCase()).toBe(SAM_ID.toLowerCase());
      expect(companion.displayName).toBe('Dev Student Sam');
    });

    it('allows companion participant (Sam) to retrieve booking details in read-only mode', async () => {
      const res = await request(app)
        .get(`/api/booking/${SEED_BOOKING_CONFIRMED}`)
        .set('X-Campus-Duo-Test-Actor', SAM_ID);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');

      const data = res.body.data;
      expect(data.bookingId).toBe(SEED_BOOKING_CONFIRMED);
      // Companion has read-only access (no cancel/reschedule allowed)
      expect(data.allowedActions).toEqual([]);
      expect(data.participants.length).toBe(2);
    });

    it('rejects non-participant student (Jordan) with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get(`/api/booking/${SEED_BOOKING_CONFIRMED}`)
        .set('X-Campus-Duo-Test-Actor', JORDAN_ID);

      expect(res.status).toBe(403);
      expect(res.body.error).toHaveProperty('code', 'FORBIDDEN');
      expect(res.body.error.message).toContain('not authorized');
    });

    it('returns 404 NOT_FOUND for nonexistent booking UUID', async () => {
      const res = await request(app)
        .get(`/api/booking/${NONEXISTENT_BOOKING_ID}`)
        .set('X-Campus-Duo-Test-Actor', ALEX_ID);

      expect(res.status).toBe(404);
      expect(res.body.error).toHaveProperty('code', 'NOT_FOUND');
      expect(res.body.error.message).toContain('not found');
    });

    it('rejects invalid non-UUID bookingId with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .get('/api/booking/invalid-booking-id')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID);

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Invalid UUID');
    });

    it('rejects unauthenticated request missing actor header with 401 UNAUTHENTICATED', async () => {
      const res = await request(app).get(`/api/booking/${SEED_BOOKING_CONFIRMED}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHENTICATED');
    });

    it('rejects invalid non-UUID actor header with 401 UNAUTHENTICATED', async () => {
      const res = await request(app)
        .get(`/api/booking/${SEED_BOOKING_CONFIRMED}`)
        .set('X-Campus-Duo-Test-Actor', 'usr-student-fresh');

      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHENTICATED');
      expect(res.body.error.message).toContain('Invalid format for X-Campus-Duo-Test-Actor header');
    });
  });

  describe('GET /api/booking (Booking History)', () => {
    it('returns list of participant-authorized bookings for creator (Alex)', async () => {
      const res = await request(app)
        .get('/api/booking')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('requestId');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const confirmed = res.body.data.find(
        (b: any) => b.bookingId === SEED_BOOKING_CONFIRMED
      );
      expect(confirmed).toBeDefined();
      expect(confirmed.status).toBe('CONFIRMED');
      expect(confirmed.allowedActions).toContain('CANCEL');
    });

    it('returns list of participant-authorized bookings for companion (Sam)', async () => {
      const res = await request(app)
        .get('/api/booking')
        .set('X-Campus-Duo-Test-Actor', SAM_ID);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);

      const confirmed = res.body.data.find(
        (b: any) => b.bookingId === SEED_BOOKING_CONFIRMED
      );
      expect(confirmed).toBeDefined();
      expect(confirmed.allowedActions).toEqual([]);
    });

    it('returns empty list for student without bookings (Jordan)', async () => {
      const res = await request(app)
        .get('/api/booking')
        .set('X-Campus-Duo-Test-Actor', JORDAN_ID);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(0);
    });

    it('rejects unauthenticated booking history request with 401 UNAUTHENTICATED', async () => {
      const res = await request(app).get('/api/booking');

      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHENTICATED');
    });
  });
});
