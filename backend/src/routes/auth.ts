import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { authMiddleware } from '../middleware/auth';
import {
  ApiResponse,
  DomainError,
  AuthSessionResponse,
  OtpSessionResponse,
  OtpChallengeResponse,
  UserSummary
} from '../types';

const router = Router();
const authService = new AuthService();

/**
 * POST /api/auth/otp/request-registration
 * Dispatches a 6-digit OTP to an allowed @iitk.ac.in email for new student registration.
 */
router.post(
  '/otp/request-registration',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, displayName } = req.body;
      const result = await authService.requestRegistrationOtp({ email, displayName });
      const response: ApiResponse<OtpChallengeResponse> = {
        data: result,
        requestId: req.requestId || 'req-unknown',
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/auth/otp/verify-registration
 * Verifies 6-digit OTP, creates verified student account, and establishes session.
 */
router.post(
  '/otp/verify-registration',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, otp, challengeId } = req.body;
      const sessionData = await authService.verifyRegistrationOtp({ email, otp, challengeId });
      const response: ApiResponse<OtpSessionResponse> = {
        data: sessionData,
        requestId: req.requestId || 'req-unknown',
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/auth/otp/request-login
 * Dispatches a 6-digit OTP to an active registered @iitk.ac.in user.
 */
router.post(
  '/otp/request-login',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email } = req.body;
      const result = await authService.requestLoginOtp({ email });
      const response: ApiResponse<OtpChallengeResponse> = {
        data: result,
        requestId: req.requestId || 'req-unknown',
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/auth/otp/verify-login
 * Verifies 6-digit OTP for login and returns fresh session token.
 */
router.post(
  '/otp/verify-login',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, otp, challengeId } = req.body;
      const sessionData = await authService.verifyLoginOtp({ email, otp, challengeId });
      const response: ApiResponse<OtpSessionResponse> = {
        data: sessionData,
        requestId: req.requestId || 'req-unknown',
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/auth/register
 * Direct registration endpoint (backward-compatible / test harness only).
 * Disabled in production: institutional OTP verification is mandatory.
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (process.env.NODE_ENV === 'production' || process.env.ALLOW_TEST_HARNESS_AUTH !== 'true') {
      throw new DomainError(
        'FORBIDDEN',
        403,
        'Direct credential registration is disabled. Normal registration requires institutional email OTP verification.'
      );
    }
    const { email, displayName, password } = req.body;
    if (!email || !displayName) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Email and display name are required.');
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
 * Direct credential login endpoint (backward-compatible / test harness only).
 * Disabled in production: institutional OTP verification is mandatory.
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (process.env.NODE_ENV === 'production' || process.env.ALLOW_TEST_HARNESS_AUTH !== 'true') {
      throw new DomainError(
        'FORBIDDEN',
        403,
        'Direct password login is disabled. Normal authentication requires institutional email OTP verification.'
      );
    }
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
