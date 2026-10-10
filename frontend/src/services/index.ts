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

export * from './interfaces';

/**
 * Creates or retrieves the singleton service bundle based on environment configuration.
 *
 * ARCHITECTURAL ISOLATION RULE:
 * - When isDemoAuthEnabled is active (dev or demo showcase), uses stateful in-memory mock adapters.
 * - When in default production, strictly returns UnavailableServiceAdapter.
 *   Never silently falls back to mock authentication or synthetic demo data in production.
 */
export function getAppServices(): AppServices {
  if (!appConfig.isDemoAuthEnabled) {
    return new UnavailableServiceAdapter();
  }

  return {
    auth: new MockAuthService(),
    profile: new MockProfileService(),
    study: new MockStudyService(),
    social: new MockSocialService(),
    connection: new MockConnectionService(),
    booking: new MockBookingService(),
    notification: new MockNotificationService(),
    moderation: new MockModerationService(),
    admin: new MockAdminService(),
    conversation: new MockConversationService(),
  };
}

export const appServices = getAppServices();
