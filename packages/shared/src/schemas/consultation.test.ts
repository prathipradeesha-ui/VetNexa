import { describe, expect, it } from 'vitest';
import {
  colomboToIso,
  consultationOutcomeSchema,
  consultationRequestSchema,
  formatAppointment,
  isoToColombo,
} from './consultation';

/** A date N days from now as "YYYY-MM-DD" in Sri Lanka. */
const colomboDay = (offset: number) =>
  isoToColombo(new Date(Date.now() + offset * 86_400_000).toISOString()).date;

const valid = {
  petId: 'pet-1',
  vetId: 'vet-1',
  type: 'IN_PERSON',
  date: colomboDay(3),
  time: '16:00',
  reason: 'Annual vaccination booster and check-up.',
};

describe('Sri Lanka time helpers', () => {
  it('converts between Colombo local time and UTC', () => {
    expect(colomboToIso('2026-11-26', '16:00')).toBe('2026-11-26T10:30:00.000Z');
    expect(isoToColombo('2026-11-26T10:30:00.000Z')).toEqual({ date: '2026-11-26', time: '16:00' });
  });

  it('formats appointments in Sri Lanka time', () => {
    expect(formatAppointment('2026-11-26T10:30:00.000Z')).toBe('Thu, 26 Nov 2026, 4:00 pm');
  });
});

describe('consultationRequestSchema', () => {
  it('accepts a valid request', () => {
    expect(consultationRequestSchema.parse(valid)).toMatchObject({
      time: '16:00',
      type: 'IN_PERSON',
    });
  });

  it.each([
    ['a time outside opening hours', { time: '21:00' }, 'time'],
    ['a time not on the half hour', { time: '16:15' }, 'time'],
    ['a date in the past', { date: colomboDay(-1) }, 'date'],
    ['a date too far ahead', { date: colomboDay(90) }, 'date'],
    ['a very short reason', { reason: 'Sick' }, 'reason'],
    ['no vet', { vetId: '' }, 'vetId'],
  ])('rejects %s', (_label, change, field) => {
    const result = consultationRequestSchema.safeParse({ ...valid, ...change });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toContain(field);
  });
});

describe('consultationOutcomeSchema', () => {
  it('requires findings and treatment, and a future follow-up date', () => {
    expect(
      consultationOutcomeSchema.safeParse({
        diagnosis: 'Mild otitis',
        treatment: 'Ear drops 7 days',
      }).success,
    ).toBe(true);
    const result = consultationOutcomeSchema.safeParse({
      diagnosis: '',
      treatment: 'Rest',
      followUpDate: '2020-01-01',
    });
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual([
      'diagnosis',
      'followUpDate',
    ]);
  });
});
