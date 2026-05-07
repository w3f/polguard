/**
 * Error thrown when an HTTP response has a non-ok status.
 * Used by services that call internal APIs via fetch.
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
