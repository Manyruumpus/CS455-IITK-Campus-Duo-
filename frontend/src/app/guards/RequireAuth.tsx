import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useDemoAuth } from '@/app/context/DemoAuthContext';

export interface RequireAuthProps {
  children: ReactNode;
}

/**
 * RequireAuth Guard
 *
 * NOTE: Client-side navigation guards improve UX and routing, but DO NOT
 * implement server authorization or security guarantees.
 */
export const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const { isAuthenticated } = useDemoAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    const fullPath = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?from=${encodeURIComponent(fullPath)}`} replace />;
  }

  return <>{children}</>;
};
