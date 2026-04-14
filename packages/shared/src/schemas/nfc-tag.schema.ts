import { z } from 'zod';

export const NfcTagStatusSchema = z.enum([
  'provisioned',
  'active',
  'inactive',
  'replaced',
]);

export type NfcTagStatus = z.infer<typeof NfcTagStatusSchema>;

/** Provisioning request — Admin only, via Expo NFC provisioning screen */
export const ProvisionNfcTagSchema = z
  .object({
    tag_id: z.string().min(1).max(100).trim(),
    asset_id: z.string().uuid().optional(),
    vehicle_id: z.string().uuid().optional(),
  })
  .refine(
    (data) => (data.asset_id == null) !== (data.vehicle_id == null),
    {
      message: 'Exactly one of asset_id or vehicle_id must be provided',
      path: ['asset_id'],
    }
  );

export type ProvisionNfcTag = z.infer<typeof ProvisionNfcTagSchema>;

/** Field technician confirms tag is mounted and active */
export const ConfirmNfcTagInstallSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  photo_url: z.string().url('Photo URL must be a valid URL'),
});

export type ConfirmNfcTagInstall = z.infer<typeof ConfirmNfcTagInstallSchema>;

export const NfcTagSchema = z.object({
  id: z.string().uuid(),
  tag_id: z.string(),
  status: NfcTagStatusSchema,
  asset_id: z.string().uuid().nullable(),
  vehicle_id: z.string().uuid().nullable(),
  vault_secret_id: z.string().nullable(),
  provisioned_by: z.string().uuid(),
  replaced_by: z.string().uuid().nullable(),
  install_lat: z.number().nullable(),
  install_lng: z.number().nullable(),
  install_photo_url: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type NfcTag = z.infer<typeof NfcTagSchema>;
