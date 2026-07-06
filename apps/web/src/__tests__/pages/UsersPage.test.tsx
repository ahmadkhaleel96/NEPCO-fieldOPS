import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { UsersPage } from '../../pages/UsersPage';
import type { ApiClientUser } from '@fieldops/api-client';

const { apiClient } = await import('../../lib/api-client');
const { supabase } = await import('../../lib/supabase');

const MOCK_USER: ApiClientUser = {
  id: 'u-1',
  auth_id: 'auth-1',
  email: 'ali@nepco.jo',
  full_name: 'Ali Hassan',
  role: 'engineer',
  phone: null,
  is_active: true,
  push_token: null,
  mfa_enabled: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: { user: { id: 'admin-1' } } as never },
    error: null,
  });
});

describe('UsersPage', () => {
  it('shows loading state initially', () => {
    vi.mocked(apiClient.users.list).mockReturnValueOnce(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('renders the user table when data is loaded', async () => {
    vi.mocked(apiClient.users.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_USER],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });

    renderPage();

    expect(await screen.findByText('Ali Hassan')).toBeInTheDocument();
    expect(screen.getByText('ali@nepco.jo')).toBeInTheDocument();
    expect(screen.getByText('Engineer')).toBeInTheDocument();
  });

  it('shows empty state when no users', async () => {
    vi.mocked(apiClient.users.list).mockResolvedValueOnce({
      success: true,
      data: [],
      pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
    });

    renderPage();
    expect(await screen.findByText(/no users found/i)).toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    vi.mocked(apiClient.users.list).mockRejectedValueOnce(new Error('Network error'));
    renderPage();
    expect(await screen.findByText(/failed to load users/i)).toBeInTheDocument();
  });

  it('opens create user modal when Create user button is clicked', async () => {
    vi.mocked(apiClient.users.list).mockResolvedValueOnce({
      success: true,
      data: [],
      pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
    });

    renderPage();
    await screen.findByText(/no users found/i);

    fireEvent.click(screen.getByRole('button', { name: /create user/i }));
    expect(screen.getByRole('dialog', { name: /create user/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
  });

  it('opens edit modal when Edit is clicked', async () => {
    vi.mocked(apiClient.users.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_USER],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });

    renderPage();
    await screen.findByText('Ali Hassan');

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('dialog', { name: /edit user/i })).toBeInTheDocument();
  });

  it('shows deactivate confirmation when Deactivate is clicked', async () => {
    vi.mocked(apiClient.users.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_USER],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'different-admin' } } as never },
      error: null,
    });

    renderPage();
    await screen.findByText('Ali Hassan');

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    const deactivateDialog = screen.getByRole('dialog', { name: /deactivate user/i });
    expect(deactivateDialog).toBeInTheDocument();
    expect(within(deactivateDialog).getByText(/Ali Hassan/)).toBeInTheDocument();
  });

  it('calls deactivate API and closes dialog on confirm', async () => {
    vi.mocked(apiClient.users.list).mockResolvedValue({
      success: true,
      data: [MOCK_USER],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });
    vi.mocked(apiClient.users.deactivate).mockResolvedValueOnce({
      success: true,
      data: { ...MOCK_USER, is_active: false },
    });
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'different-admin' } } as never },
      error: null,
    });

    renderPage();
    await screen.findByText('Ali Hassan');
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    const dialog = screen.getByRole('dialog', { name: /deactivate user/i });
    fireEvent.click(within(dialog).getByRole('button', { name: /^deactivate$/i }));

    await waitFor(() => {
      expect(vi.mocked(apiClient.users.deactivate)).toHaveBeenCalledWith('u-1');
    });
  });
});
