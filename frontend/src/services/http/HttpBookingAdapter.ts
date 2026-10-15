import { IBookingService, ServiceContext } from '@/services/interfaces';
import {
  CampusLocation,
  StudyTableSlot,
  BookingRecord,
  BookingCreationRequest,
  BookingRescheduleRequest,
  BookingParticipant,
  AppError,
  ErrorCode,
  AppErrorCode,
} from '@/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Mapping for fictional frontend demo IDs to DB-05 seed UUID fixtures
const DEMO_USER_MAP: Record<string, string> = {
  'usr-student-alex': '00000000-0000-0000-0000-00000000D501',
  'usr-student-sam': '00000000-0000-0000-0000-00000000D502',
  'usr-student-jordan': '00000000-0000-0000-0000-00000000D503',
  'usr-admin-senate': '00000000-0000-0000-0000-00000000D599',
};

const DEMO_LOCATION_MAP: Record<string, string> = {
  'loc-pk-kelkar-2f': '00000000-0000-0000-0000-00000000D571',
};

const DEMO_TABLE_MAP: Record<string, string> = {
  'tbl-pk-2f-10': '00000000-0000-0000-0000-00000000D572',
  'tbl-pk-2f-11': '00000000-0000-0000-0000-00000000D573',
};

const DEMO_SLOT_MAP: Record<string, string> = {
  'slot-pk-10-14': '00000000-0000-0000-0000-00000000D574',
};

const DEMO_BOOKING_MAP: Record<string, string> = {
  'bk-1001': '00000000-0000-0000-0000-00000000D581',
  'bk-1002': '00000000-0000-0000-0000-00000000D582',
  'bk-existing-99': '00000000-0000-0000-0000-00000000D582',
};

function resolveUserId(id: string): string {
  if (UUID_REGEX.test(id)) return id;
  return DEMO_USER_MAP[id] || id;
}

function resolveLocationId(id: string): string {
  if (UUID_REGEX.test(id)) return id;
  return DEMO_LOCATION_MAP[id] || id;
}

function resolveTableId(id: string): string {
  if (UUID_REGEX.test(id)) return id;
  return DEMO_TABLE_MAP[id] || id;
}

function resolveSlotId(id: string): string {
  if (UUID_REGEX.test(id)) return id;
  return DEMO_SLOT_MAP[id] || id;
}

function resolveBookingId(id: string): string {
  if (UUID_REGEX.test(id)) return id;
  return DEMO_BOOKING_MAP[id] || id;
}

export interface HttpBookingAdapterOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

/**
 * Concrete HTTP adapter connecting frontend booking UI to the Express backend API.
 * Communicates with GET /api/booking/availability and POST /api/booking against PostgreSQL persistence.
 */
