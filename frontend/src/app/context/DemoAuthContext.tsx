import React, { createContext, useContext, useState, ReactNode } from 'react';
import { UserSession, UserRole } from '@/types';
import { MOCK_STUDENT_SESSION, MOCK_ADMIN_SESSION } from '@/mocks';

export type DemoAuthRole = 'ROLE_STUDENT' | 'ROLE_ADMIN' | 'SIGNED_OUT';

interface DemoAuthContextType {
  session: UserSession | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  socialConsent: boolean;
  switchRole: (newRole: DemoAuthRole) => void;
  grantSocialConsent: () => void;
  revokeSocialConsent: () => void;
  logout: () => void;
}

export interface DemoAuthProviderProps {
  children: ReactNode;
  initialSession?: UserSession | null;
  initialSocialConsent?: boolean;
}

const DemoAuthContext = createContext<DemoAuthContextType | undefined>(undefined);

export const DemoAuthProvider: React.FC<DemoAuthProviderProps> = ({
  children,
  initialSession = null,
  initialSocialConsent = false,
}) => {
  // Defaults to unauthenticated (signed-out) visitor; user must select a role via /login
  const [session, setSession] = useState<UserSession | null>(initialSession);
  // Default to false (consent-first principle; requires explicit opt-in)
  const [socialConsent, setSocialConsent] = useState<boolean>(initialSocialConsent);

  const switchRole = (newRole: DemoAuthRole) => {
    if (newRole === 'SIGNED_OUT') {
      setSession(null);
    } else if (newRole === 'ROLE_ADMIN') {
      setSession(MOCK_ADMIN_SESSION);
    } else {
      setSession({
        ...MOCK_STUDENT_SESSION,
        hasSocialConsent: socialConsent,
      });
    }
  };

  const grantSocialConsent = () => {
    setSocialConsent(true);
    if (session) {
      setSession({ ...session, hasSocialConsent: true });
    }
  };

  const revokeSocialConsent = () => {
    setSocialConsent(false);
    if (session) {
      setSession({ ...session, hasSocialConsent: false });
    }
  };

  const logout = () => {
    setSession(null);
  };

  return (
    <DemoAuthContext.Provider
      value={{
        session,
        role: session?.role ?? null,
        isAuthenticated: !!session,
        socialConsent,
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
