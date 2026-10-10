import React, { createContext, useContext, useState, ReactNode } from 'react';
import { UserSession, UserRole, OnboardingDraftState } from '@/types';
import { MOCK_STUDENT_SESSION, MOCK_ADMIN_SESSION } from '@/mocks';
import { appConfig } from '@/config/features';
import { applicationQueryClient } from '@/queries';
import { mockStore } from '@/mocks/store';

export type DemoAuthRole = 'ROLE_STUDENT' | 'ROLE_ADMIN' | 'SIGNED_OUT' | 'ROLE_STUDENT_FRESH';

export interface DemoAuthContextType {
  session: UserSession | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  socialConsent: boolean;
  isDemoAuthEnabled: boolean;
  isDemoShowcase: boolean;
  onboardingDraft: OnboardingDraftState | null;
  setOnboardingDraft: (draft: OnboardingDraftState | null) => void;
  updateSession: (patch: Partial<UserSession>) => void;
  switchRole: (newRole: DemoAuthRole | UserSession) => void;
  grantSocialConsent: () => void;
  revokeSocialConsent: () => void;
  logout: () => void;
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

  const updateSession = (patch: Partial<UserSession>) => {
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

    // Cancel in-flight queries and clear actor-scoped cache across identity boundary
    activeQueryClient.cancelQueries();
    activeQueryClient.clear();
    // Clear onboarding drafts across session switch (Amendment 6)
    setOnboardingDraft(null);

    if (typeof newRole === 'object') {
      setSession({ ...newRole });
    } else if (newRole === 'SIGNED_OUT') {
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

  const logout = () => {
    // Cancel in-flight queries and clear actor-scoped cache on logout
    activeQueryClient.cancelQueries();
    activeQueryClient.clear();
    // Clear drafts on logout (Amendment 6)
    setOnboardingDraft(null);
    setSession(null);
  };

  return (
    <DemoAuthContext.Provider
      value={{
        session,
        role: session?.role ?? null,
        isAuthenticated: !!session,
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
