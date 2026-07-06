import { OpenAPIHono } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { SiteArrivalSchema } from '@fieldops/shared';
import { authMiddleware, type AuthVariables } from '../middleware/auth.middleware';
import { supabaseAdmin } from '../lib/supabase';

export const nfcEventsRoutes = new OpenAPIHono<{ Variables: AuthVariables }>();

nfcEventsRoutes.use(authMiddleware);

/** POST /nfc-events — site arrival scan */
nfcEventsRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON body' });
  });

  const parsed = SiteArrivalSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid site arrival data',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      422
    );
  }

  const { tag_id, trip_id, lat, lng, client_id, client_timestamp } = parsed.data;
  const userId = c.get('userProfileId');

  // Verify tag belongs to an asset listed in the permit for this trip
  const { data: trip } = await supabaseAdmin
    .from('trips')
    .select('permit_id')
    .eq('id', trip_id)
    .maybeSingle();

  if (!trip) throw new HTTPException(404, { message: 'Trip not found' });

  const { data: nfcTag } = await supabaseAdmin
    .from('nfc_tags')
    .select('asset_id')
    .eq('tag_id', tag_id)
    .eq('status', 'active')
    .maybeSingle();

  if (!nfcTag) {
    throw new HTTPException(403, { message: 'NFC_TAG_INVALID: Tag is not active' });
  }

  // Verify asset is part of this permit
  const { data: assetLink } = await supabaseAdmin
    .from('permit_assets')
    .select('asset_id')
    .eq('permit_id', (trip as { permit_id: string }).permit_id)
    .eq('asset_id', nfcTag.asset_id)
    .maybeSingle();

  if (!assetLink) {
    throw new HTTPException(403, {
      message: 'ASSET_NOT_IN_PERMIT: This asset is not part of the current permit',
    });
  }

  const { data, error } = await supabaseAdmin
    .from('nfc_events')
    .insert({
      tag_id,
      event_type: 'site_arrival',
      trip_id,
      permit_id: (trip as { permit_id: string }).permit_id,
      user_id: userId,
      lat,
      lng,
      client_id,
      client_timestamp,
    })
    .select()
    .single();

  if (error) {
    if (error.message.includes('unique')) {
      // Duplicate client_id — idempotent, return success
      return c.json({ success: true, data: { message: 'Already recorded' } });
    }
    throw new HTTPException(500, { message: error.message });
  }

  return c.json({
    success: true,
    data: {
      event_id: (data as { id: string }).id,
      asset_id: nfcTag.asset_id,
      permit_id: (trip as { permit_id: string }).permit_id,
    },
  });
});
