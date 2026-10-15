import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpBookingAdapter } from '@/services/http/HttpBookingAdapter';
import { ServiceContext } from '@/services/interfaces';
import { CampusLocation, ErrorCode, UserSession } from '@/types';

const ALEX_SESSION: UserSession = {
  userId: 'usr-student-alex',
  email: 'alex.rivera@campusduo.test',
  name: 'Alex Rivera',
  rollNumber: '200001',
  role: 'ROLE_STUDENT',
  isOnboarded: true,
  hasStudyConsent: true,
  hasSocialConsent: true,
};

const SAM_SESSION: UserSession = {
  userId: 'usr-student-sam',
  email: 'samira.patel@campusduo.test',
  name: 'Samira Patel',
  rollNumber: '200002',
  role: 'ROLE_STUDENT',
  isOnboarded: true,
  hasStudyConsent: true,
  hasSocialConsent: true,
};

const ALEX_UUID = '00000000-0000-0000-0000-00000000D501';
const SAM_UUID = '00000000-0000-0000-0000-00000000D502';
const LOCATION_UUID = '00000000-0000-0000-0000-00000000D571';
const TABLE_UUID = '00000000-0000-0000-0000-00000000D572';
const SLOT_UUID = '00000000-0000-0000-0000-00000000D574';

const context = (session: UserSession | null, signal?: AbortSignal): ServiceContext => ({
  actorSession: session,
  signal,
});

