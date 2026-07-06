import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateAssetPayload, UpdateAssetPayload, AssetType } from '@fieldops/api-client';
import { apiClient } from '../lib/api-client';

export function useAssets(params?: { page?: number; per_page?: number; asset_type?: AssetType }) {
  return useQuery({
    queryKey: ['assets', params],
    queryFn: () => apiClient.assets.list(params),
  });
}

export function useAsset(id: string) {
  return useQuery({
    queryKey: ['assets', id],
    queryFn: () => apiClient.assets.get(id),
    enabled: !!id,
  });
}

export function useCreateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAssetPayload) => apiClient.assets.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

export function useUpdateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateAssetPayload }) =>
      apiClient.assets.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

export function useDeactivateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.assets.deactivate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}
