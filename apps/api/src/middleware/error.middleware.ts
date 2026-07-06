import type { Context } from 'hono';
import type { StatusCode } from 'hono/utils/http-status';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';

/**
 * Global error handler for the Hono app.
 * Returns a consistent ApiError shape for all error types.
 */
export function errorHandler(err: Error, c: Context) {
  // Zod validation errors (from @hono/zod-openapi)
  if (err instanceof ZodError) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: err.flatten().fieldErrors,
        },
      },
      422 as StatusCode
    );
  }

  // Hono HTTP exceptions (thrown by middleware and route handlers)
  if (err instanceof HTTPException) {
    return c.json(
      {
        success: false,
        error: {
          code: httpStatusToCode(err.status),
          message: err.message,
        },
      },
      err.status as StatusCode
    );
  }

  // Unexpected errors — log internally, return generic 500
  console.error('[unhandled error]', err);
  return c.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    },
    500 as StatusCode
  );
}

function httpStatusToCode(status: number): string {
  const map: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'VALIDATION_ERROR',
    429: 'RATE_LIMITED',
    500: 'INTERNAL_SERVER_ERROR',
  };
  return map[status] ?? 'HTTP_ERROR';
}
