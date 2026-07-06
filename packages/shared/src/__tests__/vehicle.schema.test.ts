import { describe, it, expect } from 'vitest';
import {
  CreateVehicleSchema,
  UpdateVehicleSchema,
  VehicleSchema,
} from '../schemas/vehicle.schema';

describe('CreateVehicleSchema', () => {
  const valid = {
    vehicle_code: 'VEH-001',
    plate_number: '12-A-3456',
    model: 'Toyota Land Cruiser',
  };

  it('accepts a valid vehicle', () => {
    expect(() => CreateVehicleSchema.parse(valid)).not.toThrow();
  });

  it('converts plate_number to uppercase', () => {
    const result = CreateVehicleSchema.parse({ ...valid, plate_number: 'abc-123' });
    expect(result.plate_number).toBe('ABC-123');
  });

  it('rejects an empty vehicle_code', () => {
    expect(CreateVehicleSchema.safeParse({ ...valid, vehicle_code: '' }).success).toBe(false);
  });

  it('rejects an empty plate_number', () => {
    expect(CreateVehicleSchema.safeParse({ ...valid, plate_number: '' }).success).toBe(false);
  });

  it('accepts a vehicle without model', () => {
    const { model: _, ...withoutModel } = valid;
    expect(() => CreateVehicleSchema.parse(withoutModel)).not.toThrow();
  });
});

describe('UpdateVehicleSchema', () => {
  it('accepts empty update', () => {
    expect(() => UpdateVehicleSchema.parse({})).not.toThrow();
  });

  it('accepts is_active = false', () => {
    expect(() => UpdateVehicleSchema.parse({ is_active: false })).not.toThrow();
  });

  it('allows nulling the model', () => {
    const result = UpdateVehicleSchema.parse({ model: null });
    expect(result.model).toBeNull();
  });

  it('rejects a plate_number that is too long', () => {
    expect(
      UpdateVehicleSchema.safeParse({ plate_number: 'A'.repeat(21) }).success
    ).toBe(false);
  });
});

describe('VehicleSchema', () => {
  const validVehicle = {
    id: '00000000-0000-0000-0000-000000000001',
    vehicle_code: 'VEH-001',
    plate_number: 'AB-1234',
    model: null,
    is_active: true,
    created_by: '00000000-0000-0000-0000-000000000002',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };

  it('parses a valid vehicle record', () => {
    const result = VehicleSchema.parse(validVehicle);
    expect(result.vehicle_code).toBe('VEH-001');
  });

  it('rejects invalid UUID', () => {
    expect(VehicleSchema.safeParse({ ...validVehicle, id: 'bad' }).success).toBe(false);
  });
});
