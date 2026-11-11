import {
  IAdminService,
  ServiceContext,
} from '@/services/interfaces';
import {
  AdminDashboardSummary,
  AdminUserSummary,
  AdminResourceSummary,
  AdminTableResource,
  AdminLocationCreateRequest,
  AdminLocationUpdateRequest,
  AdminTableCreateRequest,
  AdminTableUpdateRequest,
  AdminSlotCreateRequest,
  AdminSlotUpdateRequest,
  AdminBookingFilters,
  BookingRecord,
  CampusLocation,
  StudyTableSlot,
  ModerationReport,
  AuditLogEntry,
  AppError,
  ErrorCode,
  AppErrorCode,
} from '@/types';

export interface HttpAdminAdapterOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEMO_ADMIN_MAP: Record<string, string> = {
  'usr-admin-senate': '00000000-0000-0000-0000-00000000d599',
};
const DEMO_BOOKING_MAP: Record<string, string> = {
  'bk-1001': '00000000-0000-0000-0000-00000000D581',
  'bk-1002': '00000000-0000-0000-0000-00000000D582',
};

function resolveAdminId(id: string): string {
  if (UUID_REGEX.test(id)) return id;
  return DEMO_ADMIN_MAP[id] || id;
}

function resolveBookingId(id: string): string {
  if (UUID_REGEX.test(id)) return id;
  return DEMO_BOOKING_MAP[id] || id;
}

