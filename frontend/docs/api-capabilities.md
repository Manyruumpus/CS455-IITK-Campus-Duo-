# Campus Duo — API Capabilities & Service Adapter Contracts

**Document Version**: 1.1.0-stage01-revised  
**Status**: Proposed Architecture & Service Placeholder Specification  
**Boundary Warning**: *No actual backend contract is currently verified. All schemas and endpoints detailed below represent proposed frontend client-side contracts. Service adapters own all data orchestration; UI components consume abstract interfaces.*

---

## 1. Service Adapter Architecture Pattern

To prevent tight coupling between UI components and unstable or hypothetical backend endpoints, all network requests flow through **Typed Service Adapters**:

```
UI Component (React)
       │
       ▼
React Hook (TanStack Query)
       │
       ▼
Service Interface (e.g., IBookingService)
       │
       ├──► [Development / Test]: MockServiceAdapter (Deterministic in-memory state & fixture delay)
       │
       └──► [Production / Staging]: HttpServiceAdapter (Axios / Fetch with IITK SSO bearer tokens)
```

---

## 2. Proposed Service Capability Placeholders (`CAP-*`)

### 2.1 Authentication & Session Service (`CAP-AUTH`)
```typescript
export interface IAuthService {
  loginWithIITK(credentials?: { username: string; token: string }): Promise<UserSession>;
  handleOAuthCallback(code: string, state: string): Promise<UserSession>;
  getCurrentSession(): Promise<UserSession | null>;
  refreshToken(): Promise<UserSession>;
  logout(): Promise<void>;
}
```

### 2.2 Study Partner Discovery Service (`CAP-STUDY`)
```typescript
export interface IStudyService {
  listStudyPartners(courseCode?: string): Promise<StudyProfile[]>;
  getStudyPartner(studentId: string): Promise<StudyProfile | null>;
}
```

### 2.3 Consent-First Social Service (`CAP-SOC`)
```typescript
export interface ISocialService {
  getSocialConsent(): Promise<{ hasConsent: boolean; consentedAt?: string }>;
  updateSocialConsent(optIn: boolean): Promise<void>;
  listSocialPeers(category?: string): Promise<SocialPeerProfile[]>;
}
```

### 2.4 Peer Connection Management Service (`CAP-CONN`)
```typescript
export interface IConnectionService {
  sendConnectionRequest(targetStudentId: string, mode: 'STUDY' | 'SOCIAL', note?: string): Promise<{ requestId: string; status: 'PENDING' }>;
  listPendingRequests(): Promise<Array<{ requestId: string; senderId: string; mode: 'STUDY' | 'SOCIAL'; timestamp: string }>>;
  respondToRequest(requestId: string, action: 'ACCEPT' | 'DECLINE'): Promise<void>;
  disconnectPeer(connectionId: string): Promise<void>;
}
```

### 2.5 Campus Table Reservation Service (`CAP-BOOK`)
*Enforces the canonical two-person study table model.*
```typescript
export interface IBookingService {
  listTableSlots(locationId: string, date: string): Promise<StudyTableSlot[]>;
  reserveSlot(slotId: string, companionStudentId?: string): Promise<TableBookingRecord>;
  cancelBooking(bookingId: string, reason?: string): Promise<boolean>;
  getMyBookings(): Promise<TableBookingRecord[]>;
}
```

### 2.6 AI Recommendation Presentation Service (`CAP-AI`)
*Frontend presentation scope only. Backend owns authoritative ranking, orchestration, and policy enforcement. The agent UI has zero autonomous authority to execute bookings or send messages.*
```typescript
export interface IAgentRecommendationService {
  submitMatchingQuery(courseCode: string, preferences: { studyStyle?: string; preferredPace?: string }): Promise<{ queryId: string; status: 'QUEUED' | 'PROCESSING' }>;
  getQueryStatus(queryId: string): Promise<{ status: 'PROCESSING' | 'COMPLETED' | 'FAILED'; results?: StudyProfile[]; fallbackReason?: string }>;
}
```

### 2.7 In-App Notifications Service (`CAP-NOTIF`)
```typescript
export interface INotificationService {
  listNotifications(): Promise<Array<{ id: string; title: string; body: string; type: 'INVITE' | 'BOOKING' | 'SYSTEM'; read: boolean; timestamp: string }>>;
  markAsRead(notificationId: string): Promise<void>;
  getUnreadCount(): Promise<number>;
}
```

### 2.8 Privacy, Blocking & Moderation Reporting (`CAP-MOD`)
```typescript
export interface IModerationService {
  reportUser(reportedUserId: string, category: string, description: string): Promise<{ reportId: string }>;
  blockUser(targetUserId: string): Promise<{ blocked: boolean }>;
  listBlockedUsers(): Promise<string[]>;
}
```

### 2.9 Conditional Messaging Service (`CAP-CHAT`)
*Provisional placeholder subject to Open Decision DEC-08 (chat vs external handle exchange).*
```typescript
export interface IConversationService {
  listConversations(): Promise<Array<{ conversationId: string; peerId: string; lastMessagePreview?: string; unread: boolean }>>;
  sendMessage(conversationId: string, content: string): Promise<{ messageId: string; timestamp: string }>;
}
```

### 2.10 Administrative Management Service (`CAP-ADM`)
```typescript
export interface IAdminService {
  listModerationReports(): Promise<ModerationReport[]>;
  resolveReport(reportId: string, action: 'DISMISS' | 'WARN_USER' | 'SUSPEND_USER', notes: string): Promise<void>;
  listAuditLogs(): Promise<AuditLogEntry[]>;
}
```

---

## 3. Mock Adapter Guarantees & Constraints
1. **Deterministic Seeds**: All mock fixtures are initialized with fixed seed IDs to ensure test reproducibility.
2. **Stateful Mutations**: Invoking mutations in development alters in-memory state.
3. **Canonical 2-Person Model**: All table booking slots enforce `capacity: 2`.
4. **Latency Simulation**: Mock adapters inject realistic network latency (150ms – 400ms) to trigger loading skeletons and disable duplicate form submission buttons during in-flight mutations.
