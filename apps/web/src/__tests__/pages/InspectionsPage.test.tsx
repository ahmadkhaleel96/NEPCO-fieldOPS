import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { InspectionsPage } from '../../pages/InspectionsPage';
import type { ApiClientAssetChange } from '@fieldops/api-client';

const { apiClient } = await import('../../lib/api-client');

const V_CHANGE  = '00000000-0000-0000-0000-000000000001';
const V_ASSET   = '00000000-0000-0000-0000-000000000002';
const V_INSP    = '00000000-0000-0000-0000-000000000003';

const MOCK_CHANGE_PENDING: ApiClientAssetChange = {
  id: V_CHANGE,
  inspection_id: V_INSP,
  asset_id: V_ASSET,
  field_name: 'condition',
  old_value: 'fair',
  new_value: 'good',
  status: 'pending',
  reviewed_by: null,
  reviewed_at: null,
  created_at: '2026-04-22T08:00:00.000Z',
};

const MOCK_CHANGE_APPROVED: ApiClientAssetChange = {
  ...MOCK_CHANGE_PENDING,
  id: '00000000-0000-0000-0000-000000000004',
  field_name: 'temperature',
  old_value: '30C',
  new_value: '35C',
  status: 'approved',
  reviewed_by: 'eng-1',
  reviewed_at: '2026-04-22T09:00:00.000Z',
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <InspectionsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('InspectionsPage', () => {
  it('shows loading state initially', () => {
    vi.mocked(apiClient.assetChanges.list).mockReturnValueOnce(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    vi.mocked(apiClient.assetChanges.list).mockRejectedValueOnce(new Error('Network error'));
    renderPage();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  });

  it('shows empty state when no pending changes', async () => {
    vi.mocked(apiClient.assetChanges.list).mockResolvedValueOnce({
      success: true,
      data: [],
      pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
    });

    renderPage();
    expect(await screen.findByText(/no pending changes/i)).toBeInTheDocument();
  });

  it('renders a table row for each change', async () => {
    vi.mocked(apiClient.assetChanges.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_CHANGE_PENDING, MOCK_CHANGE_APPROVED],
      pagination: { total: 2, page: 1, per_page: 20, total_pages: 1 },
    });

    renderPage();
    await screen.findByText('condition');

    expect(screen.getByText('condition')).toBeInTheDocument();
    expect(screen.getByText('temperature')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText('approved')).toBeInTheDocument();
  });

  it('renders old→new diff values correctly', async () => {
    vi.mocked(apiClient.assetChanges.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_CHANGE_PENDING],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });

    renderPage();
    await screen.findByText('condition');

    expect(screen.getByText('fair')).toBeInTheDocument();
    expect(screen.getByText('good')).toBeInTheDocument();
  });

  it('shows Approve and Reject buttons only for pending changes', async () => {
    vi.mocked(apiClient.assetChanges.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_CHANGE_PENDING, MOCK_CHANGE_APPROVED],
      pagination: { total: 2, page: 1, per_page: 20, total_pages: 1 },
    });

    renderPage();
    await screen.findByText('condition');

    expect(screen.getAllByRole('button', { name: /approve/i })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /reject/i })).toHaveLength(1);
  });

  it('opens confirm dialog when Approve is clicked', async () => {
    vi.mocked(apiClient.assetChanges.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_CHANGE_PENDING],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });

    renderPage();
    await screen.findByText('condition');

    fireEvent.click(screen.getByRole('button', { name: /approve/i }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/approve change/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/condition/)).toBeInTheDocument();
  });

  it('opens confirm dialog when Reject is clicked', async () => {
    vi.mocked(apiClient.assetChanges.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_CHANGE_PENDING],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });

    renderPage();
    await screen.findByText('condition');

    fireEvent.click(screen.getByRole('button', { name: /reject/i }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/reject change/i)).toBeInTheDocument();
  });

  it('calls review API with approve action and closes dialog on success', async () => {
    vi.mocked(apiClient.assetChanges.list).mockResolvedValue({
      success: true,
      data: [MOCK_CHANGE_PENDING],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });
    vi.mocked(apiClient.assetChanges.review).mockResolvedValueOnce({
      success: true,
      data: { ...MOCK_CHANGE_PENDING, status: 'approved' },
    });

    renderPage();
    await screen.findByText('condition');

    fireEvent.click(screen.getByRole('button', { name: /approve/i }));
    const dialog = screen.getByRole('dialog');

    fireEvent.click(within(dialog).getByRole('button', { name: /^approve$/i }));

    await waitFor(() => {
      expect(vi.mocked(apiClient.assetChanges.review)).toHaveBeenCalledWith(V_CHANGE, {
        action: 'approve',
        notes: undefined,
      });
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('calls review API with reject action and optional notes', async () => {
    vi.mocked(apiClient.assetChanges.list).mockResolvedValue({
      success: true,
      data: [MOCK_CHANGE_PENDING],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });
    vi.mocked(apiClient.assetChanges.review).mockResolvedValueOnce({
      success: true,
      data: { ...MOCK_CHANGE_PENDING, status: 'rejected' },
    });

    renderPage();
    await screen.findByText('condition');

    fireEvent.click(screen.getByRole('button', { name: /reject/i }));
    const dialog = screen.getByRole('dialog');

    fireEvent.change(within(dialog).getByPlaceholderText(/reason for rejection/i), {
      target: { value: 'Incorrect reading' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /^reject$/i }));

    await waitFor(() => {
      expect(vi.mocked(apiClient.assetChanges.review)).toHaveBeenCalledWith(V_CHANGE, {
        action: 'reject',
        notes: 'Incorrect reading',
      });
    });
  });

  it('cancels dialog without calling API when Cancel is clicked', async () => {
    vi.mocked(apiClient.assetChanges.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_CHANGE_PENDING],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });

    renderPage();
    await screen.findByText('condition');

    fireEvent.click(screen.getByRole('button', { name: /approve/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(vi.mocked(apiClient.assetChanges.review)).not.toHaveBeenCalled();
  });

  it('filters by status when a different filter is selected', async () => {
    vi.mocked(apiClient.assetChanges.list).mockResolvedValue({
      success: true,
      data: [],
      pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
    });

    renderPage();
    await screen.findByText(/no pending changes/i);

    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: 'approved' } });

    await waitFor(() => {
      expect(vi.mocked(apiClient.assetChanges.list)).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved' })
      );
    });
  });

  it('shows empty state with generic message when "All" filter is selected and no results', async () => {
    vi.mocked(apiClient.assetChanges.list).mockResolvedValue({
      success: true,
      data: [],
      pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
    });

    renderPage();
    await screen.findByText(/no pending changes/i);

    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: '' } });

    await waitFor(() => {
      expect(screen.getByText(/no changes found/i)).toBeInTheDocument();
    });
  });
});
