import { describe, it, expect, beforeAll, afterAll } from 'vitest';
// @ts-ignore - node built-in available in Vitest runner
import { execSync } from 'node:child_process';
import { HttpBookingAdapter } from '@/services/http/HttpBookingAdapter';
import { ServiceContext } from '@/services/interfaces';
import { ErrorCode, UserSession } from '@/types';

function cleanupLiveTestData() {
  try {
    execSync(
      `node -e "const { cleanupTestData, closeMigratorPool } = require('../backend/dist/tests/testDbHelper'); cleanupTestData(['frontend-live-op-%', 'frontend-concurrency-race-%']).then(() => closeMigratorPool()).catch(() => {})"`,
      { stdio: 'ignore' }
    );
  } catch {
    // ignore
  }
}

const ALEX_SESSION: UserSession = {
  userId: '00000000-0000-0000-0000-00000000D501',
  email: 'alex.rivera@campusduo.test',
  name: 'Dev Student Alex',
  role: 'ROLE_STUDENT',
  isOnboarded: true,
  hasStudyConsent: true,
  hasSocialConsent: true,
};

const SAM_ID = '00000000-0000-0000-0000-00000000D502';
const LOCATION_ID = '00000000-0000-0000-0000-00000000D571';
const TABLE_ID = '00000000-0000-0000-0000-00000000D572';

const TEST_DATE_1 = '2026-12-01';
const CONTESTED_DATE = '2026-12-15';

const context = (session: UserSession): ServiceContext => ({
  actorSession: session,
});

