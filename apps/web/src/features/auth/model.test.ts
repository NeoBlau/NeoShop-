import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api/client.js';
import {
  describeFailure,
  emptyRegisterForm,
  landingRouteFor,
  toRegisterInput,
  validateLogin,
  validateRegister,
  validationMessageKey,
} from './model.js';

describe('validateRegister', () => {
  it('accepts a buyer with a valid email and password', () => {
    const { errors, input } = validateRegister({
      ...emptyRegisterForm,
      email: 'buyer@example.com',
      password: 'parol-12345',
    });

    expect(errors).toEqual({});
    expect(input?.role).toBe('BUYER');
  });

  it('flags the company name for a supplier who left it empty', () => {
    const { errors, input } = validateRegister({
      ...emptyRegisterForm,
      role: 'SUPPLIER',
      email: 'supplier@example.com',
      password: 'parol-12345',
    });

    expect(input).toBeNull();
    expect(errors['companyName']).toBeDefined();
  });

  it('marks a letters-only password with its own code, not a generic one', () => {
    const { errors } = validateRegister({
      ...emptyRegisterForm,
      email: 'buyer@example.com',
      password: 'парольбезцифр',
    });

    expect(errors['password']).toBe('password_too_simple');
    expect(validationMessageKey(errors['password'] ?? '')).toBe('validation.password_too_simple');
  });
});

describe('toRegisterInput', () => {
  it('drops empty optional company fields instead of sending empty strings', () => {
    const input = toRegisterInput({
      ...emptyRegisterForm,
      role: 'SUPPLIER',
      email: 'supplier@example.com',
      password: 'parol-12345',
      companyName: '  Орбита Связь  ',
      legalName: '   ',
      taxId: '',
    }) as Record<string, unknown>;

    expect(input['companyName']).toBe('Орбита Связь');
    expect('legalName' in input).toBe(false);
    expect('taxId' in input).toBe(false);
  });
});

describe('validateLogin', () => {
  it('does not apply the password policy to an existing account', () => {
    const { input } = validateLogin({ email: 'old@example.com', password: 'short' });
    expect(input).not.toBeNull();
  });

  it('rejects a malformed email', () => {
    const { errors, input } = validateLogin({ email: 'not-an-email', password: 'parol-12345' });
    expect(input).toBeNull();
    expect(errors['email']).toBeDefined();
  });
});

describe('landingRouteFor', () => {
  it('sends every role to its own home', () => {
    expect(landingRouteFor('BUYER')).toBe('/');
    expect(landingRouteFor('SUPPLIER')).toBe('/supplier');
    expect(landingRouteFor('ADMIN')).toBe('/admin');
  });
});

describe('describeFailure', () => {
  it('keeps the server error code and per-field issues', () => {
    const error = new ApiError({
      status: 400,
      code: 'ERR_VALIDATION',
      message: 'Validation failed',
      issues: [{ path: 'email', code: 'invalid_format', message: 'invalid' }],
    });

    expect(describeFailure(error)).toEqual({
      code: 'ERR_VALIDATION',
      params: undefined,
      fields: { email: 'invalid_format' },
    });
  });

  it('falls back to ERR_INTERNAL for anything that is not an ApiError', () => {
    expect(describeFailure(new Error('boom')).code).toBe('ERR_INTERNAL');
  });
});
