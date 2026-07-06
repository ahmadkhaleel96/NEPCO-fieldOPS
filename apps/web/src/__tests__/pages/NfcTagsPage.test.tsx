import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { NfcTagsPage } from '../../pages/NfcTagsPage';
import type { ApiClientNfcTag } from '@fieldops/api-client';

const { apiClient } = await import('../../lib/api-client');

const MOCK_TAG: ApiClientNfcTag = {
  id: 'tag-1',
  tag_id: 'ABCD1234',
  status: 'provisioned',
  asset_id: '00000000-0000-0000-0000-000000000001',
  vehicle_id: null,
  provisioned_by: 'user-1',
  replaced_by: null,
  install_lat: null,
  install_lng: null,
  install_photo_url: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const MOCK_TAG_ACTIVE: ApiClientNfcTag = {
  ...MOCK_TAG,
  id: 'tag-2',
  tag_id: 'EFGH5678',
  status: 'active',
  install_lat: 31.95,
  install_lng: 35.91,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NfcTagsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NfcTagsPage', () => {
  it('shows loading state initially', () => {
    vi.mocked(apiClient.nfcTags.list).mockReturnValueOnce(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('renders the tag table when data is loaded', async () => {
    vi.mocked(apiClient.nfcTags.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_TAG, MOCK_TAG_ACTIVE],
      pagination: { total: 2, page: 1, per_page: 20, total_pages: 1 },
    });

    renderPage();

    expect(await screen.findByText('ABCD1234')).toBeInTheDocument();
    expect(screen.getByText('EFGH5678')).toBeInTheDocument();
    // Status text appears in both <span> and parent <td>; verify at least one span has the text
    expect(screen.getAllByText('Provisioned').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty state when no tags', async () => {
    vi.mocked(apiClient.nfcTags.list).mockResolvedValueOnce({
      success: true,
      data: [],
      pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
    });

    renderPage();
    expect(await screen.findByText(/no nfc tags found/i)).toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    vi.mocked(apiClient.nfcTags.list).mockRejectedValueOnce(new Error('Network error'));
    renderPage();
    expect(await screen.findByText(/failed to load nfc tags/i)).toBeInTheDocument();
  });

  it('opens provision modal when Provision tag button is clicked', async () => {
    vi.mocked(apiClient.nfcTags.list).mockResolvedValueOnce({
      success: true,
      data: [],
      pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
    });

    renderPage();
    await screen.findByText(/no nfc tags found/i);

    fireEvent.click(screen.getByRole('button', { name: /provision tag/i }));
    expect(screen.getByRole('dialog', { name: /provision nfc tag/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/tag id/i)).toBeInTheDocument();
  });

  it('shows Confirm Install button only for provisioned tags', async () => {
    vi.mocked(apiClient.nfcTags.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_TAG, MOCK_TAG_ACTIVE],
      pagination: { total: 2, page: 1, per_page: 20, total_pages: 1 },
    });

    renderPage();
    await screen.findByText('ABCD1234');

    expect(screen.getByRole('button', { name: /confirm install/i })).toBeInTheDocument();
    // Only one "Confirm Install" button — the active tag doesn't have one
    expect(screen.getAllByRole('button', { name: /confirm install/i })).toHaveLength(1);
  });

  it('opens confirm install dialog when Confirm Install is clicked', async () => {
    vi.mocked(apiClient.nfcTags.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_TAG],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });

    renderPage();
    await screen.findByText('ABCD1234');

    fireEvent.click(screen.getByRole('button', { name: /confirm install/i }));
    const dialog = screen.getByRole('dialog', { name: /confirm installation/i });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/ABCD1234/)).toBeInTheDocument();
  });

  it('calls confirmInstall API with correct payload', async () => {
    vi.mocked(apiClient.nfcTags.list).mockResolvedValue({
      success: true,
      data: [MOCK_TAG],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });
    vi.mocked(apiClient.nfcTags.confirmInstall).mockResolvedValueOnce({
      success: true,
      data: { ...MOCK_TAG, status: 'active', install_lat: 31.95, install_lng: 35.91 },
    });

    renderPage();
    await screen.findByText('ABCD1234');
    fireEvent.click(screen.getByRole('button', { name: /confirm install/i }));

    fireEvent.change(screen.getByLabelText(/latitude/i), { target: { value: '31.95' } });
    fireEvent.change(screen.getByLabelText(/longitude/i), { target: { value: '35.91' } });
    fireEvent.change(screen.getByLabelText(/photo url/i), {
      target: { value: 'https://r2.example.com/nfc/photo.jpg' },
    });

    const confirmDialog = screen.getByRole('dialog', { name: /confirm installation/i });
    fireEvent.click(within(confirmDialog).getByRole('button', { name: /confirm install/i }));

    await waitFor(() => {
      expect(vi.mocked(apiClient.nfcTags.confirmInstall)).toHaveBeenCalledWith('tag-1', {
        latitude: 31.95,
        longitude: 35.91,
        photo_url: 'https://r2.example.com/nfc/photo.jpg',
      });
    });
  });
});
