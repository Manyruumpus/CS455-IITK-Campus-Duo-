import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appServices } from '@/services';
import { useDemoAuth } from '@/app/context/DemoAuthContext';
import { AppError, AdminBookingFilters, AdminDashboardSummary, AdminResourceSummary, AdminTableResource, AdminUserSummary, AuditLogEntry, BookingRecord, CampusLocation, ModerationReport, StudyTableSlot, AdminLocationCreateRequest, AdminLocationUpdateRequest, AdminTableCreateRequest, AdminTableUpdateRequest, AdminSlotCreateRequest, AdminSlotUpdateRequest } from '@/types';
import { queryKeys } from './queryKeys';

function adminSession(session: ReturnType<typeof useDemoAuth>['session']) {
  if (!session || session.role !== 'ROLE_ADMIN') throw new AppError('FORBIDDEN', 'Administrator role required');
  return session;
}

export function useAdminDashboard() {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';
  return useQuery<AdminDashboardSummary, AppError>({
    queryKey: queryKeys.admin.dashboard(actorId),
    enabled: session?.role === 'ROLE_ADMIN',
    queryFn: ({ signal }) => appServices.admin.getDashboardSummary({ actorSession: adminSession(session), signal }),
  });
}

export function useAdminUsers(search: string) {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';
  return useQuery<AdminUserSummary[], AppError>({
    queryKey: queryKeys.admin.users(actorId, search),
    enabled: session?.role === 'ROLE_ADMIN',
    queryFn: ({ signal }) => appServices.admin.listUsers(search, { actorSession: adminSession(session), signal }),
  });
}

export function useAdminReports() {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';
  return useQuery<ModerationReport[], AppError>({
    queryKey: queryKeys.admin.reports(actorId),
    enabled: session?.role === 'ROLE_ADMIN',
    queryFn: ({ signal }) => appServices.admin.listModerationReports({ actorSession: adminSession(session), signal }),
  });
}

export function useAdminResources() {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';
  return useQuery<AdminResourceSummary[], AppError>({
    queryKey: queryKeys.admin.resources(actorId),
    enabled: session?.role === 'ROLE_ADMIN',
    queryFn: ({ signal }) => appServices.admin.listResources({ actorSession: adminSession(session), signal }),
  });
}

export function useAdminTables() {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';
  return useQuery<AdminTableResource[], AppError>({
    queryKey: [...queryKeys.admin.resources(actorId), 'tables'],
    enabled: session?.role === 'ROLE_ADMIN',
    queryFn: ({ signal }) => appServices.admin.listTables({ actorSession: adminSession(session), signal }),
  });
}

export function useAdminSlots() {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';
  return useQuery<StudyTableSlot[], AppError>({
    queryKey: [...queryKeys.admin.resources(actorId), 'slots'],
    enabled: session?.role === 'ROLE_ADMIN',
    queryFn: ({ signal }) => appServices.admin.listSlots({ actorSession: adminSession(session), signal }),
  });
}

function useAdminResourceMutation<TVariables, TResult>(mutationFn: (request: TVariables, context: { actorSession: ReturnType<typeof adminSession> }) => Promise<TResult>) {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';
  const client = useQueryClient();
  return useMutation<TResult, AppError, TVariables>({
    mutationFn: (request) => mutationFn(request, { actorSession: adminSession(session) }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.admin.all(actorId) });
      client.invalidateQueries({ queryKey: queryKeys.bookings.all(actorId) });
    },
  });
}

export function useCreateAdminLocation() {
  return useAdminResourceMutation<AdminLocationCreateRequest, CampusLocation>(
    (request, context) => appServices.admin.createLocation(request, context)
  );
}

export function useUpdateAdminLocation() {
  return useAdminResourceMutation<{ locationId: string; request: AdminLocationUpdateRequest }, CampusLocation>(
    (value, context) => appServices.admin.updateLocation(value.locationId, value.request, context)
  );
}

export function useCreateAdminTable() {
  return useAdminResourceMutation<AdminTableCreateRequest, AdminTableResource>(
    (request, context) => appServices.admin.createTable(request, context)
  );
}

export function useUpdateAdminTable() {
  return useAdminResourceMutation<{ tableId: string; request: AdminTableUpdateRequest }, AdminTableResource>(
    (value, context) => appServices.admin.updateTable(value.tableId, value.request, context)
  );
}

export function useCreateAdminSlot() {
  return useAdminResourceMutation<AdminSlotCreateRequest, StudyTableSlot>(
    (request, context) => appServices.admin.createSlot(request, context)
  );
}

export function useUpdateAdminSlot() {
  return useAdminResourceMutation<{ slotId: string; request: AdminSlotUpdateRequest }, StudyTableSlot>(
    (value, context) => appServices.admin.updateSlot(value.slotId, value.request, context)
  );
}

export function useSetAdminTableActive() {
  return useAdminResourceMutation<{ tableId: string; active: boolean; reason: string; confirm: boolean }, void>(
    (value, context) => appServices.admin.setTableActive(value.tableId, value.active, value.reason, value.confirm, context)
  );
}

export function useSetAdminSlotActive() {
  return useAdminResourceMutation<{ slotId: string; active: boolean; reason: string; confirm: boolean }, void>(
    (value, context) => appServices.admin.setSlotActive(value.slotId, value.active, value.reason, value.confirm, context)
  );
}

export function useAdminBookings(filters: AdminBookingFilters) {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';
  return useQuery<BookingRecord[], AppError>({
    queryKey: queryKeys.admin.bookings(actorId, filters),
    enabled: session?.role === 'ROLE_ADMIN',
    queryFn: ({ signal }) => appServices.admin.listBookings(filters, { actorSession: adminSession(session), signal }),
  });
}

export function useAdminAudits() {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';
  return useQuery<AuditLogEntry[], AppError>({
    queryKey: queryKeys.admin.audits(actorId),
    enabled: session?.role === 'ROLE_ADMIN',
    queryFn: ({ signal }) => appServices.admin.listAuditLogs({ actorSession: adminSession(session), signal }),
  });
}

export function useResolveAdminReport() {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';
  const client = useQueryClient();
  return useMutation<ModerationReport, AppError, { reportId: string; action: 'DISMISS' | 'WARN_USER' | 'SUSPEND_USER'; reason: string; confirm: boolean }>({
    mutationFn: (request) => appServices.admin.resolveReport(request.reportId, request, { actorSession: adminSession(session) }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.admin.all(actorId) });
      client.invalidateQueries({ queryKey: queryKeys.notifications.all(actorId) });
    },
  });
}

export function useDeactivateAdminLocation() {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';
  const client = useQueryClient();
  return useMutation<void, AppError, { locationId: string; reason: string; confirm: boolean }>({
    mutationFn: (request) => appServices.admin.deactivateLocation(request.locationId, request.reason, request.confirm, { actorSession: adminSession(session) }),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.admin.all(actorId) }),
  });
}

export function useAdminCancelBooking() {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';
  const client = useQueryClient();
  return useMutation<BookingRecord, AppError, { bookingId: string; reason: string; confirm: boolean }>({
    mutationFn: (request) => appServices.admin.cancelBooking(request.bookingId, request.reason, request.confirm, { actorSession: adminSession(session) }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.admin.all(actorId) });
      client.invalidateQueries({ queryKey: queryKeys.bookings.all(actorId) });
      client.invalidateQueries({ queryKey: queryKeys.notifications.all(actorId) });
    },
  });
}
