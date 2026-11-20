import { describe, expect, it } from 'vitest';
import {
  adoptionApplicationSchema,
  adoptionListingSchema,
  rescueReportSchema,
} from './rescue-adoption';

describe('rescueReportSchema', () => {
  const valid = {
    species: 'DOG',
    title: 'Injured puppy near bus stand',
    description: 'Small brown puppy limping with a wound on the back leg.',
    locationText: 'Negombo main bus stand, near the fruit stalls',
    city: 'Negombo',
    contactPhone: '',
  };

  it('accepts a report and defaults the urgency', () => {
    expect(rescueReportSchema.parse(valid)).toMatchObject({
      urgency: 'MEDIUM',
      contactPhone: undefined,
    });
  });

  it('asks for enough detail to find and help the animal', () => {
    const result = rescueReportSchema.safeParse({
      ...valid,
      description: 'Dog',
      locationText: 'here',
    });
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual([
      'description',
      'locationText',
    ]);
  });
});

describe('adoptionListingSchema', () => {
  const valid = {
    name: 'Coco',
    species: 'DOG',
    ageGroup: 'YOUNG',
    city: 'Colombo',
    description: 'A playful young dog who loves car rides and belly rubs.',
    size: '',
    goodWithChildren: 'yes',
    goodWithPets: '',
  };

  it('turns yes / no / unknown answers into true, false and null', () => {
    expect(adoptionListingSchema.parse(valid)).toMatchObject({
      goodWithChildren: true,
      goodWithPets: null,
      size: undefined,
      isVaccinated: false,
    });
    expect(adoptionListingSchema.parse({ ...valid, goodWithChildren: 'no' }).goodWithChildren).toBe(
      false,
    );
  });

  it('requires an age group and a meaningful description', () => {
    const result = adoptionListingSchema.safeParse({ ...valid, ageGroup: '', description: 'Cute' });
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(['ageGroup', 'description']);
  });
});

describe('adoptionApplicationSchema', () => {
  it('needs a home type, a valid phone number and a proper message', () => {
    const result = adoptionApplicationSchema.safeParse({
      homeType: 'Castle',
      contactPhone: '123',
      message: 'I want her',
    });
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual([
      'homeType',
      'contactPhone',
      'message',
    ]);
  });
});
