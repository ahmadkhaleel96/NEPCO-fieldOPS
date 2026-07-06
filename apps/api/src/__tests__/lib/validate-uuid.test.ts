import { describe, it, expect } from 'vitest';
import { HTTPException } from 'hono/http-exception';
import { validateUuid } from '../../lib/validate-uuid';

describe('validateUuid', () => {
  it('passes for a valid lowercase UUID', () => {
    expect(() => validateUuid('00000000-0000-0000-0000-000000000001')).not.toThrow();
  });

  it('passes for a valid uppercase UUID', () => {
    expect(() => validateUuid('AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE')).not.toThrow();
  });

  it('throws HTTPException 400 for an empty string', () => {
    expect(() => validateUuid('')).toThrow(HTTPException);
    try {
      validateUuid('');
    } catch (e) {
      expect((e as HTTPException).status).toBe(400);
      expect((e as HTTPException).message).toMatch(/must be a UUID/i);
    }
  });

  it('throws HTTPException 400 for a plain string', () => {
    expect(() => validateUuid('not-a-uuid')).toThrow(HTTPException);
    try {
      validateUuid('not-a-uuid');
    } catch (e) {
      expect((e as HTTPException).status).toBe(400);
    }
  });

  it('throws HTTPException 400 for a SQL injection attempt', () => {
    expect(() => validateUuid("'; DROP TABLE users; --")).toThrow(HTTPException);
    try {
      validateUuid("'; DROP TABLE users; --");
    } catch (e) {
      expect((e as HTTPException).status).toBe(400);
    }
  });

  it('throws HTTPException 400 for a UUID without dashes', () => {
    expect(() => validateUuid('00000000000000000000000000000001')).toThrow(HTTPException);
  });

  it('includes the custom label in the error message', () => {
    try {
      validateUuid('bad', 'report_id');
    } catch (e) {
      expect((e as HTTPException).message).toMatch(/report_id/);
    }
  });
});
