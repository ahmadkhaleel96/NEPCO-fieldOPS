import { describe, it, expect } from 'vitest';
import {
  WorkPermitStatusSchema,
  WorkPermitTypeSchema,
  CreateWorkPermitSchema,
  WithdrawPermitSchema,
  WorkPermitSchema,
  PermitMemberSchema,
} from '../schemas/work-permit.schema';

const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

describe('WorkPermitStatusSchema', () => {
  const validStatuses = [
    'draft', 'issued', 'active', 'completed',
    'incomplete', 'suspended', 'withdrawn',
  ];

  it('accepts all valid statuses', () => {
    for (const s of validStatuses) {
      expect(() => WorkPermitStatusSchema.parse(s)).not.toThrow();
    }
  });

  it('rejects unknown status', () => {
    expect(() => WorkPermitStatusSchema.parse('cancelled')).toThrow();
  });
});

describe('WorkPermitTypeSchema', () => {
  it('accepts all valid types', () => {
    for (const t of ['maintenance', 'inspection', 'emergency', 'installation']) {
      expect(() => WorkPermitTypeSchema.parse(t)).not.toThrow();
    }
  });
});

describe('CreateWorkPermitSchema', () => {
  const now = new Date();
  const start = new Date(now.getTime() + 60_000).toISOString();
  const end = new Date(now.getTime() + 3_600_000).toISOString();

  const valid = {
    permit_type: 'maintenance',
    vehicle_id: uuid(1),
    asset_ids: [uuid(2)],
    scheduled_start: start,
    scheduled_end: end,
    team: {
      driver_id: uuid(3),
      leader_id: uuid(4),
      technician_ids: [uuid(5)],
    },
  };

  it('accepts a valid permit creation payload', () => {
    expect(() => CreateWorkPermitSchema.parse(valid)).not.toThrow();
  });

  it('rejects end time before start time', () => {
    const result = CreateWorkPermitSchema.safeParse({
      ...valid,
      scheduled_start: end,
      scheduled_end: start,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/after/i);
    }
  });

  it('rejects equal start and end times', () => {
    const result = CreateWorkPermitSchema.safeParse({
      ...valid,
      scheduled_start: start,
      scheduled_end: start,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty asset_ids array', () => {
    const result = CreateWorkPermitSchema.safeParse({ ...valid, asset_ids: [] });
    expect(result.success).toBe(false);
  });

  it('rejects an empty technician_ids array', () => {
    const result = CreateWorkPermitSchema.safeParse({
      ...valid,
      team: { ...valid.team, technician_ids: [] },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid vehicle_id UUID', () => {
    const result = CreateWorkPermitSchema.safeParse({
      ...valid,
      vehicle_id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional safety_notes', () => {
    expect(() =>
      CreateWorkPermitSchema.parse({ ...valid, safety_notes: 'Live equipment present.' })
    ).not.toThrow();
  });

  it('rejects safety_notes over 2000 characters', () => {
    const result = CreateWorkPermitSchema.safeParse({
      ...valid,
      safety_notes: 'A'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

describe('WithdrawPermitSchema', () => {
  it('accepts a valid withdrawal reason', () => {
    expect(() =>
      WithdrawPermitSchema.parse({ reason: 'Team member became ill and cannot proceed.' })
    ).not.toThrow();
  });

  it('rejects a reason shorter than 10 characters', () => {
    expect(WithdrawPermitSchema.safeParse({ reason: 'Short' }).success).toBe(false);
  });

  it('rejects a reason over 500 characters', () => {
    expect(
      WithdrawPermitSchema.safeParse({ reason: 'A'.repeat(501) }).success
    ).toBe(false);
  });
});

describe('WorkPermitSchema', () => {
  const validPermit = {
    id: uuid(1),
    permit_number: 'WP-2026-0001',
    permit_type: 'maintenance',
    status: 'issued',
    engineer_id: uuid(2),
    vehicle_id: uuid(3),
    scheduled_start: '2026-06-01T08:00:00.000Z',
    scheduled_end: '2026-06-01T18:00:00.000Z',
    safety_notes: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };

  it('parses a valid permit record', () => {
    const result = WorkPermitSchema.parse(validPermit);
    expect(result.permit_number).toBe('WP-2026-0001');
    expect(result.status).toBe('issued');
  });

  it('rejects a permit with invalid datetime', () => {
    expect(
      WorkPermitSchema.safeParse({ ...validPermit, scheduled_start: 'not-a-date' }).success
    ).toBe(false);
  });
});

describe('PermitMemberSchema', () => {
  const validMember = {
    id: uuid(1),
    permit_id: uuid(2),
    user_id: uuid(3),
    accepted_at: null,
    withdrawn_at: null,
    withdrawal_reason: null,
    created_at: '2026-01-01T00:00:00.000Z',
  };

  it('parses a valid member record', () => {
    expect(() => PermitMemberSchema.parse(validMember)).not.toThrow();
  });

  it('parses a member with acceptance timestamp', () => {
    const result = PermitMemberSchema.parse({
      ...validMember,
      accepted_at: '2026-06-01T07:00:00.000Z',
    });
    expect(result.accepted_at).toBe('2026-06-01T07:00:00.000Z');
  });
});
