import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { closeDbPool, query } from '../src/config/db';

const ADMIN_ACTOR_ID = '00000000-0000-0000-0000-00000000D599'; // Campus Duo Administrator (ROLE_ADMIN)
const STUDENT_ACTOR_ID = '00000000-0000-0000-0000-00000000D501'; // Dev Student Alex (ROLE_STUDENT)
const SEED_LOCATION_ID = '00000000-0000-0000-0000-00000000D571';
const SEED_TABLE_ID = '00000000-0000-0000-0000-00000000D572';

describe('Admin Resource & Inventory Management API', () => {
  beforeEach(async () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_TEST_HARNESS_AUTH = 'true';
    await query(`UPDATE campus_duo.study_location SET active = true WHERE location_id = $1`, [SEED_LOCATION_ID]);
    await query(`UPDATE campus_duo.study_table SET active = true WHERE location_id = $1`, [SEED_LOCATION_ID]);
  });

  afterAll(async () => {
    try {
      await query(`
        DELETE FROM campus_duo.study_slot 
        WHERE local_date IN ('2026-12-25', '2026-12-28')
      `);
      await query(`
        DELETE FROM campus_duo.study_table 
        WHERE location_id = $1
          AND table_id NOT IN ('00000000-0000-0000-0000-00000000d572', '00000000-0000-0000-0000-00000000d573')
      `, [SEED_LOCATION_ID]);
      await query(`
        DELETE FROM campus_duo.study_table 
        WHERE location_id NOT IN ('00000000-0000-0000-0000-00000000d571', '9b159828-c470-4dab-9ba0-a6b8610dafeb')
      `);
      await query(`
        DELETE FROM campus_duo.study_location 
        WHERE location_id NOT IN ('00000000-0000-0000-0000-00000000d571', '9b159828-c470-4dab-9ba0-a6b8610dafeb')
      `);
      await query(`UPDATE campus_duo.study_location SET active = true WHERE location_id = $1`, [SEED_LOCATION_ID]);
      await query(`UPDATE campus_duo.study_table SET active = true WHERE location_id = $1`, [SEED_LOCATION_ID]);
      await query(`UPDATE campus_duo.study_slot SET active = true, status = 'AVAILABLE' WHERE location_id = $1`, [SEED_LOCATION_ID]);
      await query(`UPDATE campus_duo.booking SET status = 'CONFIRMED', cancelled_at = NULL, cancelled_by = NULL, cancellation_reason = NULL WHERE booking_id = '00000000-0000-0000-0000-00000000d581'`);
    } finally {
      await closeDbPool();
    }
  });

  describe('RBAC Authorization Boundaries', () => {
    it('rejects unauthenticated requests with 401 UNAUTHENTICATED', async () => {
      const res = await request(app).get('/api/admin/resources');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rejects student role requests with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get('/api/admin/resources')
        .set('X-Campus-Duo-Test-Actor', STUDENT_ACTOR_ID);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows admin role requests with 200 OK', async () => {
      const res = await request(app)
        .get('/api/admin/resources')
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/admin/tables and POST /api/admin/tables', () => {
    it('lists tables with location metadata for admin', async () => {
      const res = await request(app)
        .get('/api/admin/tables')
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const seedTable = res.body.data.find((t: any) => t.tableId === SEED_TABLE_ID.toLowerCase());
      expect(seedTable).toBeDefined();
      expect(seedTable.locationName).toBeDefined();
      expect(seedTable.tableNumber).toBe('DB05-A');
    });

    it('auto-generates next table number when creating a table', async () => {
      const res = await request(app)
        .post('/api/admin/tables')
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID)
        .send({
          locationId: SEED_LOCATION_ID,
          hasPowerOutlets: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('tableId');
      expect(res.body.data).toHaveProperty('tableNumber');
      expect(res.body.data.locationId).toBe(SEED_LOCATION_ID.toLowerCase());
      expect(res.body.data.active).toBe(true);
    });

    it('rejects table creation for nonexistent location with 404 NOT_FOUND', async () => {
      const res = await request(app)
        .post('/api/admin/tables')
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID)
        .send({
          locationId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
          hasPowerOutlets: true,
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/admin/slots and POST /api/admin/slots', () => {
    it('lists existing fixed slots with location and table details', async () => {
      const res = await request(app)
        .get('/api/admin/slots')
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      const slot = res.body.data[0];
      expect(slot).toHaveProperty('slotId');
      expect(slot).toHaveProperty('locationName');
      expect(slot).toHaveProperty('tableNumber');
      expect(slot).toHaveProperty('startTime');
      expect(slot).toHaveProperty('endTime');
      expect(slot).toHaveProperty('date');
    });

    it('rejects slot creation outside location operating hours with 400 VALIDATION_ERROR', async () => {
      // Seed location operating hours are 08:00 to 20:00
      const res = await request(app)
        .post('/api/admin/slots')
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID)
        .send({
          locationId: SEED_LOCATION_ID,
          tableId: SEED_TABLE_ID,
          date: '2026-12-25',
          startTime: '06:00',
          endTime: '08:00',
          zone: 'COLLABORATIVE_STUDY',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('operating hours');
    });

    it('creates slot within operating hours and rejects overlapping slot with 409 CONFLICT', async () => {
      const testDate = '2026-12-28';
      // 1. Create initial slot
      const createRes = await request(app)
        .post('/api/admin/slots')
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID)
        .send({
          locationId: SEED_LOCATION_ID,
          tableId: SEED_TABLE_ID,
          date: testDate,
          startTime: '10:00',
          endTime: '12:00',
          zone: 'COLLABORATIVE_STUDY',
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.startTime).toBe('10:00');

      // 2. Overlapping slot: 11:00 to 13:00 on same table and date
      const overlapRes = await request(app)
        .post('/api/admin/slots')
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID)
        .send({
          locationId: SEED_LOCATION_ID,
          tableId: SEED_TABLE_ID,
          date: testDate,
          startTime: '11:00',
          endTime: '13:00',
          zone: 'COLLABORATIVE_STUDY',
        });

      expect(overlapRes.status).toBe(409);
      expect(overlapRes.body.error.code).toBe('CONFLICT');
      expect(overlapRes.body.error.message).toContain('overlaps');
    });
  });

  describe('PUT /api/admin/locations/:id Table Reconciliation', () => {
    it('validates operating hours start must be before end', async () => {
      const res = await request(app)
        .put(`/api/admin/locations/${SEED_LOCATION_ID}`)
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID)
        .send({
          name: 'Test Library',
          building: 'DEV-BUILDING',
          totalTables: 2,
          openTime: '22:00',
          closeTime: '08:00', // Invalid: close before open
          hasPowerOutlets: true,
          hasWifi6: true,
          noisePolicy: 'WHISPER_COLLAB',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('openTime must be before closeTime');
    });

    it('reconciles table count upward by provisioning tables', async () => {
      const res = await request(app)
        .put(`/api/admin/locations/${SEED_LOCATION_ID}`)
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID)
        .send({
          name: '[SYNTHETIC DEV SEED] Campus Duo Test Library',
          building: '[SYNTHETIC] DEV-BUILDING',
          totalTables: 5,
          openTime: '08:00',
          closeTime: '20:00',
          hasPowerOutlets: true,
          hasWifi6: true,
          noisePolicy: 'WHISPER_COLLAB',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.totalTables).toBe(5);

      // Verify resources report 5 tables
      const resourcesRes = await request(app)
        .get('/api/admin/resources')
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID);
      const loc = resourcesRes.body.data.find((l: any) => l.locationId === SEED_LOCATION_ID.toLowerCase());
      expect(loc.tableCount).toBe(5);
    });
  });

  describe('Location Lifecycle: POST /api/admin/locations and Deactivation', () => {
    let createdLocationId: string | null = null;

    it('rejects student role creating location with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/api/admin/locations')
        .set('X-Campus-Duo-Test-Actor', STUDENT_ACTOR_ID)
        .send({
          name: 'Student Unauthorized Location',
          building: 'Hall 5',
          openTime: '08:00',
          closeTime: '22:00',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('validates operating hours when creating location (openTime must be before closeTime)', async () => {
      const res = await request(app)
        .post('/api/admin/locations')
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID)
        .send({
          name: 'Invalid Hours Pod',
          building: 'Hall 5',
          openTime: '22:00',
          closeTime: '08:00',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('openTime must be before closeTime');
    });

    it('creates location and auto-provisions tables in PostgreSQL', async () => {
      const res = await request(app)
        .post('/api/admin/locations')
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID)
        .send({
          name: '[INTEG TEST] Engineering Quad Study Pod',
          building: 'ACES Complex',
          totalTables: 2,
          openTime: '09:00',
          closeTime: '21:00',
          hasPowerOutlets: true,
          hasWifi6: true,
          noisePolicy: 'WHISPER_COLLAB',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      createdLocationId = res.body.data.id;
      expect(res.body.data.name).toBe('[INTEG TEST] Engineering Quad Study Pod');
      expect(res.body.data.totalTables).toBe(2);

      // Verify tables were created in PostgreSQL
      const tblRes = await query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM campus_duo.study_table WHERE location_id = $1`,
        [createdLocationId]
      );
      expect(parseInt(tblRes.rows[0].count, 10)).toBe(2);
    });

    it('safely deactivates unbooked location and disables tables and future slots', async () => {
      expect(createdLocationId).toBeDefined();

      const deactRes = await request(app)
        .post(`/api/admin/locations/${createdLocationId}/deactivate`)
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID)
        .send({ reason: 'Maintenance renovation' });

      expect(deactRes.status).toBe(200);
      expect(deactRes.body.data.success).toBe(true);

      // Verify location and tables in DB are inactive
      const locDb = await query<{ active: boolean }>(
        `SELECT active FROM campus_duo.study_location WHERE location_id = $1`,
        [createdLocationId]
      );
      expect(locDb.rows[0].active).toBe(false);

      const tblDb = await query<{ active: boolean }>(
        `SELECT active FROM campus_duo.study_table WHERE location_id = $1`,
        [createdLocationId]
      );
      expect(tblDb.rows.every((t) => !t.active)).toBe(true);
    });

    it('prevents deactivation of a location that has active future confirmed bookings (409 CONFLICT)', async () => {
      // Ensure SEED_LOCATION_ID contains active CONFIRMED seed booking
      await query(`UPDATE campus_duo.booking SET status = 'CONFIRMED', cancelled_at = NULL, cancelled_by = NULL, cancellation_reason = NULL WHERE booking_id = '00000000-0000-0000-0000-00000000d581'`);

      const res = await request(app)
        .post(`/api/admin/locations/${SEED_LOCATION_ID}/deactivate`)
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID)
        .send({ reason: 'Attempt unsafe shutdown' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('future confirmed bookings exist');
    });
  });

  describe('Table Lifecycle: PUT /api/admin/tables/:id and Status Deactivation', () => {
    let testTableId: string | null = null;

    it('rejects student role modifying table with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .put(`/api/admin/tables/${SEED_TABLE_ID}`)
        .set('X-Campus-Duo-Test-Actor', STUDENT_ACTOR_ID)
        .send({ hasPowerOutlets: false });

      expect(res.status).toBe(403);
    });

    it('allows admin to update table attributes', async () => {
      // First create a dedicated test table
      const createRes = await request(app)
        .post('/api/admin/tables')
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID)
        .send({
          locationId: SEED_LOCATION_ID,
          hasPowerOutlets: false,
        });
      expect(createRes.status).toBe(201);
      testTableId = createRes.body.data.tableId;

      const updateRes = await request(app)
        .put(`/api/admin/tables/${testTableId}`)
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID)
        .send({
          hasPowerOutlets: true,
          tableNumber: 'TEST-TBL-99',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.hasPowerOutlets).toBe(true);
      expect(updateRes.body.data.tableNumber).toBe('TEST-TBL-99');
    });

    it('allows deactivating an unbooked table via POST /api/admin/tables/:id/status', async () => {
      expect(testTableId).toBeDefined();

      const deactRes = await request(app)
        .post(`/api/admin/tables/${testTableId}/status`)
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID)
        .send({ active: false, reason: 'Bench repair' });

      expect(deactRes.status).toBe(200);

      const chk = await query<{ active: boolean }>(
        `SELECT active FROM campus_duo.study_table WHERE table_id = $1`,
        [testTableId]
      );
      expect(chk.rows[0].active).toBe(false);
    });

    it('rejects deactivating a table with active future confirmed bookings (409 CONFLICT)', async () => {
      // Ensure SEED_TABLE_ID holds confirmed booking
      await query(`UPDATE campus_duo.booking SET status = 'CONFIRMED', cancelled_at = NULL, cancelled_by = NULL, cancellation_reason = NULL WHERE booking_id = '00000000-0000-0000-0000-00000000d581'`);

      const res = await request(app)
        .post(`/api/admin/tables/${SEED_TABLE_ID}/status`)
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID)
        .send({ active: false, reason: 'Illegal table shutdown' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('future confirmed bookings exist');
    });
  });

  describe('Slot Lifecycle: Status Deactivation, Operating Hours, and Overlap Updates', () => {
    let testSlotId: string | null = null;
    const slotDate = '2026-12-25';

    it('creates a slot and allows deactivating it via POST /api/admin/slots/:id/status', async () => {
      const createRes = await request(app)
        .post('/api/admin/slots')
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID)
        .send({
          locationId: SEED_LOCATION_ID,
          tableId: SEED_TABLE_ID,
          date: slotDate,
          startTime: '09:00',
          endTime: '11:00',
          zone: 'SILENT_READING',
        });
      expect(createRes.status).toBe(201);
      testSlotId = createRes.body.data.slotId;

      const deactRes = await request(app)
        .post(`/api/admin/slots/${testSlotId}/status`)
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID)
        .send({ active: false, reason: 'Maintenance hold' });

      expect(deactRes.status).toBe(200);

      const chk = await query<{ active: boolean; status: string }>(
        `SELECT active, status FROM campus_duo.study_slot WHERE slot_id = $1`,
        [testSlotId]
      );
      expect(chk.rows[0].active).toBe(false);
      expect(chk.rows[0].status).toBe('LOCKED_MAINTENANCE');
    });

    it('reactivates the slot and allows updating zone and non-conflicting time window', async () => {
      expect(testSlotId).toBeDefined();

      // Reactivate
      await request(app)
        .post(`/api/admin/slots/${testSlotId}/status`)
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID)
        .send({ active: true });

      // Update slot time from 09:00-11:00 to 14:00-16:00
      const updateRes = await request(app)
        .put(`/api/admin/slots/${testSlotId}`)
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID)
        .send({
          startTime: '14:00',
          endTime: '16:00',
          zone: 'COLLABORATIVE_STUDY',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.startTime).toBe('14:00');
      expect(updateRes.body.data.endTime).toBe('16:00');
      expect(updateRes.body.data.zone).toBe('COLLABORATIVE_STUDY');
    });

    it('rejects editing slot with end time after location operating hours (400 VALIDATION_ERROR)', async () => {
      expect(testSlotId).toBeDefined();
      // SEED_LOCATION closes at 20:00. End time 21:00 must be rejected.
      const res = await request(app)
        .put(`/api/admin/slots/${testSlotId}`)
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID)
        .send({
          startTime: '18:00',
          endTime: '21:00',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('operating hours');
    });

    it('rejects editing slot with start time before location operating hours (400 VALIDATION_ERROR)', async () => {
      expect(testSlotId).toBeDefined();
      // SEED_LOCATION opens at 08:00. Start time 07:00 must be rejected.
      const res = await request(app)
        .put(`/api/admin/slots/${testSlotId}`)
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID)
        .send({
          startTime: '07:00',
          endTime: '09:00',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('operating hours');
    });

    it('rejects editing slot to overlap another slot on the same table (409 CONFLICT)', async () => {
      expect(testSlotId).toBeDefined();
      // Create second slot on same table and date: 16:00 to 18:00
      const s2 = await request(app)
        .post('/api/admin/slots')
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID)
        .send({
          locationId: SEED_LOCATION_ID,
          tableId: SEED_TABLE_ID,
          date: slotDate,
          startTime: '16:00',
          endTime: '18:00',
          zone: 'COLLABORATIVE_STUDY',
        });
      expect(s2.status).toBe(201);

      // Attempt to move testSlotId (currently 14:00-16:00) to 15:30-17:30 (overlaps s2)
      const res = await request(app)
        .put(`/api/admin/slots/${testSlotId}`)
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID)
        .send({
          startTime: '15:30',
          endTime: '17:30',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('overlaps');
    });

    it('rejects deactivating or altering time for a slot with confirmed bookings (409 CONFLICT)', async () => {
      // SEED_SLOT has active booking bk-1001 with status CONFIRMED
      const seedSlotId = '00000000-0000-0000-0000-00000000D574';
      await query(`UPDATE campus_duo.booking SET status = 'CONFIRMED', cancelled_at = NULL, cancelled_by = NULL, cancellation_reason = NULL WHERE booking_id = '00000000-0000-0000-0000-00000000d581'`);

      const deactRes = await request(app)
        .post(`/api/admin/slots/${seedSlotId}/status`)
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID)
        .send({ active: false, reason: 'Illegal slot lockdown' });

      expect(deactRes.status).toBe(409);
      expect(deactRes.body.error.code).toBe('CONFLICT');
      expect(deactRes.body.error.message).toContain('confirmed booking already exists');

      // Altering time must also be rejected
      const timeRes = await request(app)
        .put(`/api/admin/slots/${seedSlotId}`)
        .set('X-Campus-Duo-Test-Actor', ADMIN_ACTOR_ID)
        .send({ startTime: '09:00', endTime: '11:00' });

      expect(timeRes.status).toBe(409);
      expect(timeRes.body.error.code).toBe('CONFLICT');
      expect(timeRes.body.error.message).toContain('confirmed booking already exists');
    });
  });

  describe('Deterministic Availability Filtering (Location & Date Isolation)', () => {
    it('returns slot only for its exact location and date, never leaking across locations', async () => {
      const availDate = '2026-12-25';
      // Query availability for SEED_LOCATION_ID
      const loc1Res = await request(app)
        .get(`/api/booking/availability?locationId=${SEED_LOCATION_ID}&date=${availDate}`)
        .set('X-Campus-Duo-Test-Actor', STUDENT_ACTOR_ID);

      expect(loc1Res.status).toBe(200);
      expect(Array.isArray(loc1Res.body.data)).toBe(true);
      expect(loc1Res.body.data.length).toBeGreaterThan(0);
      expect(loc1Res.body.data.every((s: any) => s.locationId === SEED_LOCATION_ID.toLowerCase())).toBe(true);

      // Query availability for a different (empty) location or nonexistent date
      const emptyRes = await request(app)
        .get(`/api/booking/availability?locationId=${SEED_LOCATION_ID}&date=2026-01-01`)
        .set('X-Campus-Duo-Test-Actor', STUDENT_ACTOR_ID);

      expect(emptyRes.status).toBe(200);
      expect(emptyRes.body.data).toEqual([]);
    });
  });
});
