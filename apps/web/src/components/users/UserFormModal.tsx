import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ApiClientUser } from '@fieldops/api-client';
import styles from './UserFormModal.module.css';

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'engineer', label: 'Engineer' },
  { value: 'team_leader', label: 'Team Leader' },
  { value: 'technician', label: 'Technician' },
  { value: 'driver', label: 'Driver' },
] as const;

const CreateSchema = z.object({
  email: z.string().email('Invalid email address'),
  full_name: z.string().min(2, 'At least 2 characters').max(100).trim(),
  role: z.enum(['admin', 'engineer', 'team_leader', 'technician', 'driver']),
  phone: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, 'E.164 format required (e.g. +962791234567)')
    .optional()
    .or(z.literal('')),
});

const EditSchema = z.object({
  full_name: z.string().min(2, 'At least 2 characters').max(100).trim(),
  role: z.enum(['admin', 'engineer', 'team_leader', 'technician', 'driver']),
  phone: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, 'E.164 format required (e.g. +962791234567)')
    .optional()
    .or(z.literal('')),
});

type CreateFormValues = z.infer<typeof CreateSchema>;
type EditFormValues = z.infer<typeof EditSchema>;

interface UserFormModalProps {
  mode: 'create' | 'edit';
  user?: ApiClientUser;
  onSubmit: (values: CreateFormValues | EditFormValues) => void;
  onClose: () => void;
  isSubmitting: boolean;
  error?: string;
}

export function UserFormModal({
  mode,
  user,
  onSubmit,
  onClose,
  isSubmitting,
  error,
}: UserFormModalProps) {
  const isEdit = mode === 'edit';
  const schema = isEdit ? EditSchema : CreateSchema;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(schema),
    defaultValues: isEdit && user
      ? { full_name: user.full_name, role: user.role, phone: user.phone ?? '' }
      : { email: '', full_name: '', role: 'technician', phone: '' },
  });

  useEffect(() => {
    if (isEdit && user) {
      reset({ full_name: user.full_name, role: user.role, phone: user.phone ?? '' });
    }
  }, [isEdit, user, reset]);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit user' : 'Create user'}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{isEdit ? 'Edit User' : 'Create User'}</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className={styles.modalBody}>
            {!isEdit && (
              <div className={styles.field}>
                <label htmlFor="email" className={styles.label}>Email address</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="off"
                  className={errors.email ? `${styles.input} ${styles.inputError}` : styles.input}
                  {...register('email')}
                />
                {errors.email && <p className={styles.fieldError}>{errors.email.message}</p>}
              </div>
            )}

            <div className={styles.field}>
              <label htmlFor="full_name" className={styles.label}>Full name</label>
              <input
                id="full_name"
                type="text"
                autoComplete="off"
                className={errors.full_name ? `${styles.input} ${styles.inputError}` : styles.input}
                {...register('full_name')}
              />
              {errors.full_name && <p className={styles.fieldError}>{errors.full_name.message}</p>}
            </div>

            <div className={styles.field}>
              <label htmlFor="role" className={styles.label}>Role</label>
              <select
                id="role"
                className={errors.role ? `${styles.select} ${styles.inputError}` : styles.select}
                {...register('role')}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              {errors.role && <p className={styles.fieldError}>{errors.role.message}</p>}
            </div>

            <div className={styles.field}>
              <label htmlFor="phone" className={styles.label}>
                Phone <span className={styles.optional}>(optional)</span>
              </label>
              <input
                id="phone"
                type="tel"
                placeholder="+962791234567"
                className={errors.phone ? `${styles.input} ${styles.inputError}` : styles.input}
                {...register('phone')}
              />
              {errors.phone && <p className={styles.fieldError}>{errors.phone.message}</p>}
            </div>

            {error && (
              <div className={styles.serverError} role="alert">
                {error}
              </div>
            )}
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create user'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
