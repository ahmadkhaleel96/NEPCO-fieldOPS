import { describe, it, expect } from 'vitest';
import {
  ReportCadenceSchema,
  ReportDataSchema,
  ReportSchema,
} from '../schemas/report.schema';

const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

const validReportData = {
  period_start: '2026-01-01T00:00:00.000Z',
  period_end: '2026-01-31T23:59:59.000Z',
  cadence: 'monthly',
  summary: {
    total_permits: 42,
    completed_permits: 38,
    incomplete_permits: 2,
    suspended_permits: 1,
    total_trips: 40,
    total_inspections: 120,
    approved_changes: 95,
    rejected_changes: 5,
    safety_reports: 3,
    total_nfc_events: 280,
  },
  by_asset_type: [
    { asset_type: 'hv_tower', inspection_count: 80, change_count: 60 },
    { asset_type: 'substation', inspection_count: 40, change_count: 35 },
  ],
  by_engineer: [
    { engineer_id: uuid(1), permit_count: 22, approval_count: 50 },
    { engineer_id: uuid(2), permit_count: 20, approval_count: 45 },
  ],
};

describe('ReportCadenceSchema', () => {
  it('accepts all valid cadences', () => {
    for (const c of ['daily', 'weekly', 'monthly', 'quarterly', 'bi_yearly', 'yearly']) {
      expect(() => ReportCadenceSchema.parse(c)).not.toThrow();
    }
  });

  it('rejects unknown cadence', () => {
    expect(() => ReportCadenceSchema.parse('hourly')).toThrow();
  });
});

describe('ReportDataSchema', () => {
  it('accepts a valid report data payload', () => {
    expect(() => ReportDataSchema.parse(validReportData)).not.toThrow();
  });

  it('rejects negative counts in summary', () => {
    const result = ReportDataSchema.safeParse({
      ...validReportData,
      summary: { ...validReportData.summary, total_permits: -1 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer counts', () => {
    const result = ReportDataSchema.safeParse({
      ...validReportData,
      summary: { ...validReportData.summary, total_permits: 1.5 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid engineer_id in by_engineer', () => {
    const result = ReportDataSchema.safeParse({
      ...validReportData,
      by_engineer: [{ engineer_id: 'not-uuid', permit_count: 5, approval_count: 10 }],
    });
    expect(result.success).toBe(false);
  });
});

describe('ReportSchema', () => {
  const validReport = {
    id: uuid(1),
    cadence: 'monthly',
    period_start: '2026-01-01T00:00:00.000Z',
    period_end: '2026-01-31T23:59:59.000Z',
    data: validReportData,
    sha256: 'a'.repeat(64),
    pdf_url: 'https://r2.example.com/reports/2026/monthly/RPT-001.pdf',
    csv_sent_at: null,
    generated_at: '2026-02-01T00:01:00.000Z',
  };

  it('parses a valid report record', () => {
    const result = ReportSchema.parse(validReport);
    expect(result.sha256).toHaveLength(64);
  });

  it('rejects a sha256 that is not 64 characters', () => {
    expect(
      ReportSchema.safeParse({ ...validReport, sha256: 'tooshort' }).success
    ).toBe(false);
  });

  it('accepts a report with null pdf_url', () => {
    const result = ReportSchema.parse({ ...validReport, pdf_url: null });
    expect(result.pdf_url).toBeNull();
  });

  it('rejects an invalid pdf_url', () => {
    expect(
      ReportSchema.safeParse({ ...validReport, pdf_url: 'not-a-url' }).success
    ).toBe(false);
  });
});
