import { OpenAPIHono } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { StartTripSchema, PostTripLocationsSchema } from '@fieldops/shared';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { supabaseAdmin } from '../lib/supabase';

export const tripsRoutes = new OpenAPIHono();

tripsRoutes.use(authMiddleware);

/**
 * POST /trips — initiate a trip via vehicle NFC scan
 *
 * Security: ALL validation happens server-side.
 * A modified client that skips the NFC scan will fail here because the
 * tag_id must match the permit's assigned vehicle in nfc_tags.
 */
tripsRoutes.post('/', requireRole('driver', 'admin'), async (c) => {
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON body' });
  });

  const parsed = StartTripSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid trip start data',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      422
    );
  }

  const { tag_id, permit_id, lat, lng, client_id, client_timestamp } = parsed.data;
  const driverId = c.get('userId');

  // Step 1: Verify the NFC tag is active
  const { data: nfcTag } = await supabaseAdmin
    .from('nfc_tags')
    .select('id, vehicle_id, status')
    .eq('tag_id', tag_id)
    .eq('status', 'active')
    .maybeSingle();

  if (!nfcTag) {
    throw new HTTPException(403, {
      message: 'NFC_TAG_NOT_FOUND: Tag is not registered or not active',
    });
  }

  // Step 2: Verify the permit is issued and the tag belongs to the permit's vehicle
  const { data: permit } = await supabaseAdmin
    .from('work_permits')
    .select('id, vehicle_id, engineer_id, status')
    .eq('id', permit_id)
    .eq('status', 'issued')
    .maybeSingle();

  if (!permit) {
    throw new HTTPException(403, {
      message: 'PERMIT_NOT_ISSUED: Permit is not in issued state',
    });
  }

  if (nfcTag.vehicle_id !== permit.vehicle_id) {
    throw new HTTPException(403, {
      message: 'NFC_VEHICLE_MISMATCH: Tag does not belong to the permit vehicle',
    });
  }

  // Step 3: Verify the requester is the permit's driver
  const { data: member } = await supabaseAdmin
    .from('permit_members')
    .select('id')
    .eq('permit_id', permit_id)
    .eq('user_id', driverId)
    .not('accepted_at', 'is', null)
    .maybeSingle();

  if (!member) {
    throw new HTTPException(403, {
      message: 'NOT_PERMIT_DRIVER: User is not an accepted member of this permit',
    });
  }

  // Step 4: Ensure no trip already exists for this permit (idempotency)
  const { data: existingTrip } = await supabaseAdmin
    .from('trips')
    .select('id')
    .eq('permit_id', permit_id)
    .maybeSingle();

  if (existingTrip) {
    throw new HTTPException(409, {
      message: 'TRIP_ALREADY_EXISTS: A trip already exists for this permit',
    });
  }

  // Step 5: Create trip + NFC event atomically (both must succeed)
  const { data: trip, error: tripError } = await supabaseAdmin
    .from('trips')
    .insert({
      permit_id,
      driver_id: driverId,
      vehicle_id: permit.vehicle_id,
      start_lat: lat,
      start_lng: lng,
      client_id,
    })
    .select()
    .single();

  if (tripError) {
    if (tripError.message.includes('unique')) {
      throw new HTTPException(409, { message: 'Duplicate trip submission (client_id conflict)' });
    }
    throw new HTTPException(500, { message: tripError.message });
  }

  const tripId = (trip as { id: string }).id;

  await supabaseAdmin.from('nfc_events').insert({
    tag_id,
    event_type: 'vehicle_start',
    trip_id: tripId,
    permit_id,
    user_id: driverId,
    lat,
    lng,
    client_id: crypto.randomUUID(),
    client_timestamp,
  });

  return c.json({ success: true, data: trip }, 201);
});

/** POST /trips/:id/locations — batch GPS upload */
tripsRoutes.post('/:id/locations', async (c) => {
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON body' });
  });

  const parsed = PostTripLocationsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid location data',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      422
    );
  }

  const tripId = c.req.param('id');
  const rows = parsed.data.locations.map((loc) => ({
    trip_id: tripId,
    lat: loc.lat,
    lng: loc.lng,
    accuracy: loc.accuracy ?? null,
    captured_at: loc.captured_at,
    client_id: loc.client_id,
  }));

  // ON CONFLICT DO NOTHING — idempotent upsert for offline re-submissions
  const { error } = await supabaseAdmin
    .from('trip_locations')
    .upsert(rows, { onConflict: 'client_id', ignoreDuplicates: true });

  if (error) throw new HTTPException(500, { message: error.message });

  return c.json({ success: true, data: { inserted: rows.length } });
});

/** GET /trips/:id/track — GeoJSON LineString for map rendering */
tripsRoutes.get('/:id/track', requireRole('admin', 'engineer'), async (c) => {
  const tripId = c.req.param('id');

  const { data: locations, error } = await supabaseAdmin
    .from('trip_locations')
    .select('lat, lng, captured_at')
    .eq('trip_id', tripId)
    .order('captured_at', { ascending: true });

  if (error) throw new HTTPException(500, { message: error.message });

  const coordinates = (locations ?? []).map((l: { lng: number; lat: number }) => [l.lng, l.lat]);

  return c.json({
    success: true,
    data: {
      type: 'LineString',
      coordinates,
      has_gaps: false,
    },
  });
});

/** POST /trips/:id/end — close the trip (return NFC scan) */
tripsRoutes.post('/:id/end', requireRole('driver', 'admin'), async (c) => {
  const tripId = c.req.param('id');

  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON body' });
  });

  // Check all inspections are submitted (pre-condition from Step 5.1)
  const { count: openCount } = await supabaseAdmin
    .from('asset_inspections')
    .select('*', { count: 'exact', head: true })
    .eq('trip_id', tripId)
    .eq('status', 'open');

  if ((openCount ?? 0) > 0) {
    throw new HTTPException(409, {
      message: `INSPECTIONS_OPEN: ${openCount} inspection(s) are still open. Submit all inspections before ending the trip.`,
    });
  }

  const { data, error } = await supabaseAdmin
    .from('trips')
    .update({
      end_time: new Date().toISOString(),
      end_lat: body.lat ?? null,
      end_lng: body.lng ?? null,
    })
    .eq('id', tripId)
    .is('end_time', null)
    .select()
    .single();

  if (error || !data) {
    throw new HTTPException(409, { message: 'Trip not found or already ended' });
  }

  // Advance permit to completed
  await supabaseAdmin
    .from('work_permits')
    .update({ status: 'completed' })
    .eq('id', (data as { permit_id: string }).permit_id);

  return c.json({ success: true, data });
});
