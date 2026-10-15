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

export * from './interfaces';
export * from './http/HttpBookingAdapter';
export * from './http/HttpAdminAdapter';

export interface ServiceSelectionOptions {
  isDemoAuthEnabled?: boolean;
  isLiveBookingEnabled?: boolean;
}

/**
 * Creates or retrieves the service bundle based on environment configuration.
 *
 * ARCHITECTURAL ISOLATION RULE:
 * - When isLiveBookingEnabled is true (VITE_USE_LIVE_BOOKING=true), connects booking service and admin inventory service to real Express/PostgreSQL backend via HttpBookingAdapter and HttpAdminAdapter.
 * - When isLiveBookingEnabled is false:
 *     - If isDemoAuthEnabled is active (dev or demo showcase), uses in-memory MockBookingService and MockAdminService.
 *     - If in default production, strictly returns UnavailableServiceAdapter for booking and all unimplemented services.
 * - Preserves safe default and unavailable-service fallback when live mode is disabled.
 */
export function getAppServices(options?: ServiceSelectionOptions): AppServices {
  const isDemoAuth = options?.isDemoAuthEnabled ?? appConfig.isDemoAuthEnabled;
  const isLiveBooking =
    options?.isLiveBookingEnabled ??
    (appConfig.isLiveBookingEnabled || import.meta.env.VITE_USE_LIVE_BOOKING === 'true');

  const bookingService = isLiveBooking ? new HttpBookingAdapter() : new MockBookingService();
  const adminService = isLiveBooking ? new HttpAdminAdapter() : new MockAdminService();

  if (!isDemoAuth) {
    const unavailable = new UnavailableServiceAdapter();
    if (isLiveBooking) {
      return {
        auth: unavailable.auth,
        profile: unavailable.profile,
        study: unavailable.study,
        social: unavailable.social,
        connection: unavailable.connection,
        booking: bookingService,
        notification: unavailable.notification,
        moderation: unavailable.moderation,
        admin: adminService,
        conversation: unavailable.conversation,
      };
    }
    return unavailable;
  }

  return {
    auth: new MockAuthService(),
    profile: new MockProfileService(),
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

