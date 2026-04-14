import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import styles from './styles/App.module.css';

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner} role="status" aria-label="Loading" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className={styles.authContainer}>
        <div className={styles.authCard}>
          <h1 className={styles.authTitle}>NEPCO FieldOps</h1>
          <p className={styles.authSubtitle}>Field Operation Management System</p>
          <p className={styles.authPrompt}>
            Sign in to access the dashboard. Contact your administrator for credentials.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.appShell}>
      <header className={styles.appHeader}>
        <span className={styles.appLogo}>NEPCO FieldOps</span>
        <span className={styles.appUser}>{session.user.email}</span>
      </header>
      <main className={styles.appMain}>
        <p>Dashboard — Phase 1 implementation coming next sprint.</p>
      </main>
    </div>
  );
}
