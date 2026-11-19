import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Turns a mysql:// connection string into the options object the MariaDB driver expects.
 * The same driver works with MySQL 8.
 */
export function parseDatabaseUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  if (url.protocol !== 'mysql:') {
    throw new Error('DATABASE_URL must start with mysql://');
  }
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    connectionLimit: 10,
    // MySQL 8 uses caching_sha2_password; without TLS the driver must fetch the server's public key.
    allowPublicKeyRetrieval: true,
  };
}

export function createPrismaClient(databaseUrl = process.env['DATABASE_URL']): PrismaClient {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set. Copy apps/api/.env.example to apps/api/.env.');
  }
  const adapter = new PrismaMariaDb(parseDatabaseUrl(databaseUrl));
  return new PrismaClient({ adapter });
}
