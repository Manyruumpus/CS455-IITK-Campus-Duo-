import { AppServices } from './interfaces';
import { appConfig } from '@/config/features';
import { MockAuthService, MockProfileService } from './mock/MockAuthProfileServices';
import {
  MockStudyService,
  MockSocialService,
  MockConnectionService,
} from './mock/MockStudySocialServices';
import { MockBookingService } from './mock/MockBookingService';
import {
  MockNotificationService,
  MockModerationService,
  MockAdminService,
  MockConversationService,
} from './mock/MockAdminModerationServices';
import { UnavailableServiceAdapter } from './unavailable/UnavailableServiceAdapter';
import { HttpBookingAdapter } from './http/HttpBookingAdapter';
import { HttpAdminAdapter } from './http/HttpAdminAdapter';
import { HttpAgentAdapter } from './http/HttpAgentAdapter';
import { HttpProfileAdapter } from './http/HttpProfileAdapter';
import { HttpDiscoveryAdapter } from './http/HttpDiscoveryAdapter';
import { HttpModerationAdapter } from './http/HttpModerationAdapter';

export * from './interfaces';
export * from './http/HttpBookingAdapter';
export * from './http/HttpAdminAdapter';
export * from './http/HttpAgentAdapter';
export * from './http/HttpProfileAdapter';
export * from './http/HttpDiscoveryAdapter';
export * from './http/HttpModerationAdapter';

export interface ServiceSelectionOptions {
  isDemoAuthEnabled?: boolean;
  isLiveBookingEnabled?: boolean;
  isLiveProfileEnabled?: boolean;
}

/**
 * Creates or retrieves the service bundle based on environment configuration.
 *
 * ARCHITECTURAL ISOLATION RULE:
 * - When isLiveBookingEnabled is true (VITE_USE_LIVE_BOOKING=true), connects booking, admin inventory, profile, and read-only AI recommendation services to the backend.
 * - When isLiveBookingEnabled is false:
 *     - If isDemoAuthEnabled is active (dev or demo showcase), uses in-memory MockBookingService, MockAdminService, and MockProfileService.
 *     - If in default production, strictly returns UnavailableServiceAdapter for booking and all unimplemented services.
 * - Preserves safe default and unavailable-service fallback when live mode is disabled.
 */
export function getAppServices(options?: ServiceSelectionOptions): AppServices {
  const isDemoAuth = options?.isDemoAuthEnabled ?? appConfig.isDemoAuthEnabled;
  const isLiveBooking =
    options?.isLiveBookingEnabled ??
    (appConfig.isLiveBookingEnabled || import.meta.env.VITE_USE_LIVE_BOOKING === 'true');
  const isLiveProfile =
    options?.isLiveProfileEnabled ??
    (import.meta.env.VITE_USE_LIVE_PROFILE === 'true' || isLiveBooking);

  const bookingService = isLiveBooking ? new HttpBookingAdapter() : new MockBookingService();
  const adminService = isLiveBooking ? new HttpAdminAdapter() : new MockAdminService();
  const profileService = isLiveProfile ? new HttpProfileAdapter() : new MockProfileService();
  const liveDiscovery = isLiveBooking ? new HttpDiscoveryAdapter() : undefined;
  const liveModeration = isLiveBooking ? new HttpModerationAdapter() : undefined;

  if (isLiveBooking || isLiveProfile) {
    const unavailable = new UnavailableServiceAdapter();
    const agent = new HttpAgentAdapter();
    const liveStudy = liveDiscovery
      ? liveDiscovery
      : { ...unavailable.study, submitMatchingQuery: agent.submitMatchingQuery.bind(agent) };
    const liveSocial = liveDiscovery
      ? {
          ...unavailable.social,
          getSocialConsent: liveDiscovery.getSocialConsent.bind(liveDiscovery),
          updateSocialConsent: liveDiscovery.updateSocialConsent.bind(liveDiscovery),
        }
      : unavailable.social;
    return {
      // Demo auth controls only the development login chooser; it must not
      // switch live data services back to in-memory implementations.
      auth: isDemoAuth ? new MockAuthService() : unavailable.auth,
      profile: isLiveProfile ? profileService : unavailable.profile,
      study: liveStudy,
      social: liveSocial,
      connection: liveDiscovery ?? unavailable.connection,
      booking: isLiveBooking ? bookingService : unavailable.booking,
      notification: unavailable.notification,
      moderation: liveModeration ?? unavailable.moderation,
      admin: isLiveBooking ? adminService : unavailable.admin,
      conversation: unavailable.conversation,
    };
  }

  if (!isDemoAuth) {
    return new UnavailableServiceAdapter();
  }

  return {
    auth: new MockAuthService(),
    profile: profileService,
    study: new MockStudyService(),
    social: new MockSocialService(),
    connection: new MockConnectionService(),
    booking: bookingService,
    notification: new MockNotificationService(),
    moderation: new MockModerationService(),
    admin: adminService,
    conversation: new MockConversationService(),
  };
}

export const appServices = getAppServices();

