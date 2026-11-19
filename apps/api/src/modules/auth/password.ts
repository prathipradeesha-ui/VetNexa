import bcrypt from 'bcryptjs';

/** bcrypt cost factor: 2^12 rounds, roughly 200–300 ms per hash on a typical server. */
const BCRYPT_ROUNDS = 12;

/**
 * A pre-computed hash of a random string. When someone logs in with an email that does not
 * exist we still run bcrypt against this hash, so the response takes the same time either way.
 * Without this, an attacker could discover which emails are registered by timing responses.
 */
const DUMMY_HASH = '$2b$12$999XJtXcqbXphhPQtUcBIepJUiQokVvzB4s4Sj4e21D7G.PID7uO6';

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Compares a password with a stored hash. Pass `null` when the user was not found. */
export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  const matches = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return hash !== null && matches;
}
