import { useAssets } from '../hooks/useAssets';
import { useVehicles } from '../hooks/useVehicles';
import { useWorkPermits } from '../hooks/useWorkPermits';
import { useUsers } from '../hooks/useUsers';
import styles from './DashboardPage.module.css';

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
      {sub && <span className={styles.statSub}>{sub}</span>}
    </div>
  );
}

export function DashboardPage() {
  const assets      = useAssets({ per_page: 1 });
  const vehicles    = useVehicles({ per_page: 1 });
  const allPermits  = useWorkPermits({ per_page: 1 });
  const active      = useWorkPermits({ status: 'active', per_page: 1 });
  const issued      = useWorkPermits({ status: 'issued', per_page: 1 });
  const users       = useUsers(1, 1);

  const loading = [assets, vehicles, allPermits, active, issued, users].some(q => q.isLoading);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Dashboard</h1>
      <p className={styles.subtitle}>NEPCO FieldOps — operational overview</p>

      {loading ? (
        <div className={styles.loadingSpinner} role="status" aria-label="Loading" />
      ) : (
        <>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Operations</h2>
            <div className={styles.grid}>
              <StatCard
                label="Active trips"
                value={active.data?.pagination.total ?? '—'}
                sub="Permits currently in progress"
              />
              <StatCard
                label="Pending permits"
                value={issued.data?.pagination.total ?? '—'}
                sub="Issued, awaiting team acceptance"
              />
              <StatCard
                label="Total permits"
                value={allPermits.data?.pagination.total ?? '—'}
                sub="All time"
              />
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Registry</h2>
            <div className={styles.grid}>
              <StatCard
                label="Assets"
                value={assets.data?.pagination.total ?? '—'}
                sub="HV towers, substations, switchgear"
              />
              <StatCard
                label="Vehicles"
                value={vehicles.data?.pagination.total ?? '—'}
                sub="Fleet registered"
              />
              <StatCard
                label="Users"
                value={users.data?.pagination.total ?? '—'}
                sub="Active accounts"
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
