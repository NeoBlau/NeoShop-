import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError } from '@3dsfera/shared';
import { parseInput } from '../src/lib/validate.js';
import { toSessionUser } from '../src/modules/auth/service.js';

const schema = z.object({
  title: z.string().min(3),
  nested: z.object({ price: z.number().int().positive() }),
});

describe('parseInput', () => {
  it('returns typed data on success', () => {
    const value = parseInput(schema, { title: 'Antenna', nested: { price: 100 } });
    expect(value.nested.price).toBe(100);
  });

  it('reports every failed field with a dotted path', () => {
    try {
      parseInput(schema, { title: 'x', nested: { price: -1 } });
      expect.unreachable('parseInput should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.code).toBe('ERR_VALIDATION');
      expect(appError.status).toBe(400);
      expect(appError.issues?.map((issue) => issue.path)).toEqual(['title', 'nested.price']);
    }
  });

  it('serializes into the documented error body', () => {
    try {
      parseInput(schema, {});
      expect.unreachable('parseInput should have thrown');
    } catch (error) {
      const body = (error as AppError).toBody('req-1');
      expect(body.error.code).toBe('ERR_VALIDATION');
      expect(body.error.requestId).toBe('req-1');
      expect(body.error.issues?.length).toBeGreaterThan(0);
    }
  });
});

describe('toSessionUser', () => {
  const base = {
    id: 'user-1',
    email: 'supplier@example.com',
    role: 'SUPPLIER' as const,
    locale: 'ru' as const,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  it('never leaks the password hash and exposes the pavilion slot', () => {
    const result = toSessionUser({
      ...base,
      supplier: {
        id: 'sup-1',
        companyName: 'Орбита Связь',
        status: 'APPROVED',
        pavilions: [{ slot: 3 }],
      },
    });

    expect(result).toEqual({
      id: 'user-1',
      email: 'supplier@example.com',
      role: 'SUPPLIER',
      locale: 'ru',
      createdAt: '2026-01-01T00:00:00.000Z',
      supplier: {
        id: 'sup-1',
        companyName: 'Орбита Связь',
        status: 'APPROVED',
        pavilionSlot: 3,
      },
    });
    expect(JSON.stringify(result)).not.toContain('passwordHash');
  });

  it('reports a null slot for a supplier without a pavilion', () => {
    const result = toSessionUser({
      ...base,
      supplier: { id: 'sup-2', companyName: 'Мебель Кронос', status: 'PENDING', pavilions: [] },
    });
    expect(result.supplier?.pavilionSlot).toBeNull();
  });

  it('reports no supplier for a buyer', () => {
    const result = toSessionUser({ ...base, role: 'BUYER', supplier: null });
    expect(result.supplier).toBeNull();
  });
});
