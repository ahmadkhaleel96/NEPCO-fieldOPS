import '@testing-library/jest-native/extend-expect';

// ─── expo-location ────────────────────────────────────────────────────────────
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestBackgroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: 31.95, longitude: 35.91, accuracy: 10 },
    timestamp: Date.now(),
  }),
  watchPositionAsync: jest.fn().mockResolvedValue({ remove: jest.fn() }),
  Accuracy: { High: 5, Balanced: 3, Low: 1 },
}));

// ─── expo-secure-store ────────────────────────────────────────────────────────
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
}));

// ─── expo-splash-screen ───────────────────────────────────────────────────────
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

// ─── expo-router ─────────────────────────────────────────────────────────────
jest.mock('expo-router', () => ({
  useRouter: jest.fn().mockReturnValue({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: jest.fn().mockReturnValue({ id: 'permit-1' }),
  Link: ({ children }: { children: React.ReactNode }) => children,
  Tabs: ({ children }: { children: React.ReactNode }) => children,
  Stack: ({ children }: { children: React.ReactNode }) => children,
}));

// ─── react-native-url-polyfill ────────────────────────────────────────────────
jest.mock('react-native-url-polyfill/auto', () => {});

// ─── supabase ─────────────────────────────────────────────────────────────────
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: jest.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
      signOut: jest.fn().mockResolvedValue({}),
    },
  },
}));

// ─── api client ───────────────────────────────────────────────────────────────
jest.mock('../../lib/api', () => ({
  apiClient: {
    workPermits: {
      list: jest.fn().mockResolvedValue({
        success: true,
        data: [],
        pagination: { total: 0, page: 1, per_page: 50, total_pages: 0 },
      }),
      get: jest.fn(),
      create: jest.fn(),
      withdraw: jest.fn(),
    },
    trips: {
      start: jest.fn(),
      postLocations: jest.fn(),
      getTrack: jest.fn(),
      end: jest.fn(),
    },
    nfcEvents: {
      recordArrival: jest.fn(),
    },
  },
  syncApiToken: jest.fn().mockResolvedValue(undefined),
}));

// ─── NFC service ──────────────────────────────────────────────────────────────
jest.mock('../../services/nfc.service', () => ({
  scanNfcTag: jest.fn().mockResolvedValue({ tag_id: 'MOCK-TAG-ID' }),
  isNfcSupported: jest.fn().mockResolvedValue(true),
  NfcError: class NfcError extends Error {
    constructor(message: string, public readonly code: string) {
      super(message);
      this.name = 'NfcError';
    }
  },
}));

// ─── location service ─────────────────────────────────────────────────────────
jest.mock('../../services/location.service', () => ({
  startTracking: jest.fn().mockResolvedValue(undefined),
  stopTracking: jest.fn().mockResolvedValue(undefined),
  isTracking: jest.fn().mockReturnValue(false),
  getPendingCount: jest.fn().mockReturnValue(0),
  requestLocationPermissions: jest.fn().mockResolvedValue(true),
  getCurrentPosition: jest.fn().mockResolvedValue({ lat: 31.95, lng: 35.91 }),
}));

// ─── offline queue service ────────────────────────────────────────────────────
jest.mock('../../services/offline-queue.service', () => ({
  enqueue: jest.fn().mockResolvedValue(undefined),
  flush: jest.fn().mockResolvedValue(undefined),
  getPendingCount: jest.fn().mockResolvedValue(0),
}));

// ─── expo-file-system ─────────────────────────────────────────────────────────
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///test/',
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false }),
  readAsStringAsync: jest.fn().mockResolvedValue('[]'),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
}));

// ─── @react-native-community/netinfo ─────────────────────────────────────────
jest.mock('@react-native-community/netinfo', () => ({
  default: {
    addEventListener: jest.fn().mockReturnValue(jest.fn()),
    fetch: jest.fn().mockResolvedValue({ isConnected: true }),
  },
  addEventListener: jest.fn().mockReturnValue(jest.fn()),
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
}));
