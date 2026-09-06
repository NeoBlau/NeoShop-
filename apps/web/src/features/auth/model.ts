import { loginSchema, registerSchema, type RegisterInput, type UserRole } from '@3dsfera/shared';
import { ApiError } from '../../api/client.js';

/**
 * Form logic for the auth screens. Pure functions over plain values: no React,
 * no fetch. The components render whatever these return.
 */

export interface RegisterFormValues {
  role: Extract<UserRole, 'BUYER' | 'SUPPLIER'>;
  email: string;
  password: string;
  companyName: string;
  legalName: string;
  taxId: string;
}

export const emptyRegisterForm: RegisterFormValues = {
  role: 'BUYER',
  email: '',
  password: '',
  companyName: '',
  legalName: '',
  taxId: '',
};

export type FieldErrors = Record<string, string>;

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Builds the API payload from form values, dropping empty optional fields. */
export function toRegisterInput(values: RegisterFormValues): unknown {
  if (values.role === 'SUPPLIER') {
    return {
      role: 'SUPPLIER',
      email: values.email,
      password: values.password,
      companyName: values.companyName.trim(),
      ...(optional(values.legalName) ? { legalName: optional(values.legalName) } : {}),
      ...(optional(values.taxId) ? { taxId: optional(values.taxId) } : {}),
    };
  }
  return { role: 'BUYER', email: values.email, password: values.password };
}

/**
 * Client-side pass over the same schema the server uses. It exists to give
 * fast feedback, not to protect anything: the server validates independently.
 */
export function validateRegister(values: RegisterFormValues): {
  errors: FieldErrors;
  input: RegisterInput | null;
} {
  const result = registerSchema.safeParse(toRegisterInput(values));
  if (result.success) return { errors: {}, input: result.data };

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const path = issue.path.map(String).join('.');
    if (!path || errors[path]) continue;
    errors[path] = issue.code === 'custom' ? issue.message : issue.code;
  }
  return { errors, input: null };
}

export function validateLogin(values: { email: string; password: string }): {
  errors: FieldErrors;
  input: { email: string; password: string } | null;
} {
  const result = loginSchema.safeParse(values);
  if (result.success) return { errors: {}, input: result.data };

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const path = issue.path.map(String).join('.');
    if (path && !errors[path]) errors[path] = issue.code;
  }
  return { errors, input: null };
}

/** Where a user should land right after signing in, based on their role. */
export function landingRouteFor(role: UserRole): string {
  switch (role) {
    case 'SUPPLIER':
      return '/supplier';
    case 'ADMIN':
      return '/admin';
    case 'BUYER':
      return '/';
  }
}

/** Splits a failed request into a banner message code and per-field codes. */
export function describeFailure(error: unknown): {
  code: string;
  params: Record<string, string | number> | undefined;
  fields: FieldErrors;
} {
  if (error instanceof ApiError) {
    return { code: error.code, params: error.params, fields: error.fieldErrors() };
  }
  return { code: 'ERR_INTERNAL', params: undefined, fields: {} };
}

/**
 * Maps a Zod issue code to a dictionary key. Zod's codes are generic; the
 * dictionary is what turns them into something a person can act on.
 */
export function validationMessageKey(code: string): string {
  switch (code) {
    case 'invalid_type':
      return 'validation.required';
    case 'too_small':
      return 'validation.too_small';
    case 'too_big':
      return 'validation.too_big';
    case 'invalid_format':
    case 'invalid_string':
    case 'invalid_email':
      return 'validation.invalid_email';
    case 'password_too_simple':
      return 'validation.password_too_simple';
    default:
      return 'validation.required';
  }
}
