import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from './auth';

const validRegistration = {
  firstName: 'Nimali',
  lastName: 'Perera',
  email: 'Nimali.Perera@Example.com',
  phone: '0771234567',
  password: 'Secure123',
  confirmPassword: 'Secure123',
};

describe('registerSchema', () => {
  it('accepts a valid registration and normalises the email', () => {
    const result = registerSchema.parse(validRegistration);
    expect(result.email).toBe('nimali.perera@example.com');
    expect(result.role).toBe('OWNER'); // default role
  });

  it('rejects mismatched passwords on the confirmPassword field', () => {
    const result = registerSchema.safeParse({ ...validRegistration, confirmPassword: 'Other123' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['confirmPassword']);
  });

  it.each([
    ['short', 'Ab1'],
    ['no uppercase', 'secure123'],
    ['no number', 'SecurePass'],
  ])('rejects a weak password (%s)', (_label, password) => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      password,
      confirmPassword: password,
    });
    expect(result.success).toBe(false);
  });

  it('does not allow self-registration as an administrator', () => {
    const result = registerSchema.safeParse({ ...validRegistration, role: 'ADMIN' });
    expect(result.success).toBe(false);
  });

  it('requires a licence number for veterinarians and normalises it', () => {
    const missing = registerSchema.safeParse({ ...validRegistration, role: 'VET' });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]?.path).toEqual(['licenseNumber']);

    const vet = registerSchema.parse({
      ...validRegistration,
      role: 'VET',
      licenseNumber: ' slvc-2020-0101 ',
    });
    expect(vet.licenseNumber).toBe('SLVC-2020-0101');
  });

  it('accepts local and international mobile numbers and an empty phone', () => {
    for (const phone of ['0771234567', '+94771234567', '']) {
      expect(registerSchema.safeParse({ ...validRegistration, phone }).success).toBe(true);
    }
    expect(registerSchema.safeParse({ ...validRegistration, phone: '12345' }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('requires a valid email and a password', () => {
    expect(loginSchema.safeParse({ email: 'owner@vetnexa.lk', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'owner@vetnexa.lk', password: '' }).success).toBe(false);
  });
});
