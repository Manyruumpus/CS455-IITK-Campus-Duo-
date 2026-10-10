import {
  INotificationService,
  IModerationService,
  IAdminService,
  IConversationService,
  ServiceContext,
} from '@/services/interfaces';
import {
  NotificationItem,
  ModerationReport,
  AuditLogEntry,
  AppError,
  ReportReceipt,
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
} from '@/types';
import { mockStore } from '@/mocks/store';
import { scenarioManager } from '@/mocks/scenarios';
import { appConfig } from '@/config/features';
import { emitNotification } from './notificationEvents';
import { MockBookingService } from './MockBookingService';

function validateRequiredId(value: string, label: string): void {
  if (!value.trim() || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(value)) {
    throw new AppError('VALIDATION_ERROR', `${label} identifier is required and must be stable`);
  }
}

function validateRequiredLabel(value: string, label: string): void {
  if (!value.trim()) throw new AppError('VALIDATION_ERROR', `${label} is required`);
}

function timeToMinutes(value: string): number {
  if (!/^\d{2}:\d{2}$/.test(value)) return -1;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function validateTimeRange(startTime: string, endTime: string): void {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start < 0 || end < 0 || start >= end || start >= 24 * 60 || end > 24 * 60) {
    throw new AppError('VALIDATION_ERROR', 'Fixed-slot times must be valid and end after start');
  }
}

function validateLocationRequest(request: AdminLocationCreateRequest): void {
  validateRequiredId(request.locationId, 'Location');
  validateRequiredLabel(request.name, 'Location name');
  validateRequiredLabel(request.building, 'Building');
  if (!Number.isInteger(request.totalTables) || request.totalTables < 0) {
    throw new AppError('VALIDATION_ERROR', 'Location table count must be a non-negative integer');
  }
  validateTimeRange(request.openTime, request.closeTime);
}

function validateSlotRequest(request: { slotId: string; locationId: string; tableId?: string; tableNumber: string; zone: StudyTableSlot['zone']; startTime: string; endTime: string; date: string }): void {
  validateRequiredId(request.slotId, 'Slot');
  validateRequiredLabel(request.tableNumber, 'Table number');
  validateRequiredId(request.locationId, 'Location');
  validateRequiredId(request.tableId ?? '', 'Table');
  validateTimeRange(request.startTime, request.endTime);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.date) || Number.isNaN(Date.parse(`${request.date}T00:00:00Z`))) {
    throw new AppError('VALIDATION_ERROR', 'Slot date must be a valid local date');
  }
}

function hasFutureConfirmedBookings(predicate: (booking: BookingRecord) => boolean): boolean {
  const today = mockStore.getCampusLocalDate();
  return Array.from(mockStore.bookings.values()).some(
    (booking) => booking.status === 'CONFIRMED' && booking.localDate >= today && predicate(booking)
  );
}

function assertNoSlotOverlap(
  candidate: AdminSlotCreateRequest | StudyTableSlot,
  excludeSlotId?: string
): void {
  const start = timeToMinutes(candidate.startTime);
  const end = timeToMinutes(candidate.endTime);
  const overlaps = Array.from(mockStore.slots.values()).some((slot) => {
    if (slot.slotId === excludeSlotId) return false;
    if (slot.tableId !== candidate.tableId || slot.date !== candidate.date) return false;
    return start < timeToMinutes(slot.endTime) && end > timeToMinutes(slot.startTime);
  });
  if (overlaps) throw new AppError('CONFLICT', 'Fixed-slot definition overlaps an existing slot');
}

function requireReasonConfirmation(reason: string, confirm: boolean): void {
  if (!confirm || !reason.trim()) throw new AppError('VALIDATION_ERROR', 'Reason and confirmation are required');
}

export class MockNotificationService implements INotificationService {
  public async listNotifications(context: ServiceContext): Promise<NotificationItem[]>;
  public async listNotifications(
    filters: { unreadOnly?: boolean; type?: string },
    context: ServiceContext
  ): Promise<NotificationItem[]>;
  public async listNotifications(
    filtersOrContext: { unreadOnly?: boolean; type?: string } | ServiceContext,
    maybeContext?: ServiceContext
  ): Promise<NotificationItem[]> {
    const filters = 'actorSession' in filtersOrContext ? {} : filtersOrContext;
    const context = 'actorSession' in filtersOrContext ? filtersOrContext : maybeContext;
    if (!context) throw new AppError('UNAUTHENTICATED', 'Sign in required');
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) {
      throw new AppError('UNAUTHENTICATED', 'Sign in required');
    }

