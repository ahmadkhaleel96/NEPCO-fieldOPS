import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import styles from './ProvisionModal.module.css';

const provisionSchema = z
  .object({
    tag_id: z.string().min(1, 'Tag ID is required').max(100),
    link_to: z.enum(['asset', 'vehicle']),
    asset_id: z.string().uuid('Must be a valid UUID').optional().or(z.literal('')),
    vehicle_id: z.string().uuid('Must be a valid UUID').optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (data.link_to === 'asset' && !data.asset_id) {
      ctx.addIssue({ code: 'custom', path: ['asset_id'], message: 'Asset ID is required' });
    }
    if (data.link_to === 'vehicle' && !data.vehicle_id) {
      ctx.addIssue({ code: 'custom', path: ['vehicle_id'], message: 'Vehicle ID is required' });
    }
  });

type ProvisionFormValues = z.infer<typeof provisionSchema>;

interface ProvisionModalProps {
  onSubmit: (values: { tag_id: string; asset_id?: string; vehicle_id?: string }) => void;
  onClose: () => void;
  isSubmitting: boolean;
}

export function ProvisionModal({ onSubmit, onClose, isSubmitting }: ProvisionModalProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ProvisionFormValues>({
    resolver: zodResolver(provisionSchema),
    defaultValues: { link_to: 'asset' },
  });

  const linkTo = watch('link_to');

  function onValid(values: ProvisionFormValues) {
    onSubmit({
      tag_id: values.tag_id,
      asset_id: values.link_to === 'asset' ? values.asset_id : undefined,
      vehicle_id: values.link_to === 'vehicle' ? values.vehicle_id : undefined,
    });
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="provision-modal-title">
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 id="provision-modal-title" className={styles.title}>
            Provision NFC Tag
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit(onValid)}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="tag_id">
              Tag ID
            </label>
            <input
              id="tag_id"
              className={styles.input}
              {...register('tag_id')}
              placeholder="Physical chip identifier (e.g. 04A3B2C1)"
            />
            {errors.tag_id && <span className={styles.error}>{errors.tag_id.message}</span>}
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Link to</span>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input type="radio" value="asset" {...register('link_to')} />
                Asset
              </label>
              <label className={styles.radioLabel}>
                <input type="radio" value="vehicle" {...register('link_to')} />
                Vehicle
              </label>
            </div>
          </div>

          {linkTo === 'asset' && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="asset_id">
                Asset ID (UUID)
              </label>
              <input
                id="asset_id"
                className={styles.input}
                {...register('asset_id')}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
              {errors.asset_id && <span className={styles.error}>{errors.asset_id.message}</span>}
            </div>
          )}

          {linkTo === 'vehicle' && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="vehicle_id">
                Vehicle ID (UUID)
              </label>
              <input
                id="vehicle_id"
                className={styles.input}
                {...register('vehicle_id')}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
              {errors.vehicle_id && (
                <span className={styles.error}>{errors.vehicle_id.message}</span>
              )}
            </div>
          )}

          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
              {isSubmitting ? 'Provisioning…' : 'Provision Tag'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
