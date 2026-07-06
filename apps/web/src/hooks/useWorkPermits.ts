import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateWorkPermitPayload, WithdrawPermitPayload, WorkPermitStatus } from '@fieldops/api-client';
import { apiClient } from '../lib/api-client';

export function useWorkPermits(params?: { page?: number; per_page?: number; status?: WorkPermitStatus }) {
  return useQuery({
    queryKey: ['workPermits', params],
    queryFn: () => apiClient.workPermits.list(params),
  });
}

export function useCreateWorkPermit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateWorkPermitPayload) => apiClient.workPermits.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workPermits'] });
    },
  });
}

export function useWithdrawPermit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: WithdrawPermitPayload }) =>
      apiClient.workPermits.withdraw(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workPermits'] });
    },
  });
}
