/**
 * Campus Duo — Core Domain Type Definitions & Error Model
 *
 * Stage 03 Frontend-Proposed Domain Contracts.
 * Explicit separation of private profile, permission-filtered public views,
 * independent consent records, recommendation metadata, and canonical table units.
 */

export type UserRole = 'ROLE_STUDENT' | 'ROLE_ADMIN';

// --- Session & Identity ---
export interface UserSession {
  userId: string;
  email: string;
  name: string;
  rollNumber?: string;
  role: UserRole;
  isOnboarded: boolean;
  hasStudyConsent: boolean;
  hasSocialConsent: boolean;
  avatarUrl?: string;
}

// --- Independent Consent Records ---
export interface StudyConsentRecord {
  hasConsent: boolean;
  consentedAt?: string;
}

export interface SocialConsentRecord {
  hasConsent: boolean;
  consentedAt?: string;
}

// --- Academic Study Types ---
export interface CourseEnrollment {
  code: string; // e.g. "CS455", "MTH101"
  name: string;
  department: string;
  instructor?: string;
}

export type StudyStyle = 'QUIET_FOCUSED' | 'DISCUSSION_HEAVY' | 'PROBLEM_SOLVING' | 'HYBRID';
export type TargetPace = 'AHEAD_OF_CLASS' | 'STANDARD_REGULAR' | 'EXAM_CRAMMING';
export type PreferredStudyTime = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'LATE_NIGHT';

export interface StudyPreferences {
  studyStyle?: StudyStyle;
  preferredPace?: TargetPace;
  preferredTimes: PreferredStudyTime[];
  studyGoals?: string;
  preferredLocation?: string;
}

// Modes selectable during onboarding
export type DiscoveryModeSelection = 'STUDY' | 'SOCIAL' | 'BOTH' | 'NEITHER';

// Student Onboarding Request Contract
export interface StudentOnboardingRequest {
  displayName: string;
  modesSelected: DiscoveryModeSelection;
  studyPreferences?: Partial<StudyPreferences>;
  courses?: CourseEnrollment[];
  socialBio?: string;
  socialInterests?: SocialInterestTag[];
  studyConsent: boolean;
  socialConsent: boolean;
}

// In-Memory Onboarding Draft (resumable across permitted navigation, scoped to identity)
export interface OnboardingDraftState {
  currentStep: number;
  displayName: string;
  modesSelected: DiscoveryModeSelection;
  studyPreferences: Partial<StudyPreferences>;
  courses: CourseEnrollment[];
  socialBio: string;
  socialInterests: SocialInterestTag[];
  studyConsent: boolean;
  socialConsent: boolean;
}

// Explicit editable-field projection for profile updates
export interface ProfileUpdateRequest {
  displayName?: string;
  studyPreferences?: Partial<StudyPreferences>;
  courses?: CourseEnrollment[];
  socialBio?: string;
  socialInterests?: SocialInterestTag[];
}

// Self-Preview wrapper (works while discovery is disabled, explicit labeling)
export interface SelfPreviewResult<T> {
  profile: T;
  isDiscoverable: boolean;
  previewNotice?: string;
}

// Private Student Profile (Accessible only by self; identity fields are read-only demo fixtures)
export interface PrivateUserProfile {
  userId: string;
  email: string;
  rollNumber: string;
  displayName: string;
  department: string;
  degree: 'B.Tech' | 'M.Tech' | 'PhD' | 'BS' | 'MSc';
  year: number;
  isOnboarded: boolean;
  studyPreferences: StudyPreferences;
  courses: CourseEnrollment[];
  socialBio?: string;
  socialInterests?: SocialInterestTag[];
  studyConsent: StudyConsentRecord;
  socialConsent: SocialConsentRecord;
}

// Public Academic Study Profile (Permission-filtered; sensitive fields strictly excluded)
export interface PublicStudyProfile {
  userId: string;
  displayName: string;
  department: string;
  degree: 'B.Tech' | 'M.Tech' | 'PhD' | 'BS' | 'MSc';
  year: number;
  courses: CourseEnrollment[];
  studyStyle: StudyStyle;
  preferredPace: TargetPace;
  preferredTimes: PreferredStudyTime[];
  activeStatus: 'LOOKING' | 'PASSIVE' | 'UNAVAILABLE';
}

// --- Stage 05 Study Matching & Discovery Contracts ---
export type StudyActionType = 'LIKE' | 'PASS' | 'HIDE';

export interface StudyDiscoveryFilters {
  courseCode?: string;
  preferredTime?: PreferredStudyTime;
  studyStyle?: StudyStyle;
  preferredPace?: TargetPace;
  search?: string;
}

