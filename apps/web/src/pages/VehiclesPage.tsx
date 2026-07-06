import { useState } from 'react';
import type { ApiClientVehicle, CreateVehiclePayload, UpdateVehiclePayload } from '@fieldops/api-client';
import { useVehicles, useCreateVehicle, useUpdateVehicle, useDeactivateVehicle } from '../hooks/useVehicles';
import { VehicleTable } from '../components/vehicles/VehicleTable';
import { VehicleFormModal } from '../components/vehicles/VehicleFormModal';
import styles from './VehiclesPage.module.css';

export function VehiclesPage() {
  const [page, setPage] = useState(1);
  const [editTarget, setEditTarget] = useState<ApiClientVehicle | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<ApiClientVehicle | null>(null);

  const { data, isLoading, isError } = useVehicles({ page, per_page: 20 });
  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle();
  const deactivateVehicle = useDeactivateVehicle();

  const vehicles = data?.data ?? [];
  const pagination = data?.pagination;

  function handleCreateSubmit(values: CreateVehiclePayload) {
    createVehicle.mutate(values, {
      onSuccess: () => setShowCreate(false),
    });
  }

  function handleEditSubmit(values: UpdateVehiclePayload & { vehicle_code?: string }) {
    if (!editTarget) return;
    const { vehicle_code: _, ...payload } = values;
    updateVehicle.mutate({ id: editTarget.id, payload }, {
      onSuccess: () => setEditTarget(null),
    });
  }

  function handleDeactivateConfirm() {
    if (!deactivateTarget) return;
    deactivateVehicle.mutate(deactivateTarget.id, {
      onSuccess: () => setDeactivateTarget(null),
    });
  }

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingSpinner} role="status" aria-label="Loading vehicles" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.page}>
        <div className={styles.errorState} role="alert">
          Failed to load vehicles. Please refresh and try again.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Vehicles</h1>
          <p className={styles.pageSubtitle}>Manage field operation vehicles</p>
        </div>
        <button
          type="button"
          className={styles.createBtn}
          onClick={() => setShowCreate(true)}
        >
          Create vehicle
        </button>
      </div>

      <div className={styles.tableContainer}>
        <VehicleTable
          vehicles={vehicles}
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
        <VehicleFormModal
          vehicle={editTarget}
          onSubmit={editTarget ? handleEditSubmit : handleCreateSubmit}
          onClose={() => {
            setShowCreate(false);
            setEditTarget(null);
          }}
          isSubmitting={createVehicle.isPending || updateVehicle.isPending}
        />
      )}

      {deactivateTarget && (
        <div
          className={styles.confirmOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="deactivate-vehicle-dialog-title"
        >
          <div className={styles.confirmBox}>
            <h3 id="deactivate-vehicle-dialog-title" className={styles.confirmTitle}>
              Deactivate vehicle?
            </h3>
            <p className={styles.confirmText}>
              <strong>{deactivateTarget.vehicle_code}</strong> ({deactivateTarget.plate_number}) will
              no longer appear in active vehicle lists. This can be reversed by editing the vehicle.
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setDeactivateTarget(null)}
                disabled={deactivateVehicle.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.deactivateBtn}
                onClick={handleDeactivateConfirm}
                disabled={deactivateVehicle.isPending}
              >
                {deactivateVehicle.isPending ? 'Deactivating…' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
