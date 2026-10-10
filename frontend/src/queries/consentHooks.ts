import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import { appServices } from '@/services';
import { useDemoAuth } from '@/app/context/DemoAuthContext';
import {
  StudyConsentRecord,
  SocialConsentRecord,
  AppError,
  ErrorCode,
} from '@/types';

/**
 * Fetch independent study discovery consent.
 */
export const useStudyConsent = () => {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';

  return useQuery<StudyConsentRecord, AppError>({
    queryKey: queryKeys.consent.study(actorId),
    queryFn: async ({ signal }) => {
      if (!session) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required');
      }
      return appServices.study.getStudyConsent({ actorSession: session, signal });
    },
    enabled: !!session && session.role === 'ROLE_STUDENT',
  });
};

/**
 * Fetch independent social discovery consent.
 */
export const useSocialConsent = () => {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';

  return useQuery<SocialConsentRecord, AppError>({
    queryKey: queryKeys.consent.social(actorId),
    queryFn: async ({ signal }) => {
      if (!session) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required');
      }
      return appServices.social.getSocialConsent({ actorSession: session, signal });
    },
    enabled: !!session && session.role === 'ROLE_STUDENT',
  });
};

/**
 * Mutate academic study discovery consent.
 */
export const useUpdateStudyConsent = () => {
  const queryClient = useQueryClient();
  const { session, updateSession } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';

  return useMutation<StudyConsentRecord, AppError, boolean>({
    mutationFn: async (optIn) => {
      if (!session) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to update study consent');
      }
      return appServices.study.updateStudyConsent(optIn, { actorSession: session });
    },
    onSuccess: (updatedConsent) => {
      // Synchronize session state
      if (session) {
        updateSession({ hasStudyConsent: updatedConsent.hasConsent });
      }

      // Update query cache
      queryClient.setQueryData(queryKeys.consent.study(actorId), updatedConsent);
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.me(actorId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.studyPreview(actorId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.study.all(actorId) });
    },
  });
};

/**
 * Mutate campus social discovery consent.
 */
export const useUpdateSocialConsent = () => {
  const queryClient = useQueryClient();
  const { session, updateSession } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';

  return useMutation<SocialConsentRecord, AppError, boolean>({
    mutationFn: async (optIn) => {
      if (!session) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to update social consent');
      }
      return appServices.social.updateSocialConsent(optIn, { actorSession: session });
    },
    onSuccess: (updatedConsent) => {
      // Synchronize session state
      if (session) {
        updateSession({ hasSocialConsent: updatedConsent.hasConsent });
      }

      // Update query cache
      queryClient.setQueryData(queryKeys.consent.social(actorId), updatedConsent);
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.me(actorId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.socialPreview(actorId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.social.all(actorId) });
    },
  });
};

/**
 * Fetch blocked accounts list (read-only wire; unblock is pending policy).
 */
export const useBlockedUsers = () => {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';

  return useQuery<string[], AppError>({
    queryKey: queryKeys.moderation.blocked(actorId),
    queryFn: async ({ signal }) => {
      if (!session) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required');
      }
      return appServices.moderation.listBlockedUsers({ actorSession: session, signal });
    },
    enabled: !!session,
  });
};
