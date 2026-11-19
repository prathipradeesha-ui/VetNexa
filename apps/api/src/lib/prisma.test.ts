import { describe, expect, it } from 'vitest';
import { parseDatabaseUrl } from './prisma';

describe('parseDatabaseUrl', () => {
  it('extracts connection details from a mysql:// URL', () => {
    const options = parseDatabaseUrl('mysql://vetnexa:s3cret@localhost:3307/vetnexa');
    expect(options).toMatchObject({
      host: 'localhost',
      port: 3307,
      user: 'vetnexa',
      password: 's3cret',
      database: 'vetnexa',
    });
  });

  it('decodes special characters in the password and defaults the port', () => {
    const options = parseDatabaseUrl('mysql://app:p%40ss%23word@db/vetnexa_test');
    expect(options.password).toBe('p@ss#word');
    expect(options.port).toBe(3306);
    expect(options.database).toBe('vetnexa_test');
  });

  it('rejects non-MySQL URLs', () => {
    expect(() => parseDatabaseUrl('postgres://user:pass@localhost/db')).toThrow(/mysql:\/\//);
  });
});
