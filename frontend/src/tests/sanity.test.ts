import { describe, it, expect } from 'vitest';
import { MOCK_STUDENT_SESSION, MOCK_LOCATIONS, MOCK_TABLE_SLOTS } from '../mocks';

describe('Sanity Suite', () => {
  it('validates mock data presence and shape', () => {
    expect(MOCK_STUDENT_SESSION.userId).toBeTruthy();
    expect(MOCK_LOCATIONS.length).toBeGreaterThan(0);
    expect(MOCK_TABLE_SLOTS.length).toBeGreaterThan(0);
  });
});