export class HttpBookingAdapter implements IBookingService {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options?: HttpBookingAdapterOptions) {
    const rawBaseUrl =
      options?.baseUrl ??
      import.meta.env.VITE_API_URL ??
      import.meta.env.VITE_API_BASE_URL ??
      'http://localhost:4000';
    this.baseUrl = rawBaseUrl.replace(/\/+$/, '');
    this.fetchFn =
      options?.fetchFn ??
      (typeof window !== 'undefined' ? window.fetch.bind(window) : globalThis.fetch);
  }

  private getAuthHeaders(context: ServiceContext, extraHeaders?: Record<string, string>): Record<string, string> {
    const actor = context.actorSession;
    if (!actor || !actor.userId) {
      throw new AppError(
        ErrorCode.UNAUTHENTICATED,
        'Authentication required: missing active user session.'
      );
    }

    const actorId = resolveUserId(actor.userId);
    if (!UUID_REGEX.test(actorId)) {
      throw new AppError(
        ErrorCode.UNAUTHENTICATED,
        `Cannot authenticate live booking session: test actor "${actor.userId}" is not a valid UUID or mapped demo user.`
      );
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Campus-Duo-Test-Actor': actorId,
      ...extraHeaders,
    };
    if (actor.sessionToken) {
      headers['Authorization'] = `Bearer ${actor.sessionToken}`;
    }
    return headers;
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    if (res.ok) {
      const body = await res.json();
      return body as T;
    }

    let errorData: any = null;
    try {
      errorData = await res.json();
    } catch {
      // Non-JSON response body
    }

    const backendCode = errorData?.error?.code;
    const backendMessage = errorData?.error?.message;
    const backendDetails = errorData?.error?.details;

    let errorCode: AppErrorCode = ErrorCode.SERVICE_UNAVAILABLE;

    if (backendCode && backendCode in ErrorCode) {
      errorCode = backendCode as AppErrorCode;
    } else {
      switch (res.status) {
        case 400:
          errorCode = ErrorCode.VALIDATION_ERROR;
          break;
        case 401:
          errorCode = ErrorCode.UNAUTHENTICATED;
          break;
        case 403:
          errorCode = ErrorCode.FORBIDDEN;
          break;
        case 404:
          errorCode = ErrorCode.NOT_FOUND;
          break;
        case 409:
          errorCode = ErrorCode.CONFLICT;
          break;
        case 503:
        default:
          errorCode = ErrorCode.SERVICE_UNAVAILABLE;
      }
    }

    const message =
      backendMessage || `HTTP error ${res.status}: ${res.statusText || 'Request failed'}`;
    const isTransient = res.status >= 500 || errorCode === ErrorCode.SERVICE_UNAVAILABLE;

    throw new AppError(errorCode, message, {
      details: backendDetails,
      isTransient,
    });
  }

  private async executeRequest<T>(
    endpoint: string,
    options: RequestInit,
    context: ServiceContext
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    try {
      const res = await this.fetchFn(url, {
        ...options,
        signal: context.signal,
      });
      return await this.handleResponse<T>(res);
    } catch (err: any) {
      if (err instanceof AppError) {
        throw err;
      }
      if (err?.name === 'AbortError' || context.signal?.aborted) {
        throw err;
      }
      throw new AppError(
        ErrorCode.SERVICE_UNAVAILABLE,
        `Backend booking service is unavailable: ${err?.message || 'Connection failed'}`,
        { isTransient: true }
      );
    }
  }

  /**
   * Retrieves live slot occupancy for a given campus date and optional location.
   * Directly calls GET /api/booking/availability on the Express backend.
   */
  public async listTableAvailability(
    locationId: string,
    date: string,
    context: ServiceContext
  ): Promise<StudyTableSlot[]> {
    if (!date) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Date is required to check table availability');
    }

    const headers = this.getAuthHeaders(context);
    const resolvedLoc = locationId ? resolveLocationId(locationId) : undefined;

    const params = new URLSearchParams();
    params.set('date', date);
    if (resolvedLoc) {
      params.set('locationId', resolvedLoc);
    }

    const endpoint = `/api/booking/availability?${params.toString()}`;
    const response = await this.executeRequest<{ data: StudyTableSlot[]; requestId: string }>(
      endpoint,
      {
        method: 'GET',
        headers,
      },
      context
    );

    if (!response || !Array.isArray(response.data)) {
      throw new AppError(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Invalid response format from availability endpoint: missing data array'
      );
    }

    return response.data;
  }

  /**
   * Atomically books a two-person study table reservation with idempotency protection.
   * Calls POST /api/booking on the Express backend and persists to PostgreSQL.
   */
  public async createBooking(
    request: BookingCreationRequest,
    context: ServiceContext
  ): Promise<BookingRecord> {
    const headers = this.getAuthHeaders(context, {
      'Content-Type': 'application/json',
    });

    const actorId = resolveUserId(context.actorSession!.userId);

    if (!request.companionStudentId) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'A study companion is required to book a 2-person table'
      );
    }

    const companionId = resolveUserId(request.companionStudentId);

    if (companionId.toLowerCase() === actorId.toLowerCase()) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Self-booking is prohibited. Duo tables require exactly two distinct participants.'
      );
    }

    if (!request.tableId || !request.locationId || !request.localDate || !request.slotId) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Missing required booking fields (tableId, locationId, localDate, slotId)'
      );
    }

    const clientOperationId =
      request.clientOperationId?.trim() ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `op-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    const payload = {
      clientOperationId,
      tableId: resolveTableId(request.tableId),
      locationId: resolveLocationId(request.locationId),
      localDate: request.localDate,
      slotId: resolveSlotId(request.slotId),
      companionStudentId: companionId,
    };

    const response = await this.executeRequest<{
      data: any;
      operationId?: string;
      requestId: string;
    }>(
      '/api/booking',
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      },
      context
    );

    if (!response || !response.data || !response.data.bookingId) {
      throw new AppError(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Invalid response payload from booking creation: missing booking record'
      );
    }

    return this.mapToBookingRecord(response.data, context, clientOperationId, payload);
  }

  private mapToBookingRecord(
    raw: any,
    context: ServiceContext,
    fallbackOperationId?: string,
    fallbackPayload?: { tableId?: string; locationId?: string; localDate?: string; slotId?: string; companionStudentId?: string }
  ): BookingRecord {
    const actorSession = context.actorSession;
    const actorId = actorSession?.userId ? resolveUserId(actorSession.userId) : '';
    const actorIdLower = actorId.toLowerCase();

    const participants: BookingParticipant[] = Array.isArray(raw.participants) && raw.participants.length > 0
      ? raw.participants.map((p: any) => ({
          userId: p.userId,
          displayName: p.displayName || (p.role === 'CREATOR' ? (actorSession?.name || 'Booking Creator') : 'Study Companion'),
          role: p.role,
        }))
      : [
          { userId: raw.bookerId || actorId, displayName: actorSession?.name || 'Booking Creator', role: 'CREATOR' },
        ];

    const companionParticipant = participants.find((p) => p.role === 'COMPANION');
    const companionId = companionParticipant?.userId || raw.companionStudentId || fallbackPayload?.companionStudentId;
    const companionDisplayName = companionParticipant?.displayName || raw.companionDisplayName;

    const isCreator =
      (typeof raw.bookerId === 'string' && raw.bookerId.toLowerCase() === actorIdLower) ||
      participants.some(
        (p) => typeof p.userId === 'string' && p.userId.toLowerCase() === actorIdLower && p.role === 'CREATOR'
      );

    const allowedActions = raw.status === 'CONFIRMED'
      ? (Array.isArray(raw.allowedActions) ? raw.allowedActions : (isCreator ? ['CANCEL', 'RESCHEDULE'] : []))
      : [];

    let timeWindow = raw.timeWindow || '';
    if (!timeWindow && (raw.startTime || raw.start_time) && (raw.endTime || raw.end_time)) {
      const st = raw.startTime || raw.start_time;
      const et = raw.endTime || raw.end_time;
      timeWindow = `${st} - ${et}`;
    }

    return {
      bookingId: raw.bookingId,
      bookerId: raw.bookerId || actorId,
      clientOperationId: raw.clientOperationId || fallbackOperationId,
      participants,
      companionStudentId: companionId,
      companionDisplayName,
      tableId: raw.tableId || fallbackPayload?.tableId || '',
      locationId: raw.locationId || fallbackPayload?.locationId || '',
      localDate: raw.localDate || fallbackPayload?.localDate || '',
      slotId: raw.slotId || fallbackPayload?.slotId || '',
      tableNumber: raw.tableNumber || '',
      locationName: raw.locationName || '',
      timeWindow,
      status: raw.status || 'CONFIRMED',
      allowedActions,
      partnerApprovalStatus: raw.partnerApprovalStatus || 'NOT_REQUIRED',
      createdAt: raw.createdAt || new Date().toISOString(),
      cancelledAt: raw.cancelledAt,
      rescheduledFromBookingId: raw.rescheduledFromBookingId,
    };
  }

  /**
   * Retrieves active campus study locations along with active table counts.
   * Calls GET /api/booking/locations on the Express backend.
   */
  public async listLocations(context: ServiceContext): Promise<CampusLocation[]> {
    const headers = this.getAuthHeaders(context);
    const endpoint = '/api/booking/locations';
    const response = await this.executeRequest<{ data: CampusLocation[]; requestId: string }>(
      endpoint,
      {
        method: 'GET',
        headers,
      },
      context
    );

    if (!response || !Array.isArray(response.data)) {
      throw new AppError(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Invalid response format from locations endpoint: missing data array'
      );
    }

    return response.data;
  }

  /**
   * Retrieves single authenticated booking record if the actor is authorized.
   * Calls GET /api/booking/:bookingId on the Express backend.
   */
  public async getBooking(bookingId: string, context: ServiceContext): Promise<BookingRecord> {
    if (!bookingId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Booking ID is required');
    }

    const headers = this.getAuthHeaders(context);
    const resolvedBookingId = resolveBookingId(bookingId);

    const endpoint = `/api/booking/${encodeURIComponent(resolvedBookingId)}`;
    const response = await this.executeRequest<{ data: any; requestId: string }>(
      endpoint,
      {
        method: 'GET',
        headers,
      },
      context
    );

    if (!response || !response.data || !response.data.bookingId) {
      throw new AppError(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Invalid response payload from booking retrieval: missing booking record'
      );
    }

    return this.mapToBookingRecord(response.data, context);
  }

  public async reconcileBooking(
    _clientOperationId: string,
    _context: ServiceContext
  ): Promise<BookingRecord | null> {
    throw new AppError(
      ErrorCode.SERVICE_UNAVAILABLE,
      'SERVICE_UNAVAILABLE: reconcileBooking is not yet implemented by the backend API.',
      { isTransient: false }
    );
  }

  public async rescheduleBooking(
    request: BookingRescheduleRequest,
    context: ServiceContext
  ): Promise<BookingRecord> {
    if (!request.bookingId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Booking ID is required to reschedule');
    }
    if (!request.newLocalDate) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Replacement date is required to reschedule');
    }
    if (!request.newSlotId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Replacement slot ID is required to reschedule');
    }

    const headers = this.getAuthHeaders(context, {
      'Content-Type': 'application/json',
    });

    const resolvedBookingId = resolveBookingId(request.bookingId);
    const resolvedSlotId = resolveSlotId(request.newSlotId);
    const resolvedTableId = request.newTableId ? resolveTableId(request.newTableId) : undefined;
    const resolvedLocationId = request.newLocationId ? resolveLocationId(request.newLocationId) : undefined;

    const payload = {
      newLocalDate: request.newLocalDate,
      newSlotId: resolvedSlotId,
      newTableId: resolvedTableId,
      newLocationId: resolvedLocationId,
      clientOperationId:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `op-resched-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };

    const endpoint = `/api/booking/${encodeURIComponent(resolvedBookingId)}/reschedule`;
    const response = await this.executeRequest<{
      data: any;
      operationId?: string;
      requestId: string;
    }>(
      endpoint,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      },
      context
    );

    if (!response || !response.data || !response.data.bookingId) {
      throw new AppError(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Invalid response payload from booking rescheduling: missing booking record'
      );
    }

    return this.mapToBookingRecord(response.data, context);
  }

  public async cancelBooking(
    bookingId: string,
    context: ServiceContext
  ): Promise<BookingRecord> {
    if (!bookingId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Booking ID is required to cancel reservation');
    }

    const headers = this.getAuthHeaders(context, {
      'Content-Type': 'application/json',
    });

    const resolvedBookingId = resolveBookingId(bookingId);
    const payload = {
      reason: 'User requested cancellation',
      clientOperationId:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `op-cancel-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };

    const endpoint = `/api/booking/${encodeURIComponent(resolvedBookingId)}/cancel`;
    const response = await this.executeRequest<{
      data: any;
      operationId?: string;
      requestId: string;
    }>(
      endpoint,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      },
      context
    );

    if (!response || !response.data || !response.data.bookingId) {
      throw new AppError(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Invalid response payload from booking cancellation: missing booking record'
      );
    }

    return this.mapToBookingRecord(response.data, context);
  }

  /**
   * Retrieves participant-authorized booking history for the current viewer.
   * Calls GET /api/booking on the Express backend.
   */
  public async getMyBookings(context: ServiceContext): Promise<BookingRecord[]> {
    const headers = this.getAuthHeaders(context);
    const endpoint = '/api/booking';

    const response = await this.executeRequest<{ data: any[]; requestId: string }>(
      endpoint,
      {
        method: 'GET',
        headers,
      },
      context
    );

    if (!response || !Array.isArray(response.data)) {
      throw new AppError(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Invalid response format from booking history endpoint: missing data array'
      );
    }

    return response.data.map((b) => this.mapToBookingRecord(b, context));
  }
}
