import { UserRole } from '@/types';

/**
 * Validates and sanitizes a post-login return destination.
 *
 * Requirements:
 * 1. Preserves parsed pathname + search + hash.
 * 2. Validates against the application origin and root-relative patterns.
 * 3. Rejects external origins, protocol-relative destinations, backslashes, control characters.
 * 4. Rejects auth/login/callback paths that could create redirect loops.
 * 5. Enforces role-path compatibility, falling back to the selected role's dashboard.
 */
export function validateReturnPath(
  destination: string | null | undefined,
  targetRole: UserRole
): string {
  const fallback = targetRole === 'ROLE_ADMIN' ? '/admin/dashboard' : '/app/dashboard';

  if (!destination || typeof destination !== 'string') {
    return fallback;
  }

  const trimmed = destination.trim();
  if (!trimmed) {
    return fallback;
  }

  // Reject control characters (ASCII 0-31 or 127) and backslashes
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F\\]/.test(trimmed)) {
    return fallback;
  }

  // Reject protocol-relative destinations (e.g. //evil.com or /\evil.com)
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return fallback;
  }

  // Must begin with '/' unless it's a full URL that might match origin
  if (!trimmed.startsWith('/') && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return fallback;
  }

  try {
    const baseOrigin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://localhost:3000';

    const parsed = new URL(trimmed, baseOrigin);

    // Reject external origins
    if (parsed.origin !== baseOrigin) {
      return fallback;
    }

    const path = parsed.pathname;

    // Reject paths that would trigger redirect loops
    if (
      path === '/login' ||
      path === '/login/' ||
      path.startsWith('/auth/') ||
      path === '/forbidden'
    ) {
      return fallback;
    }

    // Enforce role compatibility
    if (targetRole === 'ROLE_STUDENT' && path.startsWith('/admin')) {
      return fallback;
    }

    if (targetRole === 'ROLE_ADMIN' && path.startsWith('/app')) {
      return fallback;
    }

    // Only return parsed pathname + search + hash (avoids repeated decode vulnerabilities)
    const result = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return result || fallback;
  } catch {
    return fallback;
  }
}
