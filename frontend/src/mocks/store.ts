import {
  UserSession,
  PrivateUserProfile,
  PublicStudyProfile,
  PublicSocialProfile,
  CampusLocation,
  StudyTableSlot,
  BookingRecord,
  PeerConnection,
  NotificationItem,
  ModerationReport,
  AuditLogEntry,
  AdminTableResource,
} from '@/types';
import { scenarioManager } from './scenarios';
import { getCampusLocalDate } from '@/utils/dateTime';
export { setDemoClock, resetDemoClock, getCampusLocalDate } from '@/utils/dateTime';

/**
 * Synthetic Fictional Identities (Stage 03 Repaired)
 * Strictly fictional student and administrator identities.
 * Free of personal names, real student numbers, or private user data.
 */
export const SEED_SESSIONS: Record<string, UserSession> = {
  alex: {
    userId: 'usr-student-alex',
    email: 'alex.rivera@campusduo.test',
    name: 'Alex Rivera',
    rollNumber: '200001',
    role: 'ROLE_STUDENT',
    isOnboarded: true,
    hasStudyConsent: true,
    hasSocialConsent: true,
  },
  sam: {
    userId: 'usr-student-sam',
    email: 'samira.patel@campusduo.test',
    name: 'Samira Patel',
    rollNumber: '200002',
    role: 'ROLE_STUDENT',
    isOnboarded: true,
    hasStudyConsent: true,
    hasSocialConsent: true,
  },
  jordan: {
    userId: 'usr-student-jordan',
    email: 'jordan.lee@campusduo.test',
    name: 'Jordan Lee',
    rollNumber: '200003',
    role: 'ROLE_STUDENT',
    isOnboarded: true,
    hasStudyConsent: true,
    hasSocialConsent: true,
  },
  taylor: {
    userId: 'usr-student-taylor',
    email: 'taylor.brooks@campusduo.test',
    name: 'Taylor Brooks',
    rollNumber: '200004',
    role: 'ROLE_STUDENT',
    isOnboarded: true,
    hasStudyConsent: false,
    hasSocialConsent: true,
  },
  morgan: {
    userId: 'usr-student-morgan',
    email: 'morgan.chen@campusduo.test',
    name: 'Morgan Chen',
    rollNumber: '200005',
    role: 'ROLE_STUDENT',
    isOnboarded: true,
    hasStudyConsent: false,
    hasSocialConsent: true,
  },
  stranger: {
    userId: 'usr-student-stranger',
    email: 'stranger@campusduo.test',
    name: 'Stranger Student',
    rollNumber: '200999',
    role: 'ROLE_STUDENT',
    isOnboarded: true,
    hasStudyConsent: false,
    hasSocialConsent: false,
  },
  fresh: {
    userId: 'usr-student-fresh',
    email: 'fresh.student@campusduo.test',
    name: 'Fresh Student',
    rollNumber: '200100',
    role: 'ROLE_STUDENT',
    isOnboarded: false,
    hasStudyConsent: false,
    hasSocialConsent: false,
  },
  admin: {
    userId: 'usr-admin-senate',
    email: 'senate.mod@campusduo.test',
    name: 'Senate Moderator',
    role: 'ROLE_ADMIN',
    isOnboarded: true,
    hasStudyConsent: false,
    hasSocialConsent: false,
  },
};

export const SEED_LOCATIONS: CampusLocation[] = [
  {
    id: 'loc-pk-kelkar-2f',
    name: 'P.K. Kelkar Library — 2nd Floor',
    building: 'PK Kelkar Library',
    totalTables: 24,
    openTime: '08:00',
    closeTime: '02:00',
    hasPowerOutlets: true,
    hasWifi6: true,
    noisePolicy: 'WHISPER_COLLAB',
  },
  {
    id: 'loc-cc-101',
    name: 'Computer Centre — Lab CC-101',
    building: 'Computer Centre',
    totalTables: 40,
    openTime: '00:00',
    closeTime: '23:59',
    hasPowerOutlets: true,
    hasWifi6: true,
    noisePolicy: 'CONVERSATIONAL',
  },
];