export interface CompatibilityFactorContribution {
  name: string;
  baseWeight: number; // Documented base weight (e.g. 35, 25, 10, 10, 10, 10)
  effectiveWeight: number; // Renormalized active weight: (baseWeight / activeBaseWeightTotal) * 100
  weight: number; // Backward-compatible integer weight
  normalizedScore: number; // 0 - 1
  weightedScore: number; // Contribution points to final 0-100 score
  explanation: string;
}

export interface CompatibilityBreakdown {
  overallScore: number; // 0 - 100 bounded
  courseFactor: CompatibilityFactorContribution;
  timeFactor: CompatibilityFactorContribution;
  styleFactor?: CompatibilityFactorContribution; // Optional style subfactor (base weight: 10)
  paceFactor?: CompatibilityFactorContribution;  // Optional pace subfactor (base weight: 10)
  paceStyleFactor?: CompatibilityFactorContribution; // Kept for backward compatibility
  locationFactor?: CompatibilityFactorContribution; // Optional location factor (base weight: 10)
  goalsFactor?: CompatibilityFactorContribution; // Optional goals factor (base weight: 10)
  omittedFactors: string[];
  activeBaseWeightTotal: number; // Sum of active base weights (60 - 100)
  dataCompletenessScore: number; // activeBaseWeightTotal / 100 (0.60 - 1.00)
  isNearTied?: boolean;
}

export interface StudyActionResult {
  targetStudentId: string;
  action: StudyActionType;
  relationshipStatus: RelationshipStatus;
  recordedAt: string;
}

// Recommendation & Matching Metadata (Separated from public profile entity)
export interface StudyRecommendation {
  profile: PublicStudyProfile;
  aiMatchScore: number;
  aiMatchReasons: string[];
  dataCompletenessScore: number;
  relationshipStatus: RelationshipStatus;
  compatibilityBreakdown?: CompatibilityBreakdown;
}

export type AgentMatchStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FALLBACK' | 'FAILED';

export interface AgentMatchResult {
  queryId: string;
  status: AgentMatchStatus;
  results?: StudyRecommendation[];
  suggestedAlternatives?: StudyRecommendation[]; // Broader alternative suggestions when exact course has no matches
  fallbackReason?: string;
  generatedAt: string;
}

// --- Social Connection Types ---
export type SocialCategory = 'TECH_ACADEMIC' | 'CULTURAL_ARTS' | 'SPORTS_FITNESS' | 'CAMPUS_LIFE';

export interface SocialInterestTag {
  id: string;
  name: string;
  category: SocialCategory;
  description?: string;
}

// Public Social Peer Profile (Contact details strictly excluded by default; disclosure is pending policy)
export interface PublicSocialProfile {
  userId: string;
  displayName: string;
  bio: string;
  interests: SocialInterestTag[];
}

export interface SocialRecommendation {
  profile: PublicSocialProfile;
  matchScore: number;
  sharedInterests: string[];
  /** Grounded human-readable reasons derived from stored public data (Stage 06). */
  groundedReasons?: string[];
  relationshipStatus: RelationshipStatus;
}

// --- Likes & Connections (Separated by Mode) ---
export type ConnectionMode = 'STUDY' | 'SOCIAL';
export type RelationshipStatus = 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'MUTUAL_CONNECTED' | 'DISCONNECTED';

export interface PeerConnection {
  connectionId: string;
  studentAId: string; // Requester
  studentBId: string; // Target
  mode: ConnectionMode;
  status: RelationshipStatus;
  note?: string;
  isRestricted?: boolean; // Stage 07: visibility under blocking/opt-out
  createdAt: string;
  updatedAt: string;
}

/**
 * Stage 07: Directional request state derived from Like records for a specific mode.
 * The actor sees one of these buckets for each connection: outgoing Likes,
 * incoming Likes (under explicit demo policy), or mutual connections.
 */
export type ConnectionViewBucket = 'OUTGOING' | 'INCOMING' | 'MUTUAL';

/**
 * Stage 07: Participant-view summary row returned by listConnectionSummaries.
 * Merges the directional relationship state with permission-filtered public peer
 * identity. Intentionally excludes contact details, private schedules, or any
 * discovery-only scoring. SOCIAL-only rows never enable study-booking eligibility.
 */
