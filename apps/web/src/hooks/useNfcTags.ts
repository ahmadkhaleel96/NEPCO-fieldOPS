import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProvisionNfcTagPayload, ConfirmInstallPayload, NfcTagStatus } from '@fieldops/api-client';
import { apiClient } from '../lib/api-client';

export function useNfcTags(params?: { page?: number; per_page?: number; status?: NfcTagStatus }) {
  return useQuery({
    queryKey: ['nfc-tags', params],
    queryFn: () => apiClient.nfcTags.list(params),
  });
}

export function useProvisionNfcTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProvisionNfcTagPayload) => apiClient.nfcTags.provision(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['nfc-tags'] });
    },
  });
}

export function useConfirmInstall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ConfirmInstallPayload }) =>
      apiClient.nfcTags.confirmInstall(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['nfc-tags'] });
    },
  });
}