    return Array.from(mockStore.notifications.values())
      .filter((n) => n.recipientId === actor.userId)
      .filter((n) => !filters.unreadOnly || !n.isRead)
      .filter((n) => !filters.type || filters.type === 'ALL' || n.mode === filters.type)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  public async markAsRead(
    notificationId: string,
    context: ServiceContext
  ): Promise<void> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) throw new AppError('UNAUTHENTICATED', 'Sign in required');
    const n = mockStore.notifications.get(notificationId);
    if (!n) throw new AppError('NOT_FOUND', 'Notification not found');
    if (n.recipientId !== actor.userId) throw new AppError('FORBIDDEN', 'Notification access denied');
    mockStore.notifications.set(notificationId, { ...n, isRead: true });
  }

  public async markAsUnread(notificationId: string, context: ServiceContext): Promise<void> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) throw new AppError('UNAUTHENTICATED', 'Sign in required');
    const n = mockStore.notifications.get(notificationId);
    if (!n) throw new AppError('NOT_FOUND', 'Notification not found');
    if (n.recipientId !== actor.userId) throw new AppError('FORBIDDEN', 'Notification access denied');
    mockStore.notifications.set(notificationId, { ...n, isRead: false });
  }

  public async markAllAsRead(context: ServiceContext): Promise<void> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) throw new AppError('UNAUTHENTICATED', 'Sign in required');
    for (const [id, notification] of mockStore.notifications.entries()) {
      if (notification.recipientId === actor.userId && !notification.isRead) {
        mockStore.notifications.set(id, { ...notification, isRead: true });
      }
    }
  }

  public async getUnreadCount(context: ServiceContext): Promise<number> {
    const notifications = await this.listNotifications({}, context);
    return notifications.filter((notification) => !notification.isRead).length;
  }
}

export class MockModerationService implements IModerationService {
  public async reportUser(
    reportedUserId: string,
    category: string,
    description: string | undefined,
    context: ServiceContext
  ): Promise<ReportReceipt> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) {
      throw new AppError('UNAUTHENTICATED', 'Sign in required');
    }

    if (!reportedUserId || !category || (description?.trim().length ?? 0) > 500) {
      throw new AppError('VALIDATION_ERROR', 'A valid target and required reason are needed; description is optional and bounded');
    }
    const existing = Array.from(mockStore.reports.values()).find(
      (report) =>
        report.reporterUserId === actor.userId &&
        report.reportedUserId === reportedUserId &&
        report.category === category &&
        report.description === (description?.trim() ?? '') &&
        report.status === 'PENDING_REVIEW'
    );
    if (existing) {
      return {
        reportId: existing.reportId,
        reporterUserId: existing.reporterUserId,
        reportedUserId: existing.reportedUserId,
        status: existing.status,
        createdAt: existing.timestamp,
      };
    }
    const reportId = `rep-demo-${mockStore.reports.size + 1}`;
    const newReport: ModerationReport = {
      reportId,
      reporterUserId: actor.userId,
      reportedUserId,
      reportedUserName: 'Reported Peer',
      category: category as ModerationReport['category'],
      description: description?.trim() ?? '',
      timestamp: mockStore.getDemoClock(),
      status: 'PENDING_REVIEW',
    };

    mockStore.reports.set(reportId, newReport);
    emitNotification({
      recipientId: actor.userId,
      eventType: 'REPORT_RECEIVED',
      mode: 'MODERATION',
      title: 'Report received',
      body: 'Your report was recorded for moderation review. No automatic action was taken.',
      destination: { kind: 'REPORT', reportId },
      dedupeKey: `report-${reportId}`,
    });
    return {
      reportId,
      reporterUserId: actor.userId,
      reportedUserId,
      status: newReport.status,
      createdAt: newReport.timestamp,
    };
  }

  public async blockUser(
    targetUserId: string,
    context: ServiceContext
  ): Promise<{ blocked: boolean }> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) {
      throw new AppError('UNAUTHENTICATED', 'Sign in required to block a user');
    }
    if (targetUserId === actor.userId) {
      throw new AppError('VALIDATION_ERROR', 'You cannot block yourself');
    }

    let blocked = mockStore.blockedBy.get(actor.userId);
    if (!blocked) {
      blocked = new Set();
      mockStore.blockedBy.set(actor.userId, blocked);
    }
    blocked.add(targetUserId);
    return { blocked: true };
  }

  public async listBlockedUsers(context: ServiceContext): Promise<string[]> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) {
      return [];
    }
    return Array.from(mockStore.blockedBy.get(actor.userId) ?? []);
  }

  public async listMyReports(context: ServiceContext): Promise<ReportReceipt[]> {
    await scenarioManager.applyScenario(context.signal);
    const actor = context.actorSession;
    if (!actor) throw new AppError('UNAUTHENTICATED', 'Sign in required');
    return Array.from(mockStore.reports.values())
      .filter((report) => report.reporterUserId === actor.userId)
      .map((report) => ({
        reportId: report.reportId,
        reporterUserId: report.reporterUserId,
        reportedUserId: report.reportedUserId,
        status: report.status,
        createdAt: report.timestamp,
      }));
  }
}

