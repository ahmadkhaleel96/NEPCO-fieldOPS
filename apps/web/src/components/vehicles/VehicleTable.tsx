import type { ApiClientVehicle } from '@fieldops/api-client';
import styles from './VehicleTable.module.css';

interface VehicleTableProps {
  vehicles: ApiClientVehicle[];
  onEdit: (vehicle: ApiClientVehicle) => void;
  onDeactivate: (vehicle: ApiClientVehicle) => void;
}

export function VehicleTable({ vehicles, onEdit, onDeactivate }: VehicleTableProps) {
  if (vehicles.length === 0) {
    return <p className={styles.empty}>No vehicles found.</p>;
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.th}>Code</th>
          <th className={styles.th}>Plate Number</th>
          <th className={styles.th}>Model</th>
          <th className={styles.th}>Status</th>
          <th className={styles.th}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {vehicles.map((vehicle) => (
          <tr key={vehicle.id} className={styles.tr}>
            <td className={styles.td}>
              <span className={styles.code}>{vehicle.vehicle_code}</span>
            </td>
            <td className={styles.td}>{vehicle.plate_number}</td>
            <td className={styles.td}>{vehicle.model ?? '—'}</td>
            <td className={styles.td}>
              <span className={vehicle.is_active ? styles.activeStatus : styles.inactiveStatus}>
                {vehicle.is_active ? 'Active' : 'Inactive'}
              </span>
            </td>
            <td className={styles.td}>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.editBtn}
                  onClick={() => onEdit(vehicle)}
                >
                  Edit
                </button>
                {vehicle.is_active && (
                  <button
                    type="button"
                    className={styles.deactivateBtn}
                    onClick={() => onDeactivate(vehicle)}
                  >
                    Deactivate
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
