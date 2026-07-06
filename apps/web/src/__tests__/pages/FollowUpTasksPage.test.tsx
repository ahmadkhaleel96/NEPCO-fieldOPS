import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { FollowUpTasksPage } from '../../pages/FollowUpTasksPage';
import type { ApiClientFollowUpTask } from '@fieldops/api-client';

const { apiClient } = await import('../../lib/api-client');

const V_TASK1 = 'aaaaaaaa-0000-0000-0000-000000000001';
const V_TASK2 = 'bbbbbbbb-0000-0000-0000-000000000002';
const V_ASSET1 = 'cccccccc-0000-0000-0000-000000000003';
const V_ASSET2 = 'dddddddd-0000-0000-0000-000000000004';
const V_INSP1 = 'eeeeeeee-0000-0000-0000-000000000005';

const MOCK_TASK_PENDING: ApiClientFollowUpTask = {
  id: V_TASK1,
  inspection_id: V_INSP1,
  asset_id: V_ASSET1,
  assigned_to: null,
  partial_form_data: { condition: 'fair' },
  notes: null,
  resolved_at: null,
  created_at: '2026-04-22T08:00:00.000Z',
  updated_at: '2026-04-22T08:00:00.000Z',
};

const MOCK_TASK_RESOLVED: ApiClientFollowUpTask = {
  id: V_TASK2,
  inspection_id: V_INSP1,
  asset_id: V_ASSET2,
  assigned_to: null,
  partial_form_data: {},
  notes: 'Completed on follow-up visit',
  resolved_at: '2026-04-22T14:00:00.000Z',
  created_at: '2026-04-22T08:00:00.000Z',
  updated_at: '2026-04-22T14:00:00.000Z',
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <FollowUpTasksPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FollowUpTasksPage', () => {
  it('shows loading state initially', () => {
    vi.mocked(apiClient.followUpTasks.list).mockReturnValueOnce(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    vi.mocked(apiClient.followUpTasks.list).mockRejectedValueOnce(new Error('Network error'));
    renderPage();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  });

  it('shows empty state when no pending tasks', async () => {
    vi.mocked(apiClient.followUpTasks.list).mockResolvedValueOnce({
      success: true,
      data: [],
      pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
    });

    renderPage();
    expect(await screen.findByText(/no pending follow-up tasks/i)).toBeInTheDocument();
  });

  it('renders a table row for each task', async () => {
    vi.mocked(apiClient.followUpTasks.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_TASK_PENDING, MOCK_TASK_RESOLVED],
      pagination: { total: 2, page: 1, per_page: 20, total_pages: 1 },
    });

    renderPage();
    await screen.findByText(`${V_ASSET1.slice(0, 8)}…`);
    expect(screen.getByText(`${V_ASSET2.slice(0, 8)}…`)).toBeInTheDocument();
  });

  it('shows Resolve button only for pending tasks', async () => {
    vi.mocked(apiClient.followUpTasks.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_TASK_PENDING, MOCK_TASK_RESOLVED],
      pagination: { total: 2, page: 1, per_page: 20, total_pages: 1 },
    });

    renderPage();
    await screen.findByText(`${V_ASSET1.slice(0, 8)}…`);

    expect(screen.getAllByRole('button', { name: /resolve task/i })).toHaveLength(1);
  });

  it('shows pending/resolved status badges correctly', async () => {
    vi.mocked(apiClient.followUpTasks.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_TASK_PENDING, MOCK_TASK_RESOLVED],
      pagination: { total: 2, page: 1, per_page: 20, total_pages: 1 },
    });

    renderPage();
    await screen.findByText('pending');
    expect(screen.getByText('resolved')).toBeInTheDocument();
  });

  it('opens resolve dialog when Resolve button is clicked', async () => {
    vi.mocked(apiClient.followUpTasks.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_TASK_PENDING],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });

    renderPage();
    await screen.findByText(`${V_ASSET1.slice(0, 8)}…`);

    fireEvent.click(screen.getByRole('button', { name: /resolve task/i }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/resolve task/i)).toBeInTheDocument();
  });

  it('closes dialog without calling API when Cancel is clicked', async () => {
    vi.mocked(apiClient.followUpTasks.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_TASK_PENDING],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });

    renderPage();
    await screen.findByText(`${V_ASSET1.slice(0, 8)}…`);

    fireEvent.click(screen.getByRole('button', { name: /resolve task/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(vi.mocked(apiClient.followUpTasks.resolve)).not.toHaveBeenCalled();
  });

  it('calls resolve API with notes and closes dialog on success', async () => {
    vi.mocked(apiClient.followUpTasks.list).mockResolvedValue({
      success: true,
      data: [MOCK_TASK_PENDING],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });
    vi.mocked(apiClient.followUpTasks.resolve).mockResolvedValueOnce({
      success: true,
      data: { ...MOCK_TASK_PENDING, resolved_at: '2026-04-22T14:00:00.000Z', notes: 'Fixed' },
    });

    renderPage();
    await screen.findByText(`${V_ASSET1.slice(0, 8)}…`);

    fireEvent.click(screen.getByRole('button', { name: /resolve task/i }));
    const dialog = screen.getByRole('dialog');

    fireEvent.change(within(dialog).getByPlaceholderText(/resolution notes/i), {
      target: { value: 'Fixed' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /^resolve$/i }));

    await waitFor(() => {
      expect(vi.mocked(apiClient.followUpTasks.resolve)).toHaveBeenCalledWith(V_TASK1, {
        notes: 'Fixed',
      });
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('filters by resolved status when dropdown changes', async () => {
    vi.mocked(apiClient.followUpTasks.list).mockResolvedValue({
      success: true,
      data: [],
      pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
    });

    renderPage();
    await screen.findByText(/no pending follow-up tasks/i);

    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: 'true' } });

    await waitFor(() => {
      expect(vi.mocked(apiClient.followUpTasks.list)).toHaveBeenCalledWith(
        expect.objectContaining({ resolved: true })
      );
    });
  });

  it('shows generic empty text when All filter selected and no results', async () => {
    vi.mocked(apiClient.followUpTasks.list).mockResolvedValue({
      success: true,
      data: [],
      pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
    });

    renderPage();
    await screen.findByText(/no pending follow-up tasks/i);

    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: '' } });

    await waitFor(() => {
      expect(screen.getByText(/no tasks found/i)).toBeInTheDocument();
    });
  });
});
