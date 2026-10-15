import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { closeDbPool, query } from '../src/config/db';
import { cleanupDiscoveryAndConnections, cleanupTestData, closeMigratorPool, setupTestSlot } from './testDbHelper';

const ALEX_ID = '00000000-0000-0000-0000-00000000d501';
const JORDAN_ID = '00000000-0000-0000-0000-00000000d503';
const SEED_LOCATION_ID = '00000000-0000-0000-0000-00000000d571';
const SEED_TABLE_ID = '00000000-0000-0000-0000-00000000d572';
const DISCOVERY_TEST_SLOT_ID = '00000000-0000-0000-0000-00000000e050';
const DISCOVERY_TEST_DATE = '2026-11-25';

describe('Discovery & Reciprocal Connections Suite (FR-05 & KAN-32)', () => {
  beforeEach(async () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_TEST_HARNESS_AUTH = 'true';

    // Clean any prior discovery/connections between Alex and Jordan
    await cleanupDiscoveryAndConnections(ALEX_ID, JORDAN_ID);
    await cleanupTestData(['test-disc-%'], [DISCOVERY_TEST_SLOT_ID]);

    // Setup dedicated test slot for discovery-booking test
    await setupTestSlot({
      slotId: DISCOVERY_TEST_SLOT_ID,
      tableId: SEED_TABLE_ID,
      locationId: SEED_LOCATION_ID,
      localDate: DISCOVERY_TEST_DATE,
      startTime: '10:00:00',
      endTime: '12:00:00',
      zone: 'COLLABORATIVE_STUDY',
    });
  });

  afterEach(async () => {
    await cleanupTestData(['test-disc-%'], [DISCOVERY_TEST_SLOT_ID]);
    await cleanupDiscoveryAndConnections(ALEX_ID, JORDAN_ID);
  });

  afterAll(async () => {
    await closeDbPool();
    await closeMigratorPool();
  });

  describe('1. Directional Like and Isolation (FR-05 Single Like)', () => {
    it('records a directional like without creating a mutual connection', async () => {
      // Alex likes Jordan
      const res = await request(app)
        .post('/api/discovery/actions')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          targetStudentId: JORDAN_ID,
          mode: 'STUDY',
          action: 'LIKE',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.actionType).toBe('LIKE');
      expect(res.body.data.relationshipStatus).toBe('LIKE_SENT');
      expect(res.body.data.connectionId).toBeNull();

      // Check PostgreSQL: row in discovery_action exists
      const discRes = await query<{ action_type: string }>(
        `SELECT action_type FROM campus_duo.discovery_action
         WHERE actor_user_id = $1 AND target_user_id = $2 AND mode = 'STUDY'`,
        [ALEX_ID, JORDAN_ID]
      );
      expect(discRes.rows.length).toBe(1);
      expect(discRes.rows[0].action_type).toBe('LIKE');

      // Check PostgreSQL: NO row in connection table for this pair
      const connRes = await query(
        `SELECT connection_id FROM campus_duo.connection
         WHERE user_a_id = LEAST($1::uuid, $2::uuid) AND user_b_id = GREATEST($1::uuid, $2::uuid)
           AND mode = 'STUDY'`,
        [ALEX_ID, JORDAN_ID]
      );
      expect(connRes.rows.length).toBe(0);

      // Attempting to book a table must be rejected with 403 Forbidden
      const bookRes = await request(app)
        .post('/api/booking')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          clientOperationId: 'test-disc-single-like-fail',
          tableId: SEED_TABLE_ID,
          locationId: SEED_LOCATION_ID,
          slotId: DISCOVERY_TEST_SLOT_ID,
          companionStudentId: JORDAN_ID,
          localDate: DISCOVERY_TEST_DATE,
        });

      expect(bookRes.status).toBe(403);
      expect(bookRes.body.error.code).toBe('FORBIDDEN');
      expect(bookRes.body.error.message).toContain('No active mutual STUDY connection exists');
    });

    it('rejects self-action with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/discovery/actions')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          targetStudentId: ALEX_ID,
          mode: 'STUDY',
          action: 'LIKE',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('yourself');
    });

    it('rejects invalid target UUID with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/discovery/actions')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          targetStudentId: 'invalid-not-uuid',
          mode: 'STUDY',
          action: 'LIKE',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('2. Reciprocal Like Detection & Connection Formation (FR-05 & KAN-32)', () => {
    it('creates exactly one active mutual STUDY connection when reciprocal like occurs, and enables table booking', async () => {
      // Step 1: Alex likes Jordan
      const firstLike = await request(app)
        .post('/api/discovery/actions')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          targetStudentId: JORDAN_ID,
          mode: 'STUDY',
          action: 'LIKE',
        });
      expect(firstLike.status).toBe(200);
      expect(firstLike.body.data.relationshipStatus).toBe('LIKE_SENT');

      // Step 2: Jordan likes Alex (Reciprocal!)
      const reciprocalLike = await request(app)
        .post('/api/discovery/actions')
        .set('X-Campus-Duo-Test-Actor', JORDAN_ID)
        .send({
          targetStudentId: ALEX_ID,
          mode: 'STUDY',
          action: 'LIKE',
        });

      expect(reciprocalLike.status).toBe(200);
      expect(reciprocalLike.body.data.relationshipStatus).toBe('MUTUAL_CONNECTED');
      expect(reciprocalLike.body.data.connectionId).toBeDefined();

      // Check PostgreSQL: exactly one connection row exists
      const connRows = await query<{ connection_id: string; status: string; user_a_id: string; user_b_id: string }>(
        `SELECT connection_id, status, user_a_id, user_b_id FROM campus_duo.connection
         WHERE user_a_id = LEAST($1::uuid, $2::uuid) AND user_b_id = GREATEST($1::uuid, $2::uuid)
           AND mode = 'STUDY'`,
        [ALEX_ID, JORDAN_ID]
      );
      expect(connRows.rows.length).toBe(1);
      expect(connRows.rows[0].status).toBe('MUTUAL_CONNECTED');
      expect(connRows.rows[0].user_a_id).toBe(ALEX_ID.toLowerCase());
      expect(connRows.rows[0].user_b_id).toBe(JORDAN_ID.toLowerCase());

      // Step 3: Now booking table slot MUST succeed!
      const bookRes = await request(app)
        .post('/api/booking')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({
          clientOperationId: 'test-disc-mutual-book-success',
          tableId: SEED_TABLE_ID,
          locationId: SEED_LOCATION_ID,
          slotId: DISCOVERY_TEST_SLOT_ID,
          companionStudentId: JORDAN_ID,
          localDate: DISCOVERY_TEST_DATE,
        });

      expect(bookRes.status).toBe(201);
      expect(bookRes.body.data.status).toBe('CONFIRMED');
      expect(bookRes.body.data.participants.length).toBe(2);
      expect(bookRes.body.data.companionStudentId).toBe(JORDAN_ID.toLowerCase());

      // Verify connection listing via GET /api/discovery/connections
      const myConns = await request(app)
        .get('/api/discovery/connections?mode=STUDY')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID);

      expect(myConns.status).toBe(200);
      const jordanConn = myConns.body.data.find((c: any) => c.peerId === JORDAN_ID.toLowerCase());
      expect(jordanConn).toBeDefined();
      expect(jordanConn.status).toBe('MUTUAL_CONNECTED');
    });

    it('enforces idempotency on repeated likes without creating duplicate connections', async () => {
      // Alex likes Jordan
      await request(app)
        .post('/api/discovery/actions')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({ targetStudentId: JORDAN_ID, mode: 'STUDY', action: 'LIKE' });

      // Jordan likes Alex
      await request(app)
        .post('/api/discovery/actions')
        .set('X-Campus-Duo-Test-Actor', JORDAN_ID)
        .send({ targetStudentId: ALEX_ID, mode: 'STUDY', action: 'LIKE' });

      // Alex sends duplicate LIKE
      const repeatRes = await request(app)
        .post('/api/discovery/actions')
        .set('X-Campus-Duo-Test-Actor', ALEX_ID)
        .send({ targetStudentId: JORDAN_ID, mode: 'STUDY', action: 'LIKE' });

      expect(repeatRes.status).toBe(200);
      expect(repeatRes.body.data.relationshipStatus).toBe('MUTUAL_CONNECTED');

      // Verify exactly 1 connection row remains in database
      const conns = await query(
        `SELECT connection_id FROM campus_duo.connection
         WHERE user_a_id = LEAST($1::uuid, $2::uuid) AND user_b_id = GREATEST($1::uuid, $2::uuid)
           AND mode = 'STUDY'`,
        [ALEX_ID, JORDAN_ID]
      );
      expect(conns.rows.length).toBe(1);
    });
  });
});
