import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { authMiddleware } from '../middleware/auth';
import { ApiResponse, DomainError, AuthSessionResponse, UserSummary } from '../types';

const router = Router();
const authService = new AuthService();

/**
 * POST /api/auth/register
 * Student registration strictly restricted to @iitk.ac.in emails.
 * Always establishes least-privilege ROLE_STUDENT and creates initial session.
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, displayName, password } = req.body;
    if (!email || !displayName || !password) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Email, display name, and password are required.');
    }

    const sessionData = await authService.registerStudent({ email, displayName, password });
    const response: ApiResponse<AuthSessionResponse> = {
      data: sessionData,
      requestId: req.requestId || 'req-unknown',
    };
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Verifies credentials and issues a fresh session token.
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Email and password are required.');
    }

    const sessionData = await authService.login({ email, password });
    const response: ApiResponse<AuthSessionResponse> = {
      data: sessionData,
      requestId: req.requestId || 'req-unknown',
    };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Retrieves current authenticated user profile and authoritative role.
 */
router.get('/me', authMiddleware, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userSummary = await authService.getMe(req.actor!.userId);
    const response: ApiResponse<{ user: UserSummary }> = {
      data: { user: userSummary },
      requestId: req.requestId || 'req-unknown',
    };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 * Invalidates the current session token in persistent session storage.
 */
router.post('/logout', authMiddleware, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.sessionToken) {
      await authService.logout(req.sessionToken);
    }
    const response: ApiResponse<{ message: string }> = {
      data: { message: 'Successfully logged out.' },
      requestId: req.requestId || 'req-unknown',
    };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

export default router;
