import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import healthRouter from './routes/health';
import bookingRouter from './routes/booking';
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
  app.use('/api/booking', bookingRouter);

  // 404 handler for unrecognized routes
  app.use((req: Request, res: Response, next: NextFunction) => {
    next(new DomainError('NOT_FOUND', 404, `Route not found: ${req.method} ${req.path}`));
  });

  // Centralized error handling middleware
  app.use(errorHandler);

  return app;
}

export const app = createApp();
