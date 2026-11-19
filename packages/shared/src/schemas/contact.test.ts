import { describe, expect, it } from 'vitest';
import { contactSchema } from './contact';

const valid = {
  name: 'Kasun Jayawardena',
  email: 'kasun@example.com',
  phone: '',
  topic: 'CLINIC_LISTING',
  message: 'I would like to list our clinic in Kandy on VetNexa.',
};

describe('contactSchema', () => {
  it('accepts a complete message and drops an empty phone', () => {
    const result = contactSchema.parse(valid);
    expect(result.phone).toBeUndefined();
    expect(result.topic).toBe('CLINIC_LISTING');
  });

  it('requires a meaningful message and a known topic', () => {
    const result = contactSchema.safeParse({ ...valid, message: 'Hi', topic: 'SPAM' });
    expect(result.success).toBe(false);
    const fields = result.error?.issues.map((issue) => issue.path[0]);
    expect(fields).toEqual(expect.arrayContaining(['message', 'topic']));
  });
});
