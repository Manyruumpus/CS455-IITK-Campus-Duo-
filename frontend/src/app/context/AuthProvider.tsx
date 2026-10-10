import React, { ReactNode } from 'react';
import { appConfig } from '@/config/features';
import { DemoAuthProvider } from './DemoAuthContext';
import { ProductionAuthProvider } from './ProductionAuthProvider';

/**
 * Top-level application authentication provider.
 * Automatically chooses ProductionAuthProvider in default production builds,
 * or DemoAuthProvider when running in development or explicit demo showcase mode.
 */
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  if (!appConfig.isDemoAuthEnabled) {
    return <ProductionAuthProvider>{children}</ProductionAuthProvider>;
  }
  return <DemoAuthProvider>{children}</DemoAuthProvider>;
};
