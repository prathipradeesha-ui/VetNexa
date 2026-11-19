import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from './api';

/**
 * Shows field errors returned by the API (422 validation or 409 conflicts) next to the
 * matching inputs, so a message like "Email already exists" appears where the user can fix
 * it, and moves keyboard focus to the first one. Returns true when any were applied.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): boolean {
  if (!(error instanceof ApiError) || !error.details?.length) return false;
  error.details.forEach((detail, index) => {
    setError(
      detail.field as Path<T>,
      { type: 'server', message: detail.message },
      { shouldFocus: index === 0 },
    );
  });
  return true;
}

/** True when the error carries field details, so it is already shown beside the inputs. */
export function hasFieldErrors(error: unknown): boolean {
  return error instanceof ApiError && Boolean(error.details?.length);
}