export const SEED_PRIVATE_PROFILES: Record<string, PrivateUserProfile> = {
  'usr-student-alex': {
    userId: 'usr-student-alex',
    email: 'alex.rivera@campusduo.test',
    rollNumber: '200001',
    displayName: 'Alex Rivera',
    department: 'Computer Science & Engineering',
    degree: 'B.Tech',
    year: 4,
    isOnboarded: true,
    courses: [
      { code: 'CS455', name: 'Computer Networks', department: 'CSE' },
      { code: 'MTH101', name: 'Mathematics I', department: 'MTH' },
    ],
    studyPreferences: {
      studyStyle: 'QUIET_FOCUSED',
      preferredPace: 'STANDARD_REGULAR',
      preferredTimes: ['AFTERNOON', 'EVENING'],
    },
    socialBio: 'Systems programmer and campus cyclist.',
    socialInterests: [
      { id: 'tag-robotics', name: 'Robotics', category: 'TECH_ACADEMIC' },
    ],
    studyConsent: { hasConsent: true, consentedAt: '2026-10-01T10:00:00Z' },
    socialConsent: { hasConsent: true, consentedAt: '2026-10-01T10:05:00Z' },
  },
  'usr-student-sam': {
    userId: 'usr-student-sam',
    email: 'samira.patel@campusduo.test',
    rollNumber: '200002',
    displayName: 'Samira Patel',
    department: 'Computer Science & Engineering',
    degree: 'B.Tech',
    year: 4,
    isOnboarded: true,
    courses: [
      { code: 'CS455', name: 'Computer Networks', department: 'CSE' },
    ],
    studyPreferences: {
      studyStyle: 'QUIET_FOCUSED',
      preferredPace: 'AHEAD_OF_CLASS',
      preferredTimes: ['AFTERNOON', 'EVENING'],
    },
    studyConsent: { hasConsent: true, consentedAt: '2026-10-02T11:00:00Z' },
    socialConsent: { hasConsent: true, consentedAt: '2026-10-02T11:05:00Z' },
  },
  'usr-student-fresh': {
    userId: 'usr-student-fresh',
    email: 'fresh.student@campusduo.test',
    rollNumber: '200100',
    displayName: 'Fresh Student',
    department: 'Computer Science & Engineering',
    degree: 'B.Tech',
    year: 1,
    isOnboarded: false,
    courses: [],
    studyPreferences: {
      preferredTimes: [],
    },
    studyConsent: { hasConsent: false },
    socialConsent: { hasConsent: false },
  },
};

export const SEED_PUBLIC_STUDY_PROFILES: PublicStudyProfile[] = [
  {
    userId: 'usr-student-alex',
    displayName: 'Alex Rivera',
    department: 'Computer Science & Engineering',
    degree: 'B.Tech',
    year: 4,
    courses: [
      { code: 'CS455', name: 'Computer Networks', department: 'CSE' },
      { code: 'MTH101', name: 'Mathematics I', department: 'MTH' },
    ],
    studyStyle: 'QUIET_FOCUSED',
    preferredPace: 'STANDARD_REGULAR',
    preferredTimes: ['AFTERNOON', 'EVENING'],
    activeStatus: 'LOOKING',
  },
  {
    userId: 'usr-student-sam',
    displayName: 'Samira Patel',
    department: 'Computer Science & Engineering',
    degree: 'B.Tech',
    year: 4,
    courses: [
      { code: 'CS455', name: 'Computer Networks', department: 'CSE' },
    ],
    studyStyle: 'QUIET_FOCUSED',
    preferredPace: 'AHEAD_OF_CLASS',
    preferredTimes: ['AFTERNOON', 'EVENING'],
    activeStatus: 'LOOKING',
  },
  {
    userId: 'usr-student-jordan',
    displayName: 'Jordan Lee',
    department: 'Electrical Engineering',
    degree: 'B.Tech',
    year: 3,
    courses: [
      { code: 'MTH101', name: 'Mathematics I', department: 'MTH' },
      { code: 'ESC102', name: 'Introduction to Electronics', department: 'EE' },
    ],
    studyStyle: 'PROBLEM_SOLVING',
    preferredPace: 'STANDARD_REGULAR',
    preferredTimes: ['EVENING', 'LATE_NIGHT'],
    activeStatus: 'LOOKING',
  },
  {
    userId: 'usr-student-aarav',
    displayName: 'Aarav Sharma',
    department: 'Computer Science & Engineering',
    degree: 'B.Tech',
    year: 4,
    courses: [
      { code: 'CS455', name: 'Computer Networks', department: 'CSE' },
      { code: 'CS771', name: 'Introduction to Machine Learning', department: 'CSE' },
    ],
    studyStyle: 'QUIET_FOCUSED',
    preferredPace: 'STANDARD_REGULAR',
    preferredTimes: ['MORNING', 'AFTERNOON', 'EVENING'],
    activeStatus: 'LOOKING',
  },
  {
    userId: 'usr-student-riya',
    displayName: 'Riya Gupta',
    department: 'Computer Science & Engineering',
    degree: 'B.Tech',
    year: 4,
    courses: [
      { code: 'CS455', name: 'Computer Networks', department: 'CSE' },
    ],
    studyStyle: 'DISCUSSION_HEAVY',
    preferredPace: 'STANDARD_REGULAR',
    preferredTimes: ['AFTERNOON', 'EVENING'],
    activeStatus: 'LOOKING',
  },
];

