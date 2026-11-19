import 'dotenv/config';
import { z } from 'zod';

/**
 * Reads and validates environment variables once at start-up.
 * If something required is missing the API refuses to start with a clear message,
 * instead of failing later in an unexpected place.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4100),
  DATABASE_URL: z.url({ protocol: /^mysql$/, error: 'DATABASE_URL must be a mysql:// URL' }),
  // Comma-separated list of front-end origins allowed to call the API with cookies.
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // Secret used to sign login tokens. Must be long and random; never commit the real value.
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  // How long a login lasts, in hours.
  SESSION_HOURS: z.coerce.number().positive().max(720).default(12),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}

export const env = loadEnv();
export const isProduction = env.NODE_ENV === 'production';
