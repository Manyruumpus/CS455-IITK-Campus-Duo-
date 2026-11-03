import { describe, it, expect } from 'vitest';
import { getAppServices } from '@/services';
import { MockBookingService } from '@/services/mock/MockBookingService';
import { HttpBookingAdapter } from '@/services/http/HttpBookingAdapter';
import { UnavailableServiceAdapter } from '@/services/unavailable/UnavailableServiceAdapter';
import { ErrorCode } from '@/types';

describe('Service Selection Architecture & Adapter Wiring (VITE_USE_LIVE_BOOKING)', () => {
  it('uses MockBookingService by default in demo/development mode when live booking is disabled', () => {
    const services = getAppServices({
      isDemoAuthEnabled: true,
      isLiveBookingEnabled: false,
    });

    expect(services.booking).toBeInstanceOf(MockBookingService);
    expect(services.booking).not.toBeInstanceOf(HttpBookingAdapter);
  });

  it('uses UnavailableServiceAdapter across all services in default production when live booking is disabled', async () => {
    const services = getAppServices({
      isDemoAuthEnabled: false,
      isLiveBookingEnabled: false,
    });

    expect(services).toBeInstanceOf(UnavailableServiceAdapter);
    await expect(
      services.booking.listTableAvailability('loc-1', '2026-10-20', { actorSession: null })
    ).rejects.toMatchObject({
      code: ErrorCode.SERVICE_UNAVAILABLE,
    });
  });

  it('wires HttpBookingAdapter for booking while preserving mock services for remaining features when live booking is enabled in dev', () => {
    const services = getAppServices({
      isDemoAuthEnabled: true,
      isLiveBookingEnabled: true,
    });

    expect(services.booking).toBeInstanceOf(HttpBookingAdapter);
    expect(services.auth).toBeDefined();
    expect(services.study).toBeDefined();
    expect(services.social).toBeDefined();
    expect(services.connection).toBeDefined();
  });

  it('wires HttpBookingAdapter for booking while keeping remaining services strictly unavailable in production mode', async () => {
    const services = getAppServices({
      isDemoAuthEnabled: false,
      isLiveBookingEnabled: true,
    });

    // Booking service is the concrete live HTTP adapter
    expect(services.booking).toBeInstanceOf(HttpBookingAdapter);

    // Remaining unimplemented services strictly return SERVICE_UNAVAILABLE
    await expect(services.auth.getCurrentSession({ actorSession: null })).rejects.toMatchObject({
      code: ErrorCode.SERVICE_UNAVAILABLE,
    });
    await expect(services.study.listStudyPartners(undefined, { actorSession: null })).rejects.toMatchObject({
      code: ErrorCode.SERVICE_UNAVAILABLE,
    });
    await expect(services.profile.getPrivateProfile({ actorSession: null })).rejects.toMatchObject({
      code: ErrorCode.SERVICE_UNAVAILABLE,
    });
  });

  it('exposes only the read-only assistant operation with live services in production mode', async () => {
    const services = getAppServices({ isDemoAuthEnabled: false, isLiveBookingEnabled: true });
    const actorSession = { userId: 'student-1', email: 's@example.test', name: 'Student', rollNumber: '1', role: 'ROLE_STUDENT' as const, isOnboarded: true, hasStudyConsent: true, hasSocialConsent: false };
    await expect(services.study.submitMatchingQuery('CS455', {}, { actorSession }))
      .rejects.toMatchObject({ code: ErrorCode.UNAUTHENTICATED });
    await expect(services.study.recordStudyAction('peer-id', 'LIKE', { actorSession }))
      .rejects.toMatchObject({ code: ErrorCode.SERVICE_UNAVAILABLE });
  });
});
