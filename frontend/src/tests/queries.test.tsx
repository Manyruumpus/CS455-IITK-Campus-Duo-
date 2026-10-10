import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  createApplicationQueryClient,
  queryKeys,
  useTableAvailability,
  useCreateBooking,
} from '@/queries';
import { DemoAuthProvider, useDemoAuth } from '@/app/context/DemoAuthContext';
import { mockStore } from '@/mocks/store';
import { scenarioManager } from '@/mocks/scenarios';
import { UserSession, AppError, ErrorCode } from '@/types';

const STUDENT_A_SESSION: UserSession = {
  userId: 'usr-student-alex',
  email: 'alex.rivera@campusduo.test',
  name: 'Alex Rivera',
  rollNumber: '200001',
  role: 'ROLE_STUDENT',
  isOnboarded: true,
  hasStudyConsent: true,
  hasSocialConsent: true,
};

describe('TanStack Query Architecture & Session Isolation', () => {
  beforeEach(() => {
    mockStore.reset();
    scenarioManager.reset();
  });

  describe('1. Actor-Scoped Query Keys', () => {
    it('embeds actor ID in all permission-sensitive keys', () => {
      const actorKey = queryKeys.bookings.availability(
        'usr-student-alex',
        'loc-pk-kelkar-2f',
        '2026-10-08'
      );
      expect(actorKey).toEqual([
        'bookings',
        'usr-student-alex',
        'availability',
        'loc-pk-kelkar-2f',
        '2026-10-08',
      ]);

      const myBookingsKey = queryKeys.bookings.myBookings('usr-student-alex');
      expect(myBookingsKey).toEqual([
        'bookings',
        'usr-student-alex',
        'my',
        { status: 'all' },
      ]);
    });
  });

  describe('2. Retry Policy: Transient-Only vs Zero-Retry Errors', () => {
    it('does not retry 400, 401, 403, 404, or 409 conflict errors', () => {
      const client = createApplicationQueryClient();
      const defaultRetry = client.getDefaultOptions().queries?.retry;
      expect(typeof defaultRetry).toBe('function');

      if (typeof defaultRetry === 'function') {
        const conflictErr = new AppError(ErrorCode.CONFLICT, 'Slot collision');
        const unauthErr = new AppError(ErrorCode.UNAUTHENTICATED, 'Missing session');
        const forbiddenErr = new AppError(ErrorCode.FORBIDDEN, 'Access denied');
        const notFoundErr = new AppError(ErrorCode.NOT_FOUND, 'Resource missing');
        const validationErr = new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid param');
        const transientErr = new AppError(ErrorCode.SERVICE_UNAVAILABLE, 'Down temporarily', {
          isTransient: true,
        });

        expect(defaultRetry(1, conflictErr)).toBe(false);
        expect(defaultRetry(1, unauthErr)).toBe(false);
        expect(defaultRetry(1, forbiddenErr)).toBe(false);
        expect(defaultRetry(1, notFoundErr)).toBe(false);
        expect(defaultRetry(1, validationErr)).toBe(false);

        // Explicitly transient error is retried
        expect(defaultRetry(1, transientErr)).toBe(true);
        expect(defaultRetry(2, transientErr)).toBe(false); // Max 2 attempts
      }
    });

    it('enforces retry: 0 on all mutations by default', () => {
      const client = createApplicationQueryClient();
      expect(client.getDefaultOptions().mutations?.retry).toBe(0);
    });
  });

  describe('3. Session Identity Switch & Cache Cancellation', () => {
    it('clears query cache and cancels pending reads across identity switch', async () => {
      const queryClient = createApplicationQueryClient();

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <DemoAuthProvider
            initialSession={STUDENT_A_SESSION}
            isDemoAuthEnabled={true}
            queryClient={queryClient}
          >
            {children}
          </DemoAuthProvider>
        </QueryClientProvider>
      );

      const { result } = renderHook(
        () => {
          const auth = useDemoAuth();
          const availability = useTableAvailability('loc-pk-kelkar-2f', '2026-10-08');
          return { auth, availability };
        },
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.availability.isSuccess).toBe(true);
      });
      expect(result.current.availability.data?.length).toBeGreaterThan(0);

      // Verify query cache has entries
      const cacheBefore = queryClient.getQueryCache().getAll();
      expect(cacheBefore.length).toBeGreaterThan(0);

      // Act: Identity switch to SIGNED_OUT
      act(() => {
        result.current.auth.switchRole('SIGNED_OUT');
      });

      // Private actor queries and data are completely eradicated from the cache
      const studentQueries = queryClient.getQueryCache().findAll({
        queryKey: ['bookings', 'usr-student-alex'],
      });
      expect(studentQueries.length).toBe(0);
      expect(
        queryClient.getQueryData(
          queryKeys.bookings.availability(
            'usr-student-alex',
            'loc-pk-kelkar-2f',
            '2026-10-08'
          )
        )
      ).toBeUndefined();
    });

    it('prevents delayed request and delayed mutation from updating new session UI or cache', async () => {
      const queryClient = createApplicationQueryClient();

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <DemoAuthProvider
            initialSession={STUDENT_A_SESSION}
            isDemoAuthEnabled={true}
            queryClient={queryClient}
          >
            {children}
          </DemoAuthProvider>
        </QueryClientProvider>
      );

      const { result } = renderHook(
        () => {
          const auth = useDemoAuth();
          const createBooking = useCreateBooking();
          return { auth, createBooking };
        },
        { wrapper }
      );

      // Introduce simulated network delay for mutations
      scenarioManager.setScenario({ forceDelayMs: 60 });

      // Launch mutation under Student A
      let mutationFinished = false;
      act(() => {
        result.current.createBooking.mutate(
          {
            tableId: 'tbl-pk-2f-10',
            locationId: 'loc-pk-kelkar-2f',
            localDate: '2026-10-08',
            slotId: 'slot-pk-10-14',
          },
          {
            onSettled: () => {
              mutationFinished = true;
            },
          }
        );
      });

      // Immediately switch identity before mutation completes
      act(() => {
        result.current.auth.switchRole('ROLE_ADMIN');
      });

      await waitFor(() => {
        expect(mutationFinished).toBe(true);
      });

      // Verify that Student A's delayed mutation callback did NOT populate Admin cache
      const adminCache = queryClient.getQueryCache().findAll({
        queryKey: ['bookings', 'usr-admin-senate'],
      });
      expect(adminCache.length).toBe(0);
    });
  });
});