export class MockAdminService implements IAdminService {
  private recordResourceAudit(context: ServiceContext, action: string, targetEntity: string, reason = 'resource operation'): void {
    mockStore.auditLogs.unshift({
      logId: `audit-demo-${mockStore.auditLogs.length + 1}`,
      adminId: context.actorSession!.userId,
      actorRole: context.actorSession!.role,
      action,
      targetEntity,
      targetType: 'RESOURCE',
      outcome: 'SUCCESS',
      correlationId: targetEntity,
      safeReason: reason.trim().slice(0, 160),
      details: `resourceOperation=${action}`,
      timestamp: mockStore.getDemoClock(),
    });
  }

  private verifyAdminRole(context: ServiceContext): void {
    const actor = context.actorSession;
    if (!actor || actor.role !== 'ROLE_ADMIN') {
      throw new AppError(
        'FORBIDDEN',
        'Administrative role required to execute governance operations'
      );
    }
  }

  public async listModerationReports(context: ServiceContext): Promise<ModerationReport[]> {
    await scenarioManager.applyScenario(context.signal);
    this.verifyAdminRole(context);
    return Array.from(mockStore.reports.values());
  }

  public async resolveReport(
    reportId: string,
    request: { action: 'DISMISS' | 'WARN_USER' | 'SUSPEND_USER'; reason: string; confirm: boolean },
    context: ServiceContext
  ): Promise<ModerationReport> {
    await scenarioManager.applyScenario(context.signal);
    this.verifyAdminRole(context);
    if (!request.confirm || !request.reason.trim()) {
      throw new AppError('VALIDATION_ERROR', 'A reason and explicit confirmation are required');
    }

    const report = mockStore.reports.get(reportId);
    if (!report) {
      throw new AppError('NOT_FOUND', `Report ${reportId} not found`);
    }
    if (report.status !== 'PENDING_REVIEW') {
      throw new AppError('CONFLICT', 'This report has already been resolved and cannot be overwritten');
    }

    const updatedStatus: ModerationReport['status'] =
      request.action === 'DISMISS' ? 'DISMISSED' : request.action === 'WARN_USER' ? 'WARNED' : 'SUSPENDED';
    const auditLogId = `audit-demo-${mockStore.auditLogs.length + 1}`;
    const reviewed = {
      ...report,
      status: updatedStatus,
      reviewedBy: context.actorSession!.userId,
      reviewedAt: mockStore.getDemoClock(),
      reviewReason: request.reason.trim(),
      auditLogId,
    };

    mockStore.reports.set(reportId, reviewed);
    mockStore.auditLogs.unshift({
      logId: auditLogId,
      adminId: context.actorSession!.userId,
      actorRole: context.actorSession!.role,
      action: `RESOLVE_${request.action}`,
      targetEntity: reportId,
      targetType: 'MODERATION_REPORT',
      outcome: 'SUCCESS',
      correlationId: auditLogId,
      safeReason: request.reason.trim().slice(0, 160),
      details: `Report status changed to ${updatedStatus}`,
      timestamp: mockStore.getDemoClock(),
    });
    emitNotification({
      recipientId: report.reporterUserId,
      eventType: 'REPORT_STATUS_UPDATED',
      mode: 'MODERATION',
      title: 'Report status updated',
      body: `Your report is now ${updatedStatus.replace(/_/g, ' ').toLowerCase()}.`,
      destination: { kind: 'REPORT', reportId },
      dedupeKey: `report-status-${reportId}-${updatedStatus}`,
    });
    return reviewed;
  }

