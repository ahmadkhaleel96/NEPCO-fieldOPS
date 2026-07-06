import type { ApiClientAsset } from '@fieldops/api-client';
import styles from './AssetTable.module.css';

const ASSET_TYPE_LABELS: Record<string, string> = {
  hv_tower: 'HV Tower',
  substation: 'Substation',
  switchgear: 'Switchgear',
  cable_joint: 'Cable Joint',
  distribution_cabinet: 'Distribution Cabinet',
};

interface AssetTableProps {
  assets: ApiClientAsset[];
  onEdit: (asset: ApiClientAsset) => void;
  onDeactivate: (asset: ApiClientAsset) => void;
}

export function AssetTable({ assets, onEdit, onDeactivate }: AssetTableProps) {
  if (assets.length === 0) {
    return <p className={styles.empty}>No assets found.</p>;
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.th}>Code</th>
          <th className={styles.th}>Name</th>
          <th className={styles.th}>Type</th>
          <th className={styles.th}>Location</th>
          <th className={styles.th}>Status</th>
          <th className={styles.th}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {assets.map((asset) => (
          <tr key={asset.id} className={styles.tr}>
            <td className={styles.td}>
              <span className={styles.code}>{asset.asset_code}</span>
            </td>
            <td className={styles.td}>{asset.name}</td>
            <td className={styles.td}>
              <span className={styles.typeBadge}>
                {ASSET_TYPE_LABELS[asset.asset_type] ?? asset.asset_type}
              </span>
            </td>
            <td className={styles.td}>
              {asset.latitude.toFixed(4)}, {asset.longitude.toFixed(4)}
            </td>
            <td className={styles.td}>
              <span className={asset.is_active ? styles.activeStatus : styles.inactiveStatus}>
                {asset.is_active ? 'Active' : 'Inactive'}
              </span>
            </td>
            <td className={styles.td}>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.editBtn}
                  onClick={() => onEdit(asset)}
                >
                  Edit
                </button>
                {asset.is_active && (
                  <button
                    type="button"
                    className={styles.deactivateBtn}
                    onClick={() => onDeactivate(asset)}
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
