/**
 * Campus Duo — Service Interfaces & Abstract Adapter Placeholders
 *
 * ARCHITECTURAL BOUNDARY:
 * - Service adapters, not UI components, own API interactions.
 * - These typed interfaces represent proposed frontend contracts (Stage 01).
 * - Real backend contracts are not yet verified.
 * - Stage 03 will implement the concrete service adapter implementations.
 */

import {
  UserSession,
  StudyProfile,
  SocialPeerProfile,
  StudyTableSlot,
  TableBookingRecord,
  ModerationReport,
  AuditLogEntry,
} from '@/types';

// 1. Shared Authentication & Session
export interface IAuthService {
  getCurrentSession(): Promise<UserSession | null>;
  loginWithIITK(credentials?: { username: string; token: string }): Promise<UserSession>;
  logout(): Promise<void>;
  refreshToken(): Promise<UserSession>;
}

// 2. Study Partner Discovery (Canonical 2-person table partner model)
export interface IStudyService {
  listStudyPartners(courseCode?: string): Promise<StudyProfile[]>;
  getStudyPartner(studentId: string): Promise<StudyProfile | null>;
}

// 3. Consent-First Social Connections (Provisional generic categories)
export interface ISocialService {
  getSocialConsent(): Promise<{ hasConsent: boolean; consentedAt?: string }>;
  updateSocialConsent(optIn: boolean): Promise<void>;
  listSocialPeers(category?: string): Promise<SocialPeerProfile[]>;
}

// 4. Peer Connection Management (Study & Social requests)
export interface IConnectionService {
  sendConnectionRequest(targetStudentId: string, mode: 'STUDY' | 'SOCIAL', note?: string): Promise<{ requestId: string; status: 'PENDING' }>;
  listPendingRequests(): Promise<Array<{ requestId: string; senderId: string; mode: 'STUDY' | 'SOCIAL'; timestamp: string }>>;
  respondToRequest(requestId: string, action: 'ACCEPT' | 'DECLINE'): Promise<void>;
  disconnectPeer(connectionId: string): Promise<void>;
}

// 5. Shared Study Table Reservations (Canonical 2-person study table model)
export interface IBookingService {
  listTableSlots(locationId: string, date: string): Promise<StudyTableSlot[]>;
  reserveSlot(slotId: string, companionStudentId?: string): Promise<TableBookingRecord>;
  cancelBooking(bookingId: string, reason?: string): Promise<boolean>;
  getMyBookings(): Promise<TableBookingRecord[]>;
}

// 6. AI Recommendation Presentation & Status (Frontend presentation scope only)
// Note: Backend owns authoritative ranking, model orchestration, and policy enforcement.
// Agent UI must never grant autonomous booking or messaging authority.
export interface IAgentRecommendationService {
  submitMatchingQuery(courseCode: string, preferences: { studyStyle?: string; preferredPace?: string }): Promise<{ queryId: string; status: 'QUEUED' | 'PROCESSING' }>;
  getQueryStatus(queryId: string): Promise<{ status: 'PROCESSING' | 'COMPLETED' | 'FAILED'; results?: StudyProfile[]; fallbackReason?: string }>;
}

// 7. In-App Notifications
export interface INotificationService {
  listNotifications(): Promise<Array<{ id: string; title: string; body: string; type: 'INVITE' | 'BOOKING' | 'SYSTEM'; read: boolean; timestamp: string }>>;
  markAsRead(notificationId: string): Promise<void>;
  getUnreadCount(): Promise<number>;
}

// 8. Privacy, Blocking & Moderation Reporting
export interface IModerationService {
  reportUser(reportedUserId: string, category: string, description: string): Promise<{ reportId: string }>;
  blockUser(targetUserId: string): Promise<{ blocked: boolean }>;
  listBlockedUsers(): Promise<string[]>;
}

// 9. Conditional Direct Messaging (Provisional: subject to Open Decision DEC-08)
export interface IConversationService {
  listConversations(): Promise<Array<{ conversationId: string; peerId: string; lastMessagePreview?: string; unread: boolean }>>;
  sendMessage(conversationId: string, content: string): Promise<{ messageId: string; timestamp: string }>;
}

// 10. Administrative Management
export interface IAdminService {
  listModerationReports(): Promise<ModerationReport[]>;
  resolveReport(reportId: string, action: 'DISMISS' | 'WARN_USER' | 'SUSPEND_USER', notes: string): Promise<void>;
  listAuditLogs(): Promise<AuditLogEntry[]>;
}
