import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { VehiclesPage } from '../../pages/VehiclesPage';
import type { ApiClientVehicle } from '@fieldops/api-client';

const { apiClient } = await import('../../lib/api-client');

const MOCK_VEHICLE: ApiClientVehicle = {
  id: 'v-1',
  vehicle_code: 'VH-001',
  plate_number: 'ABC-1234',
  model: 'Toyota Land Cruiser',
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
        <VehiclesPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('VehiclesPage', () => {
  it('shows loading state initially', () => {
    vi.mocked(apiClient.vehicles.list).mockReturnValueOnce(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('renders the vehicle table when data is loaded', async () => {
    vi.mocked(apiClient.vehicles.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_VEHICLE],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });

    renderPage();

    expect(await screen.findByText('Toyota Land Cruiser')).toBeInTheDocument();
    expect(screen.getByText('VH-001')).toBeInTheDocument();
    expect(screen.getByText('ABC-1234')).toBeInTheDocument();
  });

  it('shows empty state when no vehicles', async () => {
    vi.mocked(apiClient.vehicles.list).mockResolvedValueOnce({
      success: true,
      data: [],
      pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
    });

    renderPage();
    expect(await screen.findByText(/no vehicles found/i)).toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    vi.mocked(apiClient.vehicles.list).mockRejectedValueOnce(new Error('Network error'));
    renderPage();
    expect(await screen.findByText(/failed to load vehicles/i)).toBeInTheDocument();
  });

  it('opens create vehicle modal when Create vehicle button is clicked', async () => {
    vi.mocked(apiClient.vehicles.list).mockResolvedValueOnce({
      success: true,
      data: [],
      pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
    });

    renderPage();
    await screen.findByText(/no vehicles found/i);

    fireEvent.click(screen.getByRole('button', { name: /create vehicle/i }));
    expect(screen.getByRole('dialog', { name: /create vehicle/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/vehicle code/i)).toBeInTheDocument();
  });

  it('opens edit modal when Edit is clicked', async () => {
    vi.mocked(apiClient.vehicles.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_VEHICLE],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });

    renderPage();
    await screen.findByText('Toyota Land Cruiser');

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('dialog', { name: /edit vehicle/i })).toBeInTheDocument();
  });

  it('shows deactivate confirmation when Deactivate is clicked', async () => {
    vi.mocked(apiClient.vehicles.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_VEHICLE],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });

    renderPage();
    await screen.findByText('Toyota Land Cruiser');

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    const dialog = screen.getByRole('dialog', { name: /deactivate vehicle/i });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/VH-001/)).toBeInTheDocument();
  });

  it('calls deactivate API and closes dialog on confirm', async () => {
    vi.mocked(apiClient.vehicles.list).mockResolvedValue({
      success: true,
      data: [MOCK_VEHICLE],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });
    vi.mocked(apiClient.vehicles.deactivate).mockResolvedValueOnce({
      success: true,
      data: { ...MOCK_VEHICLE, is_active: false },
    });

    renderPage();
    await screen.findByText('Toyota Land Cruiser');
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    const dialog = screen.getByRole('dialog', { name: /deactivate vehicle/i });
    fireEvent.click(within(dialog).getByRole('button', { name: /^deactivate$/i }));

    await waitFor(() => {
      expect(vi.mocked(apiClient.vehicles.deactivate)).toHaveBeenCalledWith('v-1');
    });
  });
});