export const SEED_PUBLIC_SOCIAL_PROFILES: PublicSocialProfile[] = [
  {
    userId: 'usr-student-taylor',
    displayName: 'Taylor Brooks',
    bio: 'Autonomous drones, robotics club, and table tennis.',
    interests: [
      { id: 'tag-robotics', name: 'Robotics', category: 'TECH_ACADEMIC' },
      { id: 'tag-table-tennis', name: 'Table Tennis', category: 'SPORTS_FITNESS' },
    ],
  },
  {
    userId: 'usr-student-morgan',
    displayName: 'Morgan Chen',
    bio: 'Western music vocalist and chess enthusiast.',
    interests: [
      { id: 'tag-music', name: 'Western Music', category: 'CULTURAL_ARTS' },
      { id: 'tag-chess', name: 'Chess', category: 'SPORTS_FITNESS' },
    ],
  },
];

export const SEED_TABLE_SLOTS: StudyTableSlot[] = [
  {
    slotId: 'slot-pk-10-14',
    locationId: 'loc-pk-kelkar-2f',
    tableId: 'tbl-pk-2f-10',
    tableNumber: 'T-10',
    zone: 'COLLABORATIVE_STUDY',
    startTime: '14:00',
    endTime: '16:00',
    date: '2026-10-08',
    status: 'AVAILABLE',
    capacity: 2,
    reservedCount: 0,
  },
  {
    slotId: 'slot-pk-10-16',
    locationId: 'loc-pk-kelkar-2f',
    tableId: 'tbl-pk-2f-10',
    tableNumber: 'T-10',
    zone: 'COLLABORATIVE_STUDY',
    startTime: '16:00',
    endTime: '18:00',
    date: '2026-10-08',
    status: 'AVAILABLE',
    capacity: 2,
    reservedCount: 0,
  },
  {
    slotId: 'slot-pk-10-18',
    locationId: 'loc-pk-kelkar-2f',
    tableId: 'tbl-pk-2f-10',
    tableNumber: 'T-10',
    zone: 'COLLABORATIVE_STUDY',
    startTime: '18:00',
    endTime: '20:00',
    date: '2026-10-08',
    status: 'AVAILABLE',
    capacity: 2,
    reservedCount: 0,
  },
  {
    slotId: 'slot-pk-11-16',
    locationId: 'loc-pk-kelkar-2f',
    tableId: 'tbl-pk-2f-11',
    tableNumber: 'T-11',
    zone: 'COLLABORATIVE_STUDY',
    startTime: '16:00',
    endTime: '18:00',
    date: '2026-10-08',
    status: 'OCCUPIED',
    capacity: 2,
    reservedCount: 2,
  },
  {
    slotId: 'slot-pk-12-16',
    locationId: 'loc-pk-kelkar-2f',
    tableId: 'tbl-pk-2f-12',
    tableNumber: 'T-12',
    zone: 'SILENT_READING',
    startTime: '16:00',
    endTime: '18:00',
    date: '2026-10-08',
    status: 'AVAILABLE',
    capacity: 2,
    reservedCount: 0,
  },
];

