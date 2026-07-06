import type { ApiClientNfcTag } from '@fieldops/api-client';
import styles from './NfcTagTable.module.css';

const STATUS_LABELS: Record<string, string> = {
  provisioned: 'Provisioned',
  active: 'Active',
  inactive: 'Inactive',
  replaced: 'Replaced',
};

interface NfcTagTableProps {
  tags: ApiClientNfcTag[];
  onConfirmInstall: (tag: ApiClientNfcTag) => void;
}

export function NfcTagTable({ tags, onConfirmInstall }: NfcTagTableProps) {
  if (tags.length === 0) {
    return <p className={styles.empty}>No NFC tags found.</p>;
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.th}>Tag ID</th>
          <th className={styles.th}>Status</th>
          <th className={styles.th}>Linked To</th>
          <th className={styles.th}>Install Location</th>
          <th className={styles.th}>Provisioned</th>
          <th className={styles.th}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {tags.map((tag) => (
          <tr key={tag.id} className={styles.tr}>
            <td className={styles.td}>
              <span className={styles.tagId}>{tag.tag_id}</span>
            </td>
            <td className={styles.td}>
              <span className={styles[`status_${tag.status}`] ?? styles.status_provisioned}>
                {STATUS_LABELS[tag.status] ?? tag.status}
              </span>
            </td>
            <td className={styles.td}>
              {tag.asset_id ? (
                <span className={styles.linkedTo}>Asset: {tag.asset_id.slice(0, 8)}…</span>
              ) : tag.vehicle_id ? (
                <span className={styles.linkedTo}>Vehicle: {tag.vehicle_id.slice(0, 8)}…</span>
              ) : (
                '—'
              )}
            </td>
            <td className={styles.td}>
              {tag.install_lat != null && tag.install_lng != null
                ? `${tag.install_lat.toFixed(4)}, ${tag.install_lng.toFixed(4)}`
                : '—'}
            </td>
            <td className={styles.td}>
              {new Date(tag.created_at).toLocaleDateString()}
            </td>
            <td className={styles.td}>
              {tag.status === 'provisioned' && (
                <button
                  type="button"
                  className={styles.confirmBtn}
                  onClick={() => onConfirmInstall(tag)}
                >
                  Confirm Install
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
