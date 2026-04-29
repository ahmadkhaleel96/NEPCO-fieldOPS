import { useState } from 'react';
import type { ApiClientFollowUpTask } from '@fieldops/api-client';
import { useFollowUpTasks, useResolveFollowUpTask } from '../hooks/useInspections';
import styles from './FollowUpTasksPage.module.css';

function ResolveDialog({
  task,
  onConfirm,
  onCancel,
  isPending,
}: {
  task: ApiClientFollowUpTask;
  onConfirm: (notes: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [notes, setNotes] = useState('');
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Resolve task">
      <div className={styles.dialog}>
        <p className={styles.dialogTitle}>Resolve Task</p>
        <p className={styles.dialogSubtitle}>
          Asset: <code>{task.asset_id.slice(0, 8)}…</code>
        </p>
        <textarea
          className={styles.notesInput}
          placeholder="Resolution notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isPending}
        />
        <div className={styles.dialogActions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={isPending}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.resolveBtn}
            onClick={() => onConfirm(notes)}
            disabled={isPending}
          >
            {isPending ? 'Resolving…' : 'Resolve'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ resolved }: { resolved: boolean }) {
  return (
    <span className={`${styles.badge} ${resolved ? styles.badgeResolved : styles.badgePending}`}>
      {resolved ? 'resolved' : 'pending'}
    </span>
  );
}

export function FollowUpTasksPage() {
  const [resolvedFilter, setResolvedFilter] = useState<'' | 'true' | 'false'>('false');
  const [dialogTask, setDialogTask] = useState<ApiClientFollowUpTask | null>(null);

  const params =
    resolvedFilter === '' ? undefined : { resolved: resolvedFilter === 'true' };
  const { data, isLoading, isError } = useFollowUpTasks(params);
  const { mutate: resolveTask, isPending } = useResolveFollowUpTask();

  const handleResolve = (notes: string) => {
    if (!dialogTask) return;
    resolveTask({ id: dialogTask.id, payload: { notes: notes || undefined } }, {
      onSuccess: () => setDialogTask(null),
    });
  };

  if (isLoading) {
    return <div className={styles.statusContainer} role="status" aria-label="Loading">Loading…</div>;
  }

  if (isError) {
    return (
      <div className={styles.statusContainer} role="alert">
        <p className={styles.errorText}>Failed to load follow-up tasks. Please try again.</p>
      </div>
    );
  }

  const tasks = data?.data ?? [];

  return (
    <div className={styles.page}>
      {dialogTask && (
        <ResolveDialog
          task={dialogTask}
          onConfirm={handleResolve}
          onCancel={() => setDialogTask(null)}
          isPending={isPending}
        />
      )}

      <div className={styles.header}>
        <h1 className={styles.title}>Follow-Up Tasks</h1>
        <div className={styles.filters}>
          <label htmlFor="resolved-filter" className={styles.filterLabel}>Status</label>
          <select
            id="resolved-filter"
            className={styles.filterSelect}
            value={resolvedFilter}
            onChange={(e) => setResolvedFilter(e.target.value as '' | 'true' | 'false')}
          >
            <option value="false">Pending</option>
            <option value="true">Resolved</option>
            <option value="">All</option>
          </select>
        </div>
      </div>

      {tasks.length === 0 ? (
        <p className={styles.emptyText}>
          {resolvedFilter === 'false'
            ? 'No pending follow-up tasks.'
            : resolvedFilter === 'true'
            ? 'No resolved tasks.'
            : 'No tasks found.'}
        </p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Asset ID</th>
                <th>Inspection ID</th>
                <th>Partial Data</th>
                <th>Notes</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td><code>{task.asset_id.slice(0, 8)}…</code></td>
                  <td><code>{task.inspection_id.slice(0, 8)}…</code></td>
                  <td className={styles.dataCell}>
                    {Object.keys(task.partial_form_data).length > 0
                      ? Object.entries(task.partial_form_data)
                          .map(([k, v]) => `${k}: ${String(v)}`)
                          .join(', ')
                      : '—'}
                  </td>
                  <td>{task.notes ?? '—'}</td>
                  <td><StatusBadge resolved={task.resolved_at !== null} /></td>
                  <td>{new Date(task.created_at).toLocaleDateString()}</td>
                  <td>
                    {task.resolved_at === null && (
                      <button
                        type="button"
                        className={styles.resolveActionBtn}
                        onClick={() => setDialogTask(task)}
                        aria-label="Resolve task"
                      >
                        Resolve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
