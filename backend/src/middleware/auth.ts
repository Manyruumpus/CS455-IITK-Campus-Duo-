import { Request, Response, NextFunction } from 'express';
import { isTestAuthAllowed } from '../config/env';
import { query } from '../config/db';
import { ActorContext, DomainError } from '../types';

declare global {
  namespace Express {
    interface Request {
      actor?: ActorContext;
      requestId?: string;
      sessionToken?: string;
    }
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Universal authentication middleware.
 * Supports:
 * 1. Primary: Session tokens via Authorization: Bearer <sessionToken>
 * 2. Development/Harness fallback: X-Campus-Duo-Test-Actor (only when isTestAuthAllowed() is true)
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    const sessionToken = authHeader.substring(7).trim();
    if (!sessionToken) {
      next(new DomainError('UNAUTHENTICATED', 401, 'Missing bearer session token in Authorization header'));
      return;
    }

    try {
      const sessionResult = await query<{
        session_token: string;
        user_id: string;
        role: string;
        expires_at: string;
        email: string;
        display_name: string;
        account_status: string;
        verification_status: string;
      }>(
        `SELECT s.session_token, s.user_id, s.role, s.expires_at,
                u.email, u.display_name, u.account_status, u.verification_status
         FROM campus_duo.auth_session s
         JOIN campus_duo.user_account u ON s.user_id = u.user_id
         WHERE s.session_token = $1 AND s.expires_at > NOW()`,
        [sessionToken]
      );

      if (sessionResult.rows.length === 0) {
        next(new DomainError('UNAUTHENTICATED', 401, 'Invalid or expired session token'));
        return;
      }

      const sessionUser = sessionResult.rows[0];
      if (sessionUser.account_status !== 'ACTIVE' || sessionUser.verification_status !== 'VERIFIED') {
        next(new DomainError('UNAUTHENTICATED', 401, 'User account is not active or verified'));
        return;
      }

      req.actor = {
        userId: sessionUser.user_id,
        role: sessionUser.role,
        displayName: sessionUser.display_name,
        email: sessionUser.email,
      };
      req.sessionToken = sessionToken;
      next();
      return;
    } catch (err) {
      next(err);
      return;
    }
  }

  // Fallback to test harness authentication if enabled
  const rawActorHeader = req.headers['x-campus-duo-test-actor'];
  if (rawActorHeader && typeof rawActorHeader === 'string') {
    if (!isTestAuthAllowed()) {
      next(new DomainError(
        'UNAUTHENTICATED',
        401,
        'Test harness authentication is disabled outside explicitly enabled development mode'
      ));
      return;
    }

    const actorUserId = rawActorHeader.trim();
    if (!UUID_REGEX.test(actorUserId)) {
      next(new DomainError(
        'UNAUTHENTICATED',
        401,
        'Invalid format for X-Campus-Duo-Test-Actor header'
      ));
      return;
    }

    try {
      const result = await query<{
        user_id: string;
        email: string;
        role: string;
        display_name: string;
        account_status: string;
        verification_status: string;
      }>(
        `SELECT user_id, email, role, display_name, account_status, verification_status
         FROM campus_duo.user_account
         WHERE user_id = $1`,
        [actorUserId]
      );

      if (result.rows.length === 0) {
        next(new DomainError(
          'UNAUTHENTICATED',
          401,
          'Test actor not found in eligible user directory'
        ));
        return;
      }

      const user = result.rows[0];
      if (!['ROLE_STUDENT', 'ROLE_ADMIN'].includes(user.role) || user.account_status !== 'ACTIVE' || user.verification_status !== 'VERIFIED') {
        next(new DomainError(
          'UNAUTHENTICATED',
          401,
          'Test actor is not an active verified student or administrator'
        ));
        return;
      }

      req.actor = {
        userId: user.user_id,
        role: user.role,
        displayName: user.display_name,
        email: user.email,
      };

      next();
      return;
    } catch (error) {
      next(error);
      return;
    }
  }

  // Neither Bearer token nor Test Actor header provided
  next(new DomainError(
    'UNAUTHENTICATED',
    401,
    'Missing required authentication header: provide Authorization: Bearer <sessionToken> or X-Campus-Duo-Test-Actor'
  ));
}

/**
 * Backward compatibility alias for routes and tests using testAuthMiddleware
 */
export const testAuthMiddleware = authMiddleware;

/**
 * Role-Based Access Control (RBAC) middleware.
 * Verifies that the authenticated actor possesses one of the allowed roles.
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.actor) {
      next(new DomainError('UNAUTHENTICATED', 401, 'Authentication required'));
      return;
    }

    if (!allowedRoles.includes(req.actor.role)) {
      next(new DomainError(
        'FORBIDDEN',
        403,
        `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]`
      ));
      return;
    }

    next();
  };
}
