import { describe, it, expect, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import * as db from '../src/config/db';

describe('GET /api/health', () => {
  afterAll(async () => {
    await db.closeDbPool();
  });

  it('should return 200 with database connectivity and campus_duo_app role', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'UP');
    expect(res.body).toHaveProperty('database', 'CONNECTED');
    expect(res.body).toHaveProperty('databaseUser', 'campus_duo_app');
    expect(res.body).toHaveProperty('databaseName', 'campus_duo_dev');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('should return 503 DOWN when database query fails without leaking internal errors', async () => {
    const querySpy = vi.spyOn(db, 'query').mockRejectedValueOnce(new Error('Connection terminated'));

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty('status', 'DOWN');
    expect(res.body).toHaveProperty('database', 'DISCONNECTED');
    expect(res.body).toHaveProperty('error', 'Database connection failed');
    expect(res.body).toHaveProperty('timestamp');
    expect(JSON.stringify(res.body)).not.toContain('Connection terminated');

    querySpy.mockRestore();
  });
});
