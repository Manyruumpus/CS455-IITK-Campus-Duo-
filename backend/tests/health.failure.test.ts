import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn()
}));

vi.mock('../src/config/db', () => ({
  query: queryMock
}));

import { app } from '../src/app';

const FAILURE_MARKERS = [
  'synthetic-password-marker',
  'postgres://synthetic-user:synthetic-password@db.internal/campus_duo'
];

function expectRequestIdHeader(response: { headers: Record<string, string> }): string {
  const requestId = response.headers['x-request-id'];
  expect(requestId).toMatch(/^req-[0-9a-f-]{36}$/);
  return requestId;
}

describe('GET /api/health — database failure handling', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('returns a controlled 503 response without database internals or stack traces', async () => {
    queryMock.mockRejectedValueOnce(
      new Error(
        `synthetic SQL failure ${FAILURE_MARKERS[0]} ${FAILURE_MARKERS[1]}\n at synthetic-stack-marker`
      )
    );

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: 'DOWN',
      database: 'DISCONNECTED',
      error: 'Database connection failed',
      timestamp: expect.any(String)
    });
    expect(JSON.stringify(response.body)).not.toContain(FAILURE_MARKERS[0]);
    expect(JSON.stringify(response.body)).not.toContain(FAILURE_MARKERS[1]);
    expect(JSON.stringify(response.body)).not.toContain('synthetic-stack-marker');
    expectRequestIdHeader(response);
    expect(queryMock).toHaveBeenCalledOnce();
  });

  it('returns controlled failure responses for successive database failures', async () => {
    queryMock
      .mockRejectedValueOnce(new Error('synthetic first database failure'))
      .mockRejectedValueOnce(new Error('synthetic second database failure'));

    const first = await request(app).get('/api/health');
    const second = await request(app).get('/api/health');

    for (const response of [first, second]) {
      expect(response.status).toBe(503);
      expect(response.body.status).toBe('DOWN');
      expect(response.body.database).toBe('DISCONNECTED');
      expect(response.body.error).toBe('Database connection failed');
      expectRequestIdHeader(response);
    }
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it('recovers on the next request when the database dependency recovers', async () => {
    queryMock
      .mockRejectedValueOnce(new Error('synthetic transient database failure'))
      .mockResolvedValueOnce({
        rows: [{ current_user: 'campus_duo_app', current_database: 'campus_duo_test' }]
      });

    const failed = await request(app).get('/api/health');
    const recovered = await request(app).get('/api/health');

    expect(failed.status).toBe(503);
    expect(failed.body.status).toBe('DOWN');
    expectRequestIdHeader(failed);

    expect(recovered.status).toBe(200);
    expect(recovered.body).toEqual({
      status: 'UP',
      database: 'CONNECTED',
      databaseUser: 'campus_duo_app',
      databaseName: 'campus_duo_test',
      timestamp: expect.any(String)
    });
    expectRequestIdHeader(recovered);
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock).toHaveBeenNthCalledWith(
      1,
      'SELECT current_user, current_database();'
    );
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      'SELECT current_user, current_database();'
    );
  });
});
