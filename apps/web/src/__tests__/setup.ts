import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

// ─── react-router-dom mock ─────────────────────────────────────────────────
// react-router-dom lives in root/node_modules and uses root react@18.2.0,
// while react-dom is in apps/web/node_modules at 18.3.1.
// The dispatcher mismatch causes "Cannot read properties of null (reading 'useRef')".
// Mock every import used in the app so no real react-router code runs in tests.
vi.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  MemoryRouter: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  Routes: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  Route: ({ element }: { element?: React.ReactNode }) => element ?? null,
  NavLink: ({
    children,
    className,
    to,
  }: {
    children: React.ReactNode;
    className?: unknown;
    to: string;
  }) =>
    React.createElement(
      'a',
      {
        href: to,
        className:
          typeof className === 'function'
            ? (className as (s: { isActive: boolean }) => string)({ isActive: false })
            : className,
      },
      children
    ),
  Navigate: () => null,
  Outlet: () => null,
}));

// Mock Supabase — no live connection in unit tests
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signOut: vi.fn().mockResolvedValue({}),
    },
  },
}));

// Mock API client — no network calls in unit tests
vi.mock('../lib/api-client', () => ({
  apiClient: {
    workPermits: {
      list: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
      }),
      get: vi.fn(),
      create: vi.fn(),
      withdraw: vi.fn(),
    },
    nfcTags: {
      list: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
      }),
      get: vi.fn(),
      provision: vi.fn(),
      confirmInstall: vi.fn(),
    },
    vehicles: {
      list: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
      }),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deactivate: vi.fn(),
    },
    assets: {
      list: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
      }),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deactivate: vi.fn(),
    },
    users: {
      list: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
      }),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deactivate: vi.fn(),
    },
    assetChanges: {
      list: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
      }),
      review: vi.fn(),
    },
    assetInspections: {
      list: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
      }),
      get: vi.fn(),
      submit: vi.fn(),
    },
    followUpTasks: {
      list: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
      }),
      get: vi.fn(),
      resolve: vi.fn(),
    },
    safetyReports: {
      list: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
      }),
      get: vi.fn(),
    },
  },
}));

// Mock import.meta.env
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
