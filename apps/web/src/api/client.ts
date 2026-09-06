import { isApiErrorBody, type ErrorCode, type FieldIssue } from '@3dsfera/shared';

/**
 * The client's view of a failed request. It carries the server's error code
 * rather than a sentence, so the UI renders it in the user's language.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | 'ERR_NETWORK';
  readonly params: Record<string, string | number> | undefined;
  readonly issues: FieldIssue[] | undefined;

  constructor(options: {
    status: number;
    code: ErrorCode | 'ERR_NETWORK';
    message: string;
    params?: Record<string, string | number>;
    issues?: FieldIssue[];
  }) {
    super(options.message);
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.params = options.params;
    this.issues = options.issues;
  }

  /** Field path -> issue code, ready to be shown next to an input. */
  fieldErrors(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const issue of this.issues ?? []) {
      if (issue.path && !result[issue.path]) result[issue.path] = issue.code;
    }
    return result;
  }
}

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      // Session cookies are httpOnly; the browser must be told to send them.
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch (cause) {
    // fetch only rejects when the request never reached the server: offline,
    // DNS failure, CORS preflight refused. Anything the server answered — even
    // a 500 — resolves and is handled below.
    throw new ApiError({
      status: 0,
      code: 'ERR_NETWORK',
      message: cause instanceof Error ? cause.message : 'Network request failed',
    });
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload: unknown = text.length > 0 ? JSON.parse(text) : null;

  if (!response.ok) {
    if (isApiErrorBody(payload)) {
      throw new ApiError({
        status: response.status,
        code: payload.error.code,
        message: payload.error.message,
        ...(payload.error.params ? { params: payload.error.params } : {}),
        ...(payload.error.issues ? { issues: payload.error.issues } : {}),
      });
    }
    throw new ApiError({
      status: response.status,
      code: 'ERR_INTERNAL',
      message: `Unexpected response ${response.status}`,
    });
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, {
      method: 'POST',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  patch: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, {
      method: 'PATCH',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  delete: <T>(path: string): Promise<T> => request<T>(path, { method: 'DELETE' }),
};
