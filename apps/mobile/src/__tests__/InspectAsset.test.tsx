import React from 'react';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';

// ─── expo-router ─────────────────────────────────────────────────────────────
const mockBack = jest.fn();
const mockUseLocalSearchParams = jest.fn().mockReturnValue({
  assetId: 'asset-1',
  tripId: 'trip-1',
});

jest.mock('expo-router', () => ({
  useRouter: jest.fn().mockReturnValue({ back: mockBack }),
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

// ─── API client ───────────────────────────────────────────────────────────────
const mockAssetsGet = jest.fn();
const mockInspectionsSubmit = jest.fn();

jest.mock('../lib/api', () => ({
  apiClient: {
    assets: { get: (...args: unknown[]) => mockAssetsGet(...args) },
    assetInspections: { submit: (...args: unknown[]) => mockInspectionsSubmit(...args) },
  },
}));

// ─── offline queue service ────────────────────────────────────────────────────
const mockEnqueue = jest.fn().mockResolvedValue(undefined);

jest.mock('../services/offline-queue.service', () => ({
  enqueue: (...args: unknown[]) => mockEnqueue(...args),
  flush: jest.fn().mockResolvedValue(undefined),
  getPendingCount: jest.fn().mockResolvedValue(0),
}));

// ─── crypto.randomUUID polyfill ───────────────────────────────────────────────
Object.defineProperty(global, 'crypto', {
  value: { randomUUID: () => '00000000-0000-0000-0000-000000000099' },
  configurable: true,
});

// Import after mocks are set up
import InspectAssetScreen from '../../app/(app)/inspect/[assetId]';

const MOCK_ASSET = {
  id: 'asset-1',
  asset_code: 'TWR-001',
  asset_type: 'hv_tower',
  name: 'Tower Alpha',
  latitude: 31.95,
  longitude: 35.91,
  metadata: { condition: 'fair', temperature: '30C' },
  is_active: true,
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const MOCK_ASSET_NO_METADATA = {
  ...MOCK_ASSET,
  id: 'asset-2',
  metadata: {},
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLocalSearchParams.mockReturnValue({ assetId: 'asset-1', tripId: 'trip-1' });
  mockAssetsGet.mockResolvedValue({ success: true, data: MOCK_ASSET });
  mockInspectionsSubmit.mockResolvedValue({ success: true, data: { id: 'insp-1' } });
  mockEnqueue.mockResolvedValue(undefined);
});

describe('InspectAssetScreen', () => {
  it('shows loading indicator while asset is being fetched', () => {
    mockAssetsGet.mockReturnValue(new Promise(() => {}));
    const { getByTestId } = render(<InspectAssetScreen />);
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  it('renders asset name, code, and type after loading', async () => {
    render(<InspectAssetScreen />);

    await waitFor(() => {
      expect(screen.getByText('Tower Alpha')).toBeTruthy();
    });

    expect(screen.getByText('TWR-001')).toBeTruthy();
    expect(screen.getByText('hv tower')).toBeTruthy();
  });

  it('renders a text input for each metadata field', async () => {
    render(<InspectAssetScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('field-input-condition')).toBeTruthy();
    });

    expect(screen.getByTestId('field-input-temperature')).toBeTruthy();
  });

  it('pre-fills inputs with current metadata values', async () => {
    render(<InspectAssetScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('field-input-condition')).toBeTruthy();
    });

    const conditionInput = screen.getByTestId('field-input-condition');
    expect(conditionInput.props.value).toBe('fair');
  });

  it('shows default condition and notes fields when asset has no metadata', async () => {
    mockUseLocalSearchParams.mockReturnValue({ assetId: 'asset-2', tripId: 'trip-1' });
    mockAssetsGet.mockResolvedValue({ success: true, data: MOCK_ASSET_NO_METADATA });

    render(<InspectAssetScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('field-input-condition')).toBeTruthy();
    });
    expect(screen.getByTestId('field-input-notes')).toBeTruthy();
  });

  it('renders all four status chips', async () => {
    render(<InspectAssetScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('status-chip-open')).toBeTruthy();
    });

    expect(screen.getByTestId('status-chip-pending')).toBeTruthy();
    expect(screen.getByTestId('status-chip-incomplete')).toBeTruthy();
    expect(screen.getByTestId('status-chip-deferred')).toBeTruthy();
  });

  it('does not show incomplete reason section by default', async () => {
    render(<InspectAssetScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('status-chip-open')).toBeTruthy();
    });

    expect(screen.queryByTestId('reason-chip-safety_hazard')).toBeNull();
  });

  it('shows incomplete reason chips when incomplete status is selected', async () => {
    render(<InspectAssetScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('status-chip-incomplete')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('status-chip-incomplete'));

    expect(screen.getByTestId('reason-chip-safety_hazard')).toBeTruthy();
    expect(screen.getByTestId('reason-chip-device_failure')).toBeTruthy();
    expect(screen.getByTestId('reason-chip-access_restricted')).toBeTruthy();
    expect(screen.getByTestId('reason-chip-equipment_missing')).toBeTruthy();
  });

  it('hides incomplete reason section when status is changed back to open', async () => {
    render(<InspectAssetScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('status-chip-incomplete')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('status-chip-incomplete'));
    expect(screen.getByTestId('reason-chip-safety_hazard')).toBeTruthy();

    fireEvent.press(screen.getByTestId('status-chip-open'));
    expect(screen.queryByTestId('reason-chip-safety_hazard')).toBeNull();
  });

  it('submits inspection with correct payload', async () => {
    render(<InspectAssetScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('field-input-condition')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByTestId('field-input-condition'), 'good');
    fireEvent.press(screen.getByTestId('submit-inspection-button'));

    await waitFor(() => {
      expect(mockInspectionsSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          trip_id: 'trip-1',
          asset_id: 'asset-1',
          status: 'open',
          form_data: expect.objectContaining({ condition: 'good' }),
          idempotency_key: '00000000-0000-0000-0000-000000000099',
        })
      );
    });
  });

  it('shows error message when incomplete status is submitted without reason', async () => {
    render(<InspectAssetScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('status-chip-incomplete')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('status-chip-incomplete'));
    fireEvent.press(screen.getByTestId('submit-inspection-button'));

    await waitFor(() => {
      expect(screen.getByText(/please select a reason/i)).toBeTruthy();
    });
    expect(mockInspectionsSubmit).not.toHaveBeenCalled();
  });

  it('includes incomplete_reason in payload when provided', async () => {
    render(<InspectAssetScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('status-chip-incomplete')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('status-chip-incomplete'));
    fireEvent.press(screen.getByTestId('reason-chip-device_failure'));
    fireEvent.press(screen.getByTestId('submit-inspection-button'));

    await waitFor(() => {
      expect(mockInspectionsSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'incomplete',
          incomplete_reason: 'device_failure',
        })
      );
    });
  });

  it('queues inspection offline when submit fails and network is unavailable', async () => {
    mockInspectionsSubmit.mockRejectedValueOnce(new Error('Network error'));

    render(<InspectAssetScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('submit-inspection-button')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('submit-inspection-button'));
    });

    await waitFor(() => {
      expect(mockEnqueue).toHaveBeenCalledWith(
        'inspection_submit',
        expect.objectContaining({ asset_id: 'asset-1', trip_id: 'trip-1' }),
      );
    });
  });

  it('shows error text when submit and enqueue both fail', async () => {
    mockInspectionsSubmit.mockRejectedValueOnce(new Error('Network error'));
    mockEnqueue.mockRejectedValueOnce(new Error('Storage full'));

    render(<InspectAssetScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('submit-inspection-button')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('submit-inspection-button'));
    });

    await waitFor(() => {
      expect(screen.getByText(/failed to submit/i)).toBeTruthy();
    });
  });

  it('shows not found message when asset fetch fails', async () => {
    mockAssetsGet.mockRejectedValueOnce(new Error('Not found'));

    render(<InspectAssetScreen />);

    await waitFor(() => {
      expect(screen.getByText(/asset not found/i)).toBeTruthy();
    });
  });
});
