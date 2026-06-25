import { randomBytes } from 'node:crypto';
import { OpenAPIHono } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { ProvisionNfcTagSchema, ConfirmNfcTagInstallSchema, PaginationQuerySchema } from '@fieldops/shared';
import { authMiddleware, requireRole, type AuthVariables } from '../middleware/auth.middleware';
import { supabaseAdmin } from '../lib/supabase';
import { validateUuid } from '../lib/validate-uuid';

export const nfcTagsRoutes = new OpenAPIHono<{ Variables: AuthVariables }>();

nfcTagsRoutes.use(authMiddleware);

/** GET /nfc-tags — list all tags (admin, engineer) */
nfcTagsRoutes.get('/', requireRole('admin', 'engineer'), async (c) => {
  const query = PaginationQuerySchema.parse({
    page: c.req.query('page'),
    per_page: c.req.query('per_page'),
  });
  const statusFilter = c.req.query('status');
  const from = (query.page - 1) * query.per_page;
  const to = from + query.per_page - 1;

  let q = supabaseAdmin
    .from('nfc_tags')
    .select('id, tag_id, status, asset_id, vehicle_id, provisioned_by, replaced_by, install_lat, install_lng, install_photo_url, created_at, updated_at', { count: 'exact' })
    .range(from, to)
    .order('created_at', { ascending: false });

  if (statusFilter) {
    q = q.eq('status', statusFilter);
  }

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

/**
 * POST /nfc-tags — provision a new NFC tag (admin only)
 * Creates the nfc_tags row and generates an NTAG write password stored in Supabase Vault.
 * The password is NEVER returned to the client — it is retrieved server-side at scan time.
 */
nfcTagsRoutes.post('/', requireRole('admin'), async (c) => {
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON body' });
  });

  const parsed = ProvisionNfcTagSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid provisioning data',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      422
    );
  }

  const { tag_id, asset_id, vehicle_id } = parsed.data;
  const provisionedBy = c.get('userProfileId');

  // Check tag_id is not already registered
  const { data: existing } = await supabaseAdmin
    .from('nfc_tags')
    .select('id')
    .eq('tag_id', tag_id)
    .maybeSingle();

  if (existing) {
    throw new HTTPException(409, { message: 'This tag ID is already registered' });
  }

  // Generate a cryptographically random 4-byte NTAG write password and store
  // it in Supabase Vault. The returned UUID is stored as the vault reference;
  // the plaintext password is never held in application memory beyond this block.
  const passwordHex = randomBytes(4).toString('hex').toUpperCase();
  const { data: vaultId, error: vaultError } = await supabaseAdmin.rpc('nfc_vault_create', {
    p_secret: passwordHex,
    p_name: `nfc-${tag_id}`,
  });
  if (vaultError || !vaultId) {
    throw new HTTPException(500, { message: 'Failed to create vault secret' });
  }
  const vaultSecretId = vaultId as string;

  const { data, error } = await supabaseAdmin
    .from('nfc_tags')
    .insert({
      tag_id,
      asset_id: asset_id ?? null,
      vehicle_id: vehicle_id ?? null,
      vault_secret_id: vaultSecretId,
      provisioned_by: provisionedBy,
      status: 'provisioned',
    })
    .select()
    .single();

  if (error) throw new HTTPException(500, { message: error.message });

  return c.json({ success: true, data }, 201);
});

/** GET /nfc-tags/:id */
nfcTagsRoutes.get('/:id', requireRole('admin', 'engineer'), async (c) => {
  validateUuid(c.req.param('id'));
  const { data, error } = await supabaseAdmin
    .from('nfc_tags')
    .select('*')
    .eq('id', c.req.param('id'))
    .single();

  if (error || !data) throw new HTTPException(404, { message: 'NFC tag not found' });

  // Never return the vault_secret_id to clients
  const { vault_secret_id: _, ...safeData } = data as Record<string, unknown> & { vault_secret_id: unknown };

  return c.json({ success: true, data: safeData });
});

/** PATCH /nfc-tags/:id/confirm-install — field tech confirms tag is mounted */
nfcTagsRoutes.patch('/:id/confirm-install', requireRole('admin'), async (c) => {
  validateUuid(c.req.param('id'));
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON body' });
  });

  const parsed = ConfirmNfcTagInstallSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid install confirmation',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      422
    );
  }

  const { latitude, longitude, photo_url } = parsed.data;

  const { data, error } = await supabaseAdmin
    .from('nfc_tags')
    .update({
      status: 'active',
      install_lat: latitude,
      install_lng: longitude,
      install_photo_url: photo_url,
    })
    .eq('id', c.req.param('id'))
    .eq('status', 'provisioned')
    .select()
    .single();

  if (error || !data) {
    throw new HTTPException(404, {
      message: 'Tag not found or not in provisioned state',
    });
  }

  const { vault_secret_id: _, ...safeData } = data as Record<string, unknown> & { vault_secret_id: unknown };

  return c.json({ success: true, data: safeData });
});

/**
 * GET /nfc-tags/:id/write-password — retrieve the NTAG write password (admin only)
 * Used by provisioning tooling to program the physical tag. Never logged or cached.
 */
nfcTagsRoutes.get('/:id/write-password', requireRole('admin'), async (c) => {
  validateUuid(c.req.param('id'));

  const { data: tag, error: tagError } = await supabaseAdmin
    .from('nfc_tags')
    .select('vault_secret_id')
    .eq('id', c.req.param('id'))
    .single();

  if (tagError || !tag) throw new HTTPException(404, { message: 'NFC tag not found' });

  const { data: password, error: vaultError } = await supabaseAdmin.rpc('nfc_vault_read', {
    p_id: (tag as { vault_secret_id: string }).vault_secret_id,
  });

  if (vaultError || !password) {
    throw new HTTPException(500, { message: 'Failed to retrieve write password' });
  }

  return c.json({ success: true, data: { write_password: password as string } });
});
