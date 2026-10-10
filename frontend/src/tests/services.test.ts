import { describe, it, expect, beforeEach } from 'vitest';
import {
  MockProfileService,
} from '@/services/mock/MockAuthProfileServices';
import {
  MockStudyService,
} from '@/services/mock/MockStudySocialServices';
import { MockBookingService } from '@/services/mock/MockBookingService';
import { UnavailableServiceAdapter } from '@/services/unavailable/UnavailableServiceAdapter';
import { mockStore, setDemoClock, resetDemoClock } from '@/mocks/store';
import { scenarioManager } from '@/mocks/scenarios';
import { getCampusLocalDate } from '@/utils/dateTime';
import {
  UserSession,
  AppError,
  ErrorCode,
} from '@/types';

const STUDENT_ALEX_SESSION: UserSession = {
  userId: 'usr-student-alex',
  email: 'alex.rivera@campusduo.test',
  name: 'Alex Rivera',
  rollNumber: '200001',
  role: 'ROLE_STUDENT',
  isOnboarded: true,
  hasStudyConsent: true,
  hasSocialConsent: true,
};

const STUDENT_SAM_SESSION: UserSession = {
  userId: 'usr-student-sam',
  email: 'samira.patel@campusduo.test',
  name: 'Samira Patel',
  rollNumber: '200002',
  role: 'ROLE_STUDENT',
  isOnboarded: true,
  hasStudyConsent: true,
  hasSocialConsent: false,
};

const STUDENT_STRANGER_SESSION: UserSession = {
  userId: 'usr-student-stranger',
  email: 'stranger@campusduo.test',
  name: 'Stranger Student',
  rollNumber: '200999',
  role: 'ROLE_STUDENT',
  isOnboarded: true,
  hasStudyConsent: true,
  hasSocialConsent: true,
};

const ADMIN_SESSION: UserSession = {
  userId: 'usr-admin-senate',
  email: 'senate.mod@campusduo.test',
  name: 'Senate Moderator',
  role: 'ROLE_ADMIN',
  isOnboarded: true,
  hasStudyConsent: false,
  hasSocialConsent: false,
};

