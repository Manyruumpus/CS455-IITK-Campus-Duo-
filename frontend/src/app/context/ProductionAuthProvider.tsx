import React, { createContext, useContext, ReactNode } from 'react';
import { UserSession, UserRole } from '@/types';
import { DemoAuthProvider, useDemoAuth as useDemoAuthHook } from './DemoAuthContext';

export interface AuthContextType {
  session: UserSession | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  socialConsent: boolean;
  switchRole: (newRole: 'ROLE_STUDENT' | 'ROLE_ADMIN' | 'SIGNED_OUT') => void;
  grantSocialConsent: () => void;
  revokeSocialConsent: () => void;
  logout: () => void;
}

const ProductionAuthContext = createContext<AuthContextType>({
  session: null,
  role: null,
  isAuthenticated: false,
  socialConsent: false,
  switchRole: () => {},
  grantSocialConsent: () => {},
  revokeSocialConsent: () => {},
  logout: () => {},
});

/**
 * ProductionAuthProvider
 *
 * Strict unauthenticated stub for production builds that completely disables
 * the demo switcher bypass, requiring real OAuth / session hydration in future stages.
 */
export const ProductionAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <ProductionAuthContext.Provider
      value={{
        session: null,
        role: null,
        isAuthenticated: false,
        socialConsent: false,
        switchRole: () => {},
        grantSocialConsent: () => {},
        revokeSocialConsent: () => {},
        logout: () => {},
      }}
    >
      {children}
    </ProductionAuthContext.Provider>
  );
};

export { DemoAuthProvider, useDemoAuthHook as useDemoAuth };
