import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/**
 * Reads and validates environment variables once at start-up.
 * If something required is missing the API refuses to start with a clear message,
 * instead of failing later in an unexpected place.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4100),
    DATABASE_URL: z.url({ protocol: /^mysql$/, error: 'DATABASE_URL must be a mysql:// URL' }),
    // Comma-separated list of front-end origins allowed to call the API with cookies.
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    // Secret used to sign login tokens. Must be long and random; never commit the real value.
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    // How long a login lasts, in hours.
    SESSION_HOURS: z.coerce.number().positive().max(720).default(12),
    // Where uploaded photos are kept: "local" (UPLOAD_DIR) or "s3" (MinIO or another S3 store).
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    // Local driver: the folder for uploaded photos. Defaults to apps/api/uploads.
    UPLOAD_DIR: z.string().default(fileURLToPath(new URL('../../uploads', import.meta.url))),
    // S3 driver (MinIO in Docker): endpoint, bucket and credentials.
    S3_ENDPOINT: z.url().optional(),
    S3_REGION: z.string().default('us-east-1'),
    S3_BUCKET: z
      .string()
      .regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, 'S3_BUCKET must be a valid bucket name')
      .default('vetnexa-uploads'),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    // MinIO needs path-style URLs (http://minio:9000/bucket/key).
    S3_FORCE_PATH_STYLE: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    // Internal AI inference service (services/ai). Only the API talks to it, never the browser.
    AI_SERVICE_URL: z.url().default('http://127.0.0.1:8000'),
    // Shared secret sent to the AI service; must match VETNEXA_AI_TOKEN there when it is set.
    AI_SERVICE_TOKEN: z.string().optional(),
    // How long to wait for one assessment before giving up, in milliseconds.
    AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
  })
  .superRefine((value, ctx) => {
    if (value.STORAGE_DRIVER !== 's3') return;
    for (const key of ['S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const) {
      if (!value[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} is required when STORAGE_DRIVER=s3`,
        });
      }
    }
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
