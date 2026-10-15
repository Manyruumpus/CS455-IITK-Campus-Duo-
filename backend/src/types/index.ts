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
