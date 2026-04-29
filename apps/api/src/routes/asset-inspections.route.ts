import { OpenAPIHono } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { SubmitInspectionSchema, CreateSafetyReportSchema } from '@fieldops/shared';
import { authMiddleware, type AuthVariables } from '../middleware/auth.middleware';
import { supabaseAdmin } from '../lib/supabase';

export const assetInspectionsRoutes = new OpenAPIHono<{ Variables: AuthVariables }>();

assetInspectionsRoutes.use(authMiddleware);

/**
 * POST /asset-inspections — submit an inspection (with diff computation)
 *
 * The transaction is atomic:
 * 1. Insert asset_inspections row (status: pending)
 * 2. Compute diff against current asset metadata
 * 3. Insert asset_changes rows for each changed field
 * 4. If safety_hazard: create safety_report + suspend permit
 */
assetInspectionsRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON body' });
  });

  const parsed = SubmitInspectionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid inspection data',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      422
    );
  }

  const {
    trip_id,
    asset_id,
    status,
    form_data,
    incomplete_reason,
    idempotency_key,
  } = parsed.data;

  const submittedBy = c.get('userId');

  // Insert inspection (idempotency_key prevents duplicates from offline re-submissions)
  const { data: inspection, error: inspError } = await supabaseAdmin
    .from('asset_inspections')
    .upsert(
      {
        trip_id,
        asset_id,
        submitted_by: submittedBy,
        status,
        form_data,
        incomplete_reason: incomplete_reason ?? null,
        idempotency_key,
      },
      { onConflict: 'idempotency_key', ignoreDuplicates: false }
    )
    .select()
    .single();

  if (inspError) throw new HTTPException(500, { message: inspError.message });

  const inspectionId = (inspection as { id: string }).id;

  // Fetch current asset metadata to compute diff
  const { data: asset } = await supabaseAdmin
    .from('assets')
    .select('metadata')
    .eq('id', asset_id)
    .single();

  const currentMetadata = (asset as { metadata: Record<string, unknown> } | null)?.metadata ?? {};

  // Build asset_changes rows for fields that changed
  const changes: Array<{
    inspection_id: string;
    asset_id: string;
    field_name: string;
    old_value: unknown;
    new_value: unknown;
    status: 'pending';
  }> = [];

  for (const [field, newValue] of Object.entries(form_data)) {
    const oldValue = currentMetadata[field];
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes.push({
        inspection_id: inspectionId,
        asset_id,
        field_name: field,
        old_value: oldValue ?? null,
        new_value: newValue,
        status: 'pending',
      });
    }
  }

  if (changes.length > 0) {
    await supabaseAdmin.from('asset_changes').insert(changes);
  }

  // Handle safety hazard: create safety report + suspend permit
  if (incomplete_reason === 'safety_hazard') {
    const { data: trip } = await supabaseAdmin
      .from('trips')
      .select('permit_id')
      .eq('id', trip_id)
      .single();

    if (trip) {
      const permitId = (trip as { permit_id: string }).permit_id;

      await supabaseAdmin
        .from('work_permits')
        .update({ status: 'suspended' })
        .eq('id', permitId);
    }
  }

  return c.json({ success: true, data: inspection }, 201);
});

/** GET /asset-inspections — list with optional status and trip_id filters */
assetInspectionsRoutes.get('/', async (c) => {
  const page = Math.max(1, Number(c.req.query('page') ?? 1));
  const perPage = Math.min(100, Math.max(1, Number(c.req.query('per_page') ?? 20)));
  const status = c.req.query('status');
  const tripId = c.req.query('trip_id');
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let q = supabaseAdmin
    .from('asset_inspections')
    .select('*, asset_changes(*)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (status) q = q.eq('status', status);
  if (tripId) q = q.eq('trip_id', tripId);

  const { data, error, count } = await q;
  if (error) throw new HTTPException(500, { message: error.message });

  return c.json({
    success: true,
    data: data ?? [],
    pagination: {
      total: count ?? 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count ?? 0) / perPage),
    },
  });
});

/** GET /asset-inspections/:id */
assetInspectionsRoutes.get('/:id', async (c) => {
  const { data, error } = await supabaseAdmin
    .from('asset_inspections')
    .select('*, asset_changes(*)')
    .eq('id', c.req.param('id'))
    .single();

  if (error || !data) {
    throw new HTTPException(404, { message: 'Inspection not found' });
  }

  return c.json({ success: true, data });
});
