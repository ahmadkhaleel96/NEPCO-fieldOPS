import { z } from 'zod';

export const InspectionStatusSchema = z.enum([
  'open',
  'pending',
  'incomplete',
  'deferred',
]);

export type InspectionStatus = z.infer<typeof InspectionStatusSchema>;

export const IncompleteReasonSchema = z.enum([
  'device_failure',
  'safety_hazard',
  'access_restricted',
  'equipment_missing',
]);

export type IncompleteReason = z.infer<typeof IncompleteReasonSchema>;

export const ApprovalStatusSchema = z.enum(['pending', 'approved', 'rejected']);

export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

/** Submitted by mobile after completing site inspection */
export const SubmitInspectionSchema = z
  .object({
    trip_id: z.string().uuid(),
    asset_id: z.string().uuid(),
    status: InspectionStatusSchema,
    form_data: z.record(z.unknown()),
    incomplete_reason: IncompleteReasonSchema.optional(),
    /** Client-generated UUID — used for idempotent offline re-submissions */
    idempotency_key: z.string().uuid(),
  })
  .refine(
    (data) =>
      data.status !== 'incomplete' || data.incomplete_reason !== undefined,
    {
      message: 'incomplete_reason is required when status is incomplete',
      path: ['incomplete_reason'],
    }
  );

export type SubmitInspection = z.infer<typeof SubmitInspectionSchema>;

export const AssetInspectionSchema = z.object({
  id: z.string().uuid(),
  trip_id: z.string().uuid(),
  asset_id: z.string().uuid(),
  submitted_by: z.string().uuid(),
  status: InspectionStatusSchema,
  form_data: z.record(z.unknown()),
  incomplete_reason: IncompleteReasonSchema.nullable(),
  idempotency_key: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type AssetInspection = z.infer<typeof AssetInspectionSchema>;

export const AssetChangeSchema = z.object({
  id: z.string().uuid(),
  inspection_id: z.string().uuid(),
  asset_id: z.string().uuid(),
  field_name: z.string(),
  old_value: z.unknown().nullable(),
  new_value: z.unknown(),
  status: ApprovalStatusSchema,
  reviewed_by: z.string().uuid().nullable(),
  reviewed_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
});

export type AssetChange = z.infer<typeof AssetChangeSchema>;

/** Engineer approves or rejects a field-level change */
export const ReviewChangeSchema = z.object({
  action: z.enum(['approve', 'reject']),
  notes: z.string().max(500).optional(),
});

export type ReviewChange = z.infer<typeof ReviewChangeSchema>;

export const AssetHistorySchema = z.object({
  id: z.string().uuid(),
  asset_id: z.string().uuid(),
  change_id: z.string().uuid(),
  field_name: z.string(),
  old_value: z.unknown().nullable(),
  new_value: z.unknown(),
  approved_by: z.string().uuid(),
  approved_at: z.string().datetime(),
});

export type AssetHistory = z.infer<typeof AssetHistorySchema>;

/** Safety hazard report — auto-created when incomplete_reason is 'safety_hazard' */
export const CreateSafetyReportSchema = z.object({
  inspection_id: z.string().uuid(),
  trip_id: z.string().uuid(),
  hazard_description: z
    .string()
    .min(20, 'Hazard description must be at least 20 characters')
    .max(2000),
  photo_urls: z.array(z.string().url()).min(1, 'At least one photo is required'),
});

export type CreateSafetyReport = z.infer<typeof CreateSafetyReportSchema>;

export const SafetyReportSchema = z.object({
  id: z.string().uuid(),
  report_number: z.string(),
  inspection_id: z.string().uuid(),
  trip_id: z.string().uuid(),
  reported_by: z.string().uuid(),
  hazard_description: z.string(),
  photo_urls: z.array(z.string()),
  created_at: z.string().datetime(),
});

export type SafetyReport = z.infer<typeof SafetyReportSchema>;

export const FollowUpTaskSchema = z.object({
  id: z.string().uuid(),
  inspection_id: z.string().uuid(),
  asset_id: z.string().uuid(),
  assigned_to: z.string().uuid().nullable(),
  partial_form_data: z.record(z.unknown()),
  notes: z.string().nullable(),
  resolved_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type FollowUpTask = z.infer<typeof FollowUpTaskSchema>;

export const ResolveFollowUpTaskSchema = z.object({
  notes: z.string().max(500).optional(),
});

export type ResolveFollowUpTask = z.infer<typeof ResolveFollowUpTaskSchema>;
