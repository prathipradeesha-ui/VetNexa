/**
 * Small wrapper around fetch for calling the VetNexa API.
 * - Always sends the session cookie (`credentials: 'include'`).
 * - Turns the API's standard error JSON into an ApiError the UI can display.
 */

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: FieldError[],
    /** Extra data some errors carry, e.g. { problems: [...] } for a rejected photo. */
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function api<T>(path: string, options: { method?: Method; body?: unknown } = {}) {
  return request<T>(path, {
    method: options.method ?? 'GET',
    headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

/**
 * Uploads one file as multipart/form-data (the browser sets the boundary header itself).
 * Used for photos; the API validates the file again on the server.
 */
export async function apiUpload<T>(
  path: string,
  field: string,
  file: File,
  method: Method = 'PUT',
) {
  const form = new FormData();
  form.append(field, file);
  return request<T>(path, { method, body: form });
}

/** Sends a prepared multipart form, e.g. a photo together with text fields. */
export async function apiForm<T>(path: string, form: FormData, method: Method = 'POST') {
  return request<T>(path, { method, body: form });
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, credentials: 'include' });
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Cannot reach VetNexa right now. Check your internet connection and try again.',
    );
  }

  if (response.status === 204) return undefined as T;

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (data as { error?: { code?: string; message?: string; details?: unknown } })
      ?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN_ERROR',
      error?.message ?? 'Something went wrong. Please try again.',
      Array.isArray(error?.details) ? (error.details as FieldError[]) : undefined,
      error?.details,
    );
  }

  return data as T;
}
