import { Router, Request, Response, NextFunction } from 'express';
import { AgentService } from '../services/agentService';
import { requireRole, testAuthMiddleware } from '../middleware/auth';
import { ApiResponse, DomainError } from '../types';

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
  requireRole('ROLE_STUDENT'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const requestId = req.requestId || 'req-unknown';

      const { courseCode, prompt, limit } = req.body || {};

      if (
        (courseCode !== undefined &&
          (typeof courseCode !== 'string' ||
            courseCode.trim().length > 32 ||
            !/^[A-Za-z0-9-]+$/.test(courseCode.trim()))) ||
        (prompt !== undefined &&
          (typeof prompt !== 'string' || prompt.length > 1000)) ||
        (limit !== undefined &&
          (typeof limit !== 'number' ||
            !Number.isInteger(limit) ||
            limit < 1 ||
            limit > 50))
      ) {
        throw new DomainError(
          'VALIDATION_ERROR',
          400,
          'Invalid recommendation request. Use a course code up to 32 characters, a prompt up to 1000 characters, and a limit from 1 to 50.'
        );
      }

      const result = await agentService.recommend(actor, {
        courseCode: typeof courseCode === 'string' ? courseCode : undefined,
        prompt: typeof prompt === 'string' ? prompt : undefined,
        limit: limit as number | undefined,
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