export const SEED_BOOKINGS: BookingRecord[] = [
  {
    bookingId: 'bk-1001',
    bookerId: 'usr-student-alex',
    clientOperationId: 'op-seed-1001',
    participants: [
      { userId: 'usr-student-alex', displayName: 'Alex Rivera', role: 'CREATOR' },
      { userId: 'usr-student-sam', displayName: 'Samira Patel', role: 'COMPANION' },
    ],
    companionStudentId: 'usr-student-sam',
    companionDisplayName: 'Samira Patel',
    tableId: 'tbl-pk-2f-10',
    locationId: 'loc-pk-kelkar-2f',
    localDate: '2026-10-08',
    slotId: 'slot-pk-10-16',
    tableNumber: 'T-10',
    locationName: 'P.K. Kelkar Library — 2nd Floor',
    timeWindow: '16:00 – 18:00',
    status: 'CONFIRMED',
    allowedActions: ['CANCEL', 'RESCHEDULE'],
    partnerApprovalStatus: 'NOT_REQUIRED',
    createdAt: '2026-10-07T10:00:00Z',
  },
  {
    bookingId: 'bk-existing-99',
    bookerId: 'usr-student-stranger',
    clientOperationId: 'op-seed-stranger-99',
    participants: [
      { userId: 'usr-student-stranger', displayName: 'Stranger Student', role: 'CREATOR' },
    ],
    tableId: 'table-pk-11',
    locationId: 'loc-pk-kelkar-2f',
    localDate: '2026-10-08',
    slotId: 'slot-pk-11-16',
    tableNumber: 'T-11',
    locationName: 'P.K. Kelkar Library — 2nd Floor',
    timeWindow: '16:00 – 18:00',
    status: 'CONFIRMED',
    allowedActions: ['CANCEL', 'RESCHEDULE'],
    partnerApprovalStatus: 'NOT_REQUIRED',
    createdAt: '2026-10-07T12:00:00Z',
  },
];

export const SEED_CONNECTIONS: PeerConnection[] = [
  {
    connectionId: 'conn-alex-sam-study',
    studentAId: 'usr-student-alex',
    studentBId: 'usr-student-sam',
    mode: 'STUDY',
    status: 'MUTUAL_CONNECTED',
    note: 'CS455 study collaboration',
    createdAt: '2026-10-02T10:00:00Z',
    updatedAt: '2026-10-02T10:30:00Z',
  },
  {
    connectionId: 'conn-alex-jordan-study',
    studentAId: 'usr-student-alex',
    studentBId: 'usr-student-jordan',
    mode: 'STUDY',
    status: 'PENDING_SENT',
    note: 'MTH101 partner request',
    createdAt: '2026-10-05T14:00:00Z',
    updatedAt: '2026-10-05T14:00:00Z',
  },
  {
    connectionId: 'conn-alex-taylor-social',
    studentAId: 'usr-student-alex',
    studentBId: 'usr-student-taylor',
    mode: 'SOCIAL',
    status: 'MUTUAL_CONNECTED',
    note: 'Robotics club interest',
    createdAt: '2026-10-03T16:00:00Z',
    updatedAt: '2026-10-03T16:15:00Z',
  },
];

export const SEED_STUDY_LIKES: Array<[string, string[]]> = [
  ['usr-student-alex', ['usr-student-sam']],
  ['usr-student-sam', ['usr-student-alex']],
];

export class MockDatabase {
  public bookings: Map<string, BookingRecord> = new Map();
  public connections: Map<string, PeerConnection> = new Map();
  public notifications: Map<string, NotificationItem> = new Map();
  public reports: Map<string, ModerationReport> = new Map();
  public auditLogs: AuditLogEntry[] = [];
  public slots: Map<string, StudyTableSlot> = new Map();
  public locations: Map<string, CampusLocation> = new Map();
  public tables: Map<string, AdminTableResource> = new Map();
  public privateProfiles: Map<string, PrivateUserProfile> = new Map();
  public publicStudyProfiles: Map<string, PublicStudyProfile> = new Map();
  public publicSocialProfiles: Map<string, PublicSocialProfile> = new Map();
  public sessions: Map<string, UserSession> = new Map();
  public hiddenStudyPartners: Map<string, Set<string>> = new Map();
  public passedStudyPartners: Map<string, Set<string>> = new Map();
  public studyLikes: Map<string, Set<string>> = new Map();
  public blockedBy: Map<string, Set<string>> = new Map();
  
  // Injectable demo clock representing Indian Standard Time (Asia/Kolkata)
  private _demoClockIso: string = '2026-10-08T12:00:00.000Z';

  constructor() {
    this.reset();
  }

  public setDemoClock(isoDateOrTimestamp: string): void {
    const d = new Date(isoDateOrTimestamp);
    if (isNaN(d.getTime())) {
      throw new Error(`Invalid demo clock timestamp: ${isoDateOrTimestamp}`);
    }
    this._demoClockIso = d.toISOString();
  }

  public getDemoClock(): string {
    return this._demoClockIso;
  }

