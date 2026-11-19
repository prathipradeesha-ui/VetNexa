import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { HttpError } from '../lib/http-error';

type RequestPart = 'body' | 'query' | 'params';

/**
 * Validates one part of the request against a Zod schema before the controller runs.
 * On success the parsed (trimmed, converted) value is stored in `res.locals[part]`,
 * so controllers always work with clean data. On failure a 422 response lists every
 * invalid field, e.g. { field: "email", message: "Enter a valid email address" }.
 */
export function validate(schema: ZodTypeAny, part: RequestPart = 'body'): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      next(HttpError.validation(details));
      return;
    }
    res.locals[part] = result.data;
    next();
  };
}
