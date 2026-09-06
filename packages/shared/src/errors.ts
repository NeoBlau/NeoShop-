/**
 * Error contract between API and clients.
 *
 * The API never returns a user-facing sentence: it returns a stable code plus
 * optional parameters, and the client renders it through its own dictionary.
 * That is what keeps the interface language and the transactional-email
 * language from drifting apart. `message` is a developer-facing English string
 * for logs and for curl; it is never displayed to end users.
 */

export const ERROR_CODES = [
  'ERR_VALIDATION',
  'ERR_UNAUTHORIZED',
  'ERR_SESSION_EXPIRED',
  'ERR_FORBIDDEN',
  'ERR_NOT_FOUND',
  'ERR_CONFLICT',
  'ERR_EMAIL_TAKEN',
  'ERR_INVALID_CREDENTIALS',
  'ERR_SUPPLIER_PROFILE_REQUIRED',
  'ERR_SUPPLIER_NOT_APPROVED',
  'ERR_ACCOUNT_BLOCKED',
  'ERR_ORIGIN_NOT_ALLOWED',
  'ERR_RATE_LIMITED',
  'ERR_PAYLOAD_TOO_LARGE',
  'ERR_UNSUPPORTED_FILE',
  'ERR_MODEL_TOO_LARGE',
  'ERR_MODEL_TOO_COMPLEX',
  'ERR_INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** One failed field, addressed by a dotted path such as `address.postalCode`. */
export interface FieldIssue {
  path: string;
  code: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    /** Values interpolated into the localized message, e.g. `{ max: 50 }`. */
    params?: Record<string, string | number>;
    issues?: FieldIssue[];
    requestId?: string;
  };
}

export interface AppErrorOptions {
  status: number;
  code: ErrorCode;
  message: string;
  params?: Record<string, string | number>;
  issues?: FieldIssue[];
  cause?: unknown;
}

/**
 * The only error type the API throws deliberately. Anything else that reaches
 * the error handler is a bug and is reported as ERR_INTERNAL without leaking
 * its message to the client.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly params: Record<string, string | number> | undefined;
  readonly issues: FieldIssue[] | undefined;

  constructor(options: AppErrorOptions) {
    super(options.message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'AppError';
    this.status = options.status;
    this.code = options.code;
    this.params = options.params;
    this.issues = options.issues;
  }

  toBody(requestId?: string): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.params ? { params: this.params } : {}),
        ...(this.issues ? { issues: this.issues } : {}),
        ...(requestId ? { requestId } : {}),
      },
    };
  }
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const { error } = value as { error: unknown };
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  );
}
