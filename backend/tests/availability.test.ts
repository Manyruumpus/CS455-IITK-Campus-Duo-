import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { closeDbPool } from '../src/config/db';
import {
  AVAILABILITY_FIXTURE,
  closeAvailabilityFixturePool,
  setupAvailabilityFixture,
  teardownAvailabilityFixture
} from './availabilityFixture';

const VALID_ACTOR_ID = AVAILABILITY_FIXTURE.actorId;
const FIXTURE_LOCATION_ID = AVAILABILITY_FIXTURE.locationId;
const FIXTURE_DATE = AVAILABILITY_FIXTURE.date;
const originalTestEnvironment = {
  nodeEnv: process.env.NODE_ENV,
  allowTestHarnessAuth: process.env.ALLOW_TEST_HARNESS_AUTH
};

function restoreTestEnvironment(): void {
  if (originalTestEnvironment.nodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalTestEnvironment.nodeEnv;
  }
  if (originalTestEnvironment.allowTestHarnessAuth === undefined) {
    delete process.env.ALLOW_TEST_HARNESS_AUTH;
  } else {
    process.env.ALLOW_TEST_HARNESS_AUTH = originalTestEnvironment.allowTestHarnessAuth;
  }
}

describe('GET /api/booking/availability', () => {
  beforeAll(async () => {
    await setupAvailabilityFixture();
  });

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_TEST_HARNESS_AUTH = 'true';
  });

  afterAll(async () => {
    const failures: unknown[] = [];

    try {
      await teardownAvailabilityFixture();
    } catch (error) {
      failures.push(error);
    } finally {
      try {
        await closeAvailabilityFixturePool();
      } catch (error) {
        failures.push(error);
      }
      try {
        await closeDbPool();
      } catch (error) {
        failures.push(error);
      }
      try {
        restoreTestEnvironment();
      } catch (error) {
        failures.push(error);
      }
    }

    if (failures.length === 1) {
      throw failures[0];
    }
    if (failures.length > 1) {
      throw new AggregateError(failures, 'Availability fixture cleanup failed');
    }
  });

  describe('Valid Availability Queries', () => {
    it('returns study slots for a valid campus date with derived occupancy states', async () => {
      const res = await request(app)
        .get(
          `/api/booking/availability?date=${FIXTURE_DATE}&locationId=${FIXTURE_LOCATION_ID}`
        )
        .set('X-Campus-Duo-Test-Actor', VALID_ACTOR_ID);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('requestId');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(3);

      // Confirmed booking -> OCCUPIED, reservedCount = 2
      const confirmedSlot = res.body.data.find(
        (s: any) => s.slotId === AVAILABILITY_FIXTURE.slotIds[0].toLowerCase()
      );
      expect(confirmedSlot).toBeDefined();
      expect(confirmedSlot.status).toBe('OCCUPIED');
      expect(confirmedSlot.reservedCount).toBe(2);
      expect(confirmedSlot.capacity).toBe(2);
      expect(confirmedSlot.tableNumber).toBe('[KAN-71]-A');

      // Cancelled booking -> AVAILABLE, reservedCount = 0
      const cancelledSlot = res.body.data.find(
        (s: any) => s.slotId === AVAILABILITY_FIXTURE.slotIds[1].toLowerCase()
      );
      expect(cancelledSlot).toBeDefined();
      expect(cancelledSlot.status).toBe('AVAILABLE');
      expect(cancelledSlot.reservedCount).toBe(0);

      // Unbooked slot -> AVAILABLE, reservedCount = 0
      const unbookedSlot = res.body.data.find(
        (s: any) => s.slotId === AVAILABILITY_FIXTURE.slotIds[2].toLowerCase()
      );
      expect(unbookedSlot).toBeDefined();
      expect(unbookedSlot.status).toBe('AVAILABLE');
      expect(unbookedSlot.reservedCount).toBe(0);
    });

    it('filters correctly by locationId', async () => {
      const res = await request(app)
        .get(`/api/booking/availability?date=${FIXTURE_DATE}&locationId=${FIXTURE_LOCATION_ID}`)
        .set('X-Campus-Duo-Test-Actor', VALID_ACTOR_ID);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3);
      for (const slot of res.body.data) {
        expect(slot.locationId).toBe(FIXTURE_LOCATION_ID.toLowerCase());
      }
    });

    it('supports startDate and endDate range query with limit', async () => {
      const res = await request(app)
        .get(
          `/api/booking/availability?startDate=${FIXTURE_DATE}&endDate=2026-11-20&locationId=${FIXTURE_LOCATION_ID}&limit=2`
        )
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
        .get(`/api/booking/availability?date=${FIXTURE_DATE}&locationId=not-a-uuid`)
        .set('X-Campus-Duo-Test-Actor', VALID_ACTOR_ID);

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Invalid UUID');
    });
  });
});