  public async listAuditLogs(context: ServiceContext): Promise<AuditLogEntry[]> {
    await scenarioManager.applyScenario(context.signal);
    this.verifyAdminRole(context);
    return mockStore.auditLogs.map((entry) => ({ ...entry }));
  }

  public async getDashboardSummary(context: ServiceContext): Promise<AdminDashboardSummary> {
    await scenarioManager.applyScenario(context.signal);
    this.verifyAdminRole(context);
    return {
      activeLocations: Array.from(mockStore.locations.values()).filter((location) => location.active !== false).length,
      activeTables: new Set(
        Array.from(mockStore.slots.values())
          .filter((slot) => mockStore.locations.get(slot.locationId)?.active !== false)
          .map((slot) => slot.tableId ?? slot.tableNumber)
      ).size,
      confirmedBookings: Array.from(mockStore.bookings.values()).filter((booking) => booking.status === 'CONFIRMED').length,
      pendingReports: Array.from(mockStore.reports.values()).filter((report) => report.status === 'PENDING_REVIEW').length,
      auditEvents: mockStore.auditLogs.length,
    };
  }

  public async listUsers(search: string | undefined, context: ServiceContext): Promise<AdminUserSummary[]> {
    await scenarioManager.applyScenario(context.signal);
    this.verifyAdminRole(context);
    const term = search?.trim().toLowerCase() ?? '';
    return Array.from(mockStore.privateProfiles.values())
      .map((profile) => {
        const session = mockStore.sessions.get(profile.userId);
        return {
          userId: profile.userId,
          displayName: profile.displayName,
          rollNumber: profile.rollNumber,
          department: profile.department,
          role: session?.role ?? 'ROLE_STUDENT',
          status: 'ONBOARDED_INCOMPLETE' as const,
          studyConsent: profile.studyConsent.hasConsent,
          socialConsent: profile.socialConsent.hasConsent,
        };
      })
      .filter((user) => !term || `${user.displayName} ${user.rollNumber ?? ''} ${user.userId}`.toLowerCase().includes(term));
  }

  public async getUser(userId: string, context: ServiceContext): Promise<AdminUserSummary> {
    const users = await this.listUsers(undefined, context);
    const user = users.find((candidate) => candidate.userId === userId);
    if (!user) throw new AppError('NOT_FOUND', 'User not found');
    return user;
  }

  public async listResources(context: ServiceContext): Promise<AdminResourceSummary[]> {
    await scenarioManager.applyScenario(context.signal);
    this.verifyAdminRole(context);
    const today = mockStore.getCampusLocalDate();
    return Array.from(mockStore.locations.values()).map((location) => ({
      locationId: location.id,
      locationName: location.name,
      building: location.building,
      active: location.active !== false,
      tableCount: new Set(
        Array.from(mockStore.slots.values())
          .filter((slot) => slot.locationId === location.id)
          .map((slot) => slot.tableId ?? slot.tableNumber)
      ).size,
      futureConfirmedBookings: Array.from(mockStore.bookings.values()).filter(
        (booking) =>
          booking.locationId === location.id &&
          booking.status === 'CONFIRMED' &&
          booking.localDate >= today
      ).length,
    }));
  }

  public async createLocation(
    request: AdminLocationCreateRequest,
    context: ServiceContext
  ): Promise<CampusLocation> {
    await scenarioManager.applyScenario(context.signal);
    this.verifyAdminRole(context);
    validateLocationRequest(request);
    if (mockStore.locations.has(request.locationId)) {
      throw new AppError('CONFLICT', 'Location identifier is already in use');
    }
    const location: CampusLocation = { ...request, id: request.locationId, active: true };
    mockStore.locations.set(location.id, location);
    this.recordResourceAudit(context, 'CREATE_LOCATION', location.id);
    return { ...location };
  }

