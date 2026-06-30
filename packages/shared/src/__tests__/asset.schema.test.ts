import { describe, it, expect } from 'vitest';
import {
  AssetTypeSchema,
  CreateAssetSchema,
  UpdateAssetSchema,
  AssetSchema,
  AssetCsvRowSchema,
  HvTowerMetadataSchema,
  SubstationMetadataSchema,
  AssetMetadataByTypeSchema,
  CoordinatesSchema,
} from '../schemas/asset.schema';

describe('AssetTypeSchema', () => {
  it('accepts all valid asset types', () => {
    const types = [
      'hv_tower',
      'substation',
      'switchgear',
      'cable_joint',
      'distribution_cabinet',
    ];
    for (const t of types) {
      expect(() => AssetTypeSchema.parse(t)).not.toThrow();
    }
  });

  it('rejects unknown types', () => {
    expect(() => AssetTypeSchema.parse('transformer')).toThrow();
    expect(() => AssetTypeSchema.parse('')).toThrow();
  });
});

describe('CoordinatesSchema', () => {
  it('accepts valid coordinates', () => {
    expect(() =>
      CoordinatesSchema.parse({ latitude: 31.95, longitude: 35.93 })
    ).not.toThrow();
    expect(() =>
      CoordinatesSchema.parse({ latitude: -90, longitude: -180 })
    ).not.toThrow();
    expect(() =>
      CoordinatesSchema.parse({ latitude: 90, longitude: 180 })
    ).not.toThrow();
  });

  it('rejects out-of-range coordinates', () => {
    expect(() =>
      CoordinatesSchema.parse({ latitude: 91, longitude: 0 })
    ).toThrow();
    expect(() =>
      CoordinatesSchema.parse({ latitude: 0, longitude: 181 })
    ).toThrow();
    expect(() =>
      CoordinatesSchema.parse({ latitude: -91, longitude: 0 })
    ).toThrow();
  });
});

describe('HvTowerMetadataSchema', () => {
  it('accepts valid metadata', () => {
    expect(() =>
      HvTowerMetadataSchema.parse({
        tower_number: 'T-0042',
        line_name: 'Amman-Zarqa 400kV',
        voltage_kv: 400,
      })
    ).not.toThrow();
  });

  it('accepts all optional fields', () => {
    expect(() =>
      HvTowerMetadataSchema.parse({
        tower_number: 'T-0042',
        line_name: 'Amman-Zarqa',
        voltage_kv: 400,
        structure_type: 'lattice',
        year_installed: 1998,
        corrosion_level: 'minor',
        last_inspection_date: '2025-06-01T00:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('rejects invalid corrosion_level', () => {
    const result = HvTowerMetadataSchema.safeParse({
      tower_number: 'T-0042',
      line_name: 'Line',
      voltage_kv: 400,
      corrosion_level: 'critical',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-positive voltage', () => {
    const result = HvTowerMetadataSchema.safeParse({
      tower_number: 'T-0042',
      line_name: 'Line',
      voltage_kv: -10,
    });
    expect(result.success).toBe(false);
  });
});

describe('SubstationMetadataSchema', () => {
  it('accepts valid substation metadata', () => {
    expect(() =>
      SubstationMetadataSchema.parse({
        substation_name: 'Amman Central',
        voltage_in_kv: 400,
        voltage_out_kv: 132,
        capacity_mva: 600,
      })
    ).not.toThrow();
  });
});

describe('AssetMetadataByTypeSchema (discriminated union)', () => {
  it('validates hv_tower with correct metadata', () => {
    expect(() =>
      AssetMetadataByTypeSchema.parse({
        asset_type: 'hv_tower',
        metadata: { tower_number: 'T-001', line_name: 'Line A', voltage_kv: 132 },
      })
    ).not.toThrow();
  });

  it('rejects substation metadata for hv_tower type', () => {
    const result = AssetMetadataByTypeSchema.safeParse({
      asset_type: 'hv_tower',
      metadata: { substation_name: 'wrong', voltage_in_kv: 400, voltage_out_kv: 132 },
    });
    expect(result.success).toBe(false);
  });
});

describe('CreateAssetSchema', () => {
  const valid = {
    asset_code: 'HVT-0042',
    asset_type: 'hv_tower',
    name: 'Tower 42 – Amman-Zarqa Line',
    latitude: 31.9454,
    longitude: 35.9284,
    metadata: { tower_number: 'T-0042', line_name: 'AZ-400', voltage_kv: 400 },
  };

  it('accepts a valid asset', () => {
    expect(() => CreateAssetSchema.parse(valid)).not.toThrow();
  });

  it('rejects an empty asset_code', () => {
    const result = CreateAssetSchema.safeParse({ ...valid, asset_code: '' });
    expect(result.success).toBe(false);
  });

  it('rejects coordinates out of range', () => {
    expect(
      CreateAssetSchema.safeParse({ ...valid, latitude: 99 }).success
    ).toBe(false);
    expect(
      CreateAssetSchema.safeParse({ ...valid, longitude: -200 }).success
    ).toBe(false);
  });

  it('trims asset_code whitespace', () => {
    const result = CreateAssetSchema.parse({ ...valid, asset_code: '  HVT-001  ' });
    expect(result.asset_code).toBe('HVT-001');
  });
});

describe('UpdateAssetSchema', () => {
  it('accepts partial updates', () => {
    expect(() => UpdateAssetSchema.parse({ name: 'New Name' })).not.toThrow();
    expect(() => UpdateAssetSchema.parse({ is_active: false })).not.toThrow();
    expect(() => UpdateAssetSchema.parse({})).not.toThrow();
  });

  it('does not allow changing asset_code', () => {
    const _result = UpdateAssetSchema.safeParse({ asset_code: 'NEW-CODE' });
    // asset_code is omitted, so extra keys are stripped (strict mode off by default)
    const parsed = UpdateAssetSchema.parse({ asset_code: 'NEW-CODE' });
    expect((parsed as Record<string, unknown>).asset_code).toBeUndefined();
  });
});

describe('AssetSchema', () => {
  const validAsset = {
    id: '00000000-0000-0000-0000-000000000001',
    asset_code: 'HVT-0042',
    asset_type: 'hv_tower',
    name: 'Tower 42',
    latitude: 31.9454,
    longitude: 35.9284,
    metadata: {},
    is_active: true,
    created_by: '00000000-0000-0000-0000-000000000002',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };

  it('parses a valid asset record', () => {
    const result = AssetSchema.parse(validAsset);
    expect(result.asset_code).toBe('HVT-0042');
  });

  it('rejects a missing created_by', () => {
    const { created_by: _, ...withoutCreatedBy } = validAsset;
    expect(AssetSchema.safeParse(withoutCreatedBy).success).toBe(false);
  });
});

describe('AssetCsvRowSchema', () => {
  it('coerces string latitude/longitude to numbers', () => {
    const result = AssetCsvRowSchema.parse({
      asset_code: 'HVT-001',
      asset_type: 'hv_tower',
      name: 'Tower 1',
      latitude: '31.94',
      longitude: '35.92',
    });
    expect(typeof result.latitude).toBe('number');
    expect(typeof result.longitude).toBe('number');
  });

  it('rejects invalid asset type in CSV', () => {
    const r = AssetCsvRowSchema.safeParse({
      asset_code: 'X',
      asset_type: 'unknown',
      name: 'X',
      latitude: '0',
      longitude: '0',
    });
    expect(r.success).toBe(false);
  });
});
