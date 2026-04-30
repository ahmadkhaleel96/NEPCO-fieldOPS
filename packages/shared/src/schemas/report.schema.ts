import { z } from 'zod';

export const ReportCadenceSchema = z.enum([
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'bi_yearly',
  'yearly',
]);

export type ReportCadence = z.infer<typeof ReportCadenceSchema>;

/** Aggregated data payload structure — stored in reports.data jsonb */
export const ReportDataSchema = z.object({
  period_start: z.string().datetime(),
  period_end: z.string().datetime(),
  cadence: ReportCadenceSchema,
  summary: z.object({
    total_permits: z.number().int().nonnegative(),
    completed_permits: z.number().int().nonnegative(),
    incomplete_permits: z.number().int().nonnegative(),
    suspended_permits: z.number().int().nonnegative(),
    total_trips: z.number().int().nonnegative(),
    total_inspections: z.number().int().nonnegative(),
    approved_changes: z.number().int().nonnegative(),
    rejected_changes: z.number().int().nonnegative(),
    safety_reports: z.number().int().nonnegative(),
    total_nfc_events: z.number().int().nonnegative(),
  }),
  by_asset_type: z.array(
    z.object({
      asset_type: z.string(),
      inspection_count: z.number().int().nonnegative(),
      change_count: z.number().int().nonnegative(),
    })
  ),
  by_engineer: z.array(
    z.object({
      engineer_id: z.string().uuid(),
      permit_count: z.number().int().nonnegative(),
      approval_count: z.number().int().nonnegative(),
    })
  ),
});

export type ReportData = z.infer<typeof ReportDataSchema>;

export const ReportSchema = z.object({
  id: z.string().uuid(),
  cadence: ReportCadenceSchema,
  period_start: z.string().datetime(),
  period_end: z.string().datetime(),
  data: ReportDataSchema,
  sha256: z.string().length(64, 'SHA-256 must be 64 hex characters'),
  pdf_url: z.string().url().nullable(),
  csv_sent_at: z.string().datetime().nullable(),
  generated_at: z.string().datetime(),
});

export type Report = z.infer<typeof ReportSchema>;

export const ReportListResponseSchema = z.object({
  data: z.array(ReportSchema.omit({ data: true })),
  count: z.number().int().nonnegative(),
});

export type ReportListResponse = z.infer<typeof ReportListResponseSchema>;

export const GenerateReportSchema = z.object({
  cadence: ReportCadenceSchema,
  period_start: z.string().datetime({ message: 'period_start must be an ISO 8601 datetime' }),
  period_end: z.string().datetime({ message: 'period_end must be an ISO 8601 datetime' }),
}).refine(
  (d) => new Date(d.period_start) < new Date(d.period_end),
  { message: 'period_start must be before period_end', path: ['period_start'] }
);

export type GenerateReport = z.infer<typeof GenerateReportSchema>;

export const IntegrityAlertSchema = z.object({
  id: z.string().uuid(),
  report_id: z.string().uuid(),
  detected_at: z.string().datetime(),
  stored_hash: z.string(),
  actual_hash: z.string(),
  resolved: z.boolean(),
});

export type IntegrityAlert = z.infer<typeof IntegrityAlertSchema>;