  public async updateLocation(
    locationId: string,
    request: AdminLocationUpdateRequest,
    context: ServiceContext
  ): Promise<CampusLocation> {
    await scenarioManager.applyScenario(context.signal);
    this.verifyAdminRole(context);
    const existing = mockStore.locations.get(locationId);
    if (!existing) throw new AppError('NOT_FOUND', 'Location not found');
    if (request.name !== undefined && !request.name.trim()) {
      throw new AppError('VALIDATION_ERROR', 'Location name is required');
    }
    if (request.building !== undefined && !request.building.trim()) {
      throw new AppError('VALIDATION_ERROR', 'Building is required');
    }
    validateTimeRange(request.openTime ?? existing.openTime, request.closeTime ?? existing.closeTime);
    const hasFutureBookings = hasFutureConfirmedBookings((booking) => booking.locationId === locationId);
    const changesMeaning = Object.keys(request).some((key) => key !== 'hasPowerOutlets' && key !== 'hasWifi6');
    if (hasFutureBookings && changesMeaning) {
      throw new AppError('CONFLICT', 'Location edits affecting future bookings are blocked until remediation policy exists');
    }
    const updated = { ...existing, ...request };
    mockStore.locations.set(locationId, updated);
    this.recordResourceAudit(context, 'UPDATE_LOCATION', locationId);
    return { ...updated };
  }

  public async listTables(context: ServiceContext): Promise<AdminTableResource[]> {
    await scenarioManager.applyScenario(context.signal);
    this.verifyAdminRole(context);
    return Array.from(mockStore.tables.values()).map((table) => ({ ...table }));
  }

  public async createTable(
    request: AdminTableCreateRequest,
    context: ServiceContext
  ): Promise<AdminTableResource> {
    await scenarioManager.applyScenario(context.signal);
    this.verifyAdminRole(context);
    validateRequiredId(request.tableId, 'Table');
    validateRequiredLabel(request.tableNumber, 'Table number');
    const location = mockStore.locations.get(request.locationId);
    if (!location) throw new AppError('NOT_FOUND', 'Parent location not found');
    if (location.active === false) throw new AppError('CONFLICT', 'Cannot add a table to an inactive location');
    if (mockStore.tables.has(request.tableId)) throw new AppError('CONFLICT', 'Table identifier is already in use');
    const table: AdminTableResource = { ...request, capacity: 2, active: true };
    mockStore.tables.set(table.tableId, table);
    this.recordResourceAudit(context, 'CREATE_TABLE', table.tableId);
    return { ...table };
  }

  public async updateTable(
    tableId: string,
    request: AdminTableUpdateRequest,
    context: ServiceContext
  ): Promise<AdminTableResource> {
    await scenarioManager.applyScenario(context.signal);
    this.verifyAdminRole(context);
    const existing = mockStore.tables.get(tableId);
    if (!existing) throw new AppError('NOT_FOUND', 'Table not found');
    if (request.tableNumber !== undefined) validateRequiredLabel(request.tableNumber, 'Table number');
    const location = request.locationId ? mockStore.locations.get(request.locationId) : mockStore.locations.get(existing.locationId);
    if (!location) throw new AppError('NOT_FOUND', 'Parent location not found');
    if (location.active === false) throw new AppError('CONFLICT', 'Cannot assign a table to an inactive location');
    const hasFutureBookings = hasFutureConfirmedBookings((booking) => booking.tableId === tableId);
    if (hasFutureBookings && (request.locationId !== undefined || request.tableNumber !== undefined)) {
      throw new AppError('CONFLICT', 'Table identity/assignment edits are blocked while future bookings exist');
    }
    const updated = { ...existing, ...request, capacity: 2 as const };
    mockStore.tables.set(tableId, updated);
    this.recordResourceAudit(context, 'UPDATE_TABLE', tableId);
    for (const slot of mockStore.slots.values()) {
      if (slot.tableId === tableId) {
        mockStore.slots.set(slot.slotId, {
          ...slot,
          tableNumber: updated.tableNumber,
          locationId: updated.locationId,
        });
      }
    }
    return { ...updated };
  }

