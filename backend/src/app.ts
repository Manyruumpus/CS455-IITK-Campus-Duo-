import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import bookingRouter from './routes/booking';
import agentRouter from './routes/agent';
import discoveryRouter from './routes/discovery';
import { errorHandler } from './middleware/errorHandler';
import { DomainError } from './types';

export function createApp(): express.Application {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Attach or generate unique request ID
  app.use((req: Request, res: Response, next: NextFunction) => {
    const incomingId = req.headers['x-request-id'];
    req.requestId = typeof incomingId === 'string' && incomingId.trim().length > 0
      ? incomingId.trim()
      : `req-${crypto.randomUUID()}`;
    res.setHeader('X-Request-Id', req.requestId);
    next();
  });

  // Mount API routers
  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/booking', bookingRouter);
  app.use('/api/agent', agentRouter);
  app.use('/api/discovery', discoveryRouter);

  // 404 handler for unrecognized routes
  app.use((req: Request, res: Response, next: NextFunction) => {
    next(new DomainError('NOT_FOUND', 404, `Route not found: ${req.method} ${req.path}`));
  });

  // Centralized error handling middleware
  app.use(errorHandler);

  return app;
}

export const app = createApp();
