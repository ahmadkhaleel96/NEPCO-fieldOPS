import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { CreateWorkPermitPayload } from '@fieldops/api-client';
import styles from './WorkPermitFormModal.module.css';

const permitFormSchema = z
  .object({
    permit_type: z.enum(['maintenance', 'inspection', 'emergency', 'installation']),
    vehicle_id: z.string().uuid('Must be a valid UUID'),
    asset_ids_text: z.string().min(1, 'At least one asset ID required'),
    scheduled_start: z.string().min(1, 'Start date is required'),
    scheduled_end: z.string().min(1, 'End date is required'),
    safety_notes: z.string().max(2000).optional(),
    driver_id: z.string().uuid('Must be a valid UUID'),
    leader_id: z.string().uuid('Must be a valid UUID'),
    technician_ids_text: z.string().min(1, 'At least one technician ID required'),
  })
  .refine(
    (d) => !d.scheduled_start || !d.scheduled_end || d.scheduled_end > d.scheduled_start,
    { message: 'End must be after start', path: ['scheduled_end'] }
  );

type PermitFormValues = z.infer<typeof permitFormSchema>;

interface WorkPermitFormModalProps {
  onSubmit: (payload: CreateWorkPermitPayload) => void;
  onClose: () => void;
  isSubmitting: boolean;
}

function splitLines(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function WorkPermitFormModal({ onSubmit, onClose, isSubmitting }: WorkPermitFormModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PermitFormValues>({
    resolver: zodResolver(permitFormSchema),
  });

  function handleFormSubmit(values: PermitFormValues) {
    const payload: CreateWorkPermitPayload = {
      permit_type: values.permit_type,
      vehicle_id: values.vehicle_id,
      asset_ids: splitLines(values.asset_ids_text),
      scheduled_start: new Date(values.scheduled_start).toISOString(),
      scheduled_end: new Date(values.scheduled_end).toISOString(),
      safety_notes: values.safety_notes || undefined,
      team: {
        driver_id: values.driver_id,
        leader_id: values.leader_id,
        technician_ids: splitLines(values.technician_ids_text),
      },
    };
    onSubmit(payload);
  }

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="permit-modal-title"
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 id="permit-modal-title" className={styles.title}>
            Create Work Permit
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit(handleFormSubmit)}>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="permit_type">
                Permit Type
              </label>
              <select id="permit_type" className={styles.select} {...register('permit_type')}>
                <option value="">Select type…</option>
                <option value="maintenance">Maintenance</option>
                <option value="inspection">Inspection</option>
                <option value="emergency">Emergency</option>
                <option value="installation">Installation</option>
              </select>
              {errors.permit_type && (
                <span className={styles.error}>{errors.permit_type.message}</span>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="vehicle_id">
                Vehicle ID
              </label>
              <input
                id="vehicle_id"
                className={styles.input}
                {...register('vehicle_id')}
                placeholder="UUID"
              />
              {errors.vehicle_id && (
                <span className={styles.error}>{errors.vehicle_id.message}</span>
              )}
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="scheduled_start">
                Scheduled Start
              </label>
              <input
                id="scheduled_start"
                type="datetime-local"
                className={styles.input}
                {...register('scheduled_start')}
              />
              {errors.scheduled_start && (
                <span className={styles.error}>{errors.scheduled_start.message}</span>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="scheduled_end">
                Scheduled End
              </label>
              <input
                id="scheduled_end"
                type="datetime-local"
                className={styles.input}
                {...register('scheduled_end')}
              />
              {errors.scheduled_end && (
                <span className={styles.error}>{errors.scheduled_end.message}</span>
              )}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="asset_ids_text">
              Asset IDs (one per line)
            </label>
            <textarea
              id="asset_ids_text"
              className={styles.textarea}
              {...register('asset_ids_text')}
              placeholder={'00000000-0000-0000-0000-000000000001\n00000000-0000-0000-0000-000000000002'}
            />
            {errors.asset_ids_text && (
              <span className={styles.error}>{errors.asset_ids_text.message}</span>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="safety_notes">
              Safety Notes (optional)
            </label>
            <textarea
              id="safety_notes"
              className={styles.textarea}
              {...register('safety_notes')}
              placeholder="Any safety precautions or hazards to note…"
            />
            {errors.safety_notes && (
              <span className={styles.error}>{errors.safety_notes.message}</span>
            )}
          </div>

          <p className={styles.sectionLabel}>Team</p>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="driver_id">
                Driver ID
              </label>
              <input
                id="driver_id"
                className={styles.input}
                {...register('driver_id')}
                placeholder="UUID"
              />
              {errors.driver_id && (
                <span className={styles.error}>{errors.driver_id.message}</span>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="leader_id">
                Team Leader ID
              </label>
              <input
                id="leader_id"
                className={styles.input}
                {...register('leader_id')}
                placeholder="UUID"
              />
              {errors.leader_id && (
                <span className={styles.error}>{errors.leader_id.message}</span>
              )}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="technician_ids_text">
              Technician IDs (one per line)
            </label>
            <textarea
              id="technician_ids_text"
              className={styles.textarea}
              {...register('technician_ids_text')}
              placeholder="00000000-0000-0000-0000-000000000001"
            />
            {errors.technician_ids_text && (
              <span className={styles.error}>{errors.technician_ids_text.message}</span>
            )}
          </div>

          <div className={styles.footer}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create Permit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
