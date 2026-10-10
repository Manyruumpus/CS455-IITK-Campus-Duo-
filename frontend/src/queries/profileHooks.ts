import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import { appServices } from '@/services';
import { useDemoAuth } from '@/app/context/DemoAuthContext';
import {
  PrivateUserProfile,
  PublicStudyProfile,
  PublicSocialProfile,
  ProfileUpdateRequest,
  StudentOnboardingRequest,
  SelfPreviewResult,
  AppError,
  ErrorCode,
} from '@/types';

/**
 * Fetch private self-profile for the authenticated student.
 */
export const usePrivateProfile = () => {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';

  return useQuery<PrivateUserProfile, AppError>({
    queryKey: queryKeys.profiles.me(actorId),
    queryFn: async ({ signal }) => {
      if (!session) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to view profile');
      }
      return appServices.profile.getPrivateProfile({ actorSession: session, signal });
    },
    enabled: !!session && session.role === 'ROLE_STUDENT',
  });
};

/**
 * Fetch self public study profile preview (works even when discovery is disabled).
 */
export const usePublicStudyProfilePreview = () => {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';

  return useQuery<SelfPreviewResult<PublicStudyProfile>, AppError>({
    queryKey: queryKeys.profiles.studyPreview(actorId),
    queryFn: async ({ signal }) => {
      if (!session) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to view preview');
      }
      return appServices.profile.getSelfStudyPreview({ actorSession: session, signal });
    },
    enabled: !!session && session.role === 'ROLE_STUDENT',
  });
};

/**
 * Fetch self public social profile preview (works even when discovery is disabled).
 */
export const usePublicSocialProfilePreview = () => {
  const { session } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';

  return useQuery<SelfPreviewResult<PublicSocialProfile>, AppError>({
    queryKey: queryKeys.profiles.socialPreview(actorId),
    queryFn: async ({ signal }) => {
      if (!session) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to view preview');
      }
      return appServices.profile.getSelfSocialPreview({ actorSession: session, signal });
    },
    enabled: !!session && session.role === 'ROLE_STUDENT',
  });
};

/**
 * Update private profile fields (explicit editable projection).
 */
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  const { session, updateSession } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';

  return useMutation<PrivateUserProfile, AppError, ProfileUpdateRequest>({
    mutationFn: async (request) => {
      if (!session) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to update profile');
      }
      return appServices.profile.updatePrivateProfile(request, { actorSession: session });
    },
    onSuccess: (updatedProfile) => {
      // Refresh self-profile and previews
      queryClient.setQueryData(queryKeys.profiles.me(actorId), updatedProfile);
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.studyPreview(actorId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.socialPreview(actorId) });

      // Invalidate discovery/recommendation data so other views update
      queryClient.invalidateQueries({ queryKey: queryKeys.study.all(actorId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.social.all(actorId) });

      // Synchronize session displayName if updated
      if (session && updatedProfile.displayName !== session.name) {
        updateSession({ name: updatedProfile.displayName });
      }
    },
  });
};

/**
 * Complete student onboarding wizard.
 */
export const useCompleteOnboarding = () => {
  const queryClient = useQueryClient();
  const { session, updateSession } = useDemoAuth();
  const actorId = session?.userId ?? 'anonymous';

  return useMutation<PrivateUserProfile, AppError, StudentOnboardingRequest>({
    mutationFn: async (request) => {
      if (!session) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in required to complete onboarding');
      }
      return appServices.profile.completeOnboarding(request, { actorSession: session });
    },
    onSuccess: (savedProfile) => {
      // Synchronize session state from the saved result (Amendment 3)
      if (session) {
        updateSession({
          isOnboarded: savedProfile.isOnboarded,
          hasStudyConsent: savedProfile.studyConsent.hasConsent,
          hasSocialConsent: savedProfile.socialConsent.hasConsent,
          name: savedProfile.displayName,
        });
      }

      // Update and invalidate profile & discovery caches
      queryClient.setQueryData(queryKeys.profiles.me(actorId), savedProfile);
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.studyPreview(actorId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.socialPreview(actorId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.study.all(actorId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.social.all(actorId) });
    },
  });
};
