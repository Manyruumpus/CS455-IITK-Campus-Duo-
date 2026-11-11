import { Router, Request, Response, NextFunction } from 'express';
import { ProfileService } from '../services/profileService';
import { authMiddleware } from '../middleware/auth';
import { ApiResponse, DomainError, PrivateUserProfile } from '../types';

const router = Router();
const profileService = new ProfileService();

// All profile endpoints require authentication
router.use(authMiddleware);

async function handleGetProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actor = req.actor;
    if (!actor) {
      throw new DomainError('UNAUTHENTICATED', 401, 'Authentication required.');
    }

    if (actor.role === 'ROLE_ADMIN') {
      throw new DomainError(
        'FORBIDDEN',
        403,
        'Administrative role cannot access private student profile data directly.'
      );
    }

    const profile = await profileService.getProfile(actor.userId);
    const response: ApiResponse<PrivateUserProfile> = {
      data: profile,
      requestId: req.requestId || 'req-unknown',
    };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

async function handleUpdateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actor = req.actor;
    if (!actor) {
      throw new DomainError('UNAUTHENTICATED', 401, 'Authentication required.');
    }

    if (actor.role === 'ROLE_ADMIN') {
      throw new DomainError('FORBIDDEN', 403, 'Administrators cannot modify student profiles.');
    }

    // Reject cross-user modification attempts
    if (req.body && req.body.userId && req.body.userId !== actor.userId) {
      throw new DomainError('FORBIDDEN', 403, 'Cross-user profile modification is rejected.');
    }

    const updated = await profileService.updateProfile(actor.userId, req.body);
    const response: ApiResponse<PrivateUserProfile> = {
      data: updated,
      requestId: req.requestId || 'req-unknown',
    };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

router.get('/', handleGetProfile);
router.get('/me', handleGetProfile);
router.put('/', handleUpdateProfile);
router.put('/me', handleUpdateProfile);
router.patch('/', handleUpdateProfile);
router.patch('/me', handleUpdateProfile);

router.put('/consent/:mode', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const actor = req.actor;
    const mode = typeof req.params.mode === 'string' ? req.params.mode.toUpperCase() : '';
    if (!actor || actor.role !== 'ROLE_STUDENT') {
      throw new DomainError('FORBIDDEN', 403, 'Only students may change discovery consent.');
    }
    if (mode !== 'STUDY' && mode !== 'SOCIAL') {
      throw new DomainError('VALIDATION_ERROR', 400, 'Consent mode must be STUDY or SOCIAL.');
    }
    if (typeof req.body?.hasConsent !== 'boolean') {
      throw new DomainError('VALIDATION_ERROR', 400, 'hasConsent must be a boolean.');
    }
    const consent = await profileService.updateConsent(actor.userId, mode, req.body.hasConsent);
    const response: ApiResponse<typeof consent> = {
      data: consent,
      requestId: req.requestId || 'req-unknown',
    };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

export default router;
