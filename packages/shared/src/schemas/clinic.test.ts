import { describe, expect, it } from 'vitest';
import {
  clinicLocalTime,
  clinicSearchSchema,
  isClinicOpen,
  parseHours,
  reviewSchema,
} from './clinic';

const weekdayHours = {
  mon: '08:30-20:00',
  tue: '08:30-20:00',
  wed: '08:30-20:00',
  thu: '08:30-20:00',
  fri: '08:30-20:00',
  sat: '09:00-13:00',
  sun: 'Closed',
};

// Sri Lanka is UTC+5:30 all year round.
const colombo = (iso: string) => new Date(`${iso}+05:30`);

describe('opening hours', () => {
  it('converts a moment to Sri Lankan local time', () => {
    // 20 Nov 2026 is a Friday. 03:00 UTC is 08:30 in Colombo.
    expect(clinicLocalTime(new Date('2026-11-20T03:00:00Z'))).toEqual({ day: 'fri', minutes: 510 });
  });

  it('parses opening hours and rejects closed days', () => {
    expect(parseHours('08:30-20:00')).toEqual({ opens: 510, closes: 1200 });
    expect(parseHours('00:00-23:59')).toEqual({ opens: 0, closes: 1440 });
    expect(parseHours('Closed')).toBeNull();
    expect(parseHours(undefined)).toBeNull();
  });

  it.each([
    ['2026-11-20T08:29:00', false, 'just before opening on Friday'],
    ['2026-11-20T08:30:00', true, 'at opening time'],
    ['2026-11-20T19:59:00', true, 'a minute before closing'],
    ['2026-11-20T20:00:00', false, 'at closing time'],
    ['2026-11-21T12:00:00', true, 'Saturday morning'],
    ['2026-11-21T14:00:00', false, 'Saturday afternoon'],
    ['2026-11-22T10:00:00', false, 'on Sunday'],
  ])('at %s the clinic is open: %s (%s)', (time, expected) => {
    expect(isClinicOpen(weekdayHours, false, colombo(time))).toBe(expected);
  });

  it('treats 24-hour clinics as always open', () => {
    expect(isClinicOpen({}, true, colombo('2026-11-22T03:00:00'))).toBe(true);
  });
});

describe('reviewSchema', () => {
  it('accepts a rating sent as text from a form', () => {
    expect(
      reviewSchema.parse({ rating: '4', comment: 'Friendly staff and clean rooms.' }),
    ).toMatchObject({
      rating: 4,
    });
  });

  it('rejects missing or out-of-range ratings and very short comments', () => {
    const result = reviewSchema.safeParse({ rating: 6, comment: 'Ok' });
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(['rating', 'comment']);
    expect(reviewSchema.safeParse({ rating: 0, comment: 'Long enough comment' }).success).toBe(
      false,
    );
  });
});

describe('clinicSearchSchema', () => {
  it('reads query string flags and applies the default sort', () => {
    expect(clinicSearchSchema.parse({ emergency: 'true', city: 'Kandy' })).toEqual({
      city: 'Kandy',
      emergency: true,
      openNow: false,
      sort: 'rating',
    });
  });
});
