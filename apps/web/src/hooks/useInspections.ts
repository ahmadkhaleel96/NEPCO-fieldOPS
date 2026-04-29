import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApprovalStatus, ReviewChangePayload } from '@fieldops/api-client';
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
