import { Router, Request, Response, NextFunction } from 'express';
import { DiscoveryService } from '../services/discoveryService';
import { testAuthMiddleware } from '../middleware/auth';
import { ApiResponse, DiscoveryActionResult, ConnectionSummary, DomainError, DiscoveryMode, DiscoveryActionType } from '../types';

const router = Router();
const discoveryService = new DiscoveryService();

/**
 * POST /api/discovery/actions
 * Records a directional discovery action (LIKE, PASS, HIDE) in PostgreSQL.
 * If a reciprocal LIKE exists, transactionally creates/activates exactly one MUTUAL_CONNECTED connection.
 */
router.post(
  '/actions',
  testAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const targetUserId = req.body.targetUserId || req.body.targetStudentId;
      const mode: DiscoveryMode = req.body.mode || 'STUDY';
      const actionType: DiscoveryActionType = req.body.actionType || req.body.action;

      if (!targetUserId) {
        throw new DomainError('VALIDATION_ERROR', 400, 'targetUserId or targetStudentId is required');
      }

      if (!actionType) {
        throw new DomainError('VALIDATION_ERROR', 400, 'actionType or action is required');
      }

      const result = await discoveryService.recordAction(actor, targetUserId, mode, actionType);

      const response: ApiResponse<DiscoveryActionResult> = {
        data: result,
        requestId: req.requestId || 'req-unknown'
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/discovery/connections
 * Retrieves active connections for the authenticated actor.
 */
router.get(
  '/connections',
  testAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const mode = typeof req.query.mode === 'string' && (req.query.mode === 'STUDY' || req.query.mode === 'SOCIAL')
        ? (req.query.mode as DiscoveryMode)
        : undefined;

      const connections = await discoveryService.getMyConnections(actor, mode);

      const response: ApiResponse<ConnectionSummary[]> = {
        data: connections,
        requestId: req.requestId || 'req-unknown'
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