export interface ConnectionSummaryItem {
  connectionId: string;
  mode: ConnectionMode;
  peerId: string;
  peerDisplayName: string;
  peerDepartment?: string;
  peerDegree?: string;
  peerYear?: number;
  peerBio?: string;
  peerInterests: Array<{ id: string; name: string; category?: string }>;
  peerCourses: Array<{ code: string; name: string }>;
  bucket: ConnectionViewBucket;
  note?: string;
  isRestricted: boolean;
  restrictedReason?: 'BLOCKED' | 'OPTED_OUT' | 'PENDING_POLICY';
  /** Only true for mutual STUDY connections under existing mock rules. */
  isStudyBookingEligible: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Stage 07: Authorized detail for a specific relationship. Returned only to
 * participants. Contact details and private schedules are explicitly excluded;
 * only a permission-filtered public projection is shown.
 */
export interface ConnectionDetailView {
  connectionId: string;
  mode: ConnectionMode;
  peerId: string;
  peerDisplayName: string;
  peerDepartment?: string;
  peerDegree?: string;
  peerYear?: number;
  peerBio?: string;
  peerInterests: Array<{ id: string; name: string; category?: string }>;
  peerCourses: Array<{ code: string; name: string }>;
  relationshipStatus: RelationshipStatus;
  note?: string;
  isRestricted: boolean;
  restrictedReason?: 'BLOCKED' | 'OPTED_OUT' | 'PENDING_POLICY';
  /** Documented demo policy for this connection view. */
  visibilityPolicy: 'ONE_SIDED_VISIBLE_DEMO' | 'MUTUAL_ONLY';
  /** Only true for a mutual STUDY connection. */
  isStudyBookingEligible: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Counts per bucket for the current actor and mode. */
export interface ConnectionCounts {
  outgoing: number;
  incoming: number;
  mutual: number;
}

// --- Study Table Booking Types ---
export type TableZoneType = 'SILENT_READING' | 'COLLABORATIVE_STUDY' | 'DISCUSSION_POD' | 'LAB_TERMINAL';
export type SlotStatus = 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'LOCKED_MAINTENANCE';

export interface CampusLocation {
  id: string;
  name: string;
  building: string;
  totalTables: number;
  openTime: string;
  closeTime: string;
  hasPowerOutlets: boolean;
  hasWifi6: boolean;
  noisePolicy: 'ABSOLUTE_SILENCE' | 'WHISPER_COLLAB' | 'CONVERSATIONAL';
  active?: boolean;
}

// Canonical Bookable Unit: tableId + localDate + slotId (Capacity: 2)
export interface StudyTableSlot {
  slotId: string;
  locationId: string;
  tableId?: string;
  tableNumber: string;
  zone: TableZoneType;
  startTime: string; // "14:00"
  endTime: string;   // "16:00"
  date: string;      // "2026-10-08"
  status: SlotStatus;
  capacity: 2;       // Strict canonical pair model
  reservedCount: number;
}

export type BookingStatus = 'CONFIRMED' | 'PENDING_PARTNER_APPROVAL' | 'COMPLETED' | 'CANCELLED';
export type AllowedBookingAction = 'CANCEL' | 'RESCHEDULE';
export type PartnerApprovalPolicyStatus = 'UNRESOLVED_PENDING' | 'AUTO_ACCEPTED' | 'NOT_REQUIRED';

export type BookingParticipantRole = 'CREATOR' | 'COMPANION';

export interface BookingParticipant {
  userId: string;
  displayName: string;
  role: BookingParticipantRole;
}

export interface BookingRecord {
  bookingId: string;
  bookerId: string;
  clientOperationId?: string; // Stable idempotency identifier for operation reconciliation
  participants: BookingParticipant[];
  companionStudentId?: string;
  companionDisplayName?: string;
  tableId: string;
  locationId: string;
  localDate: string;
  slotId: string;
  tableNumber: string;
  locationName: string;
  timeWindow: string;
  status: BookingStatus;
  allowedActions: AllowedBookingAction[];
  partnerApprovalStatus: PartnerApprovalPolicyStatus;
  createdAt: string;
  cancelledAt?: string;
  rescheduledFromBookingId?: string;
}

export interface BookingCreationRequest {
  /** Stable idempotency token generated once per logical submission attempt (proposed frontend/mock contract). */
  clientOperationId?: string;
  tableId: string;
  locationId: string;
  localDate: string;
  slotId: string;
  companionStudentId?: string;
}

export interface BookingRescheduleRequest {
  bookingId: string;
  newLocalDate: string;
  newSlotId: string;
  newTableId?: string;
  newLocationId?: string;
}

// Backward-compatible types for Stage 02 fixture pages
export interface Course {
  code: string;
  name: string;
  department: string;
  instructor?: string;
}

export interface InterestTag {
  id: string;
  name: string;
  category: string;
}

export interface StudyProfile {
  id: string;
  userId: string;
  displayName: string;
  department: string;
  degree: string;
  year: number;
  courses: Course[];
  studyStyle: string;
  preferredPace: string;
  preferredTimes: string[];
  activeStatus: string;
  aiMatchScore?: number;
  aiMatchReasons?: string[];
}

export interface SocialPeerProfile {
  id: string;
  userId: string;
  displayName: string;
  bio: string;
  interests: InterestTag[];
  connectionStatus: string;
}

// --- In-App Notifications ---
export type NotificationEventType =
  | 'CONNECTION_MUTUAL'
  | 'BOOKING_CREATED'
  | 'BOOKING_RESCHEDULED'
  | 'BOOKING_CANCELLED'
  | 'REPORT_RECEIVED'
  | 'REPORT_STATUS_UPDATED'
  | 'SYSTEM';

export type NotificationMode = 'STUDY' | 'SOCIAL' | 'BOOKING' | 'MODERATION' | 'SYSTEM';

export type NotificationDestination =
  | { kind: 'BOOKING'; bookingId: string }
  | { kind: 'CONNECTION'; connectionId: string }
  | { kind: 'REPORT'; reportId: string }
  | { kind: 'SETTINGS' };

export interface NotificationItem {
  id: string;
  recipientId: string;
  title: string;
  body: string;
  type: 'INVITE' | 'BOOKING' | 'SYSTEM' | 'CONNECTION' | 'MODERATION';
  eventType?: NotificationEventType;
  mode?: NotificationMode;
  destination?: NotificationDestination;
  isRead: boolean;
  timestamp: string;
}

// --- Moderation & Reporting ---
export interface ModerationReport {
  reportId: string;
  reporterUserId: string;
  reportedUserId: string;
  reportedUserName: string;
  category: 'HARASSMENT' | 'UNAUTHORIZED_PROMOTION' | 'ACADEMIC_DISHONESTY' | 'IMPERSONATION' | 'OTHER';
  description: string;
  evidenceSnippet?: string;
  timestamp: string;
  status: 'PENDING_REVIEW' | 'WARNED' | 'SUSPENDED' | 'DISMISSED';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewReason?: string;
  auditLogId?: string;
}

export interface ReportReceipt {
  reportId: string;
  reporterUserId: string;
  reportedUserId: string;
  status: ModerationReport['status'];
  createdAt: string;
}

export interface AuditLogEntry {
  logId: string;
  adminId: string;
  actorRole?: UserRole;
  action: string;
  targetEntity: string;
  targetType?: string;
  outcome?: 'SUCCESS' | 'REJECTED';
  correlationId?: string;
  safeReason?: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
}

export interface AdminUserSummary {
  userId: string;
  displayName: string;
  rollNumber?: string;
  department?: string;
  role: UserRole;
  status: 'ACTIVE' | 'SUSPENDED' | 'ONBOARDED_INCOMPLETE';
  studyConsent: boolean;
  socialConsent: boolean;
}

export interface AdminDashboardSummary {
  activeLocations: number;
  activeTables: number;
  confirmedBookings: number;
  pendingReports: number;
  auditEvents: number;
}

export interface AdminResourceSummary {
  locationId: string;
  locationName: string;
  building: string;
  active: boolean;
  tableCount: number;
  futureConfirmedBookings: number;
}

export interface AdminTableResource {
  tableId: string;
  locationId: string;
  tableNumber: string;
  capacity: 2;
  hasPowerOutlets: boolean;
  active: boolean;
}

export interface AdminLocationCreateRequest {
  locationId: string;
  name: string;
  building: string;
  totalTables: number;
  openTime: string;
  closeTime: string;
  hasPowerOutlets: boolean;
  hasWifi6: boolean;
  noisePolicy: CampusLocation['noisePolicy'];
}

export type AdminLocationUpdateRequest = Partial<Omit<AdminLocationCreateRequest, 'locationId'>>;

export interface AdminTableCreateRequest {
  tableId: string;
  locationId: string;
  tableNumber: string;
  hasPowerOutlets: boolean;
}

export type AdminTableUpdateRequest = Partial<Omit<AdminTableCreateRequest, 'tableId'>>;

export interface AdminSlotCreateRequest {
  slotId: string;
  locationId: string;
  tableId: string;
  tableNumber: string;
  zone: TableZoneType;
  startTime: string;
  endTime: string;
  date: string;
}

export type AdminSlotUpdateRequest = Partial<Omit<AdminSlotCreateRequest, 'slotId'>>;

export interface AdminBookingFilters {
  search?: string;
  status?: BookingRecord['status'] | 'ALL';
  localDate?: string;
}

// --- Typed Application Error Model ---
export const ErrorCode = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  AGENT_FAILED: 'AGENT_FAILED',
  UNCERTAIN_MUTATION: 'UNCERTAIN_MUTATION',
  UNSUPPORTED_ACTION: 'UNSUPPORTED_ACTION',
  CANCELLED: 'CANCELLED',
} as const;

export type AppErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly details?: Record<string, unknown>;
  public readonly isTransient: boolean;

  constructor(
    code: AppErrorCode,
    message: string,
    options?: { details?: Record<string, unknown>; isTransient?: boolean }
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = options?.details;
    // Transient errors can be safely retried; logic/permission/conflict errors must never retry
    this.isTransient = options?.isTransient ?? (code === 'SERVICE_UNAVAILABLE');
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
