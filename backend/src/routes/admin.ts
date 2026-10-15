import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { query } from '../config/db';
import { ApiResponse } from '../types';

const router = Router();

// Apply strict authentication and ROLE_ADMIN authorization to all administrative endpoints
router.use(authMiddleware);
router.use(requireRole('ROLE_ADMIN'));

/**
 * GET /api/admin/summary
 * Returns administrative metrics and operational summary.
 * Strictly forbidden (HTTP 403) for students or unauthenticated users.
 */
router.get('/summary', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [locationsRes, bookingsRes, usersRes] = await Promise.all([
      query<{ count: string }>('SELECT COUNT(*)::text as count FROM campus_duo.study_location WHERE active = true'),
      query<{ count: string }>('SELECT COUNT(*)::text as count FROM campus_duo.booking'),
      query<{ count: string }>('SELECT COUNT(*)::text as count FROM campus_duo.user_account'),
    ]);

    const response: ApiResponse<{
      systemStatus: string;
      activeLocationsCount: number;
      totalBookingsCount: number;
      totalUsersCount: number;
      requester: {
        userId: string;
        role: string;
      };
    }> = {
      data: {
        systemStatus: 'OPERATIONAL',
        activeLocationsCount: parseInt(locationsRes.rows[0]?.count || '0', 10),
        totalBookingsCount: parseInt(bookingsRes.rows[0]?.count || '0', 10),
        totalUsersCount: parseInt(usersRes.rows[0]?.count || '0', 10),
        requester: {
          userId: req.actor!.userId,
          role: req.actor!.role,
        },
      },
      requestId: req.requestId || 'req-unknown',
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

export default router;
