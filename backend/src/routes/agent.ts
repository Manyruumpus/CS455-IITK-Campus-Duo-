import { Router, Request, Response, NextFunction } from 'express';
import { AgentService } from '../services/agentService';
import { testAuthMiddleware } from '../middleware/auth';
import { ApiResponse } from '../types';

const router = Router();
const agentService = new AgentService();

/**
 * POST /api/agent/recommend
 * Bounded read-only recommendation endpoint.
 * Accepts optional courseCode and prompt; executes allow-listed queries and deterministic scoring.
 * Falls back deterministically if inference is disabled, offline, or ungrounded.
 */
router.post(
  '/recommend',
  testAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const requestId = req.requestId || 'req-unknown';

      const { courseCode, prompt, limit } = req.body || {};

      const result = await agentService.recommend(actor, {
        courseCode: typeof courseCode === 'string' ? courseCode : undefined,
        prompt: typeof prompt === 'string' ? prompt : undefined,
        limit: typeof limit === 'number' ? limit : undefined,
      });

      const response: ApiResponse<typeof result> = {
        data: result,
        requestId,
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
