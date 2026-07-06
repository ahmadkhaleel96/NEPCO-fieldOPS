import { useState } from 'react';
import type { ApiClientUser } from '@fieldops/api-client';
import { UserTable } from '../components/users/UserTable';
import { UserFormModal } from '../components/users/UserFormModal';
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeactivateUser,
} from '../hooks/useUsers';
import { supabase } from '../lib/supabase';
import styles from './UsersPage.module.css';

export function UsersPage() {
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; user?: ApiClientUser } | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<ApiClientUser | null>(null);

  const { data, isLoading, error } = useUsers(page);
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deactivateUser = useDeactivateUser();

  const [currentUserId, setCurrentUserId] = useState<string>('');
  useState(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user.id) setCurrentUserId(session.user.id);
    });
  });

  function handleModalSubmit(values: Record<string, unknown>) {
    if (modal?.mode === 'create') {
      createUser.mutate(
        {
          email: values['email'] as string,
          full_name: values['full_name'] as string,
          role: values['role'] as ApiClientUser['role'],
          phone: values['phone'] ? (values['phone'] as string) : undefined,
        },
        { onSuccess: () => setModal(null) }
      );
    } else if (modal?.mode === 'edit' && modal.user) {
      updateUser.mutate(
        {
          id: modal.user.id,
          full_name: values['full_name'] as string,
          role: values['role'] as ApiClientUser['role'],
          phone: (values['phone'] as string) || null,
        },
        { onSuccess: () => setModal(null) }
      );
    }
  }

  function handleDeactivateConfirm() {
    if (!deactivateTarget) return;
    deactivateUser.mutate(deactivateTarget.id, {
      onSuccess: () => setDeactivateTarget(null),
    });
  }

  const users = data?.data ?? [];
  const pagination = data?.pagination;
  const mutationError =
    createUser.error?.message ?? updateUser.error?.message ?? undefined;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Users</h1>
          {pagination && (
            <p className={styles.pageSubtitle}>{pagination.total} total users</p>
          )}
        </div>
        <button
          type="button"
          className={styles.createBtn}
          onClick={() => setModal({ mode: 'create' })}
        >
          + Create user
        </button>
      </div>

      {isLoading && (
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner} role="status" aria-label="Loading users" />
        </div>
      )}

      {error && (
        <div className={styles.errorState} role="alert">
          Failed to load users: {error.message}
        </div>
      )}

      {!isLoading && !error && (
        <>
          <UserTable
            users={users}
            onEdit={(user) => setModal({ mode: 'edit', user })}
            onDeactivate={setDeactivateTarget}
            currentUserId={currentUserId}
          />

          {pagination && pagination.total_pages > 1 && (
            <div className={styles.pagination}>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Previous
              </button>
              <span className={styles.pageInfo}>
                Page {pagination.page} of {pagination.total_pages}
              </span>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={page === pagination.total_pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {modal && (
        <UserFormModal
          mode={modal.mode}
          user={modal.user}
          onSubmit={handleModalSubmit}
          onClose={() => { setModal(null); createUser.reset(); updateUser.reset(); }}
          isSubmitting={createUser.isPending || updateUser.isPending}
          error={mutationError}
        />
      )}

      {deactivateTarget && (
        <div className={styles.confirmOverlay} role="dialog" aria-modal="true" aria-labelledby="deactivate-dialog-title">
          <div className={styles.confirmBox}>
            <h3 id="deactivate-dialog-title" className={styles.confirmTitle}>Deactivate user?</h3>
            <p className={styles.confirmText}>
              <strong>{deactivateTarget.full_name}</strong> will no longer be able to
              sign in. This can be reversed by editing the user.
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setDeactivateTarget(null)}
                disabled={deactivateUser.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.deactivateBtn}
                onClick={handleDeactivateConfirm}
                disabled={deactivateUser.isPending}
              >
                {deactivateUser.isPending ? 'Deactivating…' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
