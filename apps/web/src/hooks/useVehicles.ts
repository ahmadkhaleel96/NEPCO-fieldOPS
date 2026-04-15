import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateVehiclePayload, UpdateVehiclePayload } from '@fieldops/api-client';
import { apiClient } from '../lib/api-client';

export function useVehicles(params?: { page?: number; per_page?: number }) {
  return useQuery({
    queryKey: ['vehicles', params],
    queryFn: () => apiClient.vehicles.list(params),
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateVehiclePayload) => apiClient.vehicles.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateVehiclePayload }) =>
      apiClient.vehicles.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}

export function useDeactivateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.vehicles.deactivate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}
