import { describe, it, expect } from 'vitest';
import { validateReturnPath } from '@/utils/navigation';

describe('validateReturnPath utility', () => {
  it('preserves valid internal paths with query parameters and hash anchors', () => {
    const destination = '/app/booking/table-grid?zone=LIBRARY&floor=2#table-10';
    const result = validateReturnPath(destination, 'ROLE_STUDENT');
    expect(result).toBe('/app/booking/table-grid?zone=LIBRARY&floor=2#table-10');
  });

  it('preserves root-relative student study detail paths', () => {
    const destination = '/app/study/st-101?tab=courses#match-score';
    const result = validateReturnPath(destination, 'ROLE_STUDENT');
    expect(result).toBe('/app/study/st-101?tab=courses#match-score');
  });

  it('rejects external origins and falls back to role dashboard', () => {
    const destination = 'https://evil.com/app/dashboard?token=stolen';
    const result = validateReturnPath(destination, 'ROLE_STUDENT');
    expect(result).toBe('/app/dashboard');
  });

  it('rejects protocol-relative double-slash destinations', () => {
    const destination = '//attacker.site/phishing';
    const result = validateReturnPath(destination, 'ROLE_STUDENT');
    expect(result).toBe('/app/dashboard');
  });

  it('rejects slash-backslash protocol evasion destinations', () => {
    const destination = '/\\attacker.site';
    const result = validateReturnPath(destination, 'ROLE_STUDENT');
    expect(result).toBe('/app/dashboard');
  });

  it('rejects destinations containing backslashes or control characters', () => {
    expect(validateReturnPath('/app\\dashboard', 'ROLE_STUDENT')).toBe('/app/dashboard');
    expect(validateReturnPath('/app/dashboard\n/secret', 'ROLE_STUDENT')).toBe('/app/dashboard');
    expect(validateReturnPath('/app/dashboard\0', 'ROLE_STUDENT')).toBe('/app/dashboard');
  });

  it('rejects auth/login endpoints to prevent redirect loops', () => {
    expect(validateReturnPath('/login', 'ROLE_STUDENT')).toBe('/app/dashboard');
    expect(validateReturnPath('/login?from=/login', 'ROLE_STUDENT')).toBe('/app/dashboard');
    expect(validateReturnPath('/auth/callback?code=abc', 'ROLE_STUDENT')).toBe('/app/dashboard');
    expect(validateReturnPath('/auth/recovery', 'ROLE_STUDENT')).toBe('/app/dashboard');
    expect(validateReturnPath('/forbidden', 'ROLE_STUDENT')).toBe('/app/dashboard');
  });

  it('enforces role compatibility by redirecting to appropriate role dashboard', () => {
    // Student attempting to access admin route falls back to student dashboard
    expect(validateReturnPath('/admin/reports', 'ROLE_STUDENT')).toBe('/app/dashboard');

    // Admin attempting to access student route falls back to admin dashboard
    expect(validateReturnPath('/app/booking', 'ROLE_ADMIN')).toBe('/admin/dashboard');

    // Admin accessing admin route succeeds
    expect(validateReturnPath('/admin/tables?status=active#t1', 'ROLE_ADMIN')).toBe(
      '/admin/tables?status=active#t1'
    );
  });

  it('handles null, undefined, empty, or whitespace inputs gracefully', () => {
    expect(validateReturnPath(null, 'ROLE_STUDENT')).toBe('/app/dashboard');
    expect(validateReturnPath(undefined, 'ROLE_STUDENT')).toBe('/app/dashboard');
    expect(validateReturnPath('', 'ROLE_STUDENT')).toBe('/app/dashboard');
    expect(validateReturnPath('   ', 'ROLE_ADMIN')).toBe('/admin/dashboard');
  });
});
