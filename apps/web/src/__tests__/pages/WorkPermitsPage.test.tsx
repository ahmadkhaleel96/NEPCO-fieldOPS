import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkPermitsPage } from '../../pages/WorkPermitsPage';
import type { ApiClientWorkPermit } from '@fieldops/api-client';

const { apiClient } = await import('../../lib/api-client');

const V1 = '00000000-0000-0000-0000-000000000001';
const V2 = '00000000-0000-0000-0000-000000000002';
const V3 = '00000000-0000-0000-0000-000000000003';
const V4 = '00000000-0000-0000-0000-000000000004';

const MOCK_PERMIT_ISSUED: ApiClientWorkPermit = {
  id: 'permit-1',
  permit_number: 'WP-2026-001',
  permit_type: 'maintenance',
  status: 'issued',
  engineer_id: 'user-1',
  vehicle_id: V1,
  scheduled_start: '2026-04-20T08:00:00.000Z',
  scheduled_end: '2026-04-20T16:00:00.000Z',
  safety_notes: null,
  created_at: '2026-04-15T09:00:00.000Z',
  updated_at: '2026-04-15T09:00:00.000Z',
};

const MOCK_PERMIT_ACTIVE: ApiClientWorkPermit = {
  ...MOCK_PERMIT_ISSUED,
  id: 'permit-2',
  permit_number: 'WP-2026-002',
  status: 'active',
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <WorkPermitsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('WorkPermitsPage', () => {
  it('shows loading state initially', () => {
    vi.mocked(apiClient.workPermits.list).mockReturnValueOnce(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('renders the permit table when data is loaded', async () => {
    vi.mocked(apiClient.workPermits.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_PERMIT_ISSUED, MOCK_PERMIT_ACTIVE],
      pagination: { total: 2, page: 1, per_page: 20, total_pages: 1 },
    });

    renderPage();

    expect(await screen.findByText('WP-2026-001')).toBeInTheDocument();
    expect(screen.getByText('WP-2026-002')).toBeInTheDocument();
  });

  it('shows empty state when no permits', async () => {
    vi.mocked(apiClient.workPermits.list).mockResolvedValueOnce({
      success: true,
      data: [],
      pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
    });

    renderPage();
    expect(await screen.findByText(/no work permits found/i)).toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    vi.mocked(apiClient.workPermits.list).mockRejectedValueOnce(new Error('Network error'));
    renderPage();
    expect(await screen.findByText(/failed to load work permits/i)).toBeInTheDocument();
  });

  it('shows Withdraw button only for draft/issued permits', async () => {
    vi.mocked(apiClient.workPermits.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_PERMIT_ISSUED, MOCK_PERMIT_ACTIVE],
      pagination: { total: 2, page: 1, per_page: 20, total_pages: 1 },
    });

    renderPage();
    await screen.findByText('WP-2026-001');

    // Only issued permit has Withdraw button; active does not
    expect(screen.getAllByRole('button', { name: /withdraw/i })).toHaveLength(1);
  });

  it('opens create permit modal when Create permit button is clicked', async () => {
    vi.mocked(apiClient.workPermits.list).mockResolvedValueOnce({
      success: true,
      data: [],
      pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
    });

    renderPage();
    await screen.findByText(/no work permits found/i);

    fireEvent.click(screen.getByRole('button', { name: /create permit/i }));
    expect(screen.getByRole('dialog', { name: /create work permit/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/permit type/i)).toBeInTheDocument();
  });

  it('opens withdraw dialog when Withdraw is clicked', async () => {
    vi.mocked(apiClient.workPermits.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_PERMIT_ISSUED],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });

    renderPage();
    await screen.findByText('WP-2026-001');

    fireEvent.click(screen.getByRole('button', { name: /withdraw/i }));
    const dialog = screen.getByRole('dialog', { name: /withdraw permit/i });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/WP-2026-001/)).toBeInTheDocument();
  });

  it('calls withdraw API with correct payload', async () => {
    vi.mocked(apiClient.workPermits.list).mockResolvedValue({
      success: true,
      data: [MOCK_PERMIT_ISSUED],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });
    vi.mocked(apiClient.workPermits.withdraw).mockResolvedValueOnce({
      success: true,
      data: { ...MOCK_PERMIT_ISSUED, status: 'withdrawn' },
    });

    renderPage();
    await screen.findByText('WP-2026-001');

    fireEvent.click(screen.getByRole('button', { name: /withdraw/i }));
    const dialog = screen.getByRole('dialog', { name: /withdraw permit/i });

    fireEvent.change(within(dialog).getByLabelText(/reason/i), {
      target: { value: 'Safety concern on site, must postpone.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /^withdraw$/i }));

    await waitFor(() => {
      expect(vi.mocked(apiClient.workPermits.withdraw)).toHaveBeenCalledWith('permit-1', {
        reason: 'Safety concern on site, must postpone.',
      });
    });
  });

  it('calls create API with correct payload', async () => {
    vi.mocked(apiClient.workPermits.list).mockResolvedValue({
      success: true,
      data: [],
      pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
    });
    vi.mocked(apiClient.workPermits.create).mockResolvedValueOnce({
      success: true,
      data: MOCK_PERMIT_ISSUED,
    });

    renderPage();
    await screen.findByText(/no work permits found/i);

    fireEvent.click(screen.getByRole('button', { name: /create permit/i }));
    const dialog = screen.getByRole('dialog', { name: /create work permit/i });

    fireEvent.change(within(dialog).getByLabelText(/permit type/i), {
      target: { value: 'maintenance' },
    });
    fireEvent.change(within(dialog).getByLabelText(/vehicle id/i), {
      target: { value: V1 },
    });
    fireEvent.change(within(dialog).getByLabelText(/asset ids/i), {
      target: { value: V2 },
    });
    fireEvent.change(within(dialog).getByLabelText(/scheduled start/i), {
      target: { value: '2026-04-20T08:00' },
    });
    fireEvent.change(within(dialog).getByLabelText(/scheduled end/i), {
      target: { value: '2026-04-20T16:00' },
    });
    fireEvent.change(within(dialog).getByLabelText(/driver id/i), {
      target: { value: V2 },
    });
    fireEvent.change(within(dialog).getByLabelText(/team leader id/i), {
      target: { value: V3 },
    });
    fireEvent.change(within(dialog).getByLabelText(/technician ids/i), {
      target: { value: V4 },
    });

    fireEvent.click(within(dialog).getByRole('button', { name: /create permit/i }));

    await waitFor(() => {
      expect(vi.mocked(apiClient.workPermits.create)).toHaveBeenCalledWith(
        expect.objectContaining({
          permit_type: 'maintenance',
          vehicle_id: V1,
          asset_ids: [V2],
          team: expect.objectContaining({
            driver_id: V2,
            leader_id: V3,
            technician_ids: [V4],
          }),
        })
      );
    });
  });
});
