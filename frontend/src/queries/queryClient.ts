import { QueryClient } from '@tanstack/react-query';
import { AppError } from '@/types';

function isTransientError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.isTransient;
  }
  return false;
}

export function createApplicationQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Retry ONLY explicitly transient errors (e.g. transient 503s); never retry 400, 401, 403, 404, or 409
        retry: (failureCount, error) => {
          if (!isTransientError(error)) {
            return false;
          }
          return failureCount < 2;
        },
        // Freshness defaults; capability-specific hooks override this
        staleTime: 1000 * 30, // 30 seconds default
      },
      mutations: {
        // Zero automatic retries for unsafe mutations without established idempotency
        retry: 0,
      },
    },
  });
}

export const applicationQueryClient = createApplicationQueryClient();
