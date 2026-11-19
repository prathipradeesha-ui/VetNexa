import { pino } from 'pino';
import pretty from 'pino-pretty';
import { env, isProduction } from '../config/env';

/**
 * Structured JSON logger. In development the output is pretty-printed for readability;
 * in production it stays as JSON so log tools can search it.
 * Passwords, cookies and auth headers are never written to the logs.
 *
 * pino-pretty is used as an in-process stream rather than a pino "transport": transports run
 * in a worker thread, which re-loads the TypeScript loader (tsx) and fails on Windows.
 */
const options: pino.LoggerOptions = {
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
    ],
    censor: '[redacted]',
  },
};

export const logger = isProduction
  ? pino(options)
  : pino(
      options,
      pretty({ colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname,responseTime' }),
    );
