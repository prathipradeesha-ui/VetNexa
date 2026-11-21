/**
 * A calendar date (YYYY-MM-DD) a number of days from today, in local time — the same way the app
 * counts days. Building it from toISOString() would use UTC, which in Sri Lanka (UTC+5:30) is
 * still the previous day between midnight and 05:30, and made due-date tests fail at night.
 */
export function localDateFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
