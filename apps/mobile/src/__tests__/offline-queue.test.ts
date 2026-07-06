import { enqueue, flush, getPendingCount } from '../services/offline-queue.service';

const mockGetInfoAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockWriteAsStringAsync = jest.fn();

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///test/',
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
  writeAsStringAsync: (...args: unknown[]) => mockWriteAsStringAsync(...args),
}));

const mockRecordArrival = jest.fn();
const mockSubmitInspection = jest.fn();

const fakeClient = {
  nfcEvents: { recordArrival: mockRecordArrival },
  assetInspections: { submit: mockSubmitInspection },
} as never;

function seedQueue(items: object[]) {
  mockGetInfoAsync.mockResolvedValue({ exists: true });
  mockReadAsStringAsync.mockResolvedValue(JSON.stringify(items));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetInfoAsync.mockResolvedValue({ exists: false });
  mockReadAsStringAsync.mockResolvedValue('[]');
  mockWriteAsStringAsync.mockResolvedValue(undefined);
});

describe('enqueue', () => {
  it('creates queue file with first operation', async () => {
    await enqueue('nfc_arrival', { tag_id: 'T1', trip_id: 'trip-1' });
    expect(mockWriteAsStringAsync).toHaveBeenCalledTimes(1);
    const written = JSON.parse(mockWriteAsStringAsync.mock.calls[0][1] as string) as object[];
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({ type: 'nfc_arrival', payload: { tag_id: 'T1', trip_id: 'trip-1' }, attempts: 0 });
  });

  it('appends to existing queue', async () => {
    seedQueue([{ id: 'op-1', type: 'nfc_arrival', payload: {}, created_at: 0, attempts: 0 }]);
    await enqueue('inspection_submit', { asset_id: 'a-1' });
    const written = JSON.parse(mockWriteAsStringAsync.mock.calls[0][1] as string) as object[];
    expect(written).toHaveLength(2);
  });

  it('returns 0 when queue file does not exist', async () => {
    expect(await getPendingCount()).toBe(0);
  });

  it('returns count of pending items', async () => {
    seedQueue([
      { id: 'op-1', type: 'nfc_arrival', payload: {}, created_at: 0, attempts: 0 },
      { id: 'op-2', type: 'inspection_submit', payload: {}, created_at: 0, attempts: 0 },
    ]);
    expect(await getPendingCount()).toBe(2);
  });
});

describe('flush', () => {
  it('does nothing when queue is empty', async () => {
    await flush(fakeClient);
    expect(mockRecordArrival).not.toHaveBeenCalled();
    expect(mockSubmitInspection).not.toHaveBeenCalled();
  });

  it('dispatches nfc_arrival and removes on success', async () => {
    seedQueue([{ id: 'op-1', type: 'nfc_arrival', payload: { tag_id: 'T1' }, created_at: 0, attempts: 0 }]);
    mockRecordArrival.mockResolvedValue({});
    await flush(fakeClient);
    expect(mockRecordArrival).toHaveBeenCalledWith({ tag_id: 'T1' });
    const remaining = JSON.parse(mockWriteAsStringAsync.mock.calls[0][1] as string) as object[];
    expect(remaining).toHaveLength(0);
  });

  it('dispatches inspection_submit and removes on success', async () => {
    seedQueue([{ id: 'op-2', type: 'inspection_submit', payload: { asset_id: 'a-1' }, created_at: 0, attempts: 0 }]);
    mockSubmitInspection.mockResolvedValue({});
    await flush(fakeClient);
    expect(mockSubmitInspection).toHaveBeenCalledWith({ asset_id: 'a-1' });
    const remaining = JSON.parse(mockWriteAsStringAsync.mock.calls[0][1] as string) as object[];
    expect(remaining).toHaveLength(0);
  });

  it('retains failed operation with incremented attempts', async () => {
    seedQueue([{ id: 'op-3', type: 'nfc_arrival', payload: { tag_id: 'T2' }, created_at: 0, attempts: 0 }]);
    mockRecordArrival.mockRejectedValue(new Error('network error'));
    await flush(fakeClient);
    const remaining = JSON.parse(mockWriteAsStringAsync.mock.calls[0][1] as string) as Array<{ attempts: number }>;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].attempts).toBe(1);
  });

  it('drops operation after MAX_ATTEMPTS (5) failures', async () => {
    seedQueue([{ id: 'op-4', type: 'nfc_arrival', payload: {}, created_at: 0, attempts: 4 }]);
    mockRecordArrival.mockRejectedValue(new Error('network error'));
    await flush(fakeClient);
    const remaining = JSON.parse(mockWriteAsStringAsync.mock.calls[0][1] as string) as object[];
    expect(remaining).toHaveLength(0);
  });

  it('processes multiple operations and keeps only failures', async () => {
    seedQueue([
      { id: 'op-5', type: 'nfc_arrival', payload: { tag_id: 'ok' }, created_at: 0, attempts: 0 },
      { id: 'op-6', type: 'inspection_submit', payload: { asset_id: 'fail' }, created_at: 0, attempts: 0 },
    ]);
    mockRecordArrival.mockResolvedValue({});
    mockSubmitInspection.mockRejectedValue(new Error('offline'));
    await flush(fakeClient);
    const remaining = JSON.parse(mockWriteAsStringAsync.mock.calls[0][1] as string) as Array<{ id: string }>;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('op-6');
  });
});
