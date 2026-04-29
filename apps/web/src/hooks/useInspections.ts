import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApprovalStatus, ReviewChangePayload, ResolveFollowUpTaskPayload } from '@fieldops/api-client';
import { apiClient } from '../lib/api-client';

export function useAssetChanges(params?: {
  page?: number;
  per_page?: number;
  status?: ApprovalStatus;
  asset_id?: string;
}) {
  return useQuery({
    queryKey: ['assetChanges', params],
    queryFn: () => apiClient.assetChanges.list(params),
  });
}

export function useReviewChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReviewChangePayload }) =>
      apiClient.assetChanges.review(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assetChanges'] });
    },
  });
}

export function useAssetInspections(params?: {
  page?: number;
  per_page?: number;
  trip_id?: string;
}) {
  return useQuery({
    queryKey: ['assetInspections', params],
    queryFn: () => apiClient.assetInspections.list(params),
  });
}

export function useFollowUpTasks(params?: {
  page?: number;
  per_page?: number;
  asset_id?: string;
  resolved?: boolean;
}) {
  return useQuery({
    queryKey: ['followUpTasks', params],
    queryFn: () => apiClient.followUpTasks.list(params),
  });
}

export function useResolveFollowUpTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ResolveFollowUpTaskPayload }) =>
      apiClient.followUpTasks.resolve(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['followUpTasks'] });
    },
  });
}

export function useSafetyReports(params?: {
  page?: number;
  per_page?: number;
  trip_id?: string;
}) {
  return useQuery({
    queryKey: ['safetyReports', params],
    queryFn: () => apiClient.safetyReports.list(params),
  });
}
