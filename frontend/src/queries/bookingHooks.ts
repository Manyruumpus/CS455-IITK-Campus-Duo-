import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDemoAuth } from '@/app/context/DemoAuthContext';
import { appServices } from '@/services';
import { queryKeys } from './queryKeys';
import { AppError, ErrorCode, StudyTableSlot, BookingRecord, BookingCreationRequest, CampusLocation } from '@/types';

export function useBookingLocations() {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';
  return useQuery<CampusLocation[], AppError>({
    queryKey: ['bookings', actorId, 'locations'],
    queryFn: async ({ signal }) => {
      if (!session) throw new AppError(ErrorCode.UNAUTHENTICATED, 'Must be authenticated to view booking locations');
      return appServices.booking.listLocations({ actorSession: session, signal });
    },
    enabled: Boolean(session),
    staleTime: 1000 * 60,
  });
}

/**
 * Hook to retrieve live table slot availability.
 * Per specification: table availability cannot rely on long stale times;
 * staleTime is set to 0 and query is cancellable via AbortSignal.
 */
export function useTableAvailability(locationId: string, date: string) {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';

  return useQuery<StudyTableSlot[], AppError>({
    queryKey: queryKeys.bookings.availability(actorId, locationId, date),
    queryFn: async ({ signal }) => {
      if (!session) {
        throw new AppError(
          ErrorCode.UNAUTHENTICATED,
          'Must be authenticated to view table availability'
        );
      }
      return appServices.booking.listTableAvailability(locationId, date, {
        actorSession: session,
        signal,
      });
    },
    enabled: Boolean(session) && Boolean(locationId) && Boolean(date),
    staleTime: 0, // Mutation-time check is authoritative; don't mask with long staleTime
  });
}

/**
 * Hook to retrieve details for a single booking by ID.
 * Actor boundary: both explicit participants (creator & companion) and admins may view details.
 */
export function useBookingDetail(bookingId: string | undefined) {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';

  return useQuery<BookingRecord, AppError>({
    queryKey: queryKeys.bookings.detail(actorId, bookingId ?? ''),
    queryFn: async ({ signal }) => {
      if (!session) {
        throw new AppError(
          ErrorCode.UNAUTHENTICATED,
          'Must be authenticated to view booking details'
        );
      }
      if (!bookingId) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Booking ID is required');
      }
      return appServices.booking.getBooking(bookingId, {
        actorSession: session,
        signal,
      });
    },
    enabled: Boolean(session) && Boolean(bookingId),
    staleTime: 1000 * 10,
  });
}

/**
 * Hook to retrieve the current actor's booking history.
 * Both creators and companions will observe their shared reservations here.
 */
export function useMyBookings() {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';

  return useQuery<BookingRecord[], AppError>({
    queryKey: queryKeys.bookings.myBookings(actorId),
    queryFn: async ({ signal }) => {
      if (!session) {
        throw new AppError(
          ErrorCode.UNAUTHENTICATED,
          'Must be authenticated to view bookings'
        );
      }
      return appServices.booking.getMyBookings({
        actorSession: session,
        signal,
      });
    },
    enabled: Boolean(session),
    staleTime: 1000 * 15,
  });
}

/**
 * Hook to create a new table reservation.
 * Idempotency & session guards: avoids updating current cache if actor switched.
 * Updates both creator and companion booking caches as well as availability.
 */
export function useCreateBooking() {
  const { session } = useDemoAuth();
  const queryClient = useQueryClient();

  return useMutation<
    { result: BookingRecord; capturedActorId: string },
    AppError,
    BookingCreationRequest
  >({
    mutationFn: async (request: BookingCreationRequest) => {
      if (!session) {
        throw new AppError(
          ErrorCode.UNAUTHENTICATED,
          'Must be authenticated to reserve a table'
        );
      }
      const capturedActorId = session.userId;
      const result = await appServices.booking.createBooking(request, {
        actorSession: session,
      });
      return { result, capturedActorId };
    },
    onSuccess: ({ result, capturedActorId }) => {
      // Guard: if actor switched during in-flight mutation, do NOT invalidate new session cache
      if (session?.userId !== capturedActorId) {
        return;
      }
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          // Invalidate availability for anyone observing table slots
          if (key[0] === 'bookings' && key[2] === 'availability') return true;
          // Invalidate creator myBookings
          if (key[0] === 'bookings' && key[1] === capturedActorId && key[2] === 'my') return true;
          // Invalidate companion myBookings if present
          if (result.companionStudentId && key[0] === 'bookings' && key[1] === result.companionStudentId && key[2] === 'my') return true;
          return false;
        },
      });
    },
  });
}

