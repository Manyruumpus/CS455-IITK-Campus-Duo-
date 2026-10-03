import React, { ReactNode } from 'react';
import { DemoAuthProvider } from './DemoAuthContext';

/**
 * ProductionAuthProvider
 *
 * Stub provider used in production builds to ensure that the development-only
 * demo session switcher and bypasses are completely disabled.
 * In development and preview demo mode, DemoAuthProvider is active.
 */
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // In development mode or demo builds, use DemoAuthProvider
  return <DemoAuthProvider>{children}</DemoAuthProvider>;
};
