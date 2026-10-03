import { describe, it, expect } from 'vitest';
import {
  MOCK_STUDENT_SESSION,
  MOCK_ADMIN_SESSION,
  MOCK_LOCATIONS,
  MOCK_STUDY_PROFILES,
  MOCK_SOCIAL_PEERS,
  MOCK_TABLE_SLOTS,
} from '../mocks';

describe('Domain Fixtures & Data Integrity', () => {
  it('provides valid student session with active roles', () => {
    expect(MOCK_STUDENT_SESSION.userId).toBe('usr-student-210642');
    expect(MOCK_STUDENT_SESSION.role).toBe('ROLE_STUDENT');
    expect(MOCK_STUDENT_SESSION.rollNumber).toBe('210642');
  });

  it('provides valid admin session with administrative role', () => {
    expect(MOCK_ADMIN_SESSION.userId).toBe('usr-admin-001');
    expect(MOCK_ADMIN_SESSION.role).toBe('ROLE_ADMIN');
  });

  it('contains populated campus locations with opening hours', () => {
    expect(MOCK_LOCATIONS.length).toBeGreaterThan(0);
    const library = MOCK_LOCATIONS.find((loc) => loc.id === 'loc-pk-kelkar-2f');
    expect(library).toBeDefined();
    expect(library?.noisePolicy).toBe('WHISPER_COLLAB');
  });

  it('strictly adheres to the canonical 2-person study table model', () => {
    expect(MOCK_TABLE_SLOTS.length).toBeGreaterThan(0);
    MOCK_TABLE_SLOTS.forEach((slot) => {
      expect(slot.capacity).toBe(2);
      expect(slot.reservedCount).toBeLessThanOrEqual(2);
    });
  });

  it('demonstrates grounded AI match reasoning factors without opaque scores', () => {
    MOCK_STUDY_PROFILES.forEach((profile) => {
      expect(profile.courses.length).toBeGreaterThan(0);
      expect(profile.aiMatchReasons).toBeDefined();
      expect(profile.aiMatchReasons?.length).toBeGreaterThan(0);
    });
  });

  it('demonstrates social privacy protection with masked handles until mutual connection', () => {
    const unrevealedPeer = MOCK_SOCIAL_PEERS.find((p) => p.connectionStatus === 'NONE');
    expect(unrevealedPeer?.maskedHandle).toContain('***');
    expect(unrevealedPeer?.revealedContact).toBeUndefined();

    const mutualPeer = MOCK_SOCIAL_PEERS.find((p) => p.connectionStatus === 'MUTUAL_CONNECTED');
    expect(mutualPeer?.revealedContact).toBeDefined();
  });
});
