export type AppErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export class DomainError extends Error {
  public readonly code: AppErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: AppErrorCode, statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export interface ActorContext {
  userId: string;
  role: string;
  displayName: string;
  email?: string;
}

export interface UserSummary {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  accountStatus: string;
  verificationStatus: string;
}

export interface AuthSessionResponse {
  user: UserSummary;
  token: string;
  expiresAt: string;
}

export interface RegisterRequest {
  email: string;
  displayName: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ApiResponse<T> {
  data: T;
  operationId?: string;
  requestId: string;
}

export interface ApiErrorResponse {
  error: {
    code: AppErrorCode;
    message: string;
    details?: unknown;
  };
  operationId?: string;
  requestId: string;
}

export type TableZoneType =
  | 'SILENT_READING'
  | 'COLLABORATIVE_STUDY'
  | 'DISCUSSION_POD'
  | 'LAB_TERMINAL';

export type SlotStatus = 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'LOCKED_MAINTENANCE';

export type NoisePolicy = 'ABSOLUTE_SILENCE' | 'WHISPER_COLLAB' | 'CONVERSATIONAL';

export interface CampusLocation {
  id: string;
  name: string;
  building: string;
  totalTables: number;
  openTime: string;
  closeTime: string;
  hasPowerOutlets: boolean;
  hasWifi6: boolean;
  noisePolicy: NoisePolicy;
  active?: boolean;
}

export interface StudyTableSlot {
  slotId: string;
  locationId: string;
  locationName: string;
  building: string;
  tableId: string;
  tableNumber: string;
  date: string;
  startTime: string;
  endTime: string;
  zone: TableZoneType;
  status: SlotStatus;
  capacity: number;
  reservedCount: number;
}

export interface BookingParticipant {
  userId: string;
  displayName: string;
  role: 'CREATOR' | 'COMPANION';
}

export interface BookingRecord {
  bookingId: string;
  bookerId: string;
  clientOperationId?: string;
  participants: BookingParticipant[];
  companionStudentId?: string;
  companionDisplayName?: string;
  tableId: string;
  tableNumber?: string;
  locationId: string;
  locationName?: string;
  localDate: string;
  slotId: string;
  timeWindow?: string;
  status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  allowedActions?: ('CANCEL' | 'RESCHEDULE')[];
  partnerApprovalStatus: 'NOT_REQUIRED';
  bookingVersion: number;
  createdAt: string;
  cancelledAt?: string;
  rescheduledFromBookingId?: string;
}

export interface BookingCreationRequest {
  clientOperationId: string;
  tableId: string;
  locationId: string;
  localDate: string;
  slotId: string;
  companionStudentId: string;
}

export interface BookingCancelRequest {
  reason?: string;
  clientOperationId?: string;
}

export interface BookingRescheduleRequest {
  bookingId?: string;
  newLocalDate: string;
  newSlotId: string;
  newTableId?: string;
  newLocationId?: string;
  clientOperationId?: string;
}

export type DiscoveryMode = 'STUDY' | 'SOCIAL';
export type DiscoveryActionType = 'LIKE' | 'PASS' | 'HIDE';
export type RelationshipStatus = 'NONE' | 'LIKE_SENT' | 'MUTUAL_CONNECTED' | 'DISCONNECTED';

export interface DiscoveryActionResult {
  actionId: string;
  actorUserId: string;
  targetUserId: string;
  mode: DiscoveryMode;
  actionType: DiscoveryActionType;
  relationshipStatus: RelationshipStatus;
  connectionId?: string | null;
}

export interface ConnectionSummary {
  connectionId: string;
  peerId: string;
  peerDisplayName: string;
  peerDepartment?: string;
  mode: DiscoveryMode;
  status: RelationshipStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OtpChallengeResponse {
  challengeId: string;
  email: string;
  message: string;
}

export interface OtpRequestInput {
  email: string;
  displayName?: string;
}

export interface OtpVerifyRegistrationInput {
  email?: string;
  challengeId?: string;
  otp: string;
}

export interface OtpVerifyLoginInput {
  email?: string;
  challengeId?: string;
  otp: string;
}

export interface OtpSessionResponse {
  user: UserSummary;
  token: string;
  expiresAt: string;
  isFirstLogin: boolean;
}

export interface AdminResourceSummary {
  locationId: string;
  locationName: string;
  building: string;
  active: boolean;
  tableCount: number;
  futureConfirmedBookings: number;
  openTime?: string;
  closeTime?: string;
  hasPowerOutlets?: boolean;
  hasWifi6?: boolean;
  noisePolicy?: NoisePolicy;
}

export interface AdminTableResource {
  tableId: string;
  locationId: string;
  locationName?: string;
  tableNumber: string;
  capacity: 2;
  hasPowerOutlets: boolean;
  active: boolean;
}

export interface AdminLocationCreateRequest {
  name: string;
  building: string;
  totalTables?: number;
  openTime: string;
  closeTime: string;
  hasPowerOutlets?: boolean;
  hasWifi6?: boolean;
  noisePolicy?: NoisePolicy;
}

export interface AdminLocationUpdateRequest {
  name?: string;
  building?: string;
  totalTables?: number;
  openTime?: string;
  closeTime?: string;
  hasPowerOutlets?: boolean;
  hasWifi6?: boolean;
  noisePolicy?: NoisePolicy;
  active?: boolean;
}

export interface AdminTableCreateRequest {
  locationId: string;
  tableNumber?: string;
  hasPowerOutlets?: boolean;
}

export interface AdminTableUpdateRequest {
  locationId?: string;
  tableNumber?: string;
  hasPowerOutlets?: boolean;
  active?: boolean;
}

export interface AdminSlotCreateRequest {
  locationId: string;
  tableId: string;
  tableNumber?: string;
  date: string;
  startTime: string;
  endTime: string;
  zone?: TableZoneType;
  status?: SlotStatus;
}

export interface AdminSlotUpdateRequest {
  date?: string;
  startTime?: string;
  endTime?: string;
  zone?: TableZoneType;
  status?: SlotStatus;
  active?: boolean;
}

// --- Profile & Preferences Types ---
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

export interface CourseEnrollment {
  code: string;
  name?: string;
  department?: string;
  instructor?: string;
  courseId?: string;
}

export interface SocialInterestTag {
  id?: string;
  interestId?: string;
  name: string;
  category?: string;
  description?: string;
}

export interface StudyConsentRecord {
  hasConsent: boolean;
  consentedAt?: string;
}

export interface SocialConsentRecord {
  hasConsent: boolean;
  consentedAt?: string;
}

export interface PrivateUserProfile {
  userId: string;
  email: string;
  rollNumber: string;
  displayName: string;
  department: string;
  degree: string;
  year: number;
  isOnboarded: boolean;
  studyPreferences: StudyPreferences;
  courses: CourseEnrollment[];
  socialBio?: string;
  socialInterests?: SocialInterestTag[];
  studyConsent: StudyConsentRecord;
  socialConsent: SocialConsentRecord;
}

export interface ProfileUpdateRequest {
  displayName?: string;
  studyPreferences?: Partial<StudyPreferences>;
  courses?: CourseEnrollment[];
  socialBio?: string;
  socialInterests?: SocialInterestTag[];
}

