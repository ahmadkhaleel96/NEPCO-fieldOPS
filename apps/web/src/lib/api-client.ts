import { ApiClient } from '@fieldops/api-client';

export const apiClient = new ApiClient({
  baseUrl: import.meta.env['VITE_API_URL'] ?? '/api',
});
