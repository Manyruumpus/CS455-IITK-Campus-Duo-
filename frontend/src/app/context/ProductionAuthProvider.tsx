import React, { ReactNode } from 'react';
import { DemoAuthProvider } from './DemoAuthContext';

/**
 * ProductionAuthProvider
 *
 * Strict unauthenticated auth provider for production builds.
 * Disables demo role switching and mock bypasses.
 */
export const ProductionAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return <DemoAuthProvider isDemoAuthEnabled={false}>{children}</DemoAuthProvider>;
};
