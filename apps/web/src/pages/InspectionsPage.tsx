import { useState } from 'react';
import type { ApiClientAssetChange, ApprovalStatus } from '@fieldops/api-client';
import { useAssetChanges, useReviewChange } from '../hooks/useInspections';
import styles from './InspectionsPage.module.css';

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function StatusBadge({ status }: { status: ApprovalStatus }) {
  const cls =
    status === 'pending'
      ? styles.badgePending
      : status === 'approved'
      ? styles.badgeApproved
      : styles.badgeRejected;
  return <span className={`${styles.badge} ${cls}`}>{status}</span>;
}

interface ReviewDialogProps {
  change: ApiClientAssetChange;
  action: 'approve' | 'reject';
  onConfirm: (notes: string) => void;
  onCancel: () => void;
  isPending: boolean;
}

function ReviewDialog({ change, action, onConfirm, onCancel, isPending }: ReviewDialogProps) {
  const [notes, setNotes] = useState('');
  const isReject = action === 'reject';

  return (
    <div className={styles.confirmOverlay} role="dialog" aria-modal="true">
      <div className={styles.confirmDialog}>
        <p className={styles.confirmTitle}>
          {isReject ? 'Reject Change' : 'Approve Change'}
        </p>
        <p className={styles.confirmSubtitle}>
          Field: <strong>{change.field_name}</strong> &nbsp;|&nbsp; Asset:{' '}
          <code>{change.asset_id.slice(0, 8)}…</code>
        </p>
        <textarea
          className={styles.notesInput}
          placeholder={isReject ? 'Reason for rejection (optional)' : 'Notes (optional)'}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isPending}
        />
        <div className={styles.confirmActions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={isPending}>
            Cancel
          </button>
          <button
            type="button"
            className={isReject ? styles.confirmRejectBtn : styles.confirmApproveBtn}
            onClick={() => onConfirm(notes)}
            disabled={isPending}
          >
            {isPending ? 'Saving…' : isReject ? 'Reject' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function InspectionsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | ''>('pending');
  const [dialog, setDialog] = useState<{
    change: ApiClientAssetChange;
    action: 'approve' | 'reject';
  } | null>(null);

  const { data, isLoading, isError } = useAssetChanges({
    page,
    per_page: 20,
    status: statusFilter || undefined,
  });

  const reviewChange = useReviewChange();

  const changes = data?.data ?? [];
  const pagination = data?.pagination;

  function openDialog(change: ApiClientAssetChange, action: 'approve' | 'reject') {
    setDialog({ change, action });
  }

  function handleConfirm(notes: string) {
    if (!dialog) return;
    reviewChange.mutate(
      { id: dialog.change.id, payload: { action: dialog.action, notes: notes || undefined } },
      { onSuccess: () => setDialog(null) }
    );
  }

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingSpinner} role="status" aria-label="Loading inspections" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.page}>
        <div className={styles.errorState} role="alert">
          Failed to load inspection changes. Please refresh and try again.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {dialog && (
        <ReviewDialog
          change={dialog.change}
          action={dialog.action}
          onConfirm={handleConfirm}
          onCancel={() => setDialog(null)}
          isPending={reviewChange.isPending}
        />
      )}

      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Inspection Review</h1>
        <p className={styles.pageSubtitle}>
          Review and approve field-reported asset changes before they are applied.
        </p>
      </div>

      <div className={styles.filterRow}>
        <label htmlFor="status-filter" className={styles.filterLabel}>
          Status:
        </label>
        <select
          id="status-filter"
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as ApprovalStatus | '');
            setPage(1);
          }}
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {changes.length === 0 ? (
        <p className={styles.emptyState}>
          {statusFilter === 'pending'
            ? 'No pending changes. All inspections are reviewed.'
            : 'No changes found.'}
        </p>
      ) : (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Field</th>
                <th>Asset</th>
                <th>Change</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((change) => (
                <tr key={change.id}>
                  <td>
                    <span className={styles.fieldName}>{change.field_name}</span>
                  </td>
                  <td>
                    <span className={styles.assetId}>{change.asset_id.slice(0, 8)}…</span>
                  </td>
                  <td>
                    <div className={styles.diffCell}>
                      <span className={change.old_value !== null ? styles.oldValue : styles.nullValue}>
                        {formatValue(change.old_value)}
                      </span>
                      <span className={styles.arrow}>→</span>
                      <span className={styles.newValue}>{formatValue(change.new_value)}</span>
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={change.status} />
                  </td>
                  <td>
                    {new Date(change.created_at).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td>
                    {change.status === 'pending' ? (
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.approveBtn}
                          onClick={() => openDialog(change, 'approve')}
                          disabled={reviewChange.isPending}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className={styles.rejectBtn}
                          onClick={() => openDialog(change, 'reject')}
                          disabled={reviewChange.isPending}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className={styles.assetId}>
                        {change.reviewed_by ? `by ${change.reviewed_by.slice(0, 8)}…` : '—'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {pagination && pagination.total_pages > 1 && (
            <div className={styles.paginationRow}>
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
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= pagination.total_pages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
