import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useDemoAuth } from '@/app/context/DemoAuthContext';
import { UserRole } from '@/types';

export interface RequireRoleProps {
  role: UserRole;
  children: ReactNode;
}

/**
 * RequireRole Guard
 *
 * NOTE: Client-side role gating provides routing redirection. Server authorization
 * remains authoritative in production.
 */
export const RequireRole: React.FC<RequireRoleProps> = ({ role, children }) => {
  const { session, isAuthenticated } = useDemoAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (session?.role !== role) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
};
