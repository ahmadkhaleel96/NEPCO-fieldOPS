import { useState } from 'react';
import type { ApiClientWorkPermit, CreateWorkPermitPayload } from '@fieldops/api-client';
import { useWorkPermits, useCreateWorkPermit, useWithdrawPermit } from '../hooks/useWorkPermits';
import { WorkPermitTable } from '../components/work-permits/WorkPermitTable';
import { WorkPermitFormModal } from '../components/work-permits/WorkPermitFormModal';
import styles from './WorkPermitsPage.module.css';

export function WorkPermitsPage() {
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [withdrawTarget, setWithdrawTarget] = useState<ApiClientWorkPermit | null>(null);
  const [withdrawReason, setWithdrawReason] = useState('');

  const { data, isLoading, isError } = useWorkPermits({ page, per_page: 20 });
  const createPermit = useCreateWorkPermit();
  const withdrawPermit = useWithdrawPermit();

  const permits = data?.data ?? [];
  const pagination = data?.pagination;

  function handleCreateSubmit(payload: CreateWorkPermitPayload) {
    createPermit.mutate(payload, {
      onSuccess: () => setShowCreate(false),
    });
  }

  function handleWithdrawConfirm() {
    if (!withdrawTarget) return;
    withdrawPermit.mutate(
      { id: withdrawTarget.id, payload: { reason: withdrawReason } },
      {
        onSuccess: () => {
          setWithdrawTarget(null);
          setWithdrawReason('');
        },
      }
    );
  }

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingSpinner} role="status" aria-label="Loading work permits" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.page}>
        <div className={styles.errorState} role="alert">
          Failed to load work permits. Please refresh and try again.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Work Permits</h1>
          <p className={styles.pageSubtitle}>Issue and manage field operation permits</p>
        </div>
        <button
          type="button"
          className={styles.createBtn}
          onClick={() => setShowCreate(true)}
        >
          Create permit
        </button>
      </div>

      <div className={styles.tableContainer}>
        <WorkPermitTable permits={permits} onWithdraw={setWithdrawTarget} />
      </div>

      {pagination && pagination.total_pages > 1 && (
        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </button>
          <span className={styles.pageInfo}>
            Page {pagination.page} of {pagination.total_pages}
          </span>
          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
            disabled={page === pagination.total_pages}
          >
            Next
          </button>
        </div>
      )}

      {showCreate && (
        <WorkPermitFormModal
          onSubmit={handleCreateSubmit}
          onClose={() => setShowCreate(false)}
          isSubmitting={createPermit.isPending}
        />
      )}

      {withdrawTarget && (
        <div
          className={styles.withdrawOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="withdraw-dialog-title"
        >
          <div className={styles.withdrawBox}>
            <h3 id="withdraw-dialog-title" className={styles.withdrawTitle}>
              Withdraw permit?
            </h3>
            <p className={styles.withdrawSubtitle}>
              Permit <strong>{withdrawTarget.permit_number}</strong> will be withdrawn and cannot be
              reactivated.
            </p>
            <div className={styles.withdrawField}>
              <label className={styles.withdrawLabel} htmlFor="withdraw-reason">
                Reason
              </label>
              <textarea
                id="withdraw-reason"
                className={styles.withdrawTextarea}
                value={withdrawReason}
                onChange={(e) => setWithdrawReason(e.target.value)}
                placeholder="Explain why this permit is being withdrawn (min 10 characters)…"
              />
            </div>
            <div className={styles.withdrawActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => {
                  setWithdrawTarget(null);
                  setWithdrawReason('');
                }}
                disabled={withdrawPermit.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.withdrawConfirmBtn}
                onClick={handleWithdrawConfirm}
                disabled={withdrawPermit.isPending || withdrawReason.trim().length < 10}
              >
                {withdrawPermit.isPending ? 'Withdrawing…' : 'Withdraw'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
