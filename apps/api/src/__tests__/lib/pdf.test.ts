import { describe, it, expect } from 'vitest';
import { generateReportPdf } from '../../lib/pdf';
import type { ReportData } from '@fieldops/shared';

const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

const baseData: ReportData = {
  period_start: '2026-04-01T00:00:00.000Z',
  period_end: '2026-04-30T23:59:59.000Z',
  cadence: 'monthly',
  summary: {
    total_permits: 10,
    completed_permits: 8,
    incomplete_permits: 1,
    suspended_permits: 1,
    total_trips: 9,
    total_inspections: 25,
    approved_changes: 12,
    rejected_changes: 3,
    safety_reports: 2,
    total_nfc_events: 80,
  },
  by_asset_type: [
    { asset_type: 'hv_tower', inspection_count: 15, change_count: 8 },
    { asset_type: 'substation', inspection_count: 10, change_count: 7 },
  ],
  by_engineer: [
    { engineer_id: uuid(1), permit_count: 6, approval_count: 10 },
    { engineer_id: uuid(2), permit_count: 4, approval_count: 5 },
  ],
};

const report = {
  id: uuid(99),
  cadence: 'monthly',
  period_start: baseData.period_start,
  period_end: baseData.period_end,
  data: baseData,
};

describe('generateReportPdf', () => {
  it('returns a Uint8Array', async () => {
    const result = await generateReportPdf(report);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('produces a valid PDF (starts with %PDF magic bytes)', async () => {
    const result = await generateReportPdf(report);
    // %PDF in ASCII: 0x25 0x50 0x44 0x46
    expect(result[0]).toBe(0x25);
    expect(result[1]).toBe(0x50);
    expect(result[2]).toBe(0x44);
    expect(result[3]).toBe(0x46);
  });

  it('produces output with non-zero length', async () => {
    const result = await generateReportPdf(report);
    expect(result.length).toBeGreaterThan(100);
  });

  it('handles empty by_asset_type array', async () => {
    const result = await generateReportPdf({
      ...report,
      data: { ...baseData, by_asset_type: [] },
    });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('handles empty by_engineer array', async () => {
    const result = await generateReportPdf({
      ...report,
      data: { ...baseData, by_engineer: [] },
    });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('handles all-zero summary counts', async () => {
    const result = await generateReportPdf({
      ...report,
      data: {
        ...baseData,
        summary: {
          total_permits: 0, completed_permits: 0, incomplete_permits: 0,
          suspended_permits: 0, total_trips: 0, total_inspections: 0,
          approved_changes: 0, rejected_changes: 0, safety_reports: 0,
          total_nfc_events: 0,
        },
      },
    });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('handles many by_asset_type entries (page overflow guard)', async () => {
    const manyTypes = Array.from({ length: 30 }, (_, i) => ({
      asset_type: `asset_type_${i}`,
      inspection_count: i,
      change_count: i,
    }));
    const result = await generateReportPdf({
      ...report,
      data: { ...baseData, by_asset_type: manyTypes },
    });
    expect(result).toBeInstanceOf(Uint8Array);
  });
});
