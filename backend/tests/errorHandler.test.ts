import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { errorHandler } from '../src/middleware/errorHandler';
import { DomainError } from '../src/types';

type CapturedResponse = {
  statusCode: number | undefined;
  body: unknown;
};

function createResponseDouble(): Response & CapturedResponse {
  const captured: CapturedResponse = {
    statusCode: undefined,
    body: undefined
  };

  const response = {
    status(code: number) {
      captured.statusCode = code;
      return response;
    },
    json(body: unknown) {
      captured.body = body;
      return response;
    }
  } as Response & CapturedResponse;

  Object.assign(response, captured);
  Object.defineProperties(response, {
    statusCode: {
      get: () => captured.statusCode,
      set: (value: number | undefined) => {
        captured.statusCode = value;
      }
    },
    body: {
      get: () => captured.body,
      set: (value: unknown) => {
        captured.body = value;
      }
    }
  });

  return response;
}

function invokeHandler(
  error: unknown,
  requestId?: string
): CapturedResponse {
  const response = createResponseDouble();
  const request = { requestId } as Request;
  const next: NextFunction = () => undefined;

  errorHandler(error, request, response, next);

  return {
    statusCode: response.statusCode,
    body: response.body
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('errorHandler', () => {
  it.each([
    {
      code: 'UNAUTHENTICATED' as const,
      status: 401,
      message: 'Authentication is required',
      details: undefined
    },
    {
      code: 'FORBIDDEN' as const,
      status: 403,
      message: 'You are not allowed to perform this action',
      details: { policy: 'study-consent' }
    },
    {
      code: 'NOT_FOUND' as const,
      status: 404,
      message: 'The requested resource was not found',
      details: undefined
    },
    {
      code: 'CONFLICT' as const,
      status: 409,
      message: 'The study table slot is already booked',
      details: { resource: 'slot' }
    },
    {
      code: 'VALIDATION_ERROR' as const,
      status: 400,
      message: 'The request is invalid',
      details: { field: 'localDate' }
    },
    {
      code: 'SERVICE_UNAVAILABLE' as const,
      status: 503,
      message: 'The booking service is temporarily unavailable',
      details: undefined
    },
    {
      code: 'INTERNAL_ERROR' as const,
      status: 500,
      message: 'An internal application error occurred',
      details: undefined
    }
  ])(
    'maps $code to its documented status, code, message, details, and request ID',
    ({ code, status, message, details }) => {
      const result = invokeHandler(
        new DomainError(code, status, message, details),
        'req-domain-123'
      );

      expect(result.statusCode).toBe(status);
      expect(result.body).toEqual({
        error: {
          code,
          message,
          ...(details === undefined ? {} : { details })
        },
        requestId: 'req-domain-123'
      });
    }
  );

  it('maps the booking uniqueness constraint to a safe booking conflict response', () => {
    const result = invokeHandler(
      {
        code: '23505',
        constraint: 'booking_confirmed_resource_uk',
        message: 'duplicate key value violates unique constraint'
      },
      'req-pg-conflict'
    );

    expect(result.statusCode).toBe(409);
    expect(result.body).toEqual({
      error: {
        code: 'CONFLICT',
        message: 'The requested study table slot is already booked for this date and time'
      },
      requestId: 'req-pg-conflict'
    });
  });

  it.each([
    {
      description: 'another unique constraint',
      error: { code: '23505', constraint: 'user_account_identity_subject_uk' }
    },
    {
      description: 'an unexpected PostgreSQL SQLSTATE',
      error: { code: '40001', message: 'serialization failure' }
    }
  ])(
    'does not label $description as a booking conflict',
    ({ error }) => {
      const result = invokeHandler(error, 'req-unrelated-db');

      expect(result.statusCode).toBe(500);
      expect(result.body).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected internal error occurred'
        },
        requestId: 'req-unrelated-db'
      });
    }
  );

  it('returns a generic safe response for unexpected exceptions without exposing internals', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const secretMarker = 'SYNTHETIC_SECRET_MARKER';
    const rawSql = 'SELECT password FROM campus_duo.secret_store';
    const databaseDetail = 'postgres://campus_duo_app:secret@localhost/campus_duo_test';
    const result = invokeHandler(
      new Error(`${secretMarker} ${rawSql} ${databaseDetail}`),
      'req-unexpected'
    );

    expect(result.statusCode).toBe(500);
    expect(result.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected internal error occurred'
      },
      requestId: 'req-unexpected'
    });
    expect(JSON.stringify(result.body)).not.toContain(secretMarker);
    expect(JSON.stringify(result.body)).not.toContain(rawSql);
    expect(JSON.stringify(result.body)).not.toContain(databaseDetail);
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it('uses req-unknown when the request has no request ID', () => {
    const result = invokeHandler(
      new DomainError('NOT_FOUND', 404, 'Missing resource')
    );

    expect(result.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Missing resource'
      },
      requestId: 'req-unknown'
    });
  });
});