describe('Stage 03 Repaired Services & Deterministic Mocks', () => {
  beforeEach(() => {
    mockStore.reset();
    scenarioManager.reset();
    resetDemoClock();
    MockStudyService.resetQueries();
    MockBookingService.setPartnerApprovalPolicy(undefined);
  });

  describe('1. Actor & Permission Boundaries', () => {
    it('resolves actor from ServiceContext and rejects unauthenticated profile read', async () => {
      const profileService = new MockProfileService();
      await expect(
        profileService.getPrivateProfile({ actorSession: null })
      ).rejects.toMatchObject({
        code: ErrorCode.UNAUTHENTICATED,
      });
    });

    it('returns private profile for authorized synthetic student', async () => {
      const profileService = new MockProfileService();
      const profile = await profileService.getPrivateProfile({
        actorSession: STUDENT_ALEX_SESSION,
      });

      expect(profile.userId).toBe('usr-student-alex');
      expect(profile.rollNumber).toBe('200001');
      expect(profile.displayName).toBe('Alex Rivera');
      expect(profile.studyConsent.hasConsent).toBe(true);
      expect(profile.socialConsent.hasConsent).toBe(true);
    });

    it('public profile projection excludes contact details and roll number', async () => {
      const profileService = new MockProfileService();
      const publicProf = await profileService.getPublicStudyProfile('usr-student-sam', {
        actorSession: STUDENT_ALEX_SESSION,
      });

      expect(publicProf.userId).toBe('usr-student-sam');
      expect(publicProf.displayName).toBe('Samira Patel');
      expect((publicProf as unknown as Record<string, unknown>).rollNumber).toBeUndefined();
      expect((publicProf as unknown as Record<string, unknown>).email).toBeUndefined();
      expect((publicProf as unknown as Record<string, unknown>).phone).toBeUndefined();
    });

    it('admin role permits booking detail inspection but denies student private profile access', async () => {
      const bookingService = new MockBookingService();
      const profileService = new MockProfileService();

      const booking = await bookingService.getBooking('bk-existing-99', {
        actorSession: ADMIN_SESSION,
      });
      expect(booking.bookingId).toBe('bk-existing-99');

      await expect(
        profileService.getPrivateProfile({
          actorSession: ADMIN_SESSION,
        })
      ).rejects.toMatchObject({
        code: ErrorCode.FORBIDDEN,
      });
    });

    it('unrelated student reading booking detail throws FORBIDDEN', async () => {
      const bookingService = new MockBookingService();
      await expect(
        bookingService.getBooking('bk-existing-99', {
          actorSession: STUDENT_ALEX_SESSION,
        })
      ).rejects.toMatchObject({
        code: ErrorCode.FORBIDDEN,
      });
    });
  });

  describe('2. Multi-Participant Shared Bookings & Actor Mutation Policy', () => {
    it('prevents self-booking with oneself as companion', async () => {
      const bookingService = new MockBookingService();
      await expect(
        bookingService.createBooking(
          {
            tableId: 'tbl-pk-2f-10',
            locationId: 'loc-pk-kelkar-2f',
            localDate: '2026-10-08',
            slotId: 'slot-pk-10-14',
            companionStudentId: STUDENT_ALEX_SESSION.userId, // Self booking!
          },
          { actorSession: STUDENT_ALEX_SESSION }
        )
      ).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_ERROR,
        message: expect.stringContaining('Self-booking is prohibited'),
      });
    });

    it('creates shared booking with explicit creator and companion participant records', async () => {
      const bookingService = new MockBookingService();
      const booking = await bookingService.createBooking(
        {
          tableId: 'tbl-pk-2f-10',
          locationId: 'loc-pk-kelkar-2f',
          localDate: '2026-10-08',
          slotId: 'slot-pk-10-14',
          companionStudentId: 'usr-student-sam',
          clientOperationId: 'op-initial-create',
        },
        { actorSession: STUDENT_ALEX_SESSION }
      );

      expect(booking.participants.length).toBe(2);
      expect(booking.participants[0]).toEqual({
        userId: 'usr-student-alex',
        role: 'CREATOR',
        displayName: 'Alex Rivera',
      });
      expect(booking.participants[1]).toEqual({
        userId: 'usr-student-sam',
        role: 'COMPANION',
        displayName: 'Samira Patel',
      });
      expect(booking.allowedActions).toContain('CANCEL');
      expect(booking.allowedActions).toContain('RESCHEDULE');
    });

    it('allows companion to read booking detail and view it in booking history with empty mutation actions', async () => {
      const bookingService = new MockBookingService();
      const created = await bookingService.createBooking(
        {
          tableId: 'tbl-pk-2f-10',
          locationId: 'loc-pk-kelkar-2f',
          localDate: '2026-10-08',
          slotId: 'slot-pk-10-14',
          companionStudentId: 'usr-student-sam',
          clientOperationId: 'op-shared-test',
        },
        { actorSession: STUDENT_ALEX_SESSION }
      );

      // Companion can read detail
      const companionDetail = await bookingService.getBooking(created.bookingId, {
        actorSession: STUDENT_SAM_SESSION,
      });
      expect(companionDetail.bookingId).toBe(created.bookingId);
      // Under demo policy: Companion cannot mutate
      expect(companionDetail.allowedActions).toEqual([]);

      // Companion sees it in history
      const companionHistory = await bookingService.getMyBookings({
        actorSession: STUDENT_SAM_SESSION,
      });
      const inHistory = companionHistory.find((b) => b.bookingId === created.bookingId);
      expect(inHistory).toBeDefined();
      expect(inHistory?.allowedActions).toEqual([]);
    });

    it('denies companion mutation attempts with FORBIDDEN under demo policy', async () => {
      const bookingService = new MockBookingService();
      const created = await bookingService.createBooking(
        {
          tableId: 'tbl-pk-2f-10',
          locationId: 'loc-pk-kelkar-2f',
          localDate: '2026-10-08',
          slotId: 'slot-pk-10-14',
          companionStudentId: 'usr-student-sam',
        },
        { actorSession: STUDENT_ALEX_SESSION }
      );

      // Companion cancel denied
      await expect(
        bookingService.cancelBooking(created.bookingId, {
          actorSession: STUDENT_SAM_SESSION,
        })
      ).rejects.toMatchObject({
        code: ErrorCode.FORBIDDEN,
        message: expect.stringContaining('only the booking creator or administrator'),
      });

      // Companion reschedule denied
      await expect(
        bookingService.rescheduleBooking(
          {
            bookingId: created.bookingId,
            newLocalDate: '2026-10-08',
            newSlotId: 'slot-pk-10-16',
          },
          { actorSession: STUDENT_SAM_SESSION }
        )
      ).rejects.toMatchObject({
        code: ErrorCode.FORBIDDEN,
        message: expect.stringContaining('only the booking creator or administrator'),
      });
    });
  });

  describe('3. Operation Reconciliation & Approval Simulation', () => {
    it('reconciles committed uncertain request to exact booking using stable clientOperationId', async () => {
      const bookingService = new MockBookingService();
      const stableOpId = 'op-stable-12345';

      scenarioManager.setScenario({ forceUncertainMutation: true });

      let caughtErr: AppError | null = null;
      try {
        await bookingService.createBooking(
          {
            tableId: 'tbl-pk-2f-10',
            locationId: 'loc-pk-kelkar-2f',
            localDate: '2026-10-08',
            slotId: 'slot-pk-10-14',
            clientOperationId: stableOpId,
          },
          { actorSession: STUDENT_ALEX_SESSION }
        );
      } catch (e) {
        caughtErr = e as AppError;
      }

      expect(caughtErr?.code).toBe(ErrorCode.UNCERTAIN_MUTATION);

      // Turn off scenario and reconcile by clientOperationId
      scenarioManager.setScenario({ forceUncertainMutation: false });
      const reconciled = await bookingService.reconcileBooking(stableOpId, {
        actorSession: STUDENT_ALEX_SESSION,
      });

      expect(reconciled).not.toBeNull();
      expect(reconciled?.clientOperationId).toBe(stableOpId);
      expect(reconciled?.slotId).toBe('slot-pk-10-14');
      expect(reconciled?.status).toBe('CONFIRMED');
    });

    it('does NOT mistake a prior booking on the same resource for a new attempt', async () => {
      const bookingService = new MockBookingService();

      // Prior booking on slot-pk-10-14 with operation op-prior
      await bookingService.createBooking(
        {
          tableId: 'tbl-pk-2f-10',
          locationId: 'loc-pk-kelkar-2f',
          localDate: '2026-10-08',
          slotId: 'slot-pk-10-14',
          clientOperationId: 'op-prior',
        },
        { actorSession: STUDENT_ALEX_SESSION }
      );

      // Cancel it to free the slot
      const myBookings = await bookingService.getMyBookings({ actorSession: STUDENT_ALEX_SESSION });
      const priorBooking = myBookings.find((b) => b.clientOperationId === 'op-prior');
      await bookingService.cancelBooking(priorBooking!.bookingId, {
        actorSession: STUDENT_ALEX_SESSION,
      });

      // Now query reconciliation for a different, new operation attempt op-new-uncommitted
      const result = await bookingService.reconcileBooking('op-new-uncommitted', {
        actorSession: STUDENT_ALEX_SESSION,
      });

      // Honest unresolved state: returns null, NOT the prior booking on the same table/date/slot
      expect(result).toBeNull();
    });

    it('simulates AUTO_APPROVED_DEMO policy and rejects REQUIRES_EXPLICIT_APPROVAL with UNSUPPORTED_ACTION', async () => {
      const bookingService = new MockBookingService();

      // 1. AUTO_APPROVED_DEMO path
      MockBookingService.setPartnerApprovalPolicy('AUTO_APPROVED_DEMO');
      const autoApproved = await bookingService.createBooking(
        {
          tableId: 'tbl-pk-2f-10',
          locationId: 'loc-pk-kelkar-2f',
          localDate: '2026-10-08',
          slotId: 'slot-pk-10-14',
          companionStudentId: 'usr-student-sam',
        },
        { actorSession: STUDENT_ALEX_SESSION }
      );
      expect(autoApproved.status).toBe('CONFIRMED');
      expect(autoApproved.partnerApprovalStatus).toBe('AUTO_ACCEPTED');

      // Cancel to free slot
      await bookingService.cancelBooking(autoApproved.bookingId, { actorSession: STUDENT_ALEX_SESSION });

      // 2. REQUIRES_EXPLICIT_APPROVAL path -> unsupported before writing or holding slot
      MockBookingService.setPartnerApprovalPolicy('REQUIRES_EXPLICIT_APPROVAL');
      await expect(
        bookingService.createBooking(
          {
            tableId: 'tbl-pk-2f-10',
            locationId: 'loc-pk-kelkar-2f',
            localDate: '2026-10-08',
            slotId: 'slot-pk-10-14',
            companionStudentId: 'usr-student-sam',
          },
          { actorSession: STUDENT_ALEX_SESSION }
        )
      ).rejects.toMatchObject({
        code: ErrorCode.UNSUPPORTED_ACTION,
        message: expect.stringContaining('pending team/user approval'),
      });

      // Verify slot was NOT held or modified: remains AVAILABLE
      const slots = await bookingService.listTableAvailability('loc-pk-kelkar-2f', '2026-10-08', {
        actorSession: STUDENT_ALEX_SESSION,
      });
      const targetSlot = slots.find((s) => s.slotId === 'slot-pk-10-14');
      expect(targetSlot?.status).toBe('AVAILABLE');
    });
  });

  describe('4. Participant Cache Consistency & Observable Reads', () => {
    it('rescheduling refreshes both old and new slot availability on observable reads', async () => {
      const bookingService = new MockBookingService();

      // Create booking in slot-pk-10-14
      const created = await bookingService.createBooking(
        {
          tableId: 'tbl-pk-2f-10',
          locationId: 'loc-pk-kelkar-2f',
          localDate: '2026-10-08',
          slotId: 'slot-pk-10-14',
        },
        { actorSession: STUDENT_ALEX_SESSION }
      );

      // Verify slot-pk-10-14 is OCCUPIED, slot-pk-10-18 is AVAILABLE
      let slots = await bookingService.listTableAvailability('loc-pk-kelkar-2f', '2026-10-08', {
        actorSession: STUDENT_ALEX_SESSION,
      });
      expect(slots.find((s) => s.slotId === 'slot-pk-10-14')?.status).toBe('OCCUPIED');
      expect(slots.find((s) => s.slotId === 'slot-pk-10-18')?.status).toBe('AVAILABLE');

      // Reschedule to slot-pk-10-18
      await bookingService.rescheduleBooking(
        {
          bookingId: created.bookingId,
          newLocalDate: '2026-10-08',
          newSlotId: 'slot-pk-10-18',
        },
        { actorSession: STUDENT_ALEX_SESSION }
      );

      // Verify BOTH old and new slot availability refreshed correctly
      slots = await bookingService.listTableAvailability('loc-pk-kelkar-2f', '2026-10-08', {
        actorSession: STUDENT_ALEX_SESSION,
      });
      expect(slots.find((s) => s.slotId === 'slot-pk-10-14')?.status).toBe('AVAILABLE');
      expect(slots.find((s) => s.slotId === 'slot-pk-10-18')?.status).toBe('OCCUPIED');
    });

    it('creation and cancellation update availability, booking detail, creator history, and companion history on observable reads', async () => {
      const bookingService = new MockBookingService();

      // 1. Initial Availability Check
      let slots = await bookingService.listTableAvailability('loc-pk-kelkar-2f', '2026-10-08', {
        actorSession: STUDENT_ALEX_SESSION,
      });
      expect(slots.find((s) => s.slotId === 'slot-pk-10-14')?.status).toBe('AVAILABLE');

      // 2. Create Shared Booking (Alex + Sam)
      const created = await bookingService.createBooking(
        {
          tableId: 'tbl-pk-2f-10',
          locationId: 'loc-pk-kelkar-2f',
          localDate: '2026-10-08',
          slotId: 'slot-pk-10-14',
          companionStudentId: 'usr-student-sam',
        },
        { actorSession: STUDENT_ALEX_SESSION }
      );

      // Observable Read: Availability updated
      slots = await bookingService.listTableAvailability('loc-pk-kelkar-2f', '2026-10-08', {
        actorSession: STUDENT_ALEX_SESSION,
      });
      expect(slots.find((s) => s.slotId === 'slot-pk-10-14')?.status).toBe('OCCUPIED');

      // Observable Read: Booking Detail
      const detailAfterCreate = await bookingService.getBooking(created.bookingId, {
        actorSession: STUDENT_ALEX_SESSION,
      });
      expect(detailAfterCreate.status).toBe('CONFIRMED');

      // Observable Read: Creator History
      const creatorHistory = await bookingService.getMyBookings({
        actorSession: STUDENT_ALEX_SESSION,
      });
      const inCreatorHistory = creatorHistory.find((b) => b.bookingId === created.bookingId);
      expect(inCreatorHistory).toBeDefined();
      expect(inCreatorHistory?.status).toBe('CONFIRMED');

      // Observable Read: Companion History
      const companionHistory = await bookingService.getMyBookings({
        actorSession: STUDENT_SAM_SESSION,
      });
      const inCompanionHistory = companionHistory.find((b) => b.bookingId === created.bookingId);
      expect(inCompanionHistory).toBeDefined();
      expect(inCompanionHistory?.status).toBe('CONFIRMED');

      // 3. Cancel Booking
      await bookingService.cancelBooking(created.bookingId, {
        actorSession: STUDENT_ALEX_SESSION,
      });

      // Observable Read: Availability freed
      slots = await bookingService.listTableAvailability('loc-pk-kelkar-2f', '2026-10-08', {
        actorSession: STUDENT_ALEX_SESSION,
      });
      expect(slots.find((s) => s.slotId === 'slot-pk-10-14')?.status).toBe('AVAILABLE');

      // Observable Read: Detail updated
      const detailAfterCancel = await bookingService.getBooking(created.bookingId, {
        actorSession: STUDENT_ALEX_SESSION,
      });
      expect(detailAfterCancel.status).toBe('CANCELLED');

      // Observable Read: Creator History updated
      const creatorHistoryAfter = await bookingService.getMyBookings({
        actorSession: STUDENT_ALEX_SESSION,
      });
      expect(creatorHistoryAfter.find((b) => b.bookingId === created.bookingId)?.status).toBe('CANCELLED');

      // Observable Read: Companion History updated
      const companionHistoryAfter = await bookingService.getMyBookings({
        actorSession: STUDENT_SAM_SESSION,
      });
      expect(companionHistoryAfter.find((b) => b.bookingId === created.bookingId)?.status).toBe('CANCELLED');
    });
  });

  describe('5. Campus Timezone & Clock Near Date Boundary', () => {
    it('computes campus localDate accurately across UTC date boundaries (Asia/Kolkata UTC+05:30)', () => {
      // 2026-10-08 19:00:00 UTC -> 2026-10-09 00:30:00 IST (Next day in campus timezone!)
      const lateUtc = new Date('2026-10-08T19:00:00.000Z');
      setDemoClock(lateUtc);

      const campusDate = getCampusLocalDate();
      expect(campusDate).toBe('2026-10-09');

      // Blind UTC slicing would yield '2026-10-08', which is incorrect for IIT Kanpur.
      expect(lateUtc.toISOString().slice(0, 10)).toBe('2026-10-08');
    });

    it('computes campus localDate correctly for early morning UTC', () => {
      // 2026-10-08 02:00:00 UTC -> 2026-10-08 07:30:00 IST (Same day)
      const morningUtc = new Date('2026-10-08T02:00:00.000Z');
      setDemoClock(morningUtc);

      expect(getCampusLocalDate()).toBe('2026-10-08');
    });
  });

  describe('6. Agent Matching Coverage & Submitting Actor Ownership', () => {
    it('submits matching query and retrieves status with grounded results', async () => {
      const studyService = new MockStudyService();
      const matchResult = await studyService.submitMatchingQuery(
        'CS455',
        { studyStyle: 'QUIET_FOCUSED' },
        { actorSession: STUDENT_ALEX_SESSION }
      );

      expect(matchResult.queryId).toBeDefined();
      expect(matchResult.status).toBe('COMPLETED');
      expect(Array.isArray(matchResult.results)).toBe(true);
      expect((matchResult.results ?? []).length).toBeGreaterThan(0);

      // Status retrieval by submitting student succeeds
      const retrieved = await studyService.getMatchingStatus(matchResult.queryId, {
        actorSession: STUDENT_ALEX_SESSION,
      });
      expect(retrieved.queryId).toBe(matchResult.queryId);
      expect(retrieved.status).toBe('COMPLETED');
    });

    it('denies unrelated students from retrieving private agent query results', async () => {
      const studyService = new MockStudyService();
      const matchResult = await studyService.submitMatchingQuery(
        'CS455',
        {},
        { actorSession: STUDENT_ALEX_SESSION }
      );

      // Unrelated student attempting to inspect Alex's private query
      await expect(
        studyService.getMatchingStatus(matchResult.queryId, {
          actorSession: STUDENT_STRANGER_SESSION,
        })
      ).rejects.toMatchObject({
        code: ErrorCode.FORBIDDEN,
        message: expect.stringContaining('belong exclusively to the submitting student'),
      });
    });

    it('returns grounded fallback results when agent service is simulated unavailable', async () => {
      const studyService = new MockStudyService();
      scenarioManager.setScenario({ forceAgentFallback: true });

      const fallbackResult = await studyService.submitMatchingQuery(
        'CS455',
        {},
        { actorSession: STUDENT_ALEX_SESSION }
      );

      expect(fallbackResult.status).toBe('FALLBACK');
      expect(fallbackResult.fallbackReason).toBeDefined();
      expect(Array.isArray(fallbackResult.results)).toBe(true);
      expect((fallbackResult.results ?? []).length).toBeGreaterThan(0);
    });
  });

  describe('7. Production Unavailable Adapter Isolation', () => {
    it('strictly throws SERVICE_UNAVAILABLE across all production operations', async () => {
      const unavailable = new UnavailableServiceAdapter();

      await expect(
        unavailable.auth.getCurrentSession({ actorSession: null })
      ).rejects.toMatchObject({
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });

      await expect(
        unavailable.booking.listTableAvailability('loc-pk-kelkar-2f', '2026-10-08', {
          actorSession: null,
        })
      ).rejects.toMatchObject({
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });

      await expect(
        unavailable.study.listStudyPartners(undefined, { actorSession: null })
      ).rejects.toMatchObject({
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });
    });
  });
});
