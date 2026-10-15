import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { closeDbPool } from '../src/config/db';

const VALID_ACTOR_ID = '00000000-0000-0000-0000-00000000D501'; // Dev Student Alex
const SEED_LOCATION_ID = '00000000-0000-0000-0000-00000000D571';

describe('GET /api/booking/locations', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_TEST_HARNESS_AUTH = 'true';
  });

  afterAll(async () => {
    await closeDbPool();
  });

  describe('Authentication Boundary', () => {
    it('rejects unauthenticated request missing actor header with 401 UNAUTHENTICATED', async () => {
      const res = await request(app).get('/api/booking/locations');

      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHENTICATED');
      expect(res.body.error.message).toContain('Missing required authentication header');
    });

    it('rejects invalid UUID actor header with 401 UNAUTHENTICATED', async () => {
      const res = await request(app)
        .get('/api/booking/locations')
        .set('X-Campus-Duo-Test-Actor', 'not-a-valid-uuid');

      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHENTICATED');
      expect(res.body.error.message).toContain('Invalid format');
    });

    it('rejects nonexistent user actor header with 401 UNAUTHENTICATED', async () => {
      const res = await request(app)
        .get('/api/booking/locations')
        .set('X-Campus-Duo-Test-Actor', 'ffffffff-ffff-ffff-ffff-ffffffffffff');

      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHENTICATED');
    });
  });

  describe('Location Listing & Contract Verification', () => {
    it('returns active campus study locations with exact CampusLocation envelope', async () => {
      const res = await request(app)
        .get('/api/booking/locations')
        .set('X-Campus-Duo-Test-Actor', VALID_ACTOR_ID);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('requestId');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      // Verify the known seed location
      const seedLoc = res.body.data.find(
        (loc: any) => loc.id.toLowerCase() === SEED_LOCATION_ID.toLowerCase()
      );
      expect(seedLoc).toBeDefined();
      expect(seedLoc.name).toContain('Campus Duo Test Library');
      expect(seedLoc.building).toBeTruthy();
      expect(seedLoc.totalTables).toBe(2);
      expect(seedLoc.openTime).toBe('08:00');
      expect(seedLoc.closeTime).toBe('20:00');
      expect(seedLoc.hasPowerOutlets).toBe(true);
      expect(seedLoc.hasWifi6).toBe(true);
      expect(seedLoc.noisePolicy).toBe('WHISPER_COLLAB');
      expect(seedLoc.active).toBe(true);

      // Verify all returned locations adhere to CampusLocation contract
      for (const loc of res.body.data) {
        expect(typeof loc.id).toBe('string');
        expect(typeof loc.name).toBe('string');
        expect(typeof loc.building).toBe('string');
        expect(typeof loc.totalTables).toBe('number');
        expect(loc.totalTables).toBeGreaterThanOrEqual(0);
        expect(typeof loc.openTime).toBe('string');
        expect(loc.openTime).toMatch(/^\d{2}:\d{2}$/);
        expect(typeof loc.closeTime).toBe('string');
        expect(loc.closeTime).toMatch(/^\d{2}:\d{2}$/);
        expect(typeof loc.hasPowerOutlets).toBe('boolean');
        expect(typeof loc.hasWifi6).toBe('boolean');
        expect(['ABSOLUTE_SILENCE', 'WHISPER_COLLAB', 'CONVERSATIONAL']).toContain(loc.noisePolicy);
        expect(loc.active).toBe(true);
      }
    });
  });
});
