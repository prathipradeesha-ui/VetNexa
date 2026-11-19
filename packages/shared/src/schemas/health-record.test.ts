import { describe, expect, it } from 'vitest';
import { healthRecordSchema } from './health-record';

const valid = {
  type: 'VACCINATION',
  title: ' Anti-rabies vaccine ',
  description: '',
  recordDate: '2026-05-01',
  nextDueDate: '2027-05-01',
  vetName: 'Dr. Ruwan Senanayake',
  clinicName: '',
};

describe('healthRecordSchema', () => {
  it('accepts a vaccination with a booster date and tidies blank fields', () => {
    const record = healthRecordSchema.parse(valid);
    expect(record).toMatchObject({ title: 'Anti-rabies vaccine', nextDueDate: '2027-05-01' });
    expect(record.description).toBeUndefined();
    expect(record.clinicName).toBeUndefined();
  });

  it('allows records without a next due date', () => {
    const record = healthRecordSchema.parse({ ...valid, type: 'ALLERGY', nextDueDate: '' });
    expect(record.nextDueDate).toBeUndefined();
  });

  it.each([
    ['a future record date', { recordDate: '2999-01-01' }, 'recordDate'],
    ['a missing record date', { recordDate: '' }, 'recordDate'],
    ['a due date before the record date', { nextDueDate: '2026-04-01' }, 'nextDueDate'],
    ['a one-letter title', { title: 'x' }, 'title'],
    ['an unknown type', { type: 'HAIRCUT' }, 'type'],
  ])('rejects %s', (_label, change, field) => {
    const result = healthRecordSchema.safeParse({ ...valid, ...change });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toContain(field);
  });
});
