import { z } from 'zod';

export const WorkPermitStatusSchema = z.enum([
  'draft',
  'issued',
  'active',
  'completed',
  'incomplete',
  'suspended',
  'withdrawn',
]);

export type WorkPermitStatus = z.infer<typeof WorkPermitStatusSchema>;

export const WorkPermitTypeSchema = z.enum([
  'maintenance',
  'inspection',
  'emergency',
  'installation',
]);

export type WorkPermitType = z.infer<typeof WorkPermitTypeSchema>;

export const CreateWorkPermitSchema = z
  .object({
    permit_type: WorkPermitTypeSchema,
    vehicle_id: z.string().uuid('Invalid vehicle ID'),
    asset_ids: z
      .array(z.string().uuid())
      .min(1, 'At least one asset must be selected'),
    scheduled_start: z.string().datetime('Invalid ISO datetime for scheduled_start'),
    scheduled_end: z.string().datetime('Invalid ISO datetime for scheduled_end'),
    safety_notes: z.string().max(2000).optional(),
    team: z.object({
      driver_id: z.string().uuid('Driver is required'),
      leader_id: z.string().uuid('Team leader is required'),
      technician_ids: z
        .array(z.string().uuid())
        .min(1, 'At least one technician is required'),
    }),
  })
  .refine(
    (data) => new Date(data.scheduled_end) > new Date(data.scheduled_start),
    {
      message: 'scheduled_end must be after scheduled_start',
      path: ['scheduled_end'],
    }
  );

export type CreateWorkPermit = z.infer<typeof CreateWorkPermitSchema>;

export const WithdrawPermitSchema = z.object({
  reason: z
    .string()
    .min(10, 'Withdrawal reason must be at least 10 characters')
    .max(500),
});

export type WithdrawPermit = z.infer<typeof WithdrawPermitSchema>;

export const PermitMemberSchema = z.object({
  id: z.string().uuid(),
  permit_id: z.string().uuid(),
  user_id: z.string().uuid(),
  accepted_at: z.string().datetime().nullable(),
  withdrawn_at: z.string().datetime().nullable(),
  withdrawal_reason: z.string().nullable(),
  created_at: z.string().datetime(),
});

export type PermitMember = z.infer<typeof PermitMemberSchema>;

export const WorkPermitSchema = z.object({
  id: z.string().uuid(),
  permit_number: z.string(),
  permit_type: WorkPermitTypeSchema,
  status: WorkPermitStatusSchema,
  engineer_id: z.string().uuid(),
  vehicle_id: z.string().uuid(),
  scheduled_start: z.string().datetime(),
  scheduled_end: z.string().datetime(),
  safety_notes: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type WorkPermit = z.infer<typeof WorkPermitSchema>;

export const WorkPermitDetailSchema = WorkPermitSchema.extend({
  members: z.array(PermitMemberSchema),
  asset_ids: z.array(z.string().uuid()),
});

export type WorkPermitDetail = z.infer<typeof WorkPermitDetailSchema>;

export const WorkPermitListResponseSchema = z.object({
  data: z.array(WorkPermitSchema),
  count: z.number().int().nonnegative(),
});

export type WorkPermitListResponse = z.infer<typeof WorkPermitListResponseSchema>;
