import { Request, Response, NextFunction } from 'express';
import { DomainError, ApiErrorResponse } from '../types';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const requestId = req.requestId || 'req-unknown';

  if (err instanceof DomainError) {
    const response: ApiErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      },
      requestId
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // Handle postgresql unique constraint collision if leaked to error handler
  const pgErr = err as { code?: string; constraint?: string; message?: string };
  if (pgErr && pgErr.code === '23505' && pgErr.constraint === 'booking_confirmed_resource_uk') {
    const response: ApiErrorResponse = {
      error: {
        code: 'CONFLICT',
        message: 'The requested study table slot is already booked for this date and time'
      },
      requestId
    };
    res.status(409).json(response);
    return;
  }

  // Safe fallback: never leak internal credentials, connection strings or database internals
  console.error('Unhandled backend error:', pgErr?.message || String(err));

  const response: ApiErrorResponse = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected internal error occurred'
    },
    requestId
  };
  res.status(500).json(response);
}
