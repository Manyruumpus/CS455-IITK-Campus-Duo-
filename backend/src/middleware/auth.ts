import { Request, Response, NextFunction } from 'express';
import { isTestAuthAllowed } from '../config/env';
import { query } from '../config/db';
import { ActorContext, DomainError } from '../types';

declare global {
  namespace Express {
    interface Request {
      actor?: ActorContext;
      requestId?: string;
    }
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function testAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Reject in production or when test harness auth is disabled
  if (!isTestAuthAllowed()) {
    next(new DomainError(
      'UNAUTHENTICATED',
      401,
      'Test harness authentication is disabled outside explicitly enabled development mode'
    ));
    return;
  }

  const rawActorHeader = req.headers['x-campus-duo-test-actor'];
  if (!rawActorHeader || typeof rawActorHeader !== 'string') {
    next(new DomainError(
      'UNAUTHENTICATED',
      401,
      'Missing required authentication header X-Campus-Duo-Test-Actor'
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
    // Resolve actor strictly from trusted database state
    const result = await query<{
      user_id: string;
      role: string;
      display_name: string;
      account_status: string;
      verification_status: string;
    }>(
      `SELECT user_id, role, display_name, account_status, verification_status
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
    if (user.role !== 'ROLE_STUDENT' || user.account_status !== 'ACTIVE' || user.verification_status !== 'VERIFIED') {
      next(new DomainError(
        'UNAUTHENTICATED',
        401,
        'Test actor is not an active verified student'
      ));
      return;
    }

    req.actor = {
      userId: user.user_id,
      role: user.role,
      displayName: user.display_name
    };

    next();
  } catch (error) {
    next(error);
  }
}
