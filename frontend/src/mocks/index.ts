/**
 * Campus Duo — Deterministic Mock Fixtures & Stores
 * Fixtures provide stable IDs for testing and demonstrations.
 */

import {
  UserSession,
  StudyProfile,
  SocialPeerProfile,
  StudyTableSlot,
  CampusLocation,
} from '@/types';

export const MOCK_STUDENT_SESSION: UserSession = {
  userId: 'usr-student-alex',
  email: 'alex.rivera@campusduo.test',
  name: 'Alex Rivera',
  rollNumber: '200001',
  role: 'ROLE_STUDENT',
  isOnboarded: true,
  hasStudyConsent: true,
  hasSocialConsent: true,
};

export const MOCK_ADMIN_SESSION: UserSession = {
  userId: 'usr-admin-senate',
  email: 'senate.mod@campusduo.test',
  name: 'Senate Moderator',
  role: 'ROLE_ADMIN',
  isOnboarded: true,
  hasStudyConsent: false,
  hasSocialConsent: false,
};

export const MOCK_LOCATIONS: CampusLocation[] = [
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

export const MOCK_STUDY_PROFILES: StudyProfile[] = [
  {
    id: 'prof-210884',
    userId: 'usr-210884',
    displayName: 'Aarav Sharma',
    department: 'Computer Science & Engineering',
    degree: 'B.Tech',
    year: 4,
    courses: [
      { code: 'CS455', name: 'Computer Networks', department: 'CSE' },
      { code: 'CS632', name: 'Advanced Compiler Design', department: 'CSE' },
    ],
    studyStyle: 'QUIET_FOCUSED',
    preferredPace: 'AHEAD_OF_CLASS',
    preferredTimes: ['AFTERNOON', 'EVENING'],
    activeStatus: 'LOOKING',
    aiMatchScore: 94,
    aiMatchReasons: [
      'Enrolled in CS455 (Computer Networks) this semester',
      'Quiet focused study style match',
      'Overlapping afternoon schedule slot (16:00 - 18:00)',
    ],
  },
  {
    id: 'prof-220191',
    userId: 'usr-220191',
    displayName: 'Riya Sen',
    department: 'Electrical Engineering',
    degree: 'B.Tech',
    year: 3,
    courses: [
      { code: 'ESC102', name: 'Introduction to Electronics', department: 'EE' },
      { code: 'MTH101', name: 'Mathematics I', department: 'MTH' },
    ],
    studyStyle: 'PROBLEM_SOLVING',
    preferredPace: 'STANDARD_REGULAR',
    preferredTimes: ['EVENING', 'LATE_NIGHT'],
    activeStatus: 'LOOKING',
    aiMatchScore: 81,
    aiMatchReasons: [
      'Enrolled in foundational mathematics',
      'Collaborative problem solving preference',
    ],
  },
];

export const MOCK_SOCIAL_PEERS: SocialPeerProfile[] = [
  {
    id: 'soc-peer-01',
    userId: 'usr-student-jordan',
    displayName: 'Jordan Lee',
    bio: 'Passionate about autonomous drones, robotics club, and late-night table tennis.',
    interests: [
      { id: 'tag-robotics', name: 'Robotics', category: 'TECH_ACADEMIC' },
      { id: 'tag-table-tennis', name: 'Table Tennis', category: 'SPORTS_FITNESS' },
      { id: 'tag-anime', name: 'Anime', category: 'CAMPUS_LIFE' },
    ],
    connectionStatus: 'NONE',
  },
  {
    id: 'soc-peer-02',
    userId: 'usr-student-taylor',
    displayName: 'Taylor Brooks',
    bio: 'Western music vocalist, occasional chess player, and open-source enthusiast.',
    interests: [
      { id: 'tag-music', name: 'Western Music', category: 'CULTURAL_ARTS' },
      { id: 'tag-chess', name: 'Chess', category: 'SPORTS_FITNESS' },
      { id: 'tag-opensource', name: 'Open Source', category: 'TECH_ACADEMIC' },
    ],
    connectionStatus: 'MUTUAL_CONNECTED',
  },
];

export const MOCK_TABLE_SLOTS: StudyTableSlot[] = [
  {
    slotId: 'slot-pk-10',
    locationId: 'loc-pk-kelkar-2f',
    tableNumber: 'T-10',
    zone: 'COLLABORATIVE_STUDY',
    startTime: '16:00',
    endTime: '18:00',
    date: '2026-10-02',
    status: 'AVAILABLE',
    capacity: 2,
    reservedCount: 0,
  },
  {
    slotId: 'slot-pk-11',
    locationId: 'loc-pk-kelkar-2f',
    tableNumber: 'T-11',
    zone: 'COLLABORATIVE_STUDY',
    startTime: '16:00',
    endTime: '18:00',
    date: '2026-10-02',
    status: 'OCCUPIED',
    capacity: 2,
    reservedCount: 2,
  },
  {
    slotId: 'slot-pk-12',
    locationId: 'loc-pk-kelkar-2f',
    tableNumber: 'T-12',
    zone: 'SILENT_READING',
    startTime: '16:00',
    endTime: '18:00',
    date: '2026-10-02',
    status: 'AVAILABLE',
    capacity: 2,
    reservedCount: 0,
  },
  {
    slotId: 'slot-pk-13',
    locationId: 'loc-pk-kelkar-2f',
    tableNumber: 'T-13',
    zone: 'DISCUSSION_POD',
    startTime: '16:00',
    endTime: '18:00',
    date: '2026-10-02',
    status: 'RESERVED',
    capacity: 2,
    reservedCount: 2,
  },
];

export * from './store';
export * from './scenarios';

