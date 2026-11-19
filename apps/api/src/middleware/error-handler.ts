import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '../generated/prisma/client';
import { HttpError } from '../lib/http-error';
import { logger } from '../lib/logger';

/** Any request that reaches this point did not match a route. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(HttpError.notFound(`Route ${req.method} ${req.path} does not exist`));
};

/** Converts known error types into HttpErrors with friendly messages. */
function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;

  // Body parser: malformed JSON or a payload that is too large.
  if (typeof error === 'object' && error !== null && 'type' in error) {
    if (error.type === 'entity.parse.failed')
      return HttpError.badRequest('Request body is not valid JSON');
    if (error.type === 'entity.too.large')
      return new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  }

  // Prisma: unique constraint and missing-record errors.
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002')
      return HttpError.conflict('A record with these details already exists');
    if (error.code === 'P2025') return HttpError.notFound('The requested record no longer exists');
  }

  return new HttpError(
    500,
    'INTERNAL_ERROR',
    'Something went wrong on our side. Please try again.',
  );
}

/**
 * Central error handler: every error ends up here and leaves in the same JSON shape.
 * Unexpected (500) errors are logged with full details but the client only sees a
 * generic message, so internal information is never leaked.
 */
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const httpError = toHttpError(error);

  if (httpError.status >= 500) {
    logger.error({ err: error, method: req.method, path: req.path }, 'Unhandled error');
  }

  res.status(httpError.status).json({
    error: {
      code: httpError.code,
      message: httpError.message,
      ...(httpError.details !== undefined && { details: httpError.details }),
    },
  });
};