  public getCampusLocalDate(): string {
    return getCampusLocalDate(new Date(this._demoClockIso));
  }

  public reset(): void {
    scenarioManager.reset();
    this._demoClockIso = '2026-10-08T12:00:00.000Z';

    this.sessions.clear();
    for (const [key, s] of Object.entries(SEED_SESSIONS)) {
      this.sessions.set(key, { ...s });
      this.sessions.set(s.userId, { ...s });
    }

    this.privateProfiles.clear();
    for (const [uid, p] of Object.entries(SEED_PRIVATE_PROFILES)) {
      this.privateProfiles.set(uid, {
        ...p,
        courses: p.courses.map((c) => ({ ...c })),
        studyPreferences: {
          ...p.studyPreferences,
          preferredTimes: [...p.studyPreferences.preferredTimes],
        },
        socialInterests: p.socialInterests?.map((i) => ({ ...i })),
        studyConsent: { ...p.studyConsent },
        socialConsent: { ...p.socialConsent },
      });
    }

    this.publicStudyProfiles.clear();
    for (const p of SEED_PUBLIC_STUDY_PROFILES) {
      this.publicStudyProfiles.set(p.userId, {
        ...p,
        courses: p.courses.map((c) => ({ ...c })),
        preferredTimes: [...p.preferredTimes],
      });
    }

    this.publicSocialProfiles.clear();
    for (const p of SEED_PUBLIC_SOCIAL_PROFILES) {
      this.publicSocialProfiles.set(p.userId, {
        ...p,
        interests: p.interests.map((i) => ({ ...i })),
      });
    }

    this.bookings.clear();
    for (const b of SEED_BOOKINGS) {
      this.bookings.set(b.bookingId, {
        ...b,
        participants: b.participants.map((p) => ({ ...p })),
        allowedActions: [...b.allowedActions],
      });
    }

    // Relationships are intentionally not seeded. Connection state is derived
    // from the mode-specific Like stores by the connection service.
    this.connections.clear();

    this.slots.clear();
    for (const s of SEED_TABLE_SLOTS) {
      this.slots.set(s.slotId, { ...s });
    }
    this.locations.clear();
    for (const location of SEED_LOCATIONS) {
      this.locations.set(location.id, { ...location, active: true });
    }
    this.tables.clear();
    for (const slot of SEED_TABLE_SLOTS) {
      if (slot.tableId && !this.tables.has(slot.tableId)) {
        this.tables.set(slot.tableId, {
          tableId: slot.tableId,
          locationId: slot.locationId,
          tableNumber: slot.tableNumber,
          capacity: 2,
          hasPowerOutlets: this.locations.get(slot.locationId)?.hasPowerOutlets ?? false,
          active: true,
        });
      }
    }

    this.notifications.clear();
    this.notifications.set('notif-1', {
      id: 'notif-1',
      recipientId: 'usr-student-alex',
      title: 'Study Table Confirmed',
      body: 'Your simulated table reservation is active.',
      type: 'BOOKING',
      isRead: false,
      timestamp: '2026-10-08T09:00:00Z',
    });

    this.reports.clear();
    this.reports.set('rep-01', {
      reportId: 'rep-01',
      reporterUserId: 'usr-student-jordan',
      reportedUserId: 'usr-student-stranger',
      reportedUserName: 'Stranger Student',
      category: 'UNAUTHORIZED_PROMOTION',
      description: 'Commercial coaching promotion in study rooms',
      timestamp: '2026-10-07T14:30:00Z',
      status: 'PENDING_REVIEW',
    });

    this.auditLogs = [
      {
        logId: 'audit-001',
        adminId: 'usr-admin-senate',
        action: 'REPORT_REVIEW_INITIATED',
        targetEntity: 'rep-01',
        details: 'Senate admin opened investigation',
        timestamp: '2026-10-07T15:00:00Z',
      },
    ];

    this.hiddenStudyPartners.clear();
    this.passedStudyPartners.clear();
    this.studyLikes.clear();
    for (const [actorId, targetIds] of SEED_STUDY_LIKES) {
      this.studyLikes.set(actorId, new Set(targetIds));
    }
    this.blockedBy.clear();
  }

  /**
   * Reset passed dismissals for a student to mark the end/start of a discovery round.
   * Note: Hidden partners persist across discovery rounds until full store reset.
   */
  public resetDiscoveryRound(actorId: string): void {
    this.passedStudyPartners.delete(actorId);
  }
}

export const mockStore = new MockDatabase();