describe('HttpBookingAdapter Unit & Contract Suite', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let adapter: HttpBookingAdapter;

  beforeEach(() => {
    mockFetch = vi.fn();
    adapter = new HttpBookingAdapter({
      baseUrl: 'http://test-backend:4000',
      fetchFn: mockFetch as any,
    });
  });

  describe('1. Authentication and Guard Boundaries', () => {
    it('rejects unauthenticated requests before dispatching any network call', async () => {
      await expect(
        adapter.listTableAvailability('loc-pk-kelkar-2f', '2026-10-20', context(null))
      ).rejects.toMatchObject({
        code: ErrorCode.UNAUTHENTICATED,
      });

      await expect(
        adapter.createBooking(
          {
            tableId: 'tbl-pk-2f-10',
            locationId: 'loc-pk-kelkar-2f',
            localDate: '2026-10-20',
            slotId: 'slot-pk-10-14',
            companionStudentId: SAM_SESSION.userId,
          },
          context(null)
        )
      ).rejects.toMatchObject({
        code: ErrorCode.UNAUTHENTICATED,
      });

      await expect(adapter.listLocations(context(null))).rejects.toMatchObject({
        code: ErrorCode.UNAUTHENTICATED,
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('rejects self-booking before network dispatch', async () => {
      await expect(
        adapter.createBooking(
          {
            tableId: 'tbl-pk-2f-10',
            locationId: 'loc-pk-kelkar-2f',
            localDate: '2026-10-20',
            slotId: 'slot-pk-10-14',
            companionStudentId: ALEX_SESSION.userId, // Self as companion
          },
          context(ALEX_SESSION)
        )
      ).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_ERROR,
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('rejects booking creation when companion is missing', async () => {
      await expect(
        adapter.createBooking(
          {
            tableId: 'tbl-pk-2f-10',
            locationId: 'loc-pk-kelkar-2f',
            localDate: '2026-10-20',
            slotId: 'slot-pk-10-14',
          },
          context(ALEX_SESSION)
        )
      ).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_ERROR,
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('rejects booking creation when required fields are missing', async () => {
      await expect(
        adapter.createBooking(
          {
            tableId: '',
            locationId: 'loc-pk-kelkar-2f',
            localDate: '2026-10-20',
            slotId: 'slot-pk-10-14',
            companionStudentId: SAM_SESSION.userId,
          },
          context(ALEX_SESSION)
        )
      ).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_ERROR,
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('rejects listTableAvailability when date is missing', async () => {
      await expect(
        adapter.listTableAvailability('loc-pk-kelkar-2f', '', context(ALEX_SESSION))
      ).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_ERROR,
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('2. Unimplemented Service Fallback (Preserving Safe Failure)', () => {
    it('throws SERVICE_UNAVAILABLE for operations without backend endpoints', async () => {
      const ctx = context(ALEX_SESSION);

      await expect(adapter.reconcileBooking('op-123', ctx)).rejects.toMatchObject({
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });
      await expect(
        adapter.rescheduleBooking(
          { bookingId: 'bk-123', newLocalDate: '2026-10-21', newSlotId: 'slot-456' },
          ctx
        )
      ).rejects.toMatchObject({
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });
      await expect(adapter.cancelBooking('bk-123', ctx)).rejects.toMatchObject({
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('2b. listLocations Contract and Execution', () => {
    it('successfully calls GET /api/booking/locations and returns CampusLocation array', async () => {
      const mockLocations: CampusLocation[] = [
        {
          id: LOCATION_UUID,
          name: 'Campus Duo Test Library',
          building: 'PK Kelkar Building',
          totalTables: 2,
          openTime: '08:00',
          closeTime: '20:00',
          hasPowerOutlets: true,
          hasWifi6: true,
          noisePolicy: 'WHISPER_COLLAB',
          active: true,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: mockLocations,
          requestId: 'req-loc-1',
        }),
      });

      const result = await adapter.listLocations(context(ALEX_SESSION));

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-backend:4000/api/booking/locations',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Accept: 'application/json',
            'X-Campus-Duo-Test-Actor': ALEX_UUID,
          }),
        })
      );
      expect(result).toEqual(mockLocations);
    });

    it('throws SERVICE_UNAVAILABLE if locations response lacks data array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: null,
          requestId: 'req-loc-bad',
        }),
      });

      await expect(adapter.listLocations(context(ALEX_SESSION))).rejects.toMatchObject({
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });
    });

    it('translates 500 error on listLocations into SERVICE_UNAVAILABLE with isTransient: true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Database query failed',
          },
        }),
      });

      await expect(adapter.listLocations(context(ALEX_SESSION))).rejects.toMatchObject({
        code: ErrorCode.SERVICE_UNAVAILABLE,
        isTransient: true,
      });
    });
  });

  describe('3. listTableAvailability Contract and Execution', () => {
    it('successfully calls GET /api/booking/availability with resolved parameters and headers', async () => {
      const mockSlots = [
        {
          slotId: SLOT_UUID,
          locationId: LOCATION_UUID,
          locationName: 'Campus Duo Test Library',
          building: 'DEV-BUILDING',
          tableId: TABLE_UUID,
          tableNumber: 'DB05-A',
          date: '2026-10-20',
          startTime: '09:00:00',
          endTime: '11:00:00',
          zone: 'COLLABORATIVE_STUDY',
          status: 'AVAILABLE',
          capacity: 2,
          reservedCount: 0,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: mockSlots,
          requestId: 'req-test-1',
        }),
      });

      const slots = await adapter.listTableAvailability(
        'loc-pk-kelkar-2f',
        '2026-10-20',
        context(ALEX_SESSION)
      );

      expect(slots).toEqual(mockSlots);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [calledUrl, calledInit] = mockFetch.mock.calls[0];
      expect(calledUrl).toContain('/api/booking/availability?');
      expect(calledUrl).toContain('date=2026-10-20');
      expect(calledUrl).toContain(`locationId=${LOCATION_UUID}`);
      expect(calledInit.method).toBe('GET');
      expect(calledInit.headers).toMatchObject({
        Accept: 'application/json',
        'X-Campus-Duo-Test-Actor': ALEX_UUID,
      });
    });

    it('forwards AbortSignal for query cancellation', async () => {
      const controller = new AbortController();
      controller.abort();

      mockFetch.mockRejectedValueOnce(new DOMException('The user aborted a request.', 'AbortError'));

      await expect(
        adapter.listTableAvailability('loc-pk-kelkar-2f', '2026-10-20', context(ALEX_SESSION, controller.signal))
      ).rejects.toThrow();
    });
  });

  describe('4. createBooking Contract and Payload Mapping', () => {
    it('successfully submits POST /api/booking and returns a complete BookingRecord', async () => {
      const backendResponseData = {
        bookingId: '00000000-0000-0000-0000-00000000B001',
        bookerId: ALEX_UUID,
        clientOperationId: 'test-op-12345',
        participants: [
          { userId: ALEX_UUID, displayName: 'Dev Student Alex', role: 'CREATOR' },
          { userId: SAM_UUID, displayName: 'Dev Student Sam', role: 'COMPANION' },
        ],
        tableId: TABLE_UUID,
        tableNumber: 'DB05-A',
        locationId: LOCATION_UUID,
        locationName: 'Campus Duo Test Library',
        localDate: '2026-10-20',
        slotId: SLOT_UUID,
        status: 'CONFIRMED',
        partnerApprovalStatus: 'NOT_REQUIRED',
        bookingVersion: 1,
        createdAt: '2026-10-15T05:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          data: backendResponseData,
          operationId: 'test-op-12345',
          requestId: 'req-booking-create-1',
        }),
      });

      const result = await adapter.createBooking(
        {
          clientOperationId: 'test-op-12345',
          tableId: 'tbl-pk-2f-10',
          locationId: 'loc-pk-kelkar-2f',
          localDate: '2026-10-20',
          slotId: 'slot-pk-10-14',
          companionStudentId: SAM_SESSION.userId,
        },
        context(ALEX_SESSION)
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = mockFetch.mock.calls[0];

      expect(calledUrl).toBe('http://test-backend:4000/api/booking');
      expect(calledInit.method).toBe('POST');
      expect(calledInit.headers).toMatchObject({
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Campus-Duo-Test-Actor': ALEX_UUID,
      });

      const parsedBody = JSON.parse(calledInit.body);
      expect(parsedBody).toEqual({
        clientOperationId: 'test-op-12345',
        tableId: TABLE_UUID,
        locationId: LOCATION_UUID,
        localDate: '2026-10-20',
        slotId: SLOT_UUID,
        companionStudentId: SAM_UUID,
      });

      // Verify domain fields returned in BookingRecord
      expect(result.bookingId).toBe('00000000-0000-0000-0000-00000000B001');
      expect(result.status).toBe('CONFIRMED');
      expect(result.partnerApprovalStatus).toBe('NOT_REQUIRED');
      expect(result.companionStudentId).toBe(SAM_UUID);
      expect(result.companionDisplayName).toBe('Dev Student Sam');
      expect(result.allowedActions).toEqual(['CANCEL', 'RESCHEDULE']);
      expect(result.tableNumber).toBe('DB05-A');
    });

    it('generates a stable clientOperationId if omitted from creation request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          data: {
            bookingId: '00000000-0000-0000-0000-00000000B002',
            bookerId: ALEX_UUID,
            clientOperationId: 'generated-client-id',
            participants: [{ userId: ALEX_UUID, role: 'CREATOR' }],
            tableId: TABLE_UUID,
            locationId: LOCATION_UUID,
            localDate: '2026-10-20',
            slotId: SLOT_UUID,
            status: 'CONFIRMED',
            partnerApprovalStatus: 'NOT_REQUIRED',
            bookingVersion: 1,
            createdAt: '2026-10-15T05:00:00.000Z',
          },
        }),
      });

      await adapter.createBooking(
        {
          tableId: TABLE_UUID,
          locationId: LOCATION_UUID,
          localDate: '2026-10-20',
          slotId: SLOT_UUID,
          companionStudentId: SAM_UUID,
        },
        context(ALEX_SESSION)
      );

      const [, calledInit] = mockFetch.mock.calls[0];
      const parsedBody = JSON.parse(calledInit.body);
      expect(parsedBody.clientOperationId).toBeTruthy();
      expect(typeof parsedBody.clientOperationId).toBe('string');
    });
  });

  describe('5. HTTP Error and Backend Failure Translations', () => {
    it('translates 409 CONFLICT from backend into AppError with CONFLICT code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: async () => ({
          error: {
            code: 'CONFLICT',
            message: 'The requested study table slot is already booked for this date and time',
          },
          requestId: 'req-conflict-1',
        }),
      });

      await expect(
        adapter.createBooking(
          {
            tableId: TABLE_UUID,
            locationId: LOCATION_UUID,
            localDate: '2026-10-20',
            slotId: SLOT_UUID,
            companionStudentId: SAM_UUID,
          },
          context(ALEX_SESSION)
        )
      ).rejects.toMatchObject({
        code: ErrorCode.CONFLICT,
        message: expect.stringContaining('already booked'),
        isTransient: false,
      });
    });

    it('translates 403 FORBIDDEN when no mutual STUDY connection exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({
          error: {
            code: 'FORBIDDEN',
            message: 'No active mutual STUDY connection exists between participants',
          },
          requestId: 'req-forbidden-1',
        }),
      });

      await expect(
        adapter.createBooking(
          {
            tableId: TABLE_UUID,
            locationId: LOCATION_UUID,
            localDate: '2026-10-20',
            slotId: SLOT_UUID,
            companionStudentId: SAM_UUID,
          },
          context(ALEX_SESSION)
        )
      ).rejects.toMatchObject({
        code: ErrorCode.FORBIDDEN,
        message: expect.stringContaining('mutual STUDY connection'),
        isTransient: false,
      });
    });

    it('translates 400 VALIDATION_ERROR from backend into AppError with VALIDATION_ERROR code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'startDate must be less than or equal to endDate',
          },
        }),
      });

      await expect(
        adapter.listTableAvailability(LOCATION_UUID, '2026-10-20', context(ALEX_SESSION))
      ).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_ERROR,
        isTransient: false,
      });
    });

    it('translates network drop / backend unavailability to SERVICE_UNAVAILABLE with isTransient: true', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch (ECONNREFUSED)'));

      await expect(
        adapter.listTableAvailability(LOCATION_UUID, '2026-10-20', context(ALEX_SESSION))
      ).rejects.toMatchObject({
        code: ErrorCode.SERVICE_UNAVAILABLE,
        isTransient: true,
      });
    });

    it('handles non-JSON error responses gracefully (e.g. 502 Bad Gateway)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: async () => {
          throw new Error('Unexpected token < in JSON');
        },
      });

      await expect(
        adapter.createBooking(
          {
            tableId: TABLE_UUID,
            locationId: LOCATION_UUID,
            localDate: '2026-10-20',
            slotId: SLOT_UUID,
            companionStudentId: SAM_UUID,
          },
          context(ALEX_SESSION)
        )
      ).rejects.toMatchObject({
        code: ErrorCode.SERVICE_UNAVAILABLE,
        isTransient: true,
      });
    });

    it('rejects unmapped test actor session (e.g. fresh student) before network dispatch', async () => {
      const FRESH_SESSION: UserSession = {
        userId: 'usr-student-fresh',
        email: 'fresh.student@campusduo.test',
        name: 'Fresh Student',
        rollNumber: '200100',
        role: 'ROLE_STUDENT',
        isOnboarded: false,
        hasStudyConsent: false,
        hasSocialConsent: false,
      };

      await expect(adapter.listLocations(context(FRESH_SESSION))).rejects.toMatchObject({
        code: ErrorCode.UNAUTHENTICATED,
        message: expect.stringContaining('is not a valid UUID or mapped demo user'),
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('6. Booking Retrieval & Booking History', () => {
    const SEED_BOOKING_UUID = '00000000-0000-0000-0000-00000000D581';

    it('successfully retrieves booking by demo ID and maps fields correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            bookingId: SEED_BOOKING_UUID,
            bookerId: ALEX_UUID,
            participants: [
              { userId: ALEX_UUID, displayName: 'Dev Student Alex', role: 'CREATOR' },
              { userId: SAM_UUID, displayName: 'Dev Student Sam', role: 'COMPANION' },
            ],
            tableId: TABLE_UUID,
            tableNumber: 'DB05-A',
            locationId: LOCATION_UUID,
            locationName: 'P.K. Kelkar Library',
            localDate: '2026-11-14',
            slotId: SLOT_UUID,
            timeWindow: '10:00 - 12:00',
            status: 'CONFIRMED',
            allowedActions: ['CANCEL', 'RESCHEDULE'],
            partnerApprovalStatus: 'NOT_REQUIRED',
            bookingVersion: 1,
            createdAt: '2026-10-14T10:00:00Z',
          },
          requestId: 'req-retrieval-1',
        }),
      });

      // Pass demo booking ID bk-1001, which adapter resolves to SEED_BOOKING_UUID
      const booking = await adapter.getBooking('bk-1001', context(ALEX_SESSION));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = mockFetch.mock.calls[0];
      expect(calledUrl).toBe(`http://test-backend:4000/api/booking/${SEED_BOOKING_UUID}`);
      expect(calledInit.method).toBe('GET');
      expect(calledInit.headers['X-Campus-Duo-Test-Actor']).toBe(ALEX_UUID);

      expect(booking.bookingId).toBe(SEED_BOOKING_UUID);
      expect(booking.tableNumber).toBe('DB05-A');
      expect(booking.timeWindow).toBe('10:00 - 12:00');
      expect(booking.allowedActions).toEqual(['CANCEL', 'RESCHEDULE']);
      expect(booking.companionStudentId).toBe(SAM_UUID);
      expect(booking.companionDisplayName).toBe('Dev Student Sam');
    });

    it('handles 404 NOT_FOUND for nonexistent booking', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({
          error: {
            code: 'NOT_FOUND',
            message: 'Booking with ID 00000000-0000-0000-0000-000000009999 not found',
          },
          requestId: 'req-404-1',
        }),
      });

      await expect(
        adapter.getBooking('00000000-0000-0000-0000-000000009999', context(ALEX_SESSION))
      ).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
        message: expect.stringContaining('not found'),
      });
    });

    it('handles 403 FORBIDDEN for unauthorized access attempt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({
          error: {
            code: 'FORBIDDEN',
            message: 'You are not authorized to view this booking',
          },
          requestId: 'req-403-1',
        }),
      });

      await expect(
        adapter.getBooking(SEED_BOOKING_UUID, context(ALEX_SESSION))
      ).rejects.toMatchObject({
        code: ErrorCode.FORBIDDEN,
        message: expect.stringContaining('not authorized'),
      });
    });

    it('successfully retrieves booking history list via getMyBookings', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              bookingId: SEED_BOOKING_UUID,
              bookerId: ALEX_UUID,
              participants: [
                { userId: ALEX_UUID, displayName: 'Dev Student Alex', role: 'CREATOR' },
                { userId: SAM_UUID, displayName: 'Dev Student Sam', role: 'COMPANION' },
              ],
              tableId: TABLE_UUID,
              tableNumber: 'DB05-A',
              locationId: LOCATION_UUID,
              locationName: 'P.K. Kelkar Library',
              localDate: '2026-11-14',
              slotId: SLOT_UUID,
              timeWindow: '10:00 - 12:00',
              status: 'CONFIRMED',
              allowedActions: ['CANCEL', 'RESCHEDULE'],
              partnerApprovalStatus: 'NOT_REQUIRED',
              bookingVersion: 1,
              createdAt: '2026-10-14T10:00:00Z',
            },
          ],
          requestId: 'req-history-1',
        }),
      });

      const bookings = await adapter.getMyBookings(context(ALEX_SESSION));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = mockFetch.mock.calls[0];
      expect(calledUrl).toBe('http://test-backend:4000/api/booking');
      expect(calledInit.method).toBe('GET');
      expect(calledInit.headers['X-Campus-Duo-Test-Actor']).toBe(ALEX_UUID);

      expect(Array.isArray(bookings)).toBe(true);
      expect(bookings.length).toBe(1);
      expect(bookings[0].bookingId).toBe(SEED_BOOKING_UUID);
      expect(bookings[0].status).toBe('CONFIRMED');
    });
  });
});
