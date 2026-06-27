import { useRef, useState } from 'react';
import type { ApiClientAsset, CreateAssetPayload, UpdateAssetPayload, BulkImportAssetRow, BulkImportResult } from '@fieldops/api-client';
import { useAssets, useCreateAsset, useUpdateAsset, useDeactivateAsset } from '../hooks/useAssets';
import { AssetTable } from '../components/assets/AssetTable';
import { AssetFormModal } from '../components/assets/AssetFormModal';
import { apiClient } from '../lib/api-client';
import styles from './AssetsPage.module.css';

/** Minimal CSV parser: returns array of header→value maps. Handles quoted fields. */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { values.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    values.push(cur.trim());
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
  });
}

export function AssetsPage() {
  const [page, setPage] = useState(1);
  const [editTarget, setEditTarget] = useState<ApiClientAsset | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<ApiClientAsset | null>(null);

  // CSV import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvRows, setCsvRows] = useState<BulkImportAssetRow[] | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);

  const { data, isLoading, isError, refetch } = useAssets({ page, per_page: 20 });
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!e.target) return;
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rawRows = parseCsv(text);
      if (rawRows.length === 0) {
        setCsvError('CSV is empty or missing a header row.');
        return;
      }
      const rows: BulkImportAssetRow[] = rawRows.map((r) => ({
        asset_code: r['asset_code'] ?? '',
        asset_type: r['asset_type'] as BulkImportAssetRow['asset_type'],
        name: r['name'] ?? '',
        latitude: parseFloat(r['latitude'] ?? '0'),
        longitude: parseFloat(r['longitude'] ?? '0'),
      }));
      setCsvRows(rows);
      setCsvError(null);
    };
    reader.readAsText(file);
  }

  async function handleImportConfirm() {
    if (!csvRows) return;
    setImporting(true);
    try {
      const res = await apiClient.assets.bulkImport(csvRows);
      setImportResult(res.data);
      setCsvRows(null);
      void refetch();
    } catch {
      setCsvError('Import failed. Please check your file and try again.');
      setCsvRows(null);
    } finally {
      setImporting(false);
    }
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
        <div className={styles.headerActions}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className={styles.hiddenInput}
            onChange={handleFileChange}
            aria-label="Import CSV file"
          />
          <button
            type="button"
            className={styles.importBtn}
            onClick={() => fileInputRef.current?.click()}
          >
            Import CSV
          </button>
          <button
            type="button"
            className={styles.createBtn}
            onClick={() => setShowCreate(true)}
          >
            Create asset
          </button>
        </div>
      </div>

      {csvError && (
        <div className={styles.csvError} role="alert">{csvError}</div>
      )}

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

      {/* CSV preview / confirm modal */}
      {csvRows && (
        <div className={styles.confirmOverlay} role="dialog" aria-modal="true" aria-labelledby="csv-import-title">
          <div className={styles.confirmBox}>
            <h3 id="csv-import-title" className={styles.confirmTitle}>Import assets</h3>
            <p className={styles.confirmText}>
              <strong>{csvRows.length}</strong> row{csvRows.length !== 1 ? 's' : ''} found in the CSV.
              Existing assets with the same code will be skipped.
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setCsvRows(null)}
                disabled={importing}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.createBtn}
                onClick={handleImportConfirm}
                disabled={importing}
              >
                {importing ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import result modal */}
      {importResult && (
        <div className={styles.confirmOverlay} role="dialog" aria-modal="true" aria-labelledby="import-result-title">
          <div className={styles.confirmBox}>
            <h3 id="import-result-title" className={styles.confirmTitle}>Import complete</h3>
            <ul className={styles.resultList}>
              <li><strong>{importResult.imported}</strong> asset{importResult.imported !== 1 ? 's' : ''} imported</li>
              {importResult.skipped > 0 && (
                <li><strong>{importResult.skipped}</strong> skipped (already exist)</li>
              )}
              {importResult.errors.length > 0 && (
                <li><strong>{importResult.errors.length}</strong> row{importResult.errors.length !== 1 ? 's' : ''} had errors</li>
              )}
            </ul>
            {importResult.errors.length > 0 && (
              <ul className={styles.errorList}>
                {importResult.errors.map((e) => (
                  <li key={e.row}>Row {e.row}: {e.message}</li>
                ))}
              </ul>
            )}
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.createBtn}
                onClick={() => setImportResult(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
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
