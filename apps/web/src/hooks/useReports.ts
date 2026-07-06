import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReportCadence, GenerateReportPayload } from '@fieldops/api-client';
import { apiClient } from '../lib/api-client';

export function useReports(params?: { page?: number; per_page?: number; cadence?: ReportCadence }) {
  return useQuery({
    queryKey: ['reports', params],
    queryFn: () => apiClient.reports.list(params),
  });
}

export function useReport(id: string) {
  return useQuery({
    queryKey: ['report', id],
    queryFn: () => apiClient.reports.get(id),
    enabled: Boolean(id),
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: GenerateReportPayload) => apiClient.reports.generate(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useVerifyReport() {
  return useMutation({
    mutationFn: (id: string) => apiClient.reports.verify(id),
  });
}

export function useRegeneratePdf() {
  return useMutation({
    mutationFn: (id: string) => apiClient.reports.regeneratePdf(id),
  });
}
