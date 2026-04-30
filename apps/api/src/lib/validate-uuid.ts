import { HTTPException } from 'hono/http-exception';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateUuid(id: string, label = 'id'): void {
  if (!UUID_RE.test(id)) {
    throw new HTTPException(400, { message: `Invalid ${label}: must be a UUID` });
  }
}