  public async setTableActive(
    tableId: string,
    active: boolean,
    reason: string,
    confirm: boolean,
    context: ServiceContext
  ): Promise<void> {
    await scenarioManager.applyScenario(context.signal);
    this.verifyAdminRole(context);
    requireReasonConfirmation(reason, confirm);
    const table = mockStore.tables.get(tableId);
    if (!table) throw new AppError('NOT_FOUND', 'Table not found');
    if (!active && hasFutureConfirmedBookings((booking) => booking.tableId === tableId)) {
      throw new AppError('CONFLICT', 'Table deactivation is blocked by future confirmed bookings');
    }
    mockStore.tables.set(tableId, { ...table, active });
    this.recordResourceAudit(context, active ? 'ACTIVATE_TABLE' : 'DEACTIVATE_TABLE', tableId, reason);
    for (const slot of mockStore.slots.values()) {
      if (slot.tableId === tableId && !active) {
        mockStore.slots.set(slot.slotId, { ...slot, status: 'LOCKED_MAINTENANCE' });
      }
    }
  }

  public async createSlot(
    request: AdminSlotCreateRequest,
    context: ServiceContext
  ): Promise<StudyTableSlot> {
    await scenarioManager.applyScenario(context.signal);
    this.verifyAdminRole(context);
    validateSlotRequest(request);
    if (mockStore.slots.has(request.slotId)) throw new AppError('CONFLICT', 'Slot identifier is already in use');
    const table = mockStore.tables.get(request.tableId);
    if (!table || table.locationId !== request.locationId) {
      throw new AppError('NOT_FOUND', 'Parent table/location reference is invalid');
    }

    assertNoSlotOverlap(request);
    const slot: StudyTableSlot = {
      ...request,
      status: table.active && mockStore.locations.get(request.locationId)?.active !== false ? 'AVAILABLE' : 'LOCKED_MAINTENANCE',
      capacity: 2,
      reservedCount: 0,
    };
    mockStore.slots.set(slot.slotId, slot);
    this.recordResourceAudit(context, 'CREATE_SLOT', slot.slotId);
    return { ...slot };
  }

  public async listSlots(context: ServiceContext): Promise<StudyTableSlot[]> {
    await scenarioManager.applyScenario(context.signal);
    this.verifyAdminRole(context);
    return Array.from(mockStore.slots.values()).map((slot) => ({ ...slot }));
  }

  public async updateSlot(
    slotId: string,
    request: AdminSlotUpdateRequest,
    context: ServiceContext
  ): Promise<StudyTableSlot> {
    await scenarioManager.applyScenario(context.signal);
    this.verifyAdminRole(context);
    const existing = mockStore.slots.get(slotId);
    if (!existing) throw new AppError('NOT_FOUND', 'Slot not found');
    const merged = { ...existing, ...request };
    validateSlotRequest({ ...merged, slotId });
    if (hasFutureConfirmedBookings((booking) => booking.slotId === slotId) && (
      request.locationId !== undefined ||
      request.tableId !== undefined ||
      request.date !== undefined ||
      request.startTime !== undefined ||
      request.endTime !== undefined
    )) {
      throw new AppError('CONFLICT', 'Slot meaning edits are blocked while future confirmed bookings exist');
    }
    assertNoSlotOverlap(merged, slotId);
    const updated = { ...merged, capacity: 2 as const };
    mockStore.slots.set(slotId, updated);
    this.recordResourceAudit(context, 'UPDATE_SLOT', slotId);
    return { ...updated };
  }

  public async setSlotActive(
    slotId: string,
    active: boolean,
    reason: string,
    confirm: boolean,
    context: ServiceContext
  ): Promise<void> {
    await scenarioManager.applyScenario(context.signal);
    this.verifyAdminRole(context);
    requireReasonConfirmation(reason, confirm);
    const slot = mockStore.slots.get(slotId);
    if (!slot) throw new AppError('NOT_FOUND', 'Slot not found');
    if (!active && hasFutureConfirmedBookings((booking) => booking.slotId === slotId)) {
      throw new AppError('CONFLICT', 'Slot deactivation is blocked by future confirmed bookings');
    }
    mockStore.slots.set(slotId, { ...slot, status: active ? 'AVAILABLE' : 'LOCKED_MAINTENANCE' });
    this.recordResourceAudit(context, active ? 'ACTIVATE_SLOT' : 'DEACTIVATE_SLOT', slotId, reason);
  }

