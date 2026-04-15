import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ApiClientAsset } from '@fieldops/api-client';
import styles from './AssetFormModal.module.css';

const assetFormSchema = z.object({
  asset_code: z.string().min(1, 'Asset code is required').max(50),
  asset_type: z.enum([
    'hv_tower',
    'substation',
    'switchgear',
    'cable_joint',
    'distribution_cabinet',
  ]),
  name: z.string().min(1, 'Name is required').max(200),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

type AssetFormValues = z.infer<typeof assetFormSchema>;

interface AssetFormModalProps {
  asset?: ApiClientAsset | null;
  onSubmit: (values: AssetFormValues & { metadata: Record<string, unknown> }) => void;
  onClose: () => void;
  isSubmitting: boolean;
}

const ASSET_TYPE_OPTIONS = [
  { value: 'hv_tower', label: 'HV Tower' },
  { value: 'substation', label: 'Substation' },
  { value: 'switchgear', label: 'Switchgear' },
  { value: 'cable_joint', label: 'Cable Joint' },
  { value: 'distribution_cabinet', label: 'Distribution Cabinet' },
] as const;

export function AssetFormModal({ asset, onSubmit, onClose, isSubmitting }: AssetFormModalProps) {
  const isEdit = !!asset;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AssetFormValues>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: asset
      ? {
          asset_code: asset.asset_code,
          asset_type: asset.asset_type,
          name: asset.name,
          latitude: asset.latitude,
          longitude: asset.longitude,
        }
      : undefined,
  });

  useEffect(() => {
    if (asset) {
      reset({
        asset_code: asset.asset_code,
        asset_type: asset.asset_type,
        name: asset.name,
        latitude: asset.latitude,
        longitude: asset.longitude,
      });
    } else {
      reset({});
    }
  }, [asset, reset]);

  function onValid(values: AssetFormValues) {
    onSubmit({ ...values, metadata: asset?.metadata ?? {} });
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="asset-modal-title">
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 id="asset-modal-title" className={styles.title}>
            {isEdit ? 'Edit Asset' : 'Create Asset'}
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit(onValid)}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="asset_code">
              Asset Code
            </label>
            <input
              id="asset_code"
              className={styles.input}
              {...register('asset_code')}
              disabled={isEdit}
              placeholder="e.g. TWR-001"
            />
            {errors.asset_code && (
              <span className={styles.error}>{errors.asset_code.message}</span>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="asset_type">
              Asset Type
            </label>
            <select id="asset_type" className={styles.select} {...register('asset_type')}>
              <option value="">Select type…</option>
              {ASSET_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.asset_type && (
              <span className={styles.error}>{errors.asset_type.message}</span>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="name">
              Name
            </label>
            <input
              id="name"
              className={styles.input}
              {...register('name')}
              placeholder="Descriptive name"
            />
            {errors.name && <span className={styles.error}>{errors.name.message}</span>}
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="latitude">
                Latitude
              </label>
              <input
                id="latitude"
                type="number"
                step="any"
                className={styles.input}
                {...register('latitude')}
                placeholder="e.g. 31.9539"
              />
              {errors.latitude && (
                <span className={styles.error}>{errors.latitude.message}</span>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="longitude">
                Longitude
              </label>
              <input
                id="longitude"
                type="number"
                step="any"
                className={styles.input}
                {...register('longitude')}
                placeholder="e.g. 35.9106"
              />
              {errors.longitude && (
                <span className={styles.error}>{errors.longitude.message}</span>
              )}
            </div>
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
