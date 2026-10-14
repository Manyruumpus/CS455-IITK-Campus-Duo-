import { describe, it, expect, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { closeDbPool } from '../src/config/db';

const VALID_ALEX_ID = '00000000-0000-0000-0000-00000000D501';
const NON_EXISTENT_ID = '00000000-0000-0000-0000-00000000FFFF';

describe('Test-Auth Middleware Security & Boundary', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    process.env.ALLOW_TEST_HARNESS_AUTH = originalEnv.ALLOW_TEST_HARNESS_AUTH;
  });

  afterAll(async () => {
    await closeDbPool();
  });

  it('rejects test authentication when NODE_ENV is production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_TEST_HARNESS_AUTH = 'true';

    const res = await request(app)
      .get('/api/booking/availability?date=2026-11-14')
      .set('X-Campus-Duo-Test-Actor', VALID_ALEX_ID);

    expect(res.status).toBe(401);
    expect(res.body.error).toHaveProperty('code', 'UNAUTHENTICATED');
    expect(res.body.error.message).toContain('disabled outside explicitly enabled development mode');
  });

  it('rejects test authentication when ALLOW_TEST_HARNESS_AUTH is false or missing', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_TEST_HARNESS_AUTH = 'false';

    const res = await request(app)
      .get('/api/booking/availability?date=2026-11-14')
      .set('X-Campus-Duo-Test-Actor', VALID_ALEX_ID);

    expect(res.status).toBe(401);
    expect(res.body.error).toHaveProperty('code', 'UNAUTHENTICATED');
  });

  it('rejects requests missing the X-Campus-Duo-Test-Actor header in development mode', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_TEST_HARNESS_AUTH = 'true';

    const res = await request(app)
      .get('/api/booking/availability?date=2026-11-14');

    expect(res.status).toBe(401);
    expect(res.body.error).toHaveProperty('code', 'UNAUTHENTICATED');
    expect(res.body.error.message).toContain('Missing required authentication header');
  });

  it('rejects malformed UUID in X-Campus-Duo-Test-Actor header', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_TEST_HARNESS_AUTH = 'true';

    const res = await request(app)
      .get('/api/booking/availability?date=2026-11-14')
      .set('X-Campus-Duo-Test-Actor', 'not-a-valid-uuid');

    expect(res.status).toBe(401);
    expect(res.body.error).toHaveProperty('code', 'UNAUTHENTICATED');
    expect(res.body.error.message).toContain('Invalid format');
  });

  it('rejects non-existent student UUID in X-Campus-Duo-Test-Actor header', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_TEST_HARNESS_AUTH = 'true';

    const res = await request(app)
      .get('/api/booking/availability?date=2026-11-14')
      .set('X-Campus-Duo-Test-Actor', NON_EXISTENT_ID);

    expect(res.status).toBe(401);
    expect(res.body.error).toHaveProperty('code', 'UNAUTHENTICATED');
    expect(res.body.error.message).toContain('not found in eligible user directory');
  });

  it('accepts valid active student in development mode', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_TEST_HARNESS_AUTH = 'true';

    const res = await request(app)
      .get('/api/booking/availability?date=2026-11-14')
      .set('X-Campus-Duo-Test-Actor', VALID_ALEX_ID);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });
});
