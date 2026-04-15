import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ApiClientVehicle } from '@fieldops/api-client';
import styles from './VehicleFormModal.module.css';

const vehicleFormSchema = z.object({
  vehicle_code: z.string().min(1, 'Vehicle code is required').max(50),
  plate_number: z.string().min(1, 'Plate number is required').max(20),
  model: z.string().max(100).optional(),
});

type VehicleFormValues = z.infer<typeof vehicleFormSchema>;

interface VehicleFormModalProps {
  vehicle?: ApiClientVehicle | null;
  onSubmit: (values: VehicleFormValues) => void;
  onClose: () => void;
  isSubmitting: boolean;
}

export function VehicleFormModal({ vehicle, onSubmit, onClose, isSubmitting }: VehicleFormModalProps) {
  const isEdit = !!vehicle;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: vehicle
      ? {
          vehicle_code: vehicle.vehicle_code,
          plate_number: vehicle.plate_number,
          model: vehicle.model ?? '',
        }
      : undefined,
  });

  useEffect(() => {
    if (vehicle) {
      reset({
        vehicle_code: vehicle.vehicle_code,
        plate_number: vehicle.plate_number,
        model: vehicle.model ?? '',
      });
    } else {
      reset({});
    }
  }, [vehicle, reset]);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="vehicle-modal-title">
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 id="vehicle-modal-title" className={styles.title}>
            {isEdit ? 'Edit Vehicle' : 'Create Vehicle'}
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="vehicle_code">
              Vehicle Code
            </label>
            <input
              id="vehicle_code"
              className={styles.input}
              {...register('vehicle_code')}
              disabled={isEdit}
              placeholder="e.g. VH-001"
            />
            {errors.vehicle_code && (
              <span className={styles.error}>{errors.vehicle_code.message}</span>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="plate_number">
              Plate Number
            </label>
            <input
              id="plate_number"
              className={styles.input}
              {...register('plate_number')}
              placeholder="e.g. ABC-1234"
            />
            {errors.plate_number && (
              <span className={styles.error}>{errors.plate_number.message}</span>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="model">
              Model (optional)
            </label>
            <input
              id="model"
              className={styles.input}
              {...register('model')}
              placeholder="e.g. Toyota Land Cruiser"
            />
            {errors.model && <span className={styles.error}>{errors.model.message}</span>}
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Vehicle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
