import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import styles from './AppShell.module.css';

interface AppShellProps {
  userEmail: string;
  userRole: string;
  onSignOut: () => void;
}

export function AppShell({ userEmail, userRole, onSignOut }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.logo}>NEPCO FieldOps</span>
        <div className={styles.headerRight}>
          <span className={styles.userEmail}>{userEmail}</span>
          <button type="button" className={styles.signOutBtn} onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>
      <div className={styles.body}>
        <Sidebar userRole={userRole} />
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
