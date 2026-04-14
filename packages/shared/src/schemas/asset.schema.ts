import { z } from 'zod';

export const AssetTypeSchema = z.enum([
  'hv_tower',
  'substation',
  'switchgear',
  'cable_joint',
  'distribution_cabinet',
]);

export type AssetType = z.infer<typeof AssetTypeSchema>;

/** Base coordinates — reused across multiple schemas */
export const CoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type Coordinates = z.infer<typeof CoordinatesSchema>;

/** Per-type metadata shapes validated at the API boundary */
export const HvTowerMetadataSchema = z.object({
  tower_number: z.string().min(1),
  line_name: z.string().min(1),
  voltage_kv: z.number().positive(),
  structure_type: z.string().optional(),
  year_installed: z.number().int().min(1900).max(2100).optional(),
  corrosion_level: z.enum(['none', 'minor', 'moderate', 'severe']).optional(),
  last_inspection_date: z.string().datetime().optional(),
});

export const SubstationMetadataSchema = z.object({
  substation_name: z.string().min(1),
  voltage_in_kv: z.number().positive(),
  voltage_out_kv: z.number().positive(),
  capacity_mva: z.number().positive().optional(),
  year_commissioned: z.number().int().min(1900).max(2100).optional(),
});

export const SwitchgearMetadataSchema = z.object({
  panel_id: z.string().min(1),
  voltage_kv: z.number().positive(),
  type: z.enum(['indoor', 'outdoor']).optional(),
});

export const CableJointMetadataSchema = z.object({
  cable_id: z.string().min(1),
  joint_type: z.string().optional(),
  depth_m: z.number().nonnegative().optional(),
});

export const DistributionCabinetMetadataSchema = z.object({
  cabinet_id: z.string().min(1),
  circuit_count: z.number().int().positive().optional(),
});

/** Union discriminated by asset_type for strict API validation */
export const AssetMetadataByTypeSchema = z.discriminatedUnion('asset_type', [
  z.object({ asset_type: z.literal('hv_tower'), metadata: HvTowerMetadataSchema }),
  z.object({ asset_type: z.literal('substation'), metadata: SubstationMetadataSchema }),
  z.object({ asset_type: z.literal('switchgear'), metadata: SwitchgearMetadataSchema }),
  z.object({ asset_type: z.literal('cable_joint'), metadata: CableJointMetadataSchema }),
  z.object({
    asset_type: z.literal('distribution_cabinet'),
    metadata: DistributionCabinetMetadataSchema,
  }),
]);

export const CreateAssetSchema = z
  .object({
    asset_code: z.string().min(1).max(50).trim(),
    asset_type: AssetTypeSchema,
    name: z.string().min(1).max(200).trim(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    metadata: z.record(z.unknown()),
  });

export type CreateAsset = z.infer<typeof CreateAssetSchema>;

export const UpdateAssetSchema = CreateAssetSchema.partial().omit({ asset_code: true });

export type UpdateAsset = z.infer<typeof UpdateAssetSchema>;

export const AssetSchema = z.object({
  id: z.string().uuid(),
  asset_code: z.string(),
  asset_type: AssetTypeSchema,
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  metadata: z.record(z.unknown()),
  is_active: z.boolean(),
  created_by: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Asset = z.infer<typeof AssetSchema>;

export const AssetListResponseSchema = z.object({
  data: z.array(AssetSchema),
  count: z.number().int().nonnegative(),
});

export type AssetListResponse = z.infer<typeof AssetListResponseSchema>;

/** Used for CSV bulk import */
export const AssetCsvRowSchema = z.object({
  asset_code: z.string().min(1),
  asset_type: AssetTypeSchema,
  name: z.string().min(1),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

export type AssetCsvRow = z.infer<typeof AssetCsvRowSchema>;
