import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  ApiSuccessSchema,
  ApiErrorSchema,
  PaginatedResponseSchema,
  PaginationQuerySchema,
} from '../schemas/api-response.schema';

describe('ApiSuccessSchema', () => {
  it('wraps data in a success envelope', () => {
    const schema = ApiSuccessSchema(z.object({ id: z.string() }));
    const result = schema.parse({ success: true, data: { id: 'abc' } });
    expect(result.success).toBe(true);
    expect(result.data.id).toBe('abc');
  });

  it('rejects success=false', () => {
    const schema = ApiSuccessSchema(z.object({ id: z.string() }));
    expect(schema.safeParse({ success: false, data: { id: 'abc' } }).success).toBe(false);
  });

  it('rejects missing data field', () => {
    const schema = ApiSuccessSchema(z.object({ id: z.string() }));
    expect(schema.safeParse({ success: true }).success).toBe(false);
  });

  it('rejects when data does not match inner schema', () => {
    const schema = ApiSuccessSchema(z.object({ count: z.number() }));
    expect(schema.safeParse({ success: true, data: { count: 'not-a-number' } }).success).toBe(false);
  });
});

describe('ApiErrorSchema', () => {
  const validError = {
    success: false,
    error: { code: 'NOT_FOUND', message: 'Resource not found' },
  };

  it('accepts a valid error response', () => {
    expect(ApiErrorSchema.safeParse(validError).success).toBe(true);
  });

  it('accepts an error with optional details', () => {
    const withDetails = {
      ...validError,
      error: { ...validError.error, details: { field: 'was wrong' } },
    };
    expect(ApiErrorSchema.safeParse(withDetails).success).toBe(true);
  });

  it('rejects success=true', () => {
    expect(ApiErrorSchema.safeParse({ ...validError, success: true }).success).toBe(false);
  });

  it('rejects missing error.code', () => {
    expect(
      ApiErrorSchema.safeParse({ success: false, error: { message: 'oops' } }).success
    ).toBe(false);
  });

  it('rejects missing error.message', () => {
    expect(
      ApiErrorSchema.safeParse({ success: false, error: { code: 'ERR' } }).success
    ).toBe(false);
  });
});

describe('PaginatedResponseSchema', () => {
  const ItemSchema = z.object({ id: z.string(), name: z.string() });

  const validPaginated = {
    success: true,
    data: [{ id: '1', name: 'Alice' }],
    pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
  };

  it('accepts a valid paginated response', () => {
    const schema = PaginatedResponseSchema(ItemSchema);
    expect(schema.safeParse(validPaginated).success).toBe(true);
  });

  it('accepts an empty data array', () => {
    const schema = PaginatedResponseSchema(ItemSchema);
    expect(
      schema.safeParse({ ...validPaginated, data: [], pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 } }).success
    ).toBe(true);
  });

  it('rejects item that does not match inner schema', () => {
    const schema = PaginatedResponseSchema(ItemSchema);
    expect(
      schema.safeParse({ ...validPaginated, data: [{ id: 1, name: 'Alice' }] }).success
    ).toBe(false);
  });

  it('rejects missing pagination object', () => {
    const schema = PaginatedResponseSchema(ItemSchema);
    expect(schema.safeParse({ success: true, data: [] }).success).toBe(false);
  });

  it('rejects negative total in pagination', () => {
    const schema = PaginatedResponseSchema(ItemSchema);
    expect(
      schema.safeParse({ ...validPaginated, pagination: { ...validPaginated.pagination, total: -1 } }).success
    ).toBe(false);
  });
});

describe('PaginationQuerySchema', () => {
  it('parses numeric strings via coercion', () => {
    const result = PaginationQuerySchema.parse({ page: '2', per_page: '50' });
    expect(result.page).toBe(2);
    expect(result.per_page).toBe(50);
  });

  it('applies default values when fields are omitted', () => {
    const result = PaginationQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.per_page).toBe(20);
  });

  it('rejects page=0', () => {
    expect(PaginationQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });

  it('rejects per_page > 100', () => {
    expect(PaginationQuerySchema.safeParse({ per_page: '101' }).success).toBe(false);
  });

  it('rejects per_page=0', () => {
    expect(PaginationQuerySchema.safeParse({ per_page: '0' }).success).toBe(false);
  });
});
