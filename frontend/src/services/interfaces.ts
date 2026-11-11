/**
 * Campus Duo — Service Interfaces & Abstract Adapter Contracts
 *
 * ARCHITECTURAL CONTRACTS:
 * 1. UI components and query hooks consume these interfaces, never raw endpoints or in-memory stores.
 * 2. Actor identity is resolved strictly via ServiceContext. Caller-supplied userIds are never trusted for authorization.
 * 3. AbortSignal is passed through cancellable service reads and mock delays.
 */

import {
  UserSession,
  UserRole,
  PrivateUserProfile,
  PublicStudyProfile,
  PublicSocialProfile,
  StudyPreferences,
  StudyRecommendation,
  StudyConsentRecord,
  SocialConsentRecord,
  SocialRecommendation,
  ConnectionMode,
  PeerConnection,
  CampusLocation,
  StudyTableSlot,
  BookingCreationRequest,
  BookingRescheduleRequest,
  AgentMatchResult,
  NotificationItem,
  ModerationReport,
  AuditLogEntry,
  StudentOnboardingRequest,
  ProfileUpdateRequest,
  SelfPreviewResult,
  StudyActionType,
  StudyDiscoveryFilters,
  StudyActionResult,
  ConnectionSummaryItem,
  ConnectionDetailView,
  ConnectionCounts,
  ConnectionViewBucket,
  ReportReceipt,
  NotificationMode,
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
} from '@/types';
import { SocialActionType, SocialActionResult, SocialDiscoveryFilters } from '@/types/social';

export interface ServiceContext {
  actorSession: UserSession | null;
  signal?: AbortSignal;
}

// 1. Session & Identity Service
export interface IAuthService {
  getCurrentSession(context?: ServiceContext): Promise<UserSession | null>;
  loginWithDemoRole(role: UserRole, context?: ServiceContext): Promise<UserSession>;
  logout(context?: ServiceContext): Promise<void>;
  refreshToken(context?: ServiceContext): Promise<UserSession>;
}

// 2. Profile Management Service
export interface IProfileService {
  getPrivateProfile(context: ServiceContext): Promise<PrivateUserProfile>;
  updatePrivateProfile(request: ProfileUpdateRequest, context: ServiceContext): Promise<PrivateUserProfile>;
  completeOnboarding(request: StudentOnboardingRequest, context: ServiceContext): Promise<PrivateUserProfile>;
  getPublicStudyProfile(targetUserId: string, context: ServiceContext): Promise<PublicStudyProfile>;
  getSelfStudyPreview(context: ServiceContext): Promise<SelfPreviewResult<PublicStudyProfile>>;
  getSelfSocialPreview(context: ServiceContext): Promise<SelfPreviewResult<PublicSocialProfile>>;
}

// 3. Academic Study Partner Discovery & AI Recommendation
export interface IStudyService {
  getStudyConsent(context: ServiceContext): Promise<StudyConsentRecord>;
  updateStudyConsent(optIn: boolean, context: ServiceContext): Promise<StudyConsentRecord>;
  listStudyPartners(options?: StudyDiscoveryFilters, context?: ServiceContext): Promise<StudyRecommendation[]>;
  getStudyPartner(targetStudentId: string, context: ServiceContext): Promise<StudyRecommendation | null>;
  recordStudyAction(targetStudentId: string, action: StudyActionType, context: ServiceContext): Promise<StudyActionResult>;
  submitMatchingQuery(courseCode: string, preferences: Partial<StudyPreferences>, context: ServiceContext): Promise<AgentMatchResult>;
  getMatchingStatus(queryId: string, context: ServiceContext): Promise<AgentMatchResult>;
  resetDiscoveryRound(context: ServiceContext): Promise<void>;
}

// 4. Consent-First Campus Social Discovery
export interface ISocialService {
  getSocialConsent(context: ServiceContext): Promise<SocialConsentRecord>;
  updateSocialConsent(optIn: boolean, context: ServiceContext): Promise<SocialConsentRecord>;
  listSocialPeers(options: SocialDiscoveryFilters | undefined, context: ServiceContext): Promise<SocialRecommendation[]>;
  getSocialPeer(targetStudentId: string, context: ServiceContext): Promise<SocialRecommendation | null>;
  /** Record a SOCIAL Like, Pass, or Hide. Isolated from study actions. */
  recordSocialAction(targetStudentId: string, action: SocialActionType, context: ServiceContext): Promise<SocialActionResult>;
  /** Reset current social discovery round (clears PASS set; HIDE persists until full reset). */
  resetSocialDiscoveryRound(context: ServiceContext): Promise<void>;
  /** List actor's mutual SOCIAL connections for the connections summary view. */
  listSocialConnections(context: ServiceContext): Promise<SocialRecommendation[]>;
}

// 5. Peer Connection & Relationship Management
export interface IConnectionService {
  sendConnectionRequest(targetStudentId: string, mode: ConnectionMode, note: string | undefined, context: ServiceContext): Promise<PeerConnection>;
  listConnections(mode: ConnectionMode, context: ServiceContext): Promise<PeerConnection[]>;
  getConnection(connectionId: string, context: ServiceContext): Promise<PeerConnection>;
  /** Stage 07: Participant-scoped summaries. Derives outgoing/incoming/mutual state from Like records. */
  listConnectionSummaries(mode: ConnectionMode, bucket: ConnectionViewBucket | 'ALL', context: ServiceContext): Promise<ConnectionSummaryItem[]>;
  /** Stage 07: Authorized detail view for a specific relationship. */
  getConnectionDetail(connectionId: string, context: ServiceContext): Promise<ConnectionDetailView>;
  /** Stage 07: Bucket counts derived from the same deterministic derivation as summary lists. */
  getConnectionCounts(mode: ConnectionMode, context: ServiceContext): Promise<ConnectionCounts>;
  /** Stage 07: Coordinated full demo reset across study/social stores, actions and scenario state. */
  resetDemoState(context: ServiceContext): Promise<void>;
}

