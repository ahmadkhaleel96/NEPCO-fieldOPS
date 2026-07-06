import { describe, it, expect, vi } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({ auth: { getUser: vi.fn() } }),
}));

process.env['SUPABASE_URL'] = 'https://test.supabase.co';
process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';
process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role-key';

const { supabaseAnon, supabaseAdmin } = await import('../../lib/supabase');
const { createClient } = await import('@supabase/supabase-js');

describe('supabase clients', () => {
  it('exports supabaseAnon', () => {
    expect(supabaseAnon).toBeDefined();
  });

  it('exports supabaseAdmin', () => {
    expect(supabaseAdmin).toBeDefined();
  });

  it('creates the anon client with the anon key', () => {
    expect(vi.mocked(createClient)).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
      expect.objectContaining({ auth: expect.objectContaining({ autoRefreshToken: false }) })
    );
  });

  it('creates the admin client with the service-role key', () => {
    expect(vi.mocked(createClient)).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-service-role-key',
      expect.objectContaining({ auth: expect.objectContaining({ autoRefreshToken: false }) })
    );
  });
});
