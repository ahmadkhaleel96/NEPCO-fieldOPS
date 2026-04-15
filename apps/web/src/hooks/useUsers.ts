import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateUserPayload, UpdateUserPayload } from '@fieldops/api-client';
import { apiClient } from '../lib/api-client';

const USERS_KEY = 'users';

export function useUsers(page = 1, perPage = 20) {
  return useQuery({
    queryKey: [USERS_KEY, page, perPage],
    queryFn: () => apiClient.users.list({ page, per_page: perPage }),
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: [USERS_KEY, id],
    queryFn: () => apiClient.users.get(id),
    enabled: Boolean(id),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => apiClient.users.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [USERS_KEY] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateUserPayload & { id: string }) =>
      apiClient.users.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [USERS_KEY] }),
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.users.deactivate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [USERS_KEY] }),
  });
}
