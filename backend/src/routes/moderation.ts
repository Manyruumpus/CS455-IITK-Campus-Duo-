import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import { ApiResponse, DomainError } from '../types';
import { ModerationService } from '../services/moderationService';

const router = Router();
const moderationService = new ModerationService();
router.use(authMiddleware);

router.get('/blocks', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await moderationService.listBlocked(req.actor!);
    const response: ApiResponse<string[]> = { data, requestId: req.requestId || 'req-unknown' };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

router.post('/blocks/:targetUserId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await moderationService.setBlock(req.actor!, req.params.targetUserId, true);
    const response: ApiResponse<typeof result> = { data: result, requestId: req.requestId || 'req-unknown' };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

router.delete('/blocks/:targetUserId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await moderationService.setBlock(req.actor!, req.params.targetUserId, false);
    const response: ApiResponse<typeof result> = { data: result, requestId: req.requestId || 'req-unknown' };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

router.post('/reports', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { reportedUserId, category, description } = req.body || {};
    if (typeof reportedUserId !== 'string' || typeof category !== 'string' || typeof description !== 'string') {
      throw new DomainError('VALIDATION_ERROR', 400, 'reportedUserId, category, and description are required.');
    }
    const data = await moderationService.submitReport(req.actor!, reportedUserId, category, description);
    const response: ApiResponse<typeof data> = { data, requestId: req.requestId || 'req-unknown' };
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});

router.get('/reports/mine', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await moderationService.listMyReports(req.actor!);
    const response: ApiResponse<typeof data> = { data, requestId: req.requestId || 'req-unknown' };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

export default router;
