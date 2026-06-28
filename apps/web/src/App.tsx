import { useEffect, useState, type FormEvent } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { apiClient } from './lib/api-client';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { AssetsPage } from './pages/AssetsPage';
import { VehiclesPage } from './pages/VehiclesPage';
import { NfcTagsPage } from './pages/NfcTagsPage';
import { WorkPermitsPage } from './pages/WorkPermitsPage';
import { InspectionsPage } from './pages/InspectionsPage';
import { FollowUpTasksPage } from './pages/FollowUpTasksPage';
import { ReportsPage } from './pages/ReportsPage';
import styles from './styles/App.module.css';

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setAuthError('');
    setSigningIn(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
    setSigningIn(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) apiClient.setAccessToken(session.access_token);
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) apiClient.setAccessToken(session.access_token);
      else apiClient.setAccessToken('');
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
          <form onSubmit={handleSignIn} className={styles.authForm}>
            <div className={styles.authField}>
              <label className={styles.authLabel} htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                className={styles.authInput}
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className={styles.authField}>
              <label className={styles.authLabel} htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                className={styles.authInput}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            {authError && <p className={styles.authError}>{authError}</p>}
            <button type="submit" className={styles.authButton} disabled={signingIn}>
              {signingIn ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
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
          {(userRole === 'admin' || userRole === 'engineer') && (
            <Route path="inspections" element={<InspectionsPage />} />
          )}
          {(userRole === 'admin' || userRole === 'engineer' || userRole === 'team_leader') && (
            <Route path="follow-up-tasks" element={<FollowUpTasksPage />} />
          )}
          {(userRole === 'admin' || userRole === 'engineer') && (
            <Route path="reports" element={<ReportsPage userRole={userRole} />} />
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
