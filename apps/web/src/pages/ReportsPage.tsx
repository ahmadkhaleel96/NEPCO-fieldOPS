import { useState } from 'react';
import type { ReportCadence, ApiClientReportListItem } from '@fieldops/api-client';
import { useReports, useGenerateReport, useVerifyReport, useRegeneratePdf } from '../hooks/useReports';
import styles from './ReportsPage.module.css';

const CADENCES: ReportCadence[] = ['daily', 'weekly', 'monthly', 'quarterly', 'bi_yearly', 'yearly'];

interface GenerateFormProps {
  onClose: () => void;
}

function GenerateForm({ onClose }: GenerateFormProps) {
  const [cadence, setCadence] = useState<ReportCadence>('monthly');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [formError, setFormError] = useState('');

  const { mutate: generate, isPending } = useGenerateReport();

  const handleSubmit = () => {
    if (!periodStart || !periodEnd) {
      setFormError('Both period dates are required.');
      return;
    }
    if (new Date(periodStart) >= new Date(periodEnd)) {
      setFormError('Period start must be before period end.');
      return;
    }
    setFormError('');
    generate(
      { cadence, period_start: new Date(periodStart).toISOString(), period_end: new Date(periodEnd).toISOString() },
      { onSuccess: onClose, onError: () => setFormError('Failed to generate report. Period may already exist.') }
    );
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Generate report">
      <div className={styles.dialog}>
        <p className={styles.dialogTitle}>Generate Report</p>

        <label className={styles.fieldLabel} htmlFor="gen-cadence">Cadence</label>
        <select
          id="gen-cadence"
          className={styles.select}
          value={cadence}
          onChange={(e) => setCadence(e.target.value as ReportCadence)}
          disabled={isPending}
        >
          {CADENCES.map((c) => (
            <option key={c} value={c}>{c.replace('_', '-')}</option>
          ))}
        </select>

        <label className={styles.fieldLabel} htmlFor="gen-start">Period Start</label>
        <input
          id="gen-start"
          type="datetime-local"
          className={styles.input}
          value={periodStart}
          onChange={(e) => setPeriodStart(e.target.value)}
          disabled={isPending}
          aria-label="Period start"
        />

        <label className={styles.fieldLabel} htmlFor="gen-end">Period End</label>
        <input
          id="gen-end"
          type="datetime-local"
          className={styles.input}
          value={periodEnd}
          onChange={(e) => setPeriodEnd(e.target.value)}
          disabled={isPending}
          aria-label="Period end"
        />

        {formError && <p className={styles.formError}>{formError}</p>}

        <div className={styles.dialogActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isPending}>
            Cancel
          </button>
          <button type="button" className={styles.generateBtn} onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface VerifyResultBadgeProps {
  match: boolean | null;
}

function VerifyResultBadge({ match }: VerifyResultBadgeProps) {
  if (match === null) return null;
  return (
    <span className={`${styles.badge} ${match ? styles.badgeOk : styles.badgeFail}`}>
      {match ? 'OK' : 'MISMATCH'}
    </span>
  );
}

interface ReportRowProps {
  report: ApiClientReportListItem;
  userRole: string;
}

function ReportRow({ report, userRole }: ReportRowProps) {
  const [verifyResult, setVerifyResult] = useState<boolean | null>(null);
  const { mutate: verify, isPending: verifying } = useVerifyReport();
  const { mutate: regenerate, isPending: regenerating } = useRegeneratePdf();

  return (
    <tr>
      <td>{report.cadence.replace('_', '-')}</td>
      <td>{new Date(report.period_start).toLocaleDateString()}</td>
      <td>{new Date(report.period_end).toLocaleDateString()}</td>
      <td className={styles.hashCell}>
        <code title={report.sha256}>{report.sha256.slice(0, 12)}…</code>
      </td>
      <td>
        {report.pdf_url ? (
          <a href={report.pdf_url} target="_blank" rel="noreferrer" className={styles.pdfLink}>
            PDF
          </a>
        ) : (
          <span className={styles.noPdf}>—</span>
        )}
      </td>
      <td>{new Date(report.generated_at).toLocaleDateString()}</td>
      <td>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.verifyBtn}
            onClick={() =>
              verify(report.id, {
                onSuccess: (res) => setVerifyResult(res.data.match),
              })
            }
            disabled={verifying}
            aria-label={`Verify report ${report.id}`}
          >
            {verifying ? '…' : 'Verify'}
          </button>
          {userRole === 'admin' && (
            <button
              type="button"
              className={styles.regenBtn}
              onClick={() => regenerate(report.id)}
              disabled={regenerating}
              aria-label={`Regenerate PDF for report ${report.id}`}
            >
              {regenerating ? '…' : 'Re-PDF'}
            </button>
          )}
          <VerifyResultBadge match={verifyResult} />
        </div>
      </td>
    </tr>
  );
}

interface ReportsPageProps {
  userRole?: string;
}

export function ReportsPage({ userRole = 'engineer' }: ReportsPageProps) {
  const [cadenceFilter, setCadenceFilter] = useState<ReportCadence | ''>('');
  const [showGenerate, setShowGenerate] = useState(false);

  const params = cadenceFilter ? { cadence: cadenceFilter } : undefined;
  const { data, isLoading, isError } = useReports(params);

  if (isLoading) {
    return <div className={styles.statusContainer} role="status" aria-label="Loading">Loading…</div>;
  }

  if (isError) {
    return (
      <div className={styles.statusContainer} role="alert">
        <p className={styles.errorText}>Failed to load reports. Please try again.</p>
      </div>
    );
  }

  const reports = data?.data ?? [];

  return (
    <div className={styles.page}>
      {showGenerate && <GenerateForm onClose={() => setShowGenerate(false)} />}

      <div className={styles.header}>
        <h1 className={styles.title}>Reports</h1>
        <div className={styles.headerRight}>
          <label htmlFor="cadence-filter" className={styles.filterLabel}>Cadence</label>
          <select
            id="cadence-filter"
            className={styles.filterSelect}
            value={cadenceFilter}
            onChange={(e) => setCadenceFilter(e.target.value as ReportCadence | '')}
          >
            <option value="">All</option>
            {CADENCES.map((c) => (
              <option key={c} value={c}>{c.replace('_', '-')}</option>
            ))}
          </select>
          {userRole === 'admin' && (
            <button
              type="button"
              className={styles.generateBtn}
              onClick={() => setShowGenerate(true)}
              aria-label="Generate new report"
            >
              Generate Report
            </button>
          )}
        </div>
      </div>

      {reports.length === 0 ? (
        <p className={styles.emptyText}>No reports found.</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Cadence</th>
                <th>Period Start</th>
                <th>Period End</th>
                <th>SHA-256</th>
                <th>PDF</th>
                <th>Generated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <ReportRow key={report.id} report={report} userRole={userRole} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
