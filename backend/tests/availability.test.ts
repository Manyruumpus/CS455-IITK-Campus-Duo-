import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { closeDbPool } from '../src/config/db';

const VALID_ACTOR_ID = '00000000-0000-0000-0000-00000000D501'; // Dev Student Alex
const SEED_LOCATION_ID = '00000000-0000-0000-0000-00000000D571';
const SEED_DATE = '2026-11-14';

describe('GET /api/booking/availability', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_TEST_HARNESS_AUTH = 'true';
  });

  afterAll(async () => {
    await closeDbPool();
  });

  describe('Valid Availability Queries', () => {
    it('returns study slots for a valid campus date with derived occupancy states', async () => {
      const res = await request(app)
        .get(`/api/booking/availability?date=${SEED_DATE}`)
        .set('X-Campus-Duo-Test-Actor', VALID_ACTOR_ID);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('requestId');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(3);

      // Verify slot D574 (confirmed booking) -> OCCUPIED, reservedCount = 2
      const slotD574 = res.body.data.find(
        (s: any) => s.slotId === '00000000-0000-0000-0000-00000000d574'
      );
      expect(slotD574).toBeDefined();
      expect(slotD574.status).toBe('OCCUPIED');
      expect(slotD574.reservedCount).toBe(2);
      expect(slotD574.capacity).toBe(2);
      expect(slotD574.tableNumber).toBe('DB05-A');

      // Verify slot D575 (cancelled booking) -> AVAILABLE, reservedCount = 0
      const slotD575 = res.body.data.find(
        (s: any) => s.slotId === '00000000-0000-0000-0000-00000000d575'
      );
      expect(slotD575).toBeDefined();
      expect(slotD575.status).toBe('AVAILABLE');
      expect(slotD575.reservedCount).toBe(0);

      // Verify slot D576 (no booking) -> AVAILABLE, reservedCount = 0
      const slotD576 = res.body.data.find(
        (s: any) => s.slotId === '00000000-0000-0000-0000-00000000d576'
      );
      expect(slotD576).toBeDefined();
      expect(slotD576.status).toBe('AVAILABLE');
      expect(slotD576.reservedCount).toBe(0);
    });

    it('filters correctly by locationId', async () => {
      const res = await request(app)
        .get(`/api/booking/availability?date=${SEED_DATE}&locationId=${SEED_LOCATION_ID}`)
        .set('X-Campus-Duo-Test-Actor', VALID_ACTOR_ID);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3);
      for (const slot of res.body.data) {
        expect(slot.locationId).toBe(SEED_LOCATION_ID.toLowerCase());
      }
    });

    it('supports startDate and endDate range query with limit', async () => {
      const res = await request(app)
        .get(`/api/booking/availability?startDate=${SEED_DATE}&endDate=2026-11-20&limit=2`)
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
        .get('/api/booking/availability?startDate=2026-11-20&endDate=2026-11-14')
        .set('X-Campus-Duo-Test-Actor', VALID_ACTOR_ID);

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(res.body.error.message).toContain('startDate must be less than or equal to endDate');
    });

    it('rejects malformed locationId with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .get(`/api/booking/availability?date=${SEED_DATE}&locationId=not-a-uuid`)
        .set('X-Campus-Duo-Test-Actor', VALID_ACTOR_ID);

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Invalid UUID');
    });
  });
});
