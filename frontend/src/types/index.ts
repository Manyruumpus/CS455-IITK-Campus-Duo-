/**
 * Campus Duo — Core Domain Type Definitions
 * Covers Student, Admin, Academic Study Matching, Consent-First Social, and Study Table Booking
 */

export type UserRole = 'ROLE_STUDENT' | 'ROLE_ADMIN';

export interface UserSession {
  userId: string;
  email: string;
  name: string;
  rollNumber?: string;
  role: UserRole;
  isOnboarded: boolean;
  hasSocialConsent: boolean;
  avatarUrl?: string;
}

// Academic Study Types
export interface CourseEnrollment {
  code: string; // e.g. "CS455", "MTH101"
  name: string;
  department: string;
  instructor?: string;
}

export type StudyStyle = 'QUIET_FOCUSED' | 'DISCUSSION_HEAVY' | 'PROBLEM_SOLVING' | 'HYBRID';
export type TargetPace = 'AHEAD_OF_CLASS' | 'STANDARD_REGULAR' | 'EXAM_CRAMMING';

export interface StudyProfile {
  id: string;
  userId: string;
  displayName: string;
  department: string;
  degree: 'B.Tech' | 'M.Tech' | 'PhD' | 'BS' | 'MSc';
  year: number;
  courses: CourseEnrollment[];
  studyStyle: StudyStyle;
  preferredPace: TargetPace;
  preferredTimes: Array<'MORNING' | 'AFTERNOON' | 'EVENING' | 'LATE_NIGHT'>;
  activeStatus: 'LOOKING' | 'PASSIVE' | 'UNAVAILABLE';
  aiMatchScore?: number;
  aiMatchReasons?: string[];
}

// Social Interest Types (Strictly friendship/peer networking, no dating)
export type SocialCategory = 'TECH_ACADEMIC' | 'CULTURAL_ARTS' | 'SPORTS_FITNESS' | 'CAMPUS_LIFE';

export interface SocialInterestTag {
  id: string;
  name: string;
  category: SocialCategory;
  description?: string;
}

export interface SocialPeerProfile {
  id: string;
  userId: string;
  displayName: string;
  bio: string;
  interests: SocialInterestTag[];
  connectionStatus: 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'MUTUAL_CONNECTED';
  maskedHandle?: string;
  revealedContact?: {
    platform: 'TELEGRAM' | 'EMAIL' | 'WHATSAPP';
    handle: string;
  };
}

// Study Table Booking Types
export type TableZoneType = 'SILENT_READING' | 'COLLABORATIVE_STUDY' | 'DISCUSSION_POD' | 'LAB_TERMINAL';
export type SlotStatus = 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'LOCKED_MAINTENANCE';

export interface CampusLocation {
  id: string;
  name: string; // e.g., "P.K. Kelkar Library — 2nd Floor", "Computer Centre CC-101"
  building: string;
  totalTables: number;
  openTime: string; // "08:00"
  closeTime: string; // "02:00"
  hasPowerOutlets: boolean;
  hasWifi6: boolean;
  noisePolicy: 'ABSOLUTE_SILENCE' | 'WHISPER_COLLAB' | 'CONVERSATIONAL';
}

export interface StudyTableSlot {
  slotId: string;
  locationId: string;
  tableNumber: string;
  zone: TableZoneType;
  startTime: string; // "14:00"
  endTime: string; // "16:00"
  date: string; // "2026-10-02"
  status: SlotStatus;
  capacity: number;
  reservedCount: number;
}

export interface TableBookingRecord {
  bookingId: string;
  slotId: string;
  tableNumber: string;
  locationName: string;
  date: string;
  timeWindow: string;
  companionName?: string;
  status: 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED';
  checkInToken: string;
  createdAt: string;
}

// Admin & Moderation Types
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
}

export interface AuditLogEntry {
  logId: string;
  adminId: string;
  action: string;
  targetEntity: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
}