  public async deactivateLocation(
    locationId: string,
    reason: string,
    confirm: boolean,
    context: ServiceContext
  ): Promise<void> {
    await scenarioManager.applyScenario(context.signal);
    this.verifyAdminRole(context);
    if (!confirm || !reason.trim()) throw new AppError('VALIDATION_ERROR', 'Reason and confirmation are required');
    const location = mockStore.locations.get(locationId);
    if (!location) throw new AppError('NOT_FOUND', 'Location not found');
    const today = mockStore.getCampusLocalDate();
    const impact = Array.from(mockStore.bookings.values()).filter(
      (booking) =>
        booking.locationId === locationId &&
        booking.status === 'CONFIRMED' &&
        booking.localDate >= today
    );
    if (impact.length > 0) {
      throw new AppError('CONFLICT', `Deactivation blocked by ${impact.length} future confirmed booking(s)`);
    }
    mockStore.locations.set(locationId, { ...location, active: false });
    const logId = `audit-demo-${mockStore.auditLogs.length + 1}`;
    mockStore.auditLogs.unshift({
      logId,
      adminId: context.actorSession!.userId,
      actorRole: context.actorSession!.role,
      action: 'DEACTIVATE_LOCATION',
      targetEntity: locationId,
      targetType: 'LOCATION',
      outcome: 'SUCCESS',
      correlationId: logId,
      safeReason: reason.trim().slice(0, 160),
      details: 'Location deactivated without deleting dependent history',
      timestamp: mockStore.getDemoClock(),
    });
  }

  public async listBookings(filters: AdminBookingFilters, context: ServiceContext): Promise<BookingRecord[]> {
    await scenarioManager.applyScenario(context.signal);
    this.verifyAdminRole(context);
    const term = filters.search?.trim().toLowerCase() ?? '';
    return Array.from(mockStore.bookings.values()).filter((booking) => {
      const matchesSearch =
        !term ||
        `${booking.bookingId} ${booking.locationName} ${booking.tableNumber} ${booking.participants.map((p) => p.displayName).join(' ')}`
          .toLowerCase()
          .includes(term);
      return (
        matchesSearch &&
        (!filters.status || filters.status === 'ALL' || booking.status === filters.status) &&
        (!filters.localDate || booking.localDate === filters.localDate)
      );
    });
  }

  public async cancelBooking(
    bookingId: string,
    reason: string,
    confirm: boolean,
    context: ServiceContext
  ): Promise<BookingRecord> {
    await scenarioManager.applyScenario(context.signal);
    this.verifyAdminRole(context);
    if (!confirm || !reason.trim()) throw new AppError('VALIDATION_ERROR', 'Reason and confirmation are required');
    const booking = await new MockBookingService().cancelBooking(bookingId, context);
    const logId = `audit-demo-${mockStore.auditLogs.length + 1}`;
    mockStore.auditLogs.unshift({
      logId,
      adminId: context.actorSession!.userId,
      actorRole: context.actorSession!.role,
      action: 'ADMIN_CANCEL_BOOKING',
      targetEntity: bookingId,
      targetType: 'BOOKING',
      outcome: 'SUCCESS',
      correlationId: logId,
      safeReason: reason.trim().slice(0, 160),
      details: 'Booking cancelled under documented administrator demo policy',
      timestamp: mockStore.getDemoClock(),
    });
    return booking;
  }
}

export class MockConversationService implements IConversationService {
  public async listConversations(
    context: ServiceContext
  ): Promise<Array<{ id: string; peerId: string }>> {
    await scenarioManager.applyScenario(context.signal);
    if (!appConfig.isMessagingEnabled) {
      throw new AppError(
        'FORBIDDEN',
        'Direct messaging is feature-flagged off pending architectural decision DEC-08'
      );
    }
    return [];
  }

  public async sendMessage(
    _conversationId: string,
    _content: string,
    context: ServiceContext
  ): Promise<{ messageId: string }> {
    await scenarioManager.applyScenario(context.signal);
    if (!appConfig.isMessagingEnabled) {
      throw new AppError(
        'FORBIDDEN',
        'Direct messaging is feature-flagged off pending architectural decision DEC-08'
      );
    }
    return { messageId: 'msg-demo-1' };
  }
}
