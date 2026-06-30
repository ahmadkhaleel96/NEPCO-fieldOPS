import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { errorHandler } from '../../middleware/error.middleware';

function makeApp() {
  const app = new Hono();

  app.get('/throw-http/:code', (c) => {
    const code = parseInt(c.req.param('code'), 10);
    throw new HTTPException(code as ConstructorParameters<typeof HTTPException>[0], {
      message: `Error ${code}`,
    });
  });

  app.get('/throw-zod', (c) => {
    const schema = z.object({ name: z.string() });
    schema.parse({});
    return c.json({});
  });

  app.get('/throw-unknown', (c) => {
    void c;
    throw new Error('Unexpected error');
  });

  app.onError(errorHandler);
  return app;
}

describe('errorHandler', () => {
  const app = makeApp();

  it('returns 401 with structured body for HTTPException 401', async () => {
    const res = await app.request('/throw-http/401');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.error.message).toBe('Error 401');
  });

  it('returns 403 for HTTPException 403', async () => {
    const res = await app.request('/throw-http/403');
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 for HTTPException 404', async () => {
    const res = await app.request('/throw-http/404');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 429 for HTTPException 429', async () => {
    const res = await app.request('/throw-http/429');
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe('RATE_LIMITED');
  });

  it('returns 422 with field errors for ZodError', async () => {
    const res = await app.request('/throw-zod');
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toBeDefined();
  });

  it('returns 500 for unexpected errors', async () => {
    const res = await app.request('/throw-unknown');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
    // Must NOT leak error details
    expect(body.error.message).toBe('An unexpected error occurred');
  });
});
