import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AssetsPage } from '../../pages/AssetsPage';
import type { ApiClientAsset } from '@fieldops/api-client';

const { apiClient } = await import('../../lib/api-client');

const MOCK_ASSET: ApiClientAsset = {
  id: 'a-1',
  asset_code: 'TWR-001',
  asset_type: 'hv_tower',
  name: 'Tower Alpha',
  latitude: 31.95,
  longitude: 35.91,
  metadata: { tower_number: 'T1', line_name: 'L1', voltage_kv: 132 },
  is_active: true,
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AssetsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AssetsPage', () => {
  it('shows loading state initially', () => {
    vi.mocked(apiClient.assets.list).mockReturnValueOnce(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('renders the asset table when data is loaded', async () => {
    vi.mocked(apiClient.assets.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_ASSET],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });

    renderPage();

    expect(await screen.findByText('Tower Alpha')).toBeInTheDocument();
    expect(screen.getByText('TWR-001')).toBeInTheDocument();
    expect(screen.getByText('HV Tower')).toBeInTheDocument();
  });

  it('shows empty state when no assets', async () => {
    vi.mocked(apiClient.assets.list).mockResolvedValueOnce({
      success: true,
      data: [],
      pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
    });

    renderPage();
    expect(await screen.findByText(/no assets found/i)).toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    vi.mocked(apiClient.assets.list).mockRejectedValueOnce(new Error('Network error'));
    renderPage();
    expect(await screen.findByText(/failed to load assets/i)).toBeInTheDocument();
  });

  it('opens create asset modal when Create asset button is clicked', async () => {
    vi.mocked(apiClient.assets.list).mockResolvedValueOnce({
      success: true,
      data: [],
      pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
    });

    renderPage();
    await screen.findByText(/no assets found/i);

    fireEvent.click(screen.getByRole('button', { name: /create asset/i }));
    expect(screen.getByRole('dialog', { name: /create asset/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/asset code/i)).toBeInTheDocument();
  });

  it('opens edit modal when Edit is clicked', async () => {
    vi.mocked(apiClient.assets.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_ASSET],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });

    renderPage();
    await screen.findByText('Tower Alpha');

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('dialog', { name: /edit asset/i })).toBeInTheDocument();
  });

  it('shows deactivate confirmation when Deactivate is clicked', async () => {
    vi.mocked(apiClient.assets.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_ASSET],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });

    renderPage();
    await screen.findByText('Tower Alpha');

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    const dialog = screen.getByRole('dialog', { name: /deactivate asset/i });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/Tower Alpha/)).toBeInTheDocument();
  });

  it('calls deactivate API and closes dialog on confirm', async () => {
    vi.mocked(apiClient.assets.list).mockResolvedValue({
      success: true,
      data: [MOCK_ASSET],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });
    vi.mocked(apiClient.assets.deactivate).mockResolvedValueOnce({
      success: true,
      data: { ...MOCK_ASSET, is_active: false },
    });

    renderPage();
    await screen.findByText('Tower Alpha');
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    const dialog = screen.getByRole('dialog', { name: /deactivate asset/i });
    fireEvent.click(within(dialog).getByRole('button', { name: /^deactivate$/i }));

    await waitFor(() => {
      expect(vi.mocked(apiClient.assets.deactivate)).toHaveBeenCalledWith('a-1');
    });
  });
});
