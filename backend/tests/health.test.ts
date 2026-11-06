import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { closeDbPool } from '../src/config/db';

describe('GET /api/health', () => {
  afterAll(async () => {
    await closeDbPool();
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
});
