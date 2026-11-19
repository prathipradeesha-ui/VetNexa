import { describe, expect, it } from 'vitest';
import { formatPetAge, petSchema } from './pet';

const valid = {
  name: ' Bruno ',
  species: 'DOG',
  breed: 'Labrador Retriever',
  sex: 'MALE',
  dateOfBirth: '2022-08-15',
  weightKg: '31.456',
  color: '',
  microchipId: '900 164 000 123 456',
  isNeutered: true,
  notes: '',
};

describe('petSchema', () => {
  it('cleans form input into stored values', () => {
    const pet = petSchema.parse(valid);
    expect(pet).toMatchObject({
      name: 'Bruno',
      weightKg: 31.46,
      microchipId: '900164000123456',
      color: undefined,
      notes: undefined,
    });
  });

  it('only requires a name and species', () => {
    const pet = petSchema.parse({ name: 'Luna', species: 'CAT' });
    expect(pet).toMatchObject({ sex: 'UNKNOWN', isNeutered: false });
    expect(pet.dateOfBirth).toBeUndefined();
  });

  it.each([
    ['future birth date', { dateOfBirth: '2999-01-01' }, 'dateOfBirth'],
    ['unrealistic weight', { weightKg: '400' }, 'weightKg'],
    ['non-numeric weight', { weightKg: 'heavy' }, 'weightKg'],
    ['short microchip', { microchipId: '1234' }, 'microchipId'],
    ['unknown species', { species: 'DRAGON' }, 'species'],
  ])('rejects a %s', (_label, change, field) => {
    const result = petSchema.safeParse({ ...valid, ...change });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([field]);
  });
});

describe('formatPetAge', () => {
  const now = new Date('2026-11-19T12:00:00');

  it.each([
    ['2022-08-15', '4 yrs 3 mos'],
    ['2025-11-19', '1 yr'],
    ['2026-04-02', '7 mos'],
    ['2026-10-01', '1 mo'],
    ['2026-11-01', '2 wks'],
    ['2026-11-18', 'Newborn'],
  ])('formats a pet born on %s as "%s"', (birth, expected) => {
    expect(formatPetAge(birth, now)).toBe(expected);
  });

  it('returns null when the date of birth is unknown', () => {
    expect(formatPetAge(null, now)).toBeNull();
  });
});
