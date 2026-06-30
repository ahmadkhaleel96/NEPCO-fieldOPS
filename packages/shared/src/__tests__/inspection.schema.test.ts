import { describe, it, expect } from 'vitest';
import {
  InspectionStatusSchema,
  IncompleteReasonSchema,
  ApprovalStatusSchema,
  SubmitInspectionSchema,
  AssetInspectionSchema as _AssetInspectionSchema,
  AssetChangeSchema,
  ReviewChangeSchema,
  CreateSafetyReportSchema,
} from '../schemas/inspection.schema';

const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

describe('InspectionStatusSchema', () => {
  it('accepts all valid statuses', () => {
    for (const s of ['open', 'pending', 'incomplete', 'deferred']) {
      expect(() => InspectionStatusSchema.parse(s)).not.toThrow();
    }
  });

  it('rejects unknown status', () => {
    expect(() => InspectionStatusSchema.parse('closed')).toThrow();
  });
});

describe('IncompleteReasonSchema', () => {
  it('accepts all valid reasons', () => {
    for (const r of [
      'device_failure',
      'safety_hazard',
      'access_restricted',
      'equipment_missing',
    ]) {
      expect(() => IncompleteReasonSchema.parse(r)).not.toThrow();
    }
  });
});

describe('ApprovalStatusSchema', () => {
  it('accepts pending, approved, rejected', () => {
    for (const s of ['pending', 'approved', 'rejected']) {
      expect(() => ApprovalStatusSchema.parse(s)).not.toThrow();
    }
  });
});

describe('SubmitInspectionSchema', () => {
  const baseValid = {
    trip_id: uuid(1),
    asset_id: uuid(2),
    status: 'pending',
    form_data: { voltage_kv: 400, corrosion_level: 'none' },
    idempotency_key: uuid(3),
  };

  it('accepts a valid completed inspection', () => {
    expect(() => SubmitInspectionSchema.parse(baseValid)).not.toThrow();
  });

  it('accepts an incomplete inspection with a reason', () => {
    expect(() =>
      SubmitInspectionSchema.parse({
        ...baseValid,
        status: 'incomplete',
        incomplete_reason: 'device_failure',
      })
    ).not.toThrow();
  });

  it('rejects incomplete status without a reason', () => {
    const result = SubmitInspectionSchema.safeParse({
      ...baseValid,
      status: 'incomplete',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/incomplete_reason/i);
    }
  });

  it('rejects invalid status', () => {
    expect(
      SubmitInspectionSchema.safeParse({ ...baseValid, status: 'approved' }).success
    ).toBe(false);
  });

  it('rejects non-UUID idempotency_key', () => {
    expect(
      SubmitInspectionSchema.safeParse({ ...baseValid, idempotency_key: 'bad' }).success
    ).toBe(false);
  });
});

describe('ReviewChangeSchema', () => {
  it('accepts approve action', () => {
    expect(() => ReviewChangeSchema.parse({ action: 'approve' })).not.toThrow();
  });

  it('accepts reject action with notes', () => {
    expect(() =>
      ReviewChangeSchema.parse({ action: 'reject', notes: 'Value seems incorrect.' })
    ).not.toThrow();
  });

  it('rejects invalid action', () => {
    expect(ReviewChangeSchema.safeParse({ action: 'delete' }).success).toBe(false);
  });

  it('rejects notes over 500 characters', () => {
    expect(
      ReviewChangeSchema.safeParse({ action: 'approve', notes: 'A'.repeat(501) }).success
    ).toBe(false);
  });
});

describe('CreateSafetyReportSchema', () => {
  const valid = {
    inspection_id: uuid(1),
    trip_id: uuid(2),
    hazard_description:
      'Energised conductor found within 1 metre of the working platform.',
    photo_urls: ['https://r2.example.com/photos/hazard-001.jpg'],
  };

  it('accepts a valid safety report', () => {
    expect(() => CreateSafetyReportSchema.parse(valid)).not.toThrow();
  });

  it('rejects a hazard description shorter than 20 characters', () => {
    expect(
      CreateSafetyReportSchema.safeParse({ ...valid, hazard_description: 'Too short' }).success
    ).toBe(false);
  });

  it('rejects an empty photo_urls array', () => {
    expect(
      CreateSafetyReportSchema.safeParse({ ...valid, photo_urls: [] }).success
    ).toBe(false);
  });

  it('rejects an invalid photo URL', () => {
    expect(
      CreateSafetyReportSchema.safeParse({
        ...valid,
        photo_urls: ['not-a-url'],
      }).success
    ).toBe(false);
  });
});

describe('AssetChangeSchema', () => {
  const validChange = {
    id: uuid(1),
    inspection_id: uuid(2),
    asset_id: uuid(3),
    field_name: 'corrosion_level',
    old_value: 'none',
    new_value: 'minor',
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
  };

  it('parses a valid pending change', () => {
    const result = AssetChangeSchema.parse(validChange);
    expect(result.field_name).toBe('corrosion_level');
    expect(result.status).toBe('pending');
  });

  it('parses an approved change with reviewer', () => {
    const result = AssetChangeSchema.parse({
      ...validChange,
      status: 'approved',
      reviewed_by: uuid(4),
      reviewed_at: '2026-01-02T10:00:00.000Z',
    });
    expect(result.reviewed_by).toBe(uuid(4));
  });
});
