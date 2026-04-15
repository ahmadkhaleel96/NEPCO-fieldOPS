import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { AssetsPage } from './pages/AssetsPage';
import { VehiclesPage } from './pages/VehiclesPage';
import { NfcTagsPage } from './pages/NfcTagsPage';
import { WorkPermitsPage } from './pages/WorkPermitsPage';
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

  const userRole = (session.user.app_metadata?.['role'] as string) ?? 'technician';

  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <AppShell
              userEmail={session.user.email ?? ''}
              userRole={userRole}
              onSignOut={() => supabase.auth.signOut()}
            />
          }
        >
          <Route index element={<DashboardPage />} />
          {(userRole === 'admin' || userRole === 'engineer' || userRole === 'team_leader') && (
            <Route path="assets" element={<AssetsPage />} />
          )}
          {(userRole === 'admin' || userRole === 'engineer' || userRole === 'team_leader') && (
            <Route path="vehicles" element={<VehiclesPage />} />
          )}
          {userRole === 'admin' && (
            <Route path="nfc-tags" element={<NfcTagsPage />} />
          )}
          {(userRole === 'admin' || userRole === 'engineer') && (
            <Route path="work-permits" element={<WorkPermitsPage />} />
          )}
          {userRole === 'admin' && (
            <Route path="users" element={<UsersPage />} />
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
