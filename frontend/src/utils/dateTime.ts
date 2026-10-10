/**
 * Campus Duo — Campus Timezone & Date Calculations
 *
 * All local table reservations and schedules operate in the official
 * campus timezone: Asia/Kolkata (Indian Standard Time, UTC+05:30).
 *
 * Local dates MUST NOT be derived by naively slicing UTC timestamps
 * (e.g., date.toISOString().slice(0, 10)) because UTC midnight lags
 * Indian Standard Time by 5 hours and 30 minutes, producing off-by-one
 * date errors between 00:00:00 IST and 05:29:59 IST.
 */

export const CAMPUS_TIMEZONE = 'Asia/Kolkata';

let demoClockOverride: Date | null = null;

/** Injects a simulated demo clock time for testing date boundaries */
export function setDemoClock(date: Date): void {
  demoClockOverride = date;
}

/** Resets the injected demo clock back to live system time */
export function resetDemoClock(): void {
  demoClockOverride = null;
}

/** Returns the active demo clock or live system time */
export function getDemoClock(): Date {
  return demoClockOverride ?? new Date();
}

/**
 * Returns the calendar date for the campus in ISO YYYY-MM-DD format.
 */
export function getCampusLocalDate(date: Date = getDemoClock()): string {
  // en-CA outputs standard ISO YYYY-MM-DD format
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CAMPUS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Returns formatted 24-hour campus time (HH:MM).
 */
export function formatCampusTime(date: Date = getDemoClock()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: CAMPUS_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
