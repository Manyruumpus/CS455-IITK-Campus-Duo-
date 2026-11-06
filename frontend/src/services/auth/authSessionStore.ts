/**
 * Browser persistence for the authenticated session across page refreshes.
 *
 * SECURITY TRADE-OFF (development milestone):
 * The backend issues opaque bearer tokens in a JSON response body and authenticates via the
 * `Authorization` header. It has no cookie parser, CSRF protection or credentialed-CORS setup, so an
 * HttpOnly/Secure/SameSite cookie would require a backend redesign. Until that exists, the token is kept
 * in `window.sessionStorage`, which is readable by any script running on the origin (XSS).
 * `sessionStorage` is used instead of `localStorage` to limit exposure: it is scoped to a single tab,
 * is discarded when the tab closes, and is never shared with other tabs/windows.
 *
 * Only the opaque token and four non-identifying UI flags are stored. Identity (userId, email, name,
 * role) is NEVER persisted; it is re-fetched from `GET /api/auth/me` on every restore.
 * The token must never be logged or rendered.
 */

export const AUTH_SESSION_STORAGE_KEY = 'campus_duo.auth_session.v1';

export interface PersistedAuthSession {
  token: string;
  isOnboarded: boolean;
  hasStudyConsent: boolean;
  hasSocialConsent: boolean;
  isFirstLogin: boolean;
}

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    return window.sessionStorage;
  } catch {
    return null; // Storage disabled or blocked (privacy mode)
  }
}

export function readPersistedAuthSession(): PersistedAuthSession | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedAuthSession> | null;
    if (!parsed || typeof parsed.token !== 'string' || parsed.token.trim() === '') {
      storage.removeItem(AUTH_SESSION_STORAGE_KEY);
      return null;
    }
    return {
      token: parsed.token,
      isOnboarded: parsed.isOnboarded === true,
      hasStudyConsent: parsed.hasStudyConsent === true,
      hasSocialConsent: parsed.hasSocialConsent === true,
      isFirstLogin: parsed.isFirstLogin === true,
    };
  } catch {
    try { storage.removeItem(AUTH_SESSION_STORAGE_KEY); } catch { /* ignore */ }
    return null;
  }
}

export function writePersistedAuthSession(value: PersistedAuthSession): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Quota/blocked: session simply will not survive a refresh.
  }
}

export function clearPersistedAuthSession(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}
