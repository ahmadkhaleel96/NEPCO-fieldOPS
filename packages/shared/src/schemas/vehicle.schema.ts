import { z } from 'zod';

export const CreateVehicleSchema = z.object({
  vehicle_code: z.string().min(1).max(50).trim(),
  plate_number: z
    .string()
    .min(1)
    .max(20)
    .trim()
    .toUpperCase(),
  model: z.string().max(100).trim().optional(),
});

export type CreateVehicle = z.infer<typeof CreateVehicleSchema>;

export const UpdateVehicleSchema = z.object({
  plate_number: z.string().min(1).max(20).trim().toUpperCase().optional(),
  model: z.string().max(100).trim().nullable().optional(),
  is_active: z.boolean().optional(),
});

export type UpdateVehicle = z.infer<typeof UpdateVehicleSchema>;

export const VehicleSchema = z.object({
  id: z.string().uuid(),
  vehicle_code: z.string(),
  plate_number: z.string(),
  model: z.string().nullable(),
  is_active: z.boolean(),
  created_by: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Vehicle = z.infer<typeof VehicleSchema>;

export const VehicleListResponseSchema = z.object({
  data: z.array(VehicleSchema),
  count: z.number().int().nonnegative(),
});

export type VehicleListResponse = z.infer<typeof VehicleListResponseSchema>;
