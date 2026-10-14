import { Router, Request, Response } from 'express';
import { query } from '../config/db';

const router = Router();

router.get('/health', async (req: Request, res: Response) => {
  try {
    const dbRes = await query<{ current_user: string; current_database: string }>(
      'SELECT current_user, current_database();'
    );

    res.status(200).json({
      status: 'UP',
      database: 'CONNECTED',
      databaseUser: dbRes.rows[0]?.current_user,
      databaseName: dbRes.rows[0]?.current_database,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    // Never leak database password in health output
    res.status(503).json({
      status: 'DOWN',
      database: 'DISCONNECTED',
      error: 'Database connection failed',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
