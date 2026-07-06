import { OpenAPIHono } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import {
  CreateWorkPermitSchema,
  WithdrawPermitSchema,
  PaginationQuerySchema,
} from '@fieldops/shared';
import { authMiddleware, requireRole, type AuthVariables } from '../middleware/auth.middleware';
import { supabaseAdmin } from '../lib/supabase';
import { validateUuid } from '../lib/validate-uuid';
import { notifyPermitIssued, notifyPermitWithdrawn } from '../lib/notify';

export const workPermitsRoutes = new OpenAPIHono<{ Variables: AuthVariables }>();

workPermitsRoutes.use(authMiddleware);

/** GET /work-permits */
workPermitsRoutes.get('/', async (c) => {
  const query = PaginationQuerySchema.parse({
    page: c.req.query('page'),
    per_page: c.req.query('per_page'),
  });
  const statusFilter = c.req.query('status');
  const from = (query.page - 1) * query.per_page;
  const to = from + query.per_page - 1;

  let q = supabaseAdmin
    .from('work_permits')
    .select('*', { count: 'exact' })
    .range(from, to)
    .order('created_at', { ascending: false });

  if (statusFilter) q = q.eq('status', statusFilter);

  const { data, count, error } = await q;
  if (error) throw new HTTPException(500, { message: error.message });

  return c.json({
    success: true,
    data,
    pagination: {
      total: count ?? 0,
      page: query.page,
      per_page: query.per_page,
      total_pages: Math.ceil((count ?? 0) / query.per_page),
    },
  });
});

/** POST /work-permits — engineer issues a new permit */
workPermitsRoutes.post('/', requireRole('admin', 'engineer'), async (c) => {
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON body' });
  });

  const parsed = CreateWorkPermitSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid permit data',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      422
    );
  }

  const {
    permit_type,
    vehicle_id,
    asset_ids,
    scheduled_start,
    scheduled_end,
    safety_notes,
    team,
  } = parsed.data;

  const engineerId = c.get('userProfileId');

  // Create permit + members + asset links in a single transaction via RPC
  // (For Phase 1 full implementation, this will use a database function)
  const { data: permit, error: permitError } = await supabaseAdmin
    .from('work_permits')
    .insert({
      permit_type,
      vehicle_id,
      scheduled_start,
      scheduled_end,
      safety_notes: safety_notes ?? null,
      engineer_id: engineerId,
      status: 'issued',
    })
    .select()
    .single();

  if (permitError) throw new HTTPException(500, { message: permitError.message });

  const permitId = (permit as { id: string }).id;

  // Insert permit-asset links
  const assetLinks = asset_ids.map((asset_id) => ({ permit_id: permitId, asset_id }));
  await supabaseAdmin.from('permit_assets').insert(assetLinks);

  // Insert permit members
  const allMemberIds = [
    team.driver_id,
    team.leader_id,
    ...team.technician_ids,
  ];
  const uniqueMemberIds = [...new Set(allMemberIds)];
  const memberRows = uniqueMemberIds.map((user_id) => ({ permit_id: permitId, user_id }));
  await supabaseAdmin.from('permit_members').insert(memberRows);

  // Fetch member details for notifications (fire-and-forget)
  const { data: memberUsers } = await supabaseAdmin
    .from('users')
    .select('email, phone, full_name')
    .in('id', uniqueMemberIds);

  const { data: engineer } = await supabaseAdmin
    .from('users')
    .select('full_name')
    .eq('id', engineerId)
    .single();

  notifyPermitIssued({
    permitId,
    permitType: permit_type,
    scheduledStart: scheduled_start,
    scheduledEnd: scheduled_end,
    engineerName: (engineer as { full_name: string } | null)?.full_name ?? 'Engineer',
    recipients: (memberUsers ?? []) as { email: string; phone: string | null; full_name: string }[],
  }).catch(() => {});

  return c.json({ success: true, data: permit }, 201);
});

/** GET /work-permits/:id */
workPermitsRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  validateUuid(id);

  const { data: permit, error } = await supabaseAdmin
    .from('work_permits')
    .select('*, permit_members(*), permit_assets(asset_id, assets(id, asset_code, name, asset_type, metadata))')
    .eq('id', id)
    .single();

  if (error || !permit) throw new HTTPException(404, { message: 'Permit not found' });

  return c.json({ success: true, data: permit });
});

/** POST /work-permits/:id/withdraw */
workPermitsRoutes.post('/:id/withdraw', requireRole('admin', 'engineer'), async (c) => {
  const id = c.req.param('id');
  validateUuid(id);

  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON body' });
  });

  const parsed = WithdrawPermitSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid withdrawal data',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      422
    );
  }

  // Verify permit has not started
  const { data: tripCheck } = await supabaseAdmin
    .from('trips')
    .select('id')
    .eq('permit_id', id)
    .maybeSingle();

  if (tripCheck) {
    throw new HTTPException(409, {
      message: 'Cannot withdraw a permit after the trip has started',
    });
  }

  const { data, error } = await supabaseAdmin
    .from('work_permits')
    .update({ status: 'withdrawn' })
    .eq('id', id)
    .in('status', ['draft', 'issued'])
    .select()
    .single();

  if (error || !data) {
    throw new HTTPException(409, {
      message: 'Permit cannot be withdrawn in its current state',
    });
  }

  // Log withdrawal event
  await supabaseAdmin.from('nfc_events').insert({
    tag_id: 'system',
    event_type: 'permit_withdrawal',
    permit_id: id,
    user_id: c.get('userProfileId'),
    lat: 0,
    lng: 0,
    client_id: crypto.randomUUID(),
    client_timestamp: new Date().toISOString(),
  });

  // Notify permit members of the withdrawal (fire-and-forget)
  const { data: members } = await supabaseAdmin
    .from('permit_members')
    .select('users(email, phone, full_name)')
    .eq('permit_id', id);

  const recipients = (members ?? [])
    .map((m) => (m as unknown as { users: { email: string; phone: string | null; full_name: string } | null }).users)
    .filter((u): u is { email: string; phone: string | null; full_name: string } => u !== null);

  notifyPermitWithdrawn({
    permitId: id,
    withdrawalReason: parsed.data.reason,
    recipients,
  }).catch(() => {});

  return c.json({ success: true, data });
});
