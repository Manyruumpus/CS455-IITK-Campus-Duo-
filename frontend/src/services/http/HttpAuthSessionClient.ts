/** Minimal HTTP client for the backend's existing session endpoints (`GET /api/auth/me`, `POST /api/auth/logout`). */

export interface AuthMeUser {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  accountStatus: string;
  verificationStatus: string;
}

/**
 * - `valid`: backend confirmed the session.
 * - `invalid`: backend definitively rejected the token (expired, revoked, forged, account inactive).
 * - `unavailable`: the answer is unknown (network failure, timeout, 5xx, malformed body); the token may still be valid.
 */
export type SessionCheckResult =
  | { status: 'valid'; user: AuthMeUser }
  | { status: 'invalid' }
  | { status: 'unavailable' };

export interface HttpAuthSessionClientOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export class HttpAuthSessionClient {
  private readonly baseUrl: string;
  private readonly fetchFn?: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options?: HttpAuthSessionClientOptions) {
    this.baseUrl = (
      options?.baseUrl ??
      import.meta.env.VITE_API_URL ??
      import.meta.env.VITE_API_BASE_URL ??
      'http://localhost:4000'
    ).replace(/\/+$/, '');
    this.fetchFn = options?.fetchFn;
    this.timeoutMs = options?.timeoutMs ?? 8000;
  }

  private doFetch(input: string, init: RequestInit): Promise<Response> {
    // Resolve fetch lazily so test-time replacements of globalThis.fetch are honoured.
    return (this.fetchFn ?? globalThis.fetch)(input, init);
  }

  private async request(path: string, method: 'GET' | 'POST', token: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.doFetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async getCurrentUser(token: string): Promise<SessionCheckResult> {
    try {
      const res = await this.request('/api/auth/me', 'GET', token);
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        return { status: 'invalid' };
      }
      if (!res.ok) return { status: 'unavailable' };
      const body = await res.json();
      const user = body?.data?.user;
      if (
        !user ||
        typeof user.userId !== 'string' ||
        typeof user.email !== 'string' ||
        typeof user.displayName !== 'string' ||
        typeof user.role !== 'string'
      ) {
        return { status: 'unavailable' };
      }
      return { status: 'valid', user: user as AuthMeUser };
    } catch {
      return { status: 'unavailable' };
    }
  }

  /** Returns true when the backend confirmed (or already considers) the session terminated. */
  async logout(token: string): Promise<boolean> {
    try {
      const res = await this.request('/api/auth/logout', 'POST', token);
      // 401 means the session is already gone server-side, which satisfies the intent of logout.
      return res.ok || res.status === 401;
    } catch {
      return false;
    }
  }
}