/**
 * Hook to reconcile an uncertain booking creation by stable clientOperationId.
 */
export function useReconcileBooking() {
  const { session } = useDemoAuth();

  return useMutation<
    BookingRecord | null,
    AppError,
    { clientOperationId: string }
  >({
    mutationFn: async ({ clientOperationId }) => {
      if (!session) {
        throw new AppError(
          ErrorCode.UNAUTHENTICATED,
          'Must be authenticated to reconcile reservation'
        );
      }
      return appServices.booking.reconcileBooking(clientOperationId, {
        actorSession: session,
      });
    },
  });
}

/**
 * Hook to cancel an existing reservation.
 * Refreshes availability, booking detail, and history for creator and companion.
 */
export function useCancelBooking() {
  const { session } = useDemoAuth();
  const queryClient = useQueryClient();

  return useMutation<
    { result: BookingRecord; capturedActorId: string; bookingId: string },
    AppError,
    { bookingId: string; reason?: string }
  >({
    mutationFn: async ({ bookingId }: { bookingId: string; reason?: string }) => {
      if (!session) {
        throw new AppError(
          ErrorCode.UNAUTHENTICATED,
          'Must be authenticated to cancel a reservation'
        );
      }
      const capturedActorId = session.userId;
      const result = await appServices.booking.cancelBooking(bookingId, {
        actorSession: session,
      });
      return { result, capturedActorId, bookingId };
    },
    onSuccess: ({ result, capturedActorId, bookingId }) => {
      if (session?.userId !== capturedActorId) {
        return;
      }
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          // Invalidate detail for both creator, companion, or observing admin
          if (key[0] === 'bookings' && key[2] === 'detail' && key[3] === bookingId) return true;
          // Invalidate availability
          if (key[0] === 'bookings' && key[2] === 'availability') return true;
          // Invalidate creator history
          if (key[0] === 'bookings' && key[1] === capturedActorId && key[2] === 'my') return true;
          // Invalidate companion history
          if (result.companionStudentId && key[0] === 'bookings' && key[1] === result.companionStudentId && key[2] === 'my') return true;
          return false;
        },
      });
    },
  });
}

/**
 * Hook to reschedule an existing reservation.
 * Refreshes both old and new slot availability, booking detail, and participant histories.
 */
export function useRescheduleBooking() {
  const { session } = useDemoAuth();
  const queryClient = useQueryClient();

  return useMutation<
    { result: BookingRecord; capturedActorId: string; bookingId: string },
    AppError,
    { bookingId: string; newLocalDate: string; newSlotId: string }
  >({
    mutationFn: async ({
      bookingId,
      newLocalDate,
      newSlotId,
    }: {
      bookingId: string;
      newLocalDate: string;
      newSlotId: string;
    }) => {
      if (!session) {
        throw new AppError(
          ErrorCode.UNAUTHENTICATED,
          'Must be authenticated to reschedule'
        );
      }
      const capturedActorId = session.userId;
      const result = await appServices.booking.rescheduleBooking(
        { bookingId, newLocalDate, newSlotId },
        { actorSession: session }
      );
      return { result, capturedActorId, bookingId };
    },
    onSuccess: ({ result, capturedActorId, bookingId }) => {
      if (session?.userId !== capturedActorId) {
        return;
      }
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          if (key[0] === 'bookings' && key[2] === 'detail' && key[3] === bookingId) return true;
          // Invalidate availability across all locations/dates (refreshes both old and new slot availability!)
          if (key[0] === 'bookings' && key[2] === 'availability') return true;
          // Invalidate creator history
          if (key[0] === 'bookings' && key[1] === capturedActorId && key[2] === 'my') return true;
          // Invalidate companion history
          if (result.companionStudentId && key[0] === 'bookings' && key[1] === result.companionStudentId && key[2] === 'my') return true;
          return false;
        },
      });
    },
  });
}
