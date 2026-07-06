import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { MAX_REQUEST_BODY_BYTES } from '@fieldops/shared';

export const bodySizeLimitMiddleware = createMiddleware(async (c, next) => {
  const contentLength = c.req.header('content-length');
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (!isNaN(size) && size > MAX_REQUEST_BODY_BYTES) {
      throw new HTTPException(413, { message: 'Request body too large. Maximum size is 1 MB.' });
    }
  }
  await next();
});
