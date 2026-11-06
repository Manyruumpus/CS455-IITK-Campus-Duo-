import React, { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { UserSession, UserRole, OnboardingDraftState } from '@/types';
import { MOCK_STUDENT_SESSION, MOCK_ADMIN_SESSION } from '@/mocks';
import { appConfig } from '@/config/features';
import { applicationQueryClient } from '@/queries';
import { mockStore } from '@/mocks/store';
import {
  clearPersistedAuthSession,
  readPersistedAuthSession,
  writePersistedAuthSession,
} from '@/services/auth/authSessionStore';
import { HttpAuthSessionClient, SessionCheckResult } from '@/services/http/HttpAuthSessionClient';

export type DemoAuthRole = 'ROLE_STUDENT' | 'ROLE_ADMIN' | 'SIGNED_OUT' | 'ROLE_STUDENT_FRESH';

/**
 * - `idle`: no restoration pending.
 * - `restoring`: a persisted session is being validated via GET /api/auth/me; authenticated pages must not render yet.
 * - `unavailable`: the backend could not be reached; the persisted session was kept and may be retried.
 */
export type SessionRestoreStatus = 'idle' | 'restoring' | 'unavailable';

export interface DemoAuthContextType {
  session: UserSession | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isRestoringSession: boolean;
  sessionRestoreStatus: SessionRestoreStatus;
  retrySessionRestore: () => void;
  socialConsent: boolean;
  isDemoAuthEnabled: boolean;
  isDemoShowcase: boolean;
  onboardingDraft: OnboardingDraftState | null;
  setOnboardingDraft: (draft: OnboardingDraftState | null) => void;
  updateSession: (patch: Partial<UserSession>) => void;
  switchRole: (newRole: DemoAuthRole | UserSession) => void;
  grantSocialConsent: () => void;
  revokeSocialConsent: () => void;
  /** Clears local state immediately, then invalidates the server session when one exists. */
  logout: () => Promise<void>;
}

export interface DemoAuthProviderProps {
  children: ReactNode;
  initialSession?: UserSession | null;
  initialSocialConsent?: boolean;
  isDemoAuthEnabled?: boolean;
  isDemoShowcase?: boolean;
  queryClient?: typeof applicationQueryClient;
}

const DemoAuthContext = createContext<DemoAuthContextType | undefined>(undefined);

/** Dedupes concurrent GET /api/auth/me checks for the same token (StrictMode remounts, retries, multiple providers). */
const inflightSessionChecks = new Map<string, Promise<SessionCheckResult>>();

function checkSessionOnce(client: HttpAuthSessionClient, token: string): Promise<SessionCheckResult> {
  const existing = inflightSessionChecks.get(token);
  if (existing) return existing;
  const pending = client.getCurrentUser(token).finally(() => {
    inflightSessionChecks.delete(token);
  });
  inflightSessionChecks.set(token, pending);
  return pending;
}

function persistSession(session: UserSession): void {
  if (!session.sessionToken) return;
  writePersistedAuthSession({
    token: session.sessionToken,
    isOnboarded: session.isOnboarded,
    hasStudyConsent: session.hasStudyConsent,
    hasSocialConsent: session.hasSocialConsent,
    isFirstLogin: session.isFirstLogin === true,
  });
}

export const DemoAuthProvider: React.FC<DemoAuthProviderProps> = ({
  children,
  initialSession = null,
  initialSocialConsent = false,
  isDemoAuthEnabled = appConfig.isDemoAuthEnabled,
  isDemoShowcase = appConfig.isDemoShowcase,
  queryClient,
}) => {
  const activeQueryClient = queryClient ?? applicationQueryClient;
  // In production builds with demo auth disabled, initial session is forced to null
  const effectiveInitialSession = isDemoAuthEnabled ? initialSession : null;
  const [session, setSession] = useState<UserSession | null>(effectiveInitialSession);
  const [socialConsent, setSocialConsent] = useState<boolean>(initialSocialConsent);
  const [onboardingDraft, setOnboardingDraft] = useState<OnboardingDraftState | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<SessionRestoreStatus>(() =>
    isDemoAuthEnabled && !effectiveInitialSession && readPersistedAuthSession() ? 'restoring' : 'idle'
  );

  const authClient = useMemo(() => new HttpAuthSessionClient(), []);
  const sessionRef = useRef<UserSession | null>(session);
  // Incremented on every explicit identity change so a slow restoration can never overwrite a newer login/logout.
  const identityEpochRef = useRef(0);
  const restoreStartedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const restoreSession = async () => {
    const stored = readPersistedAuthSession();
    if (!stored) {
      setRestoreStatus('idle');
      return;
    }
    const epoch = identityEpochRef.current;
    setRestoreStatus('restoring');
    const result = await checkSessionOnce(authClient, stored.token);
    if (!mountedRef.current || epoch !== identityEpochRef.current) return;

    if (result.status === 'unavailable') {
      // Do not discard a possibly valid session because the backend is temporarily unreachable.
      setRestoreStatus('unavailable');
      return;
    }

    const user = result.status === 'valid' ? result.user : null;
    const isUsable =
      user !== null &&
      (user.role === 'ROLE_STUDENT' || user.role === 'ROLE_ADMIN') &&
      user.accountStatus === 'ACTIVE' &&
      user.verificationStatus === 'VERIFIED';

    if (!user || !isUsable) {
      clearPersistedAuthSession();
      setSession(null);
      setRestoreStatus('idle');
      return;
    }

    setSession({
      userId: user.userId,
      email: user.email,
      name: user.displayName,
      rollNumber: user.email.split('@')[0],
      role: user.role as UserRole,
      isOnboarded: stored.isOnboarded,
      hasStudyConsent: stored.hasStudyConsent,
      hasSocialConsent: stored.hasSocialConsent,
      sessionToken: stored.token,
      isFirstLogin: stored.isFirstLogin,
    });
    setRestoreStatus('idle');
  };

  useEffect(() => {
    mountedRef.current = true;
    if (restoreStatus === 'restoring' && !restoreStartedRef.current) {
      restoreStartedRef.current = true;
      void restoreSession();
    }
    return () => {
      mountedRef.current = false;
    };
    // Restoration runs once on mount; retries go through retrySessionRestore.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retrySessionRestore = () => {
    if (restoreStatus !== 'unavailable') return;
    void restoreSession();
  };

  const updateSession = (patch: Partial<UserSession>) => {
    const current = sessionRef.current;
    if (current?.sessionToken) {
      // Keep persisted UI flags (onboarding/consent) in step with the live session.
      const stored = readPersistedAuthSession();
      if (stored && stored.token === current.sessionToken) {
        persistSession({ ...current, ...patch });
      }
    }
    setSession((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...patch };
      // Also update mockStore if session is in store
      mockStore.sessions.set(updated.userId, updated);
      return updated;
    });
  };

  const switchRole = (newRole: DemoAuthRole | UserSession) => {
    // If demo auth is disabled (production default), ignore role switching
    if (!isDemoAuthEnabled) {
      return;
    }

    identityEpochRef.current += 1;
    setRestoreStatus('idle');

    // Cancel in-flight queries and clear actor-scoped cache across identity boundary
    activeQueryClient.cancelQueries();
    activeQueryClient.clear();
    // Clear onboarding drafts across session switch (Amendment 6)
    setOnboardingDraft(null);

    if (typeof newRole === 'object') {
      if (newRole.sessionToken) {
        // Authenticated backend session (OTP/password login): survive browser refresh.
        persistSession(newRole);
      } else {
        clearPersistedAuthSession();
      }
      setSession({ ...newRole });
      return;
    }

    // Demo roles never carry a backend session; discard any previously persisted one.
    clearPersistedAuthSession();
    if (newRole === 'SIGNED_OUT') {
      setSession(null);
    } else if (newRole === 'ROLE_ADMIN') {
      const admin = mockStore.sessions.get('admin') ?? MOCK_ADMIN_SESSION;
      setSession({ ...admin });
    } else if (newRole === 'ROLE_STUDENT_FRESH') {
      const fresh = mockStore.sessions.get('fresh');
      if (fresh) {
        setSession({ ...fresh });
      } else {
        setSession({
          userId: 'usr-student-fresh',
          email: 'fresh.student@campusduo.test',
          name: 'Fresh Student',
          rollNumber: '200100',
          role: 'ROLE_STUDENT',
          isOnboarded: false,
          hasStudyConsent: false,
          hasSocialConsent: false,
          isFirstLogin: true,
        });
      }
    } else {
      const alex = mockStore.sessions.get('alex') ?? MOCK_STUDENT_SESSION;
      setSession({
        ...alex,
        hasSocialConsent: socialConsent,
      });
    }
  };

  const grantSocialConsent = () => {
    setSocialConsent(true);
    if (session) {
      updateSession({ hasSocialConsent: true });
    }
  };

  const revokeSocialConsent = () => {
    setSocialConsent(false);
    if (session) {
      updateSession({ hasSocialConsent: false });
    }
  };

  const logout = async (): Promise<void> => {
    const token = sessionRef.current?.sessionToken ?? readPersistedAuthSession()?.token;
    identityEpochRef.current += 1;
    // Cancel in-flight queries and clear actor-scoped cache on logout
    activeQueryClient.cancelQueries();
    activeQueryClient.clear();
    // Clear drafts on logout (Amendment 6)
    setOnboardingDraft(null);
    // Local state is cleared first so the UI is never falsely authenticated, even if the network call fails.
    setSession(null);
    clearPersistedAuthSession();
    setRestoreStatus('idle');
    if (token && isDemoAuthEnabled) {
      // Best effort server-side invalidation; failure leaves the token valid until its backend expiry.
      await authClient.logout(token);
    }
  };

  return (
    <DemoAuthContext.Provider
      value={{
        session,
        role: session?.role ?? null,
        isAuthenticated: !!session,
        isRestoringSession: restoreStatus === 'restoring',
        sessionRestoreStatus: restoreStatus,
        retrySessionRestore,
        socialConsent,
        isDemoAuthEnabled,
        isDemoShowcase,
        onboardingDraft,
        setOnboardingDraft,
        updateSession,
        switchRole,
        grantSocialConsent,
        revokeSocialConsent,
        logout,
      }}
    >
      {children}
    </DemoAuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useDemoAuth = (): DemoAuthContextType => {
  const context = useContext(DemoAuthContext);
  if (!context) {
    throw new Error('useDemoAuth must be used within a DemoAuthProvider');
  }
  return context;
};
