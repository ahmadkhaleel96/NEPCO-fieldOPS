import type { ApiClientUser } from '@fieldops/api-client';
import styles from './UserTable.module.css';

const ROLE_LABELS: Record<ApiClientUser['role'], string> = {
  admin: 'Admin',
  engineer: 'Engineer',
  team_leader: 'Team Leader',
  technician: 'Technician',
  driver: 'Driver',
};

interface UserTableProps {
  users: ApiClientUser[];
  onEdit: (user: ApiClientUser) => void;
  onDeactivate: (user: ApiClientUser) => void;
  currentUserId: string;
}

export function UserTable({ users, onEdit, onDeactivate, currentUserId }: UserTableProps) {
  if (users.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No users found.</p>
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>Name</th>
            <th className={styles.th}>Email</th>
            <th className={styles.th}>Role</th>
            <th className={styles.th}>Status</th>
            <th className={styles.th}>Phone</th>
            <th className={styles.th}>MFA</th>
            <th className={`${styles.th} ${styles.thActions}`}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className={user.is_active ? styles.tr : styles.trInactive}>
              <td className={styles.td}>{user.full_name}</td>
              <td className={styles.td}>{user.email}</td>
              <td className={styles.td}>
                <span className={`${styles.roleBadge} ${styles[`role_${user.role}`]}`}>
                  {ROLE_LABELS[user.role]}
                </span>
              </td>
              <td className={styles.td}>
                <span className={user.is_active ? styles.statusActive : styles.statusInactive}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className={styles.td}>{user.phone ?? '—'}</td>
              <td className={styles.td}>
                <span className={user.mfa_enabled ? styles.mfaOn : styles.mfaOff}>
                  {user.mfa_enabled ? 'On' : 'Off'}
                </span>
              </td>
              <td className={`${styles.td} ${styles.tdActions}`}>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => onEdit(user)}
                >
                  Edit
                </button>
                {user.is_active && user.id !== currentUserId && (
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                    onClick={() => onDeactivate(user)}
                  >
                    Deactivate
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