export class HttpAdminAdapter implements IAdminService {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options?: HttpAdminAdapterOptions) {
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
        'Authentication required: missing active admin session.'
      );
    }

    const resolvedId = resolveAdminId(actor.userId);
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Campus-Duo-Test-Actor': resolvedId,
      ...extraHeaders,
    };

    if (actor.sessionToken) {
      headers['Authorization'] = `Bearer ${actor.sessionToken}`;
    }

    return headers;
  }

  private async executeRequest<T>(
    endpoint: string,
    init: RequestInit,
    context: ServiceContext
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    try {
      const res = await this.fetchFn(url, {
        ...init,
        signal: context.signal,
      });

      if (res.ok) {
        return (await res.json()) as T;
      }

      let errorData: any = null;
      try {
        errorData = await res.json();
      } catch {
        // Non-JSON response
      }

      const backendCode = errorData?.error?.code;
      const backendMessage = errorData?.error?.message;
      let errorCode: AppErrorCode = ErrorCode.SERVICE_UNAVAILABLE;

      if (backendCode && backendCode in ErrorCode) {
        errorCode = backendCode as AppErrorCode;
      } else if (res.status === 400) {
        errorCode = ErrorCode.VALIDATION_ERROR;
      } else if (res.status === 401) {
        errorCode = ErrorCode.UNAUTHENTICATED;
      } else if (res.status === 403) {
        errorCode = ErrorCode.FORBIDDEN;
      } else if (res.status === 404) {
        errorCode = ErrorCode.NOT_FOUND;
      } else if (res.status === 409) {
        errorCode = ErrorCode.CONFLICT;
      }

      throw new AppError(
        errorCode,
        backendMessage || `HTTP ${res.status}: Admin operation failed`
      );
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      if (err.name === 'AbortError') {
        throw new AppError(ErrorCode.CANCELLED, 'Request was cancelled');
      }
      throw new AppError(
        ErrorCode.SERVICE_UNAVAILABLE,
        err.message || 'Network error communicating with backend admin service'
      );
    }
  }

  public async listModerationReports(context: ServiceContext): Promise<ModerationReport[]> {
    const response = await this.executeRequest<{ data: ModerationReport[] }>(
      '/api/admin/reports',
      { method: 'GET', headers: this.getAuthHeaders(context) },
      context
    );
    return response.data;
  }

  public async resolveReport(
    reportId: string,
    request: { action: 'DISMISS' | 'WARN_USER' | 'SUSPEND_USER'; reason: string; confirm: boolean },
    context: ServiceContext
  ): Promise<ModerationReport> {
    const response = await this.executeRequest<{ data: ModerationReport }>(
      `/api/admin/reports/${encodeURIComponent(reportId)}/review`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(context, { 'Content-Type': 'application/json' }),
        body: JSON.stringify(request),
      },
      context
    );
    return response.data;
  }

  public async listAuditLogs(context: ServiceContext): Promise<AuditLogEntry[]> {
    const response = await this.executeRequest<{ data: AuditLogEntry[] }>(
      '/api/admin/audit-logs',
      { method: 'GET', headers: this.getAuthHeaders(context) },
      context
    );
    return response.data;
  }

  public async listUsers(search: string | undefined, context: ServiceContext): Promise<AdminUserSummary[]> {
    const queryString = search ? `?search=${encodeURIComponent(search)}` : '';
    const response = await this.executeRequest<{ data: AdminUserSummary[] }>(
      `/api/admin/users${queryString}`,
      { method: 'GET', headers: this.getAuthHeaders(context) },
      context
    );
    return response.data;
  }

  public async getUser(userId: string, context: ServiceContext): Promise<AdminUserSummary> {
    const users = await this.listUsers(userId, context);
    const user = users.find((item) => item.userId === userId);
    if (!user) throw new AppError(ErrorCode.NOT_FOUND, 'User not found.');
    return user;
  }

  public async listBookings(filters: AdminBookingFilters, context: ServiceContext): Promise<BookingRecord[]> {
    const headers = this.getAuthHeaders(context);
    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await this.executeRequest<{ data: BookingRecord[] }>(
      `/api/admin/bookings${queryString}`,
      { method: 'GET', headers },
      context
    );
    return res.data;
  }

  public async cancelBooking(
    bookingId: string,
    reason: string,
    _confirm: boolean,
    context: ServiceContext
  ): Promise<BookingRecord> {
    const resolvedId = resolveBookingId(bookingId);
    const headers = this.getAuthHeaders(context, { 'Content-Type': 'application/json' });
    const res = await this.executeRequest<{ data: BookingRecord }>(
      `/api/booking/${resolvedId}/cancel`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason: reason || 'Administrative cancellation' }),
      },
      context
    );
    return res.data;
  }

  // --- Authoritative HTTP backend calls for Resource Management ---

  public async getDashboardSummary(context: ServiceContext): Promise<AdminDashboardSummary> {
    const headers = this.getAuthHeaders(context);
    const summaryRes = await this.executeRequest<{
      data: {
        systemStatus: string;
        activeLocationsCount: number;
        totalBookingsCount: number;
        totalUsersCount: number;
        pendingReportsCount: number;
        auditEventsCount: number;
      };
    }>('/api/admin/summary', { method: 'GET', headers }, context);

    const resources = await this.listResources(context);
    const activeTables = resources.reduce((acc, r) => acc + (r.active ? r.tableCount : 0), 0);

    return {
      activeLocations: summaryRes.data.activeLocationsCount,
      activeTables,
      confirmedBookings: summaryRes.data.totalBookingsCount,
      pendingReports: summaryRes.data.pendingReportsCount,
      auditEvents: summaryRes.data.auditEventsCount,
    };
  }

  public async listResources(context: ServiceContext): Promise<AdminResourceSummary[]> {
    const headers = this.getAuthHeaders(context);
    const response = await this.executeRequest<{ data: AdminResourceSummary[] }>(
      '/api/admin/resources',
      { method: 'GET', headers },
      context
    );
    return response.data || [];
  }

  public async createLocation(
    request: AdminLocationCreateRequest,
    context: ServiceContext
  ): Promise<CampusLocation> {
    const headers = this.getAuthHeaders(context, { 'Content-Type': 'application/json' });
    const response = await this.executeRequest<{ data: CampusLocation }>(
      '/api/admin/locations',
      {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      },
      context
    );
    return response.data;
  }

  public async updateLocation(
    locationId: string,
    request: AdminLocationUpdateRequest,
    context: ServiceContext
  ): Promise<CampusLocation> {
    const headers = this.getAuthHeaders(context, { 'Content-Type': 'application/json' });
    const response = await this.executeRequest<{ data: CampusLocation }>(
      `/api/admin/locations/${encodeURIComponent(locationId)}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(request),
      },
      context
    );
    return response.data;
  }

  public async deactivateLocation(
    locationId: string,
    reason: string,
    _confirm: boolean,
    context: ServiceContext
  ): Promise<void> {
    const headers = this.getAuthHeaders(context, { 'Content-Type': 'application/json' });
    await this.executeRequest<{ data: { success: boolean } }>(
      `/api/admin/locations/${encodeURIComponent(locationId)}/deactivate`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason }),
      },
      context
    );
  }

  public async listTables(context: ServiceContext): Promise<AdminTableResource[]> {
    const headers = this.getAuthHeaders(context);
    const response = await this.executeRequest<{ data: AdminTableResource[] }>(
      '/api/admin/tables',
      { method: 'GET', headers },
      context
    );
    return response.data || [];
  }

  public async createTable(
    request: AdminTableCreateRequest,
    context: ServiceContext
  ): Promise<AdminTableResource> {
    const headers = this.getAuthHeaders(context, { 'Content-Type': 'application/json' });
    const response = await this.executeRequest<{ data: AdminTableResource }>(
      '/api/admin/tables',
      {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      },
      context
    );
    return response.data;
  }

  public async updateTable(
    tableId: string,
    request: AdminTableUpdateRequest,
    context: ServiceContext
  ): Promise<AdminTableResource> {
    const headers = this.getAuthHeaders(context, { 'Content-Type': 'application/json' });
    const response = await this.executeRequest<{ data: AdminTableResource }>(
      `/api/admin/tables/${encodeURIComponent(tableId)}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(request),
      },
      context
    );
    return response.data;
  }

  public async setTableActive(
    tableId: string,
    active: boolean,
    reason: string,
    _confirm: boolean,
    context: ServiceContext
  ): Promise<void> {
    const headers = this.getAuthHeaders(context, { 'Content-Type': 'application/json' });
    await this.executeRequest<{ data: { success: boolean } }>(
      `/api/admin/tables/${encodeURIComponent(tableId)}/status`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ active, reason }),
      },
      context
    );
  }

  public async listSlots(context: ServiceContext): Promise<StudyTableSlot[]> {
    const headers = this.getAuthHeaders(context);
    const response = await this.executeRequest<{ data: StudyTableSlot[] }>(
      '/api/admin/slots',
      { method: 'GET', headers },
      context
    );
    return response.data || [];
  }

  public async createSlot(
    request: AdminSlotCreateRequest,
    context: ServiceContext
  ): Promise<StudyTableSlot> {
    const headers = this.getAuthHeaders(context, { 'Content-Type': 'application/json' });
    const response = await this.executeRequest<{ data: StudyTableSlot }>(
      '/api/admin/slots',
      {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      },
      context
    );
    return response.data;
  }

  public async updateSlot(
    slotId: string,
    request: AdminSlotUpdateRequest,
    context: ServiceContext
  ): Promise<StudyTableSlot> {
    const headers = this.getAuthHeaders(context, { 'Content-Type': 'application/json' });
    const response = await this.executeRequest<{ data: StudyTableSlot }>(
      `/api/admin/slots/${encodeURIComponent(slotId)}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(request),
      },
      context
    );
    return response.data;
  }

  public async setSlotActive(
    slotId: string,
    active: boolean,
    reason: string,
    _confirm: boolean,
    context: ServiceContext
  ): Promise<void> {
    const headers = this.getAuthHeaders(context, { 'Content-Type': 'application/json' });
    await this.executeRequest<{ data: { success: boolean } }>(
      `/api/admin/slots/${encodeURIComponent(slotId)}/status`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ active, reason }),
      },
      context
    );
  }
}
