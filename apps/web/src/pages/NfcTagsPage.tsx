import { useState } from 'react';
import type { ApiClientNfcTag, ConfirmInstallPayload, ProvisionNfcTagPayload } from '@fieldops/api-client';
import { useNfcTags, useProvisionNfcTag, useConfirmInstall } from '../hooks/useNfcTags';
import { NfcTagTable } from '../components/nfc-tags/NfcTagTable';
import { ProvisionModal } from '../components/nfc-tags/ProvisionModal';
import styles from './NfcTagsPage.module.css';

export function NfcTagsPage() {
  const [page, setPage] = useState(1);
  const [showProvision, setShowProvision] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<ApiClientNfcTag | null>(null);
  const [confirmForm, setConfirmForm] = useState({ latitude: '', longitude: '', photo_url: '' });

  const { data, isLoading, isError } = useNfcTags({ page, per_page: 20 });
  const provisionTag = useProvisionNfcTag();
  const confirmInstall = useConfirmInstall();

  const tags = data?.data ?? [];
  const pagination = data?.pagination;

  function handleProvisionSubmit(values: ProvisionNfcTagPayload) {
    provisionTag.mutate(values, {
      onSuccess: () => setShowProvision(false),
    });
  }

  function handleConfirmSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmTarget) return;
    const payload: ConfirmInstallPayload = {
      latitude: parseFloat(confirmForm.latitude),
      longitude: parseFloat(confirmForm.longitude),
      photo_url: confirmForm.photo_url,
    };
    confirmInstall.mutate({ id: confirmTarget.id, payload }, {
      onSuccess: () => {
        setConfirmTarget(null);
        setConfirmForm({ latitude: '', longitude: '', photo_url: '' });
      },
    });
  }

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingSpinner} role="status" aria-label="Loading NFC tags" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.page}>
        <div className={styles.errorState} role="alert">
          Failed to load NFC tags. Please refresh and try again.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>NFC Tags</h1>
          <p className={styles.pageSubtitle}>Provision and manage NFC tags for assets and vehicles</p>
        </div>
        <button
          type="button"
          className={styles.provisionBtn}
          onClick={() => setShowProvision(true)}
        >
          Provision tag
        </button>
      </div>

      <div className={styles.tableContainer}>
        <NfcTagTable tags={tags} onConfirmInstall={setConfirmTarget} />
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

      {showProvision && (
        <ProvisionModal
          onSubmit={handleProvisionSubmit}
          onClose={() => setShowProvision(false)}
          isSubmitting={provisionTag.isPending}
        />
      )}

      {confirmTarget && (
        <div
          className={styles.confirmOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-install-title"
        >
          <div className={styles.confirmBox}>
            <h3 id="confirm-install-title" className={styles.confirmTitle}>
              Confirm Installation
            </h3>
            <p className={styles.confirmTagId}>Tag: <strong>{confirmTarget.tag_id}</strong></p>

            <form className={styles.confirmForm} onSubmit={handleConfirmSubmit}>
              <div className={styles.confirmRow}>
                <div className={styles.confirmField}>
                  <label className={styles.confirmLabel} htmlFor="conf_lat">Latitude</label>
                  <input
                    id="conf_lat"
                    type="number"
                    step="any"
                    className={styles.confirmInput}
                    value={confirmForm.latitude}
                    onChange={(e) => setConfirmForm((f) => ({ ...f, latitude: e.target.value }))}
                    placeholder="31.9539"
                    required
                  />
                </div>
                <div className={styles.confirmField}>
                  <label className={styles.confirmLabel} htmlFor="conf_lng">Longitude</label>
                  <input
                    id="conf_lng"
                    type="number"
                    step="any"
                    className={styles.confirmInput}
                    value={confirmForm.longitude}
                    onChange={(e) => setConfirmForm((f) => ({ ...f, longitude: e.target.value }))}
                    placeholder="35.9106"
                    required
                  />
                </div>
              </div>

              <div className={styles.confirmField}>
                <label className={styles.confirmLabel} htmlFor="conf_photo">Photo URL</label>
                <input
                  id="conf_photo"
                  type="url"
                  className={styles.confirmInput}
                  value={confirmForm.photo_url}
                  onChange={(e) => setConfirmForm((f) => ({ ...f, photo_url: e.target.value }))}
                  placeholder="https://r2.example.com/nfc/photo.jpg"
                  required
                />
              </div>

              <div className={styles.confirmActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setConfirmTarget(null)}
                  disabled={confirmInstall.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={confirmInstall.isPending}
                >
                  {confirmInstall.isPending ? 'Confirming…' : 'Confirm Install'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
