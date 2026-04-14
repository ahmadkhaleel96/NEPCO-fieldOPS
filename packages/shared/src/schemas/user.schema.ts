import { z } from 'zod';

export const UserRoleSchema = z.enum([
  'admin',
  'engineer',
  'team_leader',
  'technician',
  'driver',
]);

export type UserRole = z.infer<typeof UserRoleSchema>;

/** Roles that require MFA — enforced at the auth layer */
export const MFA_REQUIRED_ROLES: UserRole[] = ['admin', 'engineer'];

export const CreateUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  full_name: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must be at most 100 characters')
    .trim(),
  role: UserRoleSchema,
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number (E.164 format expected)')
    .optional(),
});

export type CreateUser = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z.object({
  full_name: z
    .string()
    .min(2)
    .max(100)
    .trim()
    .optional(),
  role: UserRoleSchema.optional(),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/)
    .nullable()
    .optional(),
  is_active: z.boolean().optional(),
  push_token: z.string().nullable().optional(),
});

export type UpdateUser = z.infer<typeof UpdateUserSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  auth_id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string(),
  role: UserRoleSchema,
  phone: z.string().nullable(),
  is_active: z.boolean(),
  push_token: z.string().nullable(),
  mfa_enabled: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;

export const UserListResponseSchema = z.object({
  data: z.array(UserSchema),
  count: z.number().int().nonnegative(),
});

export type UserListResponse = z.infer<typeof UserListResponseSchema>;