describe('Live PostgreSQL End-to-End Integration via HttpBookingAdapter', () => {
  let isBackendLive = false;
  let adapter: HttpBookingAdapter;

  beforeAll(async () => {
    cleanupLiveTestData();

    adapter = new HttpBookingAdapter({
      baseUrl: 'http://localhost:4000',
    });

    try {
      const res = await fetch('http://localhost:4000/api/health');
      if (res.ok) {
        const body = (await res.json()) as { status: string; database: string };
        isBackendLive = body.status === 'UP' && body.database === 'CONNECTED';
      }
    } catch {
      isBackendLive = false;
    }
  });

  afterAll(() => {
    cleanupLiveTestData();
  });

  it('verifies backend health and PostgreSQL connection status', () => {
    if (!isBackendLive) {
      console.log('NOTICE: Backend server not running on http://localhost:4000. Live PostgreSQL verification skipped (run backend dev server to execute).');
      return;
    }
    expect(isBackendLive).toBe(true);
  });

  describe('Live Availability & PostgreSQL Booking Creation', () => {
    it('queries live locations from PostgreSQL through HttpBookingAdapter', async () => {
      if (!isBackendLive) return;

      const locations = await adapter.listLocations(context(ALEX_SESSION));

      expect(Array.isArray(locations)).toBe(true);
      expect(locations.length).toBeGreaterThan(0);

      const testLib = locations.find((l) => l.id.toLowerCase() === LOCATION_ID.toLowerCase());
      expect(testLib).toBeDefined();
      expect(testLib?.name).toContain('Campus Duo Test Library');
      expect(testLib?.building).toBeTruthy();
      expect(testLib?.totalTables).toBe(2);
      expect(testLib?.openTime).toBe('08:00');
      expect(testLib?.closeTime).toBe('20:00');
      expect(testLib?.noisePolicy).toBe('WHISPER_COLLAB');
    });

    it('queries live table availability from PostgreSQL through HttpBookingAdapter', async () => {
      if (!isBackendLive) return;

      const slots = await adapter.listTableAvailability(LOCATION_ID, TEST_DATE_1, context(ALEX_SESSION));

      expect(Array.isArray(slots)).toBe(true);
      expect(slots.length).toBeGreaterThan(0);

      const firstSlot = slots[0];
      expect(firstSlot).toBeDefined();
      expect(firstSlot.locationId.toLowerCase()).toBe(LOCATION_ID.toLowerCase());
      expect(firstSlot.date).toBe(TEST_DATE_1);
      expect(firstSlot.tableNumber).toBeTruthy();
    });

    it('creates a confirmed booking and verifies live PostgreSQL persistence', async () => {
      if (!isBackendLive) return;

      // Dynamically select an available slot
      const initialSlots = await adapter.listTableAvailability(LOCATION_ID, TEST_DATE_1, context(ALEX_SESSION));
      const availableSlot = initialSlots.find((s) => s.status === 'AVAILABLE');
      expect(availableSlot).toBeDefined();

      const chosenSlotId = availableSlot!.slotId;
      const chosenTableId = availableSlot!.tableId || TABLE_ID;
      const clientOpId = `frontend-live-op-${Date.now()}`;

      // 1. Submit booking via adapter
      const booking = await adapter.createBooking(
        {
          clientOperationId: clientOpId,
          tableId: chosenTableId,
          locationId: LOCATION_ID,
          localDate: TEST_DATE_1,
          slotId: chosenSlotId,
          companionStudentId: SAM_ID,
        },
        context(ALEX_SESSION)
      );

      expect(booking.bookingId).toBeTruthy();
      expect(booking.status).toBe('CONFIRMED');
      expect(booking.partnerApprovalStatus).toBe('NOT_REQUIRED');
      expect(booking.participants).toHaveLength(2);
      expect(booking.allowedActions).toContain('CANCEL');
      expect(booking.allowedActions).toContain('RESCHEDULE');

      // 2. Re-query availability: PostgreSQL must now report this slot as OCCUPIED (reservedCount: 2)
      const updatedSlots = await adapter.listTableAvailability(LOCATION_ID, TEST_DATE_1, context(ALEX_SESSION));
      const bookedSlot = updatedSlots.find((s) => s.slotId.toLowerCase() === chosenSlotId.toLowerCase());
      expect(bookedSlot).toBeDefined();
      expect(bookedSlot?.status).toBe('OCCUPIED');
      expect(bookedSlot?.reservedCount).toBe(2);

      // 3. Idempotent replay: submitting identical operation ID returns cached outcome
      const replayBooking = await adapter.createBooking(
        {
          clientOperationId: clientOpId,
          tableId: chosenTableId,
          locationId: LOCATION_ID,
          localDate: TEST_DATE_1,
          slotId: chosenSlotId,
          companionStudentId: SAM_ID,
        },
        context(ALEX_SESSION)
      );

      expect(replayBooking.bookingId).toBe(booking.bookingId);
      expect(replayBooking.status).toBe('CONFIRMED');

      // 4. Reject duplicate booking attempt with different operation ID with 409 CONFLICT
      const newOpId = `frontend-conflict-op-${Date.now()}`;
      await expect(
        adapter.createBooking(
          {
            clientOperationId: newOpId,
            tableId: chosenTableId,
            locationId: LOCATION_ID,
            localDate: TEST_DATE_1,
            slotId: chosenSlotId,
            companionStudentId: SAM_ID,
          },
          context(ALEX_SESSION)
        )
      ).rejects.toMatchObject({
        code: ErrorCode.CONFLICT,
        isTransient: false,
      });
    });
  });

  describe('Live PostgreSQL Concurrency Race Condition via HttpBookingAdapter', () => {
    it('executes 5 simultaneous booking attempts targeting the same slot: exactly 1 succeeds and 4 receive CONFLICT', async () => {
      if (!isBackendLive) return;

      const initialSlots = await adapter.listTableAvailability(LOCATION_ID, CONTESTED_DATE, context(ALEX_SESSION));
      const availableSlot = initialSlots.find((s) => s.status === 'AVAILABLE');
      expect(availableSlot).toBeDefined();

      const contestedSlotId = availableSlot!.slotId;
      const contestedTableId = availableSlot!.tableId || TABLE_ID;

      const CONCURRENCY_COUNT = 5;
      const clientOpIds = Array.from(
        { length: CONCURRENCY_COUNT },
        (_, i) => `frontend-concurrency-race-${Date.now()}-${i + 1}`
      );

      // Launch 5 concurrent requests simultaneously through the frontend HTTP adapter
      const promises = clientOpIds.map((opId) =>
        adapter
          .createBooking(
            {
              clientOperationId: opId,
              tableId: contestedTableId,
              locationId: LOCATION_ID,
              localDate: CONTESTED_DATE,
              slotId: contestedSlotId,
              companionStudentId: SAM_ID,
            },
            context(ALEX_SESSION)
          )
          .then((res) => ({ status: 'fulfilled' as const, value: res }))
          .catch((err) => ({ status: 'rejected' as const, reason: err }))
      );

      const results = await Promise.all(promises);

      const successes = results.filter((r) => r.status === 'fulfilled');
      const rejections = results.filter((r) => r.status === 'rejected');

      // Assert that exactly ONE concurrent attempt succeeded
      expect(successes).toHaveLength(1);

      // Assert that all other concurrent attempts rejected with 409 CONFLICT
      expect(rejections).toHaveLength(CONCURRENCY_COUNT - 1);

      for (const rejection of rejections) {
        expect(rejection.reason).toMatchObject({
          code: ErrorCode.CONFLICT,
          isTransient: false,
        });
      }

      // Live verification: slot in PostgreSQL is now OCCUPIED
      const slots = await adapter.listTableAvailability(LOCATION_ID, CONTESTED_DATE, context(ALEX_SESSION));
      const contestedSlot = slots.find((s) => s.slotId.toLowerCase() === contestedSlotId.toLowerCase());
      expect(contestedSlot).toBeDefined();
      expect(contestedSlot?.status).toBe('OCCUPIED');
      expect(contestedSlot?.reservedCount).toBe(2);
    });

    it('retrieves live booking detail and history via HttpBookingAdapter', async () => {
      if (!isBackendLive) return;

      const seedBookingId = '00000000-0000-0000-0000-00000000d581';

      // 1. Retrieve booking using demo ID bk-1001 (mapped to seed UUID)
      const booking = await adapter.getBooking('bk-1001', context(ALEX_SESSION));
      expect(booking).toBeDefined();
      expect(booking.bookingId.toLowerCase()).toBe(seedBookingId);
      expect(booking.status).toBe('CONFIRMED');
      expect(booking.tableNumber).toBe('DB05-A');
      expect(booking.allowedActions).toContain('CANCEL');

      // 2. Retrieve booking history
      const history = await adapter.getMyBookings(context(ALEX_SESSION));
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThanOrEqual(1);

      const found = history.find((b) => b.bookingId.toLowerCase() === seedBookingId);
      expect(found).toBeDefined();
      expect(found?.status).toBe('CONFIRMED');
    });

    it('enforces booking retrieval authorization against live PostgreSQL (Jordan cannot view Alex/Sam booking)', async () => {
      if (!isBackendLive) return;

      const JORDAN_SESSION: UserSession = {
        userId: '00000000-0000-0000-0000-00000000D503',
        email: 'jordan.taylor@campusduo.test',
        name: 'Dev Student Jordan',
        role: 'ROLE_STUDENT',
        isOnboarded: true,
        hasStudyConsent: true,
        hasSocialConsent: true,
      };

      const seedBookingId = '00000000-0000-0000-0000-00000000d581';

      await expect(
        adapter.getBooking(seedBookingId, context(JORDAN_SESSION))
      ).rejects.toMatchObject({
        code: ErrorCode.FORBIDDEN,
      });
    });
  });
});
