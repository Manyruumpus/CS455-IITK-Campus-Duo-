import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingRepository } from '../src/repository/bookingRepo';
import { getClient } from '../src/config/db';
import { BookingService } from '../src/services/bookingService';
import { DomainError } from '../src/types';

vi.mock('../src/config/db', () => ({
  getClient: vi.fn()
}));

const ACTOR = {
  userId: '00000000-0000-0000-0000-00000000D501',
  role: 'ROLE_STUDENT',
  displayName: 'Dev Student Alex'
};

const VALID_REQUEST = {
  clientOperationId: 'service-test-operation',
  tableId: '00000000-0000-0000-0000-00000000D572',
  locationId: '00000000-0000-0000-0000-00000000D571',
  localDate: '2026-12-01',
  slotId: '00000000-0000-0000-0000-00000000E001',
  companionStudentId: '00000000-0000-0000-0000-00000000D502'
};

const companion = {
  user_id: VALID_REQUEST.companionStudentId,
  role: 'ROLE_STUDENT',
  display_name: 'Dev Student Sam',
  account_status: 'ACTIVE',
  verification_status: 'VERIFIED'
};

const connection = {
  connection_id: '00000000-0000-0000-0000-00000000D581',
  status: 'MUTUAL_CONNECTED'
};

const slotResource = {
  slot_id: VALID_REQUEST.slotId,
  table_id: VALID_REQUEST.tableId,
  location_id: VALID_REQUEST.locationId,
  local_date: VALID_REQUEST.localDate,
  start_time: '09:00:00',
  end_time: '11:00:00',
  status: 'AVAILABLE',
  active: true,
  table_number: 'T-01',
  capacity: 2,
  table_active: true,
  location_name: 'Service Test Location',
  location_active: true
};

function createRepository(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    getAvailability: vi.fn().mockResolvedValue([]),
    findIdempotencyRecord: vi.fn().mockResolvedValue(null),
    findUserAccount: vi.fn().mockResolvedValue(companion),
    findActiveMutualStudyConnection: vi.fn().mockResolvedValue(connection),
    getStudyConsentUserIds: vi.fn().mockResolvedValue([ACTOR.userId, VALID_REQUEST.companionStudentId]),
    hasActiveBlock: vi.fn().mockResolvedValue(false),
    findSlotResource: vi.fn().mockResolvedValue(slotResource),
    insertBooking: vi.fn(),
    insertParticipants: vi.fn().mockResolvedValue(undefined),
    insertAuditEvent: vi.fn().mockResolvedValue(undefined),
    insertOutboxEvent: vi.fn().mockResolvedValue(undefined),
    insertIdempotencyRecord: vi.fn().mockResolvedValue(undefined),
    ...overrides
  } as unknown as BookingRepository;
}

function createClient() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn()
  };
}

describe('BookingService unit validation and insert-error boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an invalid endDate before querying availability', async () => {
    const repo = createRepository();
    const service = new BookingService(repo);

    await expect(
      service.getAvailability('2026-12-01', 'not-a-date', null)
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'Invalid or missing endDate (expected YYYY-MM-DD)'
    });

    expect(repo.getAvailability).not.toHaveBeenCalled();
  });

  it.each([
    ['tableId', 'not-a-uuid', 'tableId must be a valid UUID'],
    ['locationId', 'not-a-uuid', 'locationId must be a valid UUID'],
    ['slotId', 'not-a-uuid', 'slotId must be a valid UUID'],
    ['companionStudentId', 'not-a-uuid', 'companionStudentId must be a valid UUID'],
    ['localDate', 'not-a-date', 'localDate must be a valid date formatted YYYY-MM-DD']
  ])('rejects malformed %s before opening a transaction', async (field, value, message) => {
    const repo = createRepository();
    const service = new BookingService(repo);
    const client = createClient();
    vi.mocked(getClient).mockResolvedValue(client as never);

    const request = { ...VALID_REQUEST, [field]: value };

    await expect(service.createBooking(ACTOR, request, 'request-id')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message
    });

    expect(getClient).not.toHaveBeenCalled();
    expect(client.query).not.toHaveBeenCalled();
    expect(repo.insertBooking).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'unrelated unique constraint',
      error: Object.assign(new Error('synthetic unrelated unique violation'), {
        code: '23505',
        constraint: 'unrelated_constraint'
      })
    },
    {
      label: 'unexpected SQLSTATE',
      error: Object.assign(new Error('synthetic serialization failure'), {
        code: '40001'
      })
    }
  ])('propagates the identical $label from booking insert', async ({ error }) => {
    const client = createClient();
    const repo = createRepository({
      insertBooking: vi.fn().mockRejectedValue(error)
    });
    const service = new BookingService(repo);
    vi.mocked(getClient).mockResolvedValue(client as never);

    await expect(
      service.createBooking(ACTOR, VALID_REQUEST, 'request-id')
    ).rejects.toBe(error);

    expect(repo.insertBooking).toHaveBeenCalledOnce();
    expect(client.query).toHaveBeenCalledWith('BEGIN;');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK;');
    expect(client.release).toHaveBeenCalledOnce();
  });
});
