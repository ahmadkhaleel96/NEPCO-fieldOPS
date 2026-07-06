import type { ApiClientWorkPermit } from '@fieldops/api-client';
import styles from './WorkPermitTable.module.css';

interface WorkPermitTableProps {
  permits: ApiClientWorkPermit[];
  onWithdraw: (permit: ApiClientWorkPermit) => void;
}

const WITHDRAWABLE = new Set(['draft', 'issued']);

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function WorkPermitTable({ permits, onWithdraw }: WorkPermitTableProps) {
  if (permits.length === 0) {
    return <p className={styles.emptyState}>No work permits found.</p>;
  }

  return (
    <table className={styles.table}>
      <thead className={styles.thead}>
        <tr>
          <th>Permit #</th>
          <th>Type</th>
          <th>Status</th>
          <th>Scheduled Start</th>
          <th>Scheduled End</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody className={styles.tbody}>
        {permits.map((permit) => (
          <tr key={permit.id}>
            <td className={styles.permitNumber}>{permit.permit_number}</td>
            <td style={{ textTransform: 'capitalize' }}>{permit.permit_type}</td>
            <td>
              <span className={`${styles.badge} ${styles[`badge-${permit.status}`]}`}>
                {permit.status}
              </span>
            </td>
            <td>{formatDate(permit.scheduled_start)}</td>
            <td>{formatDate(permit.scheduled_end)}</td>
            <td>
              <div className={styles.actions}>
                {WITHDRAWABLE.has(permit.status) && (
                  <button
                    type="button"
                    className={styles.withdrawBtn}
                    onClick={() => onWithdraw(permit)}
                  >
                    Withdraw
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
