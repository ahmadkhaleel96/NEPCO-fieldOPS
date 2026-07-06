import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ReportsPage } from '../../pages/ReportsPage';
import type { ApiClientReportListItem } from '@fieldops/api-client';

const { apiClient } = await import('../../lib/api-client');

const V_REPORT1 = 'aaaaaaaa-0000-0000-0000-000000000001';
const V_REPORT2 = 'bbbbbbbb-0000-0000-0000-000000000002';

const MOCK_REPORT_MONTHLY: ApiClientReportListItem = {
  id: V_REPORT1,
  cadence: 'monthly',
  period_start: '2026-04-01T00:00:00.000Z',
  period_end: '2026-04-30T23:59:59.000Z',
  sha256: 'abcdef1234567890'.repeat(4),
  pdf_url: null,
  csv_sent_at: null,
  generated_at: '2026-05-01T00:00:00.000Z',
};

const MOCK_REPORT_WEEKLY: ApiClientReportListItem = {
  id: V_REPORT2,
  cadence: 'weekly',
  period_start: '2026-04-21T00:00:00.000Z',
  period_end: '2026-04-27T23:59:59.000Z',
  sha256: 'fedcba0987654321'.repeat(4),
  pdf_url: 'https://cdn.example.com/reports/RPT-abc.pdf',
  csv_sent_at: '2026-04-28T06:00:00.000Z',
  generated_at: '2026-04-28T00:00:00.000Z',
};

function renderPage(userRole = 'engineer') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ReportsPage userRole={userRole} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ReportsPage', () => {
  it('shows loading state initially', () => {
    vi.mocked(apiClient.reports.list).mockReturnValueOnce(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    vi.mocked(apiClient.reports.list).mockRejectedValueOnce(new Error('Network error'));
    renderPage();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  });

  it('shows empty state when no reports', async () => {
    vi.mocked(apiClient.reports.list).mockResolvedValueOnce({
      success: true,
      data: [],
      pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
    });
    renderPage();
    expect(await screen.findByText(/no reports found/i)).toBeInTheDocument();
  });

  it('renders a row for each report', async () => {
    vi.mocked(apiClient.reports.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_REPORT_MONTHLY, MOCK_REPORT_WEEKLY],
      pagination: { total: 2, page: 1, per_page: 20, total_pages: 1 },
    });
    renderPage();
    await screen.findByRole('table');
    expect(screen.getAllByRole('button', { name: /verify report/i })).toHaveLength(2);
  });

  it('shows PDF link when pdf_url is set', async () => {
    vi.mocked(apiClient.reports.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_REPORT_WEEKLY],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });
    renderPage();
    await screen.findByRole('table');
    const link = screen.getByRole('link', { name: /pdf/i });
    expect(link).toHaveAttribute('href', MOCK_REPORT_WEEKLY.pdf_url!);
  });

  it('shows truncated SHA-256 hash', async () => {
    vi.mocked(apiClient.reports.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_REPORT_MONTHLY],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });
    renderPage();
    await screen.findByRole('table');
    expect(screen.getByText(`${MOCK_REPORT_MONTHLY.sha256.slice(0, 12)}…`)).toBeInTheDocument();
  });

  it('shows Verify button for each report', async () => {
    vi.mocked(apiClient.reports.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_REPORT_MONTHLY, MOCK_REPORT_WEEKLY],
      pagination: { total: 2, page: 1, per_page: 20, total_pages: 1 },
    });
    renderPage();
    await screen.findByRole('table');
    expect(screen.getAllByRole('button', { name: /verify report/i })).toHaveLength(2);
  });

  it('does NOT show Generate Report button for engineer', async () => {
    vi.mocked(apiClient.reports.list).mockResolvedValueOnce({
      success: true,
      data: [],
      pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
    });
    renderPage('engineer');
    await screen.findByText(/no reports found/i);
    expect(screen.queryByRole('button', { name: /generate new report/i })).not.toBeInTheDocument();
  });

  it('shows Generate Report button for admin', async () => {
    vi.mocked(apiClient.reports.list).mockResolvedValueOnce({
      success: true,
      data: [],
      pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
    });
    renderPage('admin');
    await screen.findByText(/no reports found/i);
    expect(screen.getByRole('button', { name: /generate new report/i })).toBeInTheDocument();
  });

  it('opens generate dialog when Generate Report is clicked', async () => {
    vi.mocked(apiClient.reports.list).mockResolvedValueOnce({
      success: true,
      data: [],
      pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
    });
    renderPage('admin');
    await screen.findByText(/no reports found/i);

    fireEvent.click(screen.getByRole('button', { name: /generate new report/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/period start/i)).toBeInTheDocument();
  });

  it('closes dialog when Cancel is clicked', async () => {
    vi.mocked(apiClient.reports.list).mockResolvedValueOnce({
      success: true,
      data: [],
      pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
    });
    renderPage('admin');
    await screen.findByText(/no reports found/i);

    fireEvent.click(screen.getByRole('button', { name: /generate new report/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls verify API and shows OK badge on success', async () => {
    vi.mocked(apiClient.reports.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_REPORT_MONTHLY],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });
    vi.mocked(apiClient.reports.verify).mockResolvedValueOnce({
      success: true,
      data: {
        report_id: V_REPORT1,
        match: true,
        stored_hash: MOCK_REPORT_MONTHLY.sha256,
        actual_hash: MOCK_REPORT_MONTHLY.sha256,
      },
    });

    renderPage();
    await screen.findByRole('table');

    fireEvent.click(screen.getByRole('button', { name: /verify report/i }));

    await waitFor(() => {
      expect(vi.mocked(apiClient.reports.verify)).toHaveBeenCalledWith(V_REPORT1);
    });
    await screen.findByText('OK');
  });

  it('shows MISMATCH badge when hash does not match', async () => {
    vi.mocked(apiClient.reports.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_REPORT_MONTHLY],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });
    vi.mocked(apiClient.reports.verify).mockResolvedValueOnce({
      success: true,
      data: {
        report_id: V_REPORT1,
        match: false,
        stored_hash: MOCK_REPORT_MONTHLY.sha256,
        actual_hash: 'differenthash'.repeat(4),
      },
    });

    renderPage();
    await screen.findByRole('table');

    fireEvent.click(screen.getByRole('button', { name: /verify report/i }));

    await screen.findByText('MISMATCH');
  });

  it('filters by cadence when dropdown changes', async () => {
    vi.mocked(apiClient.reports.list).mockResolvedValue({
      success: true,
      data: [],
      pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
    });

    renderPage();
    await screen.findByText(/no reports found/i);

    fireEvent.change(screen.getByLabelText(/cadence/i), { target: { value: 'monthly' } });

    await waitFor(() => {
      expect(vi.mocked(apiClient.reports.list)).toHaveBeenCalledWith(
        expect.objectContaining({ cadence: 'monthly' })
      );
    });
  });

  it('shows Re-PDF button for admin rows', async () => {
    vi.mocked(apiClient.reports.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_REPORT_MONTHLY],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });
    renderPage('admin');
    await screen.findByRole('table');
    expect(screen.getByRole('button', { name: /regenerate pdf/i })).toBeInTheDocument();
  });

  it('does NOT show Re-PDF button for engineer rows', async () => {
    vi.mocked(apiClient.reports.list).mockResolvedValueOnce({
      success: true,
      data: [MOCK_REPORT_MONTHLY],
      pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });
    renderPage('engineer');
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: /regenerate pdf/i })).not.toBeInTheDocument();
  });
});