// 6. Campus Table Reservation Service
export interface IBookingService {
  listLocations(context: ServiceContext): Promise<CampusLocation[]>;
  listTableAvailability(locationId: string, date: string, context: ServiceContext): Promise<StudyTableSlot[]>;
  getBooking(bookingId: string, context: ServiceContext): Promise<BookingRecord>;
  createBooking(request: BookingCreationRequest, context: ServiceContext): Promise<BookingRecord>;
  reconcileBooking(clientOperationId: string, context: ServiceContext): Promise<BookingRecord | null>;
  rescheduleBooking(request: BookingRescheduleRequest, context: ServiceContext): Promise<BookingRecord>;
  cancelBooking(bookingId: string, context: ServiceContext): Promise<BookingRecord>;
  getMyBookings(context: ServiceContext): Promise<BookingRecord[]>;
}

// 7. In-App Notifications
export interface INotificationService {
  listNotifications(context: ServiceContext): Promise<NotificationItem[]>;
  listNotifications(
    filters: { unreadOnly?: boolean; type?: NotificationMode | 'ALL' },
    context: ServiceContext
  ): Promise<NotificationItem[]>;
  markAsRead(notificationId: string, context: ServiceContext): Promise<void>;
  markAsUnread(notificationId: string, context: ServiceContext): Promise<void>;
  markAllAsRead(context: ServiceContext): Promise<void>;
  getUnreadCount(context: ServiceContext): Promise<number>;
}

// 8. Privacy, Blocking & Moderation Reporting
export interface IModerationService {
  reportUser(reportedUserId: string, category: string, description: string | undefined, context: ServiceContext): Promise<ReportReceipt>;
  blockUser(targetUserId: string, context: ServiceContext): Promise<{ blocked: boolean }>;
  listBlockedUsers(context: ServiceContext): Promise<string[]>;
  listMyReports(context: ServiceContext): Promise<ReportReceipt[]>;
}

// 9. Administrative Governance & Audit
export interface IAdminService {
  listModerationReports(context: ServiceContext): Promise<ModerationReport[]>;
  resolveReport(
    reportId: string,
    request: { action: 'DISMISS' | 'WARN_USER' | 'SUSPEND_USER'; reason: string; confirm: boolean },
    context: ServiceContext
  ): Promise<ModerationReport>;
  listAuditLogs(context: ServiceContext): Promise<AuditLogEntry[]>;
  getDashboardSummary(context: ServiceContext): Promise<AdminDashboardSummary>;
  listUsers(search: string | undefined, context: ServiceContext): Promise<AdminUserSummary[]>;
  getUser(userId: string, context: ServiceContext): Promise<AdminUserSummary>;
  listResources(context: ServiceContext): Promise<AdminResourceSummary[]>;
  createLocation(request: AdminLocationCreateRequest, context: ServiceContext): Promise<CampusLocation>;
  updateLocation(locationId: string, request: AdminLocationUpdateRequest, context: ServiceContext): Promise<CampusLocation>;
  deactivateLocation(locationId: string, reason: string, confirm: boolean, context: ServiceContext): Promise<void>;
  listTables(context: ServiceContext): Promise<AdminTableResource[]>;
  createTable(request: AdminTableCreateRequest, context: ServiceContext): Promise<AdminTableResource>;
  updateTable(tableId: string, request: AdminTableUpdateRequest, context: ServiceContext): Promise<AdminTableResource>;
  setTableActive(tableId: string, active: boolean, reason: string, confirm: boolean, context: ServiceContext): Promise<void>;
  createSlot(request: AdminSlotCreateRequest, context: ServiceContext): Promise<StudyTableSlot>;
  listSlots(context: ServiceContext): Promise<StudyTableSlot[]>;
  updateSlot(slotId: string, request: AdminSlotUpdateRequest, context: ServiceContext): Promise<StudyTableSlot>;
  setSlotActive(slotId: string, active: boolean, reason: string, confirm: boolean, context: ServiceContext): Promise<void>;
  listBookings(filters: AdminBookingFilters, context: ServiceContext): Promise<BookingRecord[]>;
  cancelBooking(bookingId: string, reason: string, confirm: boolean, context: ServiceContext): Promise<BookingRecord>;
}

// 10. Conditional Direct Messaging (DEC-08 Feature Flagged)
export interface IConversationService {
  listConversations(context: ServiceContext): Promise<Array<{ id: string; peerId: string }>>;
  sendMessage(conversationId: string, content: string, context: ServiceContext): Promise<{ messageId: string }>;
}

export interface AppServices {
  auth: IAuthService;
  profile: IProfileService;
  study: IStudyService;
  social: ISocialService;
  connection: IConnectionService;
  booking: IBookingService;
  notification: INotificationService;
  moderation: IModerationService;
  admin: IAdminService;
  conversation: IConversationService;
}
