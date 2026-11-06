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
 *
 * While a persisted session is being validated against the backend, no authenticated content is rendered
 * and no redirect to /login occurs. If the backend is unreachable the session is kept and the user may retry.
 */
export const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const { isAuthenticated, isRestoringSession, sessionRestoreStatus, retrySessionRestore } = useDemoAuth();
  const location = useLocation();

  if (isRestoringSession) {
    return (
      <div role="status" aria-live="polite" className="min-h-screen flex items-center justify-center text-sm text-craft-muted">
        Restoring your session...
      </div>
    );
  }

  if (!isAuthenticated && sessionRestoreStatus === 'unavailable') {
    return (
      <div role="alert" className="min-h-screen flex flex-col items-center justify-center gap-3 text-sm text-craft-muted">
        <p>We could not reach the server to restore your session. Your sign-in has not been discarded.</p>
        <button
          type="button"
          onClick={retrySessionRestore}
          className="px-3 py-1.5 rounded border border-craft-border text-craft-text hover:bg-craft-surface"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!isAuthenticated) {
    const fullPath = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?from=${encodeURIComponent(fullPath)}`} replace />;
  }

  return <>{children}</>;
};