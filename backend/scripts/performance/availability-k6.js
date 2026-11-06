import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const correctnessFailures = new Counter('availability_correctness_failures');
const baseUrl = __ENV.BASE_URL || 'http://127.0.0.1:4400';
const actorId = __ENV.ACTOR_ID;
const locationId = __ENV.LOCATION_ID;
const testDate = __ENV.TEST_DATE;
const expectedSlotIds = (__ENV.EXPECTED_SLOT_IDS || '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const expectedTableId = (__ENV.EXPECTED_TABLE_ID || '').toLowerCase();

const profile = __ENV.LOAD_PROFILE || 'smoke';

export const options = {
  discardResponseBodies: false,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  scenarios: {
    availability: {
      executor: 'ramping-vus',
      startVUs: profile === 'baseline' ? 1 : 1,
      stages:
        profile === 'baseline'
          ? [
              { duration: '30s', target: 1 },
              { duration: '60s', target: 5 },
              { duration: '60s', target: 10 },
              { duration: '30s', target: 0 }
            ]
          : [
              { duration: '5s', target: 1 },
              { duration: '10s', target: 1 },
              { duration: '5s', target: 0 }
            ],
      gracefulRampDown: '5s',
      tags: { endpoint: 'availability', query_shape: 'date-location' }
    }
  },
  thresholds: {
    http_req_failed: ['rate==0'],
    availability_correctness_failures: ['count==0'],
    'http_req_duration{endpoint:availability}': ['p(95)<1000']
  }
};

function recordCorrectnessFailure() {
  correctnessFailures.add(1);
}

export default function () {
  if (!actorId || !locationId || !testDate || expectedSlotIds.length === 0) {
    throw new Error(
      'ACTOR_ID, LOCATION_ID, TEST_DATE, and EXPECTED_SLOT_IDS are required'
    );
  }

  const response = http.get(
    `${baseUrl}/api/booking/availability?date=${encodeURIComponent(
      testDate
    )}&locationId=${encodeURIComponent(locationId)}&limit=100`,
    {
      headers: {
        'X-Campus-Duo-Test-Actor': actorId
      },
      tags: {
        endpoint: 'availability',
        query_shape: 'date-location'
      }
    }
  );

  let parsed = null;
  try {
    parsed = JSON.parse(response.body);
  } catch {
    // The checks below record the malformed response as a failed correctness check.
  }

  const responseChecks = check(response, {
    'availability returns HTTP 200': (res) => res.status === 200,
    'availability response has data array': () =>
      Array.isArray(parsed?.data),
    'availability response has requestId': () =>
      typeof parsed?.requestId === 'string' &&
      /^req-[0-9a-f-]{36}$/.test(parsed.requestId),
    'availability has exact fixture slots and values': () => {
      if (!Array.isArray(parsed?.data) || parsed.data.length !== expectedSlotIds.length) return false;
      const actualIds = parsed.data.map((slot) => String(slot.slotId).toLowerCase());
      if (new Set(actualIds).size !== actualIds.length) return false;
      if (actualIds.some((slotId) => !expectedSlotIds.includes(slotId))) return false;
      return parsed.data.every((slot) =>
        String(slot.locationId).toLowerCase() === locationId.toLowerCase() &&
        String(slot.tableId).toLowerCase() === expectedTableId &&
        slot.date === testDate &&
        slot.status === 'AVAILABLE' &&
        slot.capacity === 2 &&
        slot.reservedCount === 0
      );
    }
  });

  if (!responseChecks) {
    recordCorrectnessFailure();
  }
}

export function handleSummary(data) {
  const summaryPath = __ENV.K6_SUMMARY_PATH;
  if (!summaryPath) {
    return {
      stdout: JSON.stringify(data, null, 2)
    };
  }
  return {
    [summaryPath]: JSON.stringify(data, null, 2),
    stdout: JSON.stringify(data, null, 2)
  };
}
