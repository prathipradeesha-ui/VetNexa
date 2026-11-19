/**
 * An error that maps directly to an HTTP response.
 * Services throw these (e.g. `throw HttpError.notFound('Pet not found')`) and the central
 * error handler turns them into the standard JSON error shape:
 *
 *   { "error": { "code": "NOT_FOUND", "message": "Pet not found", "details": ... } }
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static badRequest(message = 'Bad request', details?: unknown) {
    return new HttpError(400, 'BAD_REQUEST', message, details);
  }

  static validation(details: unknown, message = 'Some fields are invalid') {
    return new HttpError(422, 'VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Please sign in to continue') {
    return new HttpError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'You do not have permission to do this') {
    return new HttpError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Resource not found') {
    return new HttpError(404, 'NOT_FOUND', message);
  }

  /** `field` lets the front end show the message next to the input that caused it. */
  static conflict(message: string, field?: string) {
    return new HttpError(409, 'CONFLICT', message, field ? [{ field, message }] : undefined);
  }

  static tooManyRequests(message = 'Too many requests, please try again later') {
    return new HttpError(429, 'TOO_MANY_REQUESTS', message);
  }

  static serviceUnavailable(message = 'Service temporarily unavailable') {
    return new HttpError(503, 'SERVICE_UNAVAILABLE', message);
  }
}
