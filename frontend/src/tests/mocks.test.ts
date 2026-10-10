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
  it('provides synthetic student session free of personal identities', () => {
    expect(MOCK_STUDENT_SESSION.userId).toBe('usr-student-alex');
    expect(MOCK_STUDENT_SESSION.name).toBe('Alex Rivera');
    expect(MOCK_STUDENT_SESSION.role).toBe('ROLE_STUDENT');
    expect(MOCK_STUDENT_SESSION.rollNumber).toBe('200001');
  });

  it('provides valid admin session with administrative role', () => {
    expect(MOCK_ADMIN_SESSION.userId).toBe('usr-admin-senate');
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

  it('asserts complete public social peer response shape and strict exclusion of contact-derived fields', () => {
    expect(MOCK_SOCIAL_PEERS.length).toBeGreaterThan(0);

    MOCK_SOCIAL_PEERS.forEach((peer) => {
      // Assert allowed public projection fields
      expect(peer).toHaveProperty('id');
      expect(peer).toHaveProperty('userId');
      expect(peer).toHaveProperty('displayName');
      expect(peer).toHaveProperty('bio');
      expect(peer).toHaveProperty('interests');
      expect(peer).toHaveProperty('connectionStatus');

      // Assert contact-derived fields are strictly excluded
      const peerRecord = peer as unknown as Record<string, unknown>;
      expect(peerRecord.maskedHandle).toBeUndefined();
      expect(peerRecord.revealedContact).toBeUndefined();
      expect(peerRecord.email).toBeUndefined();
      expect(peerRecord.phone).toBeUndefined();
    });
  });
});
