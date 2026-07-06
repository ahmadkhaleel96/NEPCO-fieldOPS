import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '../App';

const { supabase } = await import('../lib/supabase');

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>
  );
}

describe('App — unauthenticated state', () => {
  it('renders loading spinner initially', () => {
    vi.mocked(supabase.auth.getSession).mockReturnValueOnce(
      new Promise(() => {}) as ReturnType<typeof supabase.auth.getSession>
    );
    const { container } = renderApp();
    expect(container.querySelector('[role="status"]')).toBeTruthy();
  });

  it('shows the auth card when no session exists', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: null },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getSession>>);

    renderApp();

    const title = await screen.findByText('NEPCO FieldOps');
    expect(title).toBeInTheDocument();
    expect(screen.getByText('Field Operation Management System')).toBeInTheDocument();
  });
});

describe('App — authenticated state', () => {
  it('renders the app shell for an engineer', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: {
        session: {
          user: {
            id: 'u-1',
            email: 'engineer@nepco.jo',
            app_metadata: { role: 'engineer' },
          },
          access_token: 'tok',
          refresh_token: 'ref',
          expires_in: 3600,
          expires_at: 9999999999,
          token_type: 'bearer',
        } as Parameters<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] extends null ? never : typeof Object>[0],
      },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getSession>>);

    renderApp();

    expect(await screen.findByText('NEPCO FieldOps')).toBeInTheDocument();
    expect(await screen.findByText('engineer@nepco.jo')).toBeInTheDocument();
    // Engineer should NOT see Users nav item
    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
  });

  it('renders the Users nav item for admin', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: {
        session: {
          user: {
            id: 'admin-1',
            email: 'admin@nepco.jo',
            app_metadata: { role: 'admin' },
          },
          access_token: 'tok',
          refresh_token: 'ref',
          expires_in: 3600,
          expires_at: 9999999999,
          token_type: 'bearer',
        } as Parameters<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] extends null ? never : typeof Object>[0],
      },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getSession>>);

    renderApp();

    expect(await screen.findByRole('link', { name: 'Users' })).toBeInTheDocument();
  });
});
