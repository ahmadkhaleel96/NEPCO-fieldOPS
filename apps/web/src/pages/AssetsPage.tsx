import { useState } from 'react';
import type { ApiClientAsset, CreateAssetPayload, UpdateAssetPayload } from '@fieldops/api-client';
import { useAssets, useCreateAsset, useUpdateAsset, useDeactivateAsset } from '../hooks/useAssets';
import { AssetTable } from '../components/assets/AssetTable';
import { AssetFormModal } from '../components/assets/AssetFormModal';
import styles from './AssetsPage.module.css';

export function AssetsPage() {
  const [page, setPage] = useState(1);
  const [editTarget, setEditTarget] = useState<ApiClientAsset | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<ApiClientAsset | null>(null);

  const { data, isLoading, isError } = useAssets({ page, per_page: 20 });
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();
  const deactivateAsset = useDeactivateAsset();

  const assets = data?.data ?? [];
  const pagination = data?.pagination;

  function handleCreateSubmit(values: CreateAssetPayload) {
    createAsset.mutate(values, {
      onSuccess: () => setShowCreate(false),
    });
  }

  function handleEditSubmit(values: UpdateAssetPayload & { asset_code?: string }) {
    if (!editTarget) return;
    const { asset_code: _, ...payload } = values;
    updateAsset.mutate({ id: editTarget.id, payload }, {
      onSuccess: () => setEditTarget(null),
    });
  }

  function handleDeactivateConfirm() {
    if (!deactivateTarget) return;
    deactivateAsset.mutate(deactivateTarget.id, {
      onSuccess: () => setDeactivateTarget(null),
    });
  }

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingSpinner} role="status" aria-label="Loading assets" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.page}>
        <div className={styles.errorState} role="alert">
          Failed to load assets. Please refresh and try again.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Assets</h1>
          <p className={styles.pageSubtitle}>Manage field infrastructure assets</p>
        </div>
        <button
          type="button"
          className={styles.createBtn}
          onClick={() => setShowCreate(true)}
        >
          Create asset
        </button>
      </div>

      <div className={styles.tableContainer}>
        <AssetTable
          assets={assets}
          onEdit={setEditTarget}
          onDeactivate={setDeactivateTarget}
        />
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

      {(showCreate || editTarget) && (
        <AssetFormModal
          asset={editTarget}
          onSubmit={editTarget ? handleEditSubmit : handleCreateSubmit}
          onClose={() => {
            setShowCreate(false);
            setEditTarget(null);
          }}
          isSubmitting={createAsset.isPending || updateAsset.isPending}
        />
      )}

      {deactivateTarget && (
        <div
          className={styles.confirmOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="deactivate-asset-dialog-title"
        >
          <div className={styles.confirmBox}>
            <h3 id="deactivate-asset-dialog-title" className={styles.confirmTitle}>
              Deactivate asset?
            </h3>
            <p className={styles.confirmText}>
              <strong>{deactivateTarget.name}</strong> ({deactivateTarget.asset_code}) will no
              longer appear in active asset lists. This can be reversed by editing the asset.
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setDeactivateTarget(null)}
                disabled={deactivateAsset.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.deactivateBtn}
                onClick={handleDeactivateConfirm}
                disabled={deactivateAsset.isPending}
              >
                {deactivateAsset.isPending ? 'Deactivating…' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
