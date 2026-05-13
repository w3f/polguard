/**
 * Error thrown when an HTTP response has a non-ok status.
 * Used by services that call internal APIs via fetch (client-side),
 * and as a base class for route-level errors (server-side).
 */
export class HttpError extends Error {
  constructor(public readonly status: number, message?: string) {
    super(message ?? `HTTP ${status}`);
  }
}

/**
 * Wrapper around fetch that throws HttpError on non-ok responses.
 */
export async function fetchOrThrow(url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new HttpError(response.status);
  }
  return response;
}

// --- Server-side HTTP error subclasses (for route handlers / service layer) ---

export class NotFoundError extends HttpError {
  constructor(message = 'Not Found') { super(404, message); }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden') { super(403, message); }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflict') { super(409, message); }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad Request') { super(400, message); }
}
