import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DemoAuthProvider, useDemoAuth } from '@/app/context/DemoAuthContext';
import { RequireAuth } from '@/app/guards/RequireAuth';
import { LoginPage } from '@/features/auth/LoginPage';
import {
  AUTH_SESSION_STORAGE_KEY,
  readPersistedAuthSession,
  writePersistedAuthSession,
} from '@/services/auth/authSessionStore';
import { HttpAuthSessionClient } from '@/services/http/HttpAuthSessionClient';

const TOKEN = 'unit-test-opaque-token-0001';
const ME_USER = {
  userId: '00000000-0000-0000-0000-00000000d501',
  email: 'student@iitk.ac.in',
  displayName: 'Verified Student',
  role: 'ROLE_STUDENT',
  accountStatus: 'ACTIVE',
  verificationStatus: 'VERIFIED',
};

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

const meOk = () => jsonResponse(200, { data: { user: ME_USER }, requestId: 'r1' });
const unauthorized = () =>
  jsonResponse(401, { error: { code: 'UNAUTHENTICATED', message: 'Invalid or expired session token' } });

function persist(overrides: Partial<Parameters<typeof writePersistedAuthSession>[0]> = {}) {
  writePersistedAuthSession({
    token: TOKEN,
    isOnboarded: true,
    hasStudyConsent: true,
    hasSocialConsent: false,
    isFirstLogin: false,
    ...overrides,
  });
}

const SessionProbe: React.FC = () => {
  const { session, logout, isRestoringSession } = useDemoAuth();
  return (
    <div>
      <span data-testid="who">{session ? session.email : 'anonymous'}</span>
      <span data-testid="restoring">{String(isRestoringSession)}</span>
      <button onClick={() => void logout()}>do-logout</button>
    </div>
  );
};

function renderProtected(demoEnabled = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DemoAuthProvider isDemoAuthEnabled={demoEnabled}>
        <MemoryRouter initialEntries={['/app/dashboard']}>
          <Routes>
            <Route path="/login" element={<div>Login Screen</div>} />
            <Route
              path="/app/dashboard"
              element={
                <RequireAuth>
                  <div>Protected Dashboard</div>
                  <SessionProbe />
                </RequireAuth>
              }
            />
          </Routes>
        </MemoryRouter>
      </DemoAuthProvider>
    </QueryClientProvider>
  );
}

