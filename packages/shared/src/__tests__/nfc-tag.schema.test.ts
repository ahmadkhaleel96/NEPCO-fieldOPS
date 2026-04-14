import { describe, it, expect } from 'vitest';
import {
  NfcTagStatusSchema,
  ProvisionNfcTagSchema,
  ConfirmNfcTagInstallSchema,
  NfcTagSchema,
} from '../schemas/nfc-tag.schema';

describe('NfcTagStatusSchema', () => {
  it('accepts all valid statuses', () => {
    for (const s of ['provisioned', 'active', 'inactive', 'replaced']) {
      expect(() => NfcTagStatusSchema.parse(s)).not.toThrow();
    }
  });

  it('rejects unknown status', () => {
    expect(() => NfcTagStatusSchema.parse('lost')).toThrow();
  });
});

describe('ProvisionNfcTagSchema', () => {
  const assetId = '00000000-0000-0000-0000-000000000001';
  const vehicleId = '00000000-0000-0000-0000-000000000002';

  it('accepts tag provisioned to an asset', () => {
    expect(() =>
      ProvisionNfcTagSchema.parse({ tag_id: 'TAG-ABC-001', asset_id: assetId })
    ).not.toThrow();
  });

  it('accepts tag provisioned to a vehicle', () => {
    expect(() =>
      ProvisionNfcTagSchema.parse({ tag_id: 'TAG-VEH-001', vehicle_id: vehicleId })
    ).not.toThrow();
  });

  it('rejects provisioning to both asset and vehicle', () => {
    const result = ProvisionNfcTagSchema.safeParse({
      tag_id: 'TAG-001',
      asset_id: assetId,
      vehicle_id: vehicleId,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/exactly one/i);
    }
  });

  it('rejects provisioning to neither asset nor vehicle', () => {
    const result = ProvisionNfcTagSchema.safeParse({ tag_id: 'TAG-001' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty tag_id', () => {
    const result = ProvisionNfcTagSchema.safeParse({
      tag_id: '',
      asset_id: assetId,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid asset_id UUID', () => {
    const result = ProvisionNfcTagSchema.safeParse({
      tag_id: 'TAG-001',
      asset_id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });
});

describe('ConfirmNfcTagInstallSchema', () => {
  it('accepts valid install confirmation', () => {
    expect(() =>
      ConfirmNfcTagInstallSchema.parse({
        latitude: 31.9454,
        longitude: 35.9284,
        photo_url: 'https://r2.example.com/photos/tag-001.jpg',
      })
    ).not.toThrow();
  });

  it('rejects an invalid photo URL', () => {
    const result = ConfirmNfcTagInstallSchema.safeParse({
      latitude: 31.9454,
      longitude: 35.9284,
      photo_url: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('rejects coordinates out of range', () => {
    expect(
      ConfirmNfcTagInstallSchema.safeParse({
        latitude: 200,
        longitude: 35.9284,
        photo_url: 'https://example.com/photo.jpg',
      }).success
    ).toBe(false);
  });
});

describe('NfcTagSchema', () => {
  const validTag = {
    id: '00000000-0000-0000-0000-000000000001',
    tag_id: 'TAG-HVT-042',
    status: 'active',
    asset_id: '00000000-0000-0000-0000-000000000002',
    vehicle_id: null,
    vault_secret_id: 'vault-ref-001',
    provisioned_by: '00000000-0000-0000-0000-000000000003',
    replaced_by: null,
    install_lat: 31.9454,
    install_lng: 35.9284,
    install_photo_url: 'https://example.com/photo.jpg',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };

  it('parses a valid NFC tag record', () => {
    const result = NfcTagSchema.parse(validTag);
    expect(result.tag_id).toBe('TAG-HVT-042');
    expect(result.vault_secret_id).toBe('vault-ref-001');
  });

  it('rejects an invalid status', () => {
    expect(NfcTagSchema.safeParse({ ...validTag, status: 'burned' }).success).toBe(false);
  });
});
