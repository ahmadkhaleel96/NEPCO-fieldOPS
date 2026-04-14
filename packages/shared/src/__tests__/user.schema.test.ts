import { describe, it, expect } from 'vitest';
import {
  UserRoleSchema,
  CreateUserSchema,
  UpdateUserSchema,
  UserSchema,
  MFA_REQUIRED_ROLES,
} from '../schemas/user.schema';

describe('UserRoleSchema', () => {
  it('accepts all valid roles', () => {
    const roles = ['admin', 'engineer', 'team_leader', 'technician', 'driver'];
    for (const role of roles) {
      expect(() => UserRoleSchema.parse(role)).not.toThrow();
    }
  });

  it('rejects unknown roles', () => {
    expect(() => UserRoleSchema.parse('superuser')).toThrow();
    expect(() => UserRoleSchema.parse('')).toThrow();
    expect(() => UserRoleSchema.parse(null)).toThrow();
  });
});

describe('MFA_REQUIRED_ROLES', () => {
  it('includes admin and engineer', () => {
    expect(MFA_REQUIRED_ROLES).toContain('admin');
    expect(MFA_REQUIRED_ROLES).toContain('engineer');
  });

  it('does not include field roles', () => {
    expect(MFA_REQUIRED_ROLES).not.toContain('driver');
    expect(MFA_REQUIRED_ROLES).not.toContain('technician');
    expect(MFA_REQUIRED_ROLES).not.toContain('team_leader');
  });
});

describe('CreateUserSchema', () => {
  const valid = {
    email: 'ali@nepco.jo',
    full_name: 'Ali Al-Hassan',
    role: 'engineer',
  };

  it('accepts a valid user creation payload', () => {
    expect(() => CreateUserSchema.parse(valid)).not.toThrow();
  });

  it('rejects an invalid email', () => {
    const result = CreateUserSchema.safeParse({ ...valid, email: 'not-an-email' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('email');
    }
  });

  it('rejects a full_name that is too short', () => {
    const result = CreateUserSchema.safeParse({ ...valid, full_name: 'A' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('full_name');
    }
  });

  it('rejects a full_name that is too long', () => {
    const result = CreateUserSchema.safeParse({
      ...valid,
      full_name: 'A'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('accepts an optional valid phone number', () => {
    expect(() =>
      CreateUserSchema.parse({ ...valid, phone: '+962791234567' })
    ).not.toThrow();
  });

  it('rejects a malformed phone number', () => {
    const result = CreateUserSchema.safeParse({ ...valid, phone: '123' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('phone');
    }
  });

  it('trims full_name whitespace', () => {
    const result = CreateUserSchema.parse({ ...valid, full_name: '  Ali  ' });
    expect(result.full_name).toBe('Ali');
  });

  it('rejects missing required fields', () => {
    expect(() => CreateUserSchema.parse({})).toThrow();
    expect(() => CreateUserSchema.parse({ email: 'a@b.com' })).toThrow();
    expect(() =>
      CreateUserSchema.parse({ email: 'a@b.com', full_name: 'Name' })
    ).toThrow();
  });
});

describe('UpdateUserSchema', () => {
  it('accepts an empty update (all fields optional)', () => {
    expect(() => UpdateUserSchema.parse({})).not.toThrow();
  });

  it('accepts partial updates', () => {
    expect(() => UpdateUserSchema.parse({ is_active: false })).not.toThrow();
    expect(() => UpdateUserSchema.parse({ role: 'technician' })).not.toThrow();
    expect(() => UpdateUserSchema.parse({ push_token: null })).not.toThrow();
  });

  it('rejects an invalid role in update', () => {
    const result = UpdateUserSchema.safeParse({ role: 'god' });
    expect(result.success).toBe(false);
  });

  it('allows nulling the phone number', () => {
    const result = UpdateUserSchema.parse({ phone: null });
    expect(result.phone).toBeNull();
  });
});

describe('UserSchema', () => {
  const validUser = {
    id: '00000000-0000-0000-0000-000000000001',
    auth_id: '00000000-0000-0000-0000-000000000002',
    email: 'admin@nepco.jo',
    full_name: 'Ahmad Admin',
    role: 'admin',
    phone: null,
    is_active: true,
    push_token: null,
    mfa_enabled: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };

  it('parses a valid user record', () => {
    const result = UserSchema.parse(validUser);
    expect(result.id).toBe(validUser.id);
    expect(result.role).toBe('admin');
  });

  it('rejects a record with an invalid UUID', () => {
    const result = UserSchema.safeParse({ ...validUser, id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects a record with an invalid datetime', () => {
    const result = UserSchema.safeParse({ ...validUser, created_at: '2026/01/01' });
    expect(result.success).toBe(false);
  });

  it('rejects a record with a missing required field', () => {
    const { email: _, ...withoutEmail } = validUser;
    const result = UserSchema.safeParse(withoutEmail);
    expect(result.success).toBe(false);
  });
});