describe('Authentication persistence and session restoration (Stage A)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    window.sessionStorage.clear();
  });

  describe('login persists the session', () => {
    it('stores only the token and UI flags after successful OTP verification, never identity', async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse(200, {
            data: { challengeId: '00000000-0000-0000-0000-00000000c001', email: 'student@iitk.ac.in', expiresAt: new Date().toISOString(), maxAttempts: 3 },
          })
        )
        .mockResolvedValueOnce(
          jsonResponse(200, { data: { user: ME_USER, token: TOKEN, expiresAt: new Date().toISOString(), isFirstLogin: false } })
        ) as unknown as typeof fetch;

      const queryClient = new QueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <DemoAuthProvider isDemoAuthEnabled={true}>
            <MemoryRouter initialEntries={['/login']}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/app/dashboard" element={<div>Dashboard Screen</div>} />
              </Routes>
            </MemoryRouter>
          </DemoAuthProvider>
        </QueryClientProvider>
      );

      fireEvent.change(screen.getByLabelText(/iitk email address/i), { target: { value: 'student@iitk.ac.in' } });
      fireEvent.click(screen.getByRole('button', { name: /request login otp/i }));
      fireEvent.change(await screen.findByLabelText(/6-digit verification code/i), { target: { value: '654321' } });
      fireEvent.click(screen.getByRole('button', { name: /verify & sign in/i }));

      await waitFor(() => expect(screen.getByText('Dashboard Screen')).toBeInTheDocument());

      const raw = window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY);
      expect(raw).not.toBeNull();
      expect(readPersistedAuthSession()).toEqual({
        token: TOKEN,
        isOnboarded: true,
        hasStudyConsent: true,
        hasSocialConsent: false,
        isFirstLogin: false,
      });
      expect(raw).not.toContain('student@iitk.ac.in');
      expect(raw).not.toContain('Verified Student');
      expect(window.localStorage.length).toBe(0);
    });
  });

  describe('refresh restores authentication through /api/auth/me', () => {
    it('renders no protected content until /me resolves, then restores the user and sends the bearer token', async () => {
      persist();
      let resolveMe: (r: Response) => void = () => undefined;
      const fetchMock = vi.fn().mockImplementation(() => new Promise<Response>((r) => { resolveMe = r; }));
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      renderProtected();

      expect(screen.getByRole('status')).toHaveTextContent(/restoring your session/i);
      expect(screen.queryByText('Protected Dashboard')).not.toBeInTheDocument();
      expect(screen.queryByText('Login Screen')).not.toBeInTheDocument();

      await act(async () => { resolveMe(meOk()); });

      expect(await screen.findByText('Protected Dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('who')).toHaveTextContent('student@iitk.ac.in');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toMatch(/\/api\/auth\/me$/);
      expect((init as RequestInit).method).toBe('GET');
      expect(((init as RequestInit).headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    });

    it('performs exactly one /me request even under StrictMode double-mount', async () => {
      persist();
      const fetchMock = vi.fn().mockResolvedValue(meOk());
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      render(
        <React.StrictMode>
          <QueryClientProvider client={new QueryClient()}>
            <DemoAuthProvider isDemoAuthEnabled={true}>
              <SessionProbe />
            </DemoAuthProvider>
          </QueryClientProvider>
        </React.StrictMode>
      );

      await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('student@iitk.ac.in'));
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('makes no network request when nothing is persisted and redirects to login', async () => {
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock as unknown as typeof fetch;
      renderProtected();
      expect(await screen.findByText('Login Screen')).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('takes role and identity from the backend, ignoring any client-side tampering', async () => {
      persist();
      window.sessionStorage.setItem(
        AUTH_SESSION_STORAGE_KEY,
        JSON.stringify({ token: TOKEN, role: 'ROLE_ADMIN', email: 'evil@x', isOnboarded: true, hasStudyConsent: true, hasSocialConsent: false, isFirstLogin: false })
      );
      globalThis.fetch = vi.fn().mockResolvedValue(meOk()) as unknown as typeof fetch;
      renderProtected();
      await screen.findByText('Protected Dashboard');
      expect(screen.getByTestId('who')).toHaveTextContent('student@iitk.ac.in');
    });
  });

  describe('expired or invalid tokens clear the session', () => {
    it('clears persisted credentials on 401 and redirects to login', async () => {
      persist();
      globalThis.fetch = vi.fn().mockResolvedValue(unauthorized()) as unknown as typeof fetch;
      renderProtected();
      expect(await screen.findByText('Login Screen')).toBeInTheDocument();
      expect(window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
    });

    it('clears persisted credentials when the account is not active and verified', async () => {
      persist();
      globalThis.fetch = vi.fn().mockResolvedValue(
        jsonResponse(200, { data: { user: { ...ME_USER, accountStatus: 'SUSPENDED' } } })
      ) as unknown as typeof fetch;
      renderProtected();
      expect(await screen.findByText('Login Screen')).toBeInTheDocument();
      expect(window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
    });

    it('discards corrupt persisted data without calling the backend', async () => {
      window.sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, '{not-json');
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock as unknown as typeof fetch;
      renderProtected();
      expect(await screen.findByText('Login Screen')).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
    });
  });

  describe('backend unavailability', () => {
    it('keeps the persisted session, does not redirect to login, and recovers on retry', async () => {
      persist();
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(meOk());
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      renderProtected();

      expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i);
      expect(screen.queryByText('Login Screen')).not.toBeInTheDocument();
      expect(screen.queryByText('Protected Dashboard')).not.toBeInTheDocument();
      expect(readPersistedAuthSession()?.token).toBe(TOKEN);

      fireEvent.click(screen.getByRole('button', { name: /retry/i }));

      expect(await screen.findByText('Protected Dashboard')).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('treats 5xx responses as unavailable rather than invalid', async () => {
      persist();
      globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(503, {})) as unknown as typeof fetch;
      renderProtected();
      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(readPersistedAuthSession()?.token).toBe(TOKEN);
    });
  });

  describe('logout', () => {
    it('calls POST /api/auth/logout with the bearer token and clears frontend state', async () => {
      persist();
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(meOk())
        .mockResolvedValueOnce(jsonResponse(200, { data: { message: 'Successfully logged out.' } }));
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      renderProtected();
      await screen.findByText('Protected Dashboard');

      fireEvent.click(screen.getByRole('button', { name: 'do-logout' }));

      expect(await screen.findByText('Login Screen')).toBeInTheDocument();
      expect(window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      const [url, init] = fetchMock.mock.calls[1];
      expect(String(url)).toMatch(/\/api\/auth\/logout$/);
      expect((init as RequestInit).method).toBe('POST');
      expect(((init as RequestInit).headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    });

    it('still signs the user out locally when the logout request fails', async () => {
      persist();
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(meOk())
        .mockRejectedValueOnce(new TypeError('Failed to fetch'));
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      renderProtected();
      await screen.findByText('Protected Dashboard');
      fireEvent.click(screen.getByRole('button', { name: 'do-logout' }));

      expect(await screen.findByText('Login Screen')).toBeInTheDocument();
      expect(window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
    });
  });

  describe('HttpAuthSessionClient contract', () => {
    it('maps responses to valid / invalid / unavailable', async () => {
      const make = (fetchFn: typeof fetch) => new HttpAuthSessionClient({ baseUrl: 'http://api.test/', fetchFn });
      expect((await make(vi.fn().mockResolvedValue(meOk()) as unknown as typeof fetch).getCurrentUser('t')).status).toBe('valid');
      expect((await make(vi.fn().mockResolvedValue(unauthorized()) as unknown as typeof fetch).getCurrentUser('t')).status).toBe('invalid');
      expect((await make(vi.fn().mockResolvedValue(jsonResponse(500, {})) as unknown as typeof fetch).getCurrentUser('t')).status).toBe('unavailable');
      expect((await make(vi.fn().mockRejectedValue(new Error('x')) as unknown as typeof fetch).getCurrentUser('t')).status).toBe('unavailable');
      expect((await make(vi.fn().mockResolvedValue(jsonResponse(200, { data: {} })) as unknown as typeof fetch).getCurrentUser('t')).status).toBe('unavailable');
    });
  });

  describe('demo authentication is unaffected', () => {
    it('demo role switching neither persists nor restores a session and makes no network calls', async () => {
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const Demo: React.FC = () => {
        const { switchRole, session } = useDemoAuth();
        return (
          <div>
            <span data-testid="who">{session ? session.email : 'anonymous'}</span>
            <button onClick={() => switchRole('ROLE_STUDENT')}>demo-student</button>
          </div>
        );
      };
      render(
        <QueryClientProvider client={new QueryClient()}>
          <DemoAuthProvider isDemoAuthEnabled={true}>
            <Demo />
          </DemoAuthProvider>
        </QueryClientProvider>
      );
      fireEvent.click(screen.getByRole('button', { name: 'demo-student' }));
      await waitFor(() => expect(screen.getByTestId('who')).not.toHaveTextContent('anonymous'));
      expect(window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('ignores a persisted session when demo auth is disabled (production default)', async () => {
      persist();
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock as unknown as typeof fetch;
      renderProtected(false);
      expect(await screen.findByText('Login Screen')).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
