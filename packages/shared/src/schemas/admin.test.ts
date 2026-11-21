import { describe, expect, it } from 'vitest';
import { adminUserQuerySchema, clinicFormSchema } from './admin';

const hours = {
  mon: '08:00-20:00',
  tue: '08:00-20:00',
  wed: '08:00-20:00',
  thu: '08:00-20:00',
  fri: '08:00-20:00',
  sat: '00:00-23:59',
  sun: 'Closed',
};

const valid = {
  name: 'Kandy Lake Pet Clinic',
  addressLine: '12 Dalada Veediya',
  city: 'Kandy',
  district: 'Kandy',
  latitude: '',
  longitude: '80.6413',
  phone: '+94812234567',
  email: '',
  website: '',
  services: ['Vaccination', ' Surgery ', 'Vaccination'],
  openingHours: hours,
};

describe('clinicFormSchema', () => {
  it('cleans optional fields, coordinates and duplicate services', () => {
    const data = clinicFormSchema.parse(valid);
    expect(data).toMatchObject({
      latitude: undefined,
      longitude: 80.6413,
      email: undefined,
      website: undefined,
      services: ['Vaccination', 'Surgery'],
      hasEmergency: false,
    });
  });

  it('rejects bad hours, phone numbers, websites and coordinates outside Sri Lanka', () => {
    const result = clinicFormSchema.safeParse({
      ...valid,
      phone: '12345',
      website: 'ftp://example.lk',
      latitude: '51.5',
      openingHours: { ...hours, mon: '9-5', tue: '18:00-09:00' },
    });
    const fields = result.error?.issues.map((issue) => issue.path.join('.'));
    expect(fields).toEqual(
      expect.arrayContaining([
        'phone',
        'website',
        'latitude',
        'openingHours.mon',
        'openingHours.tue',
      ]),
    );
  });
});

describe('adminUserQuerySchema', () => {
  it('treats empty filters as "any" and defaults to page 1', () => {
    expect(adminUserQuerySchema.parse({ q: ' ', role: '', status: '' })).toEqual({
      q: undefined,
      role: undefined,
      status: undefined,
      page: 1,
    });
  });
});
