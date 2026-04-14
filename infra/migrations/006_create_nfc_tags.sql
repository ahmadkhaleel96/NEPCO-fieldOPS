-- Migration 006: NFC tags — provisioned via Admin-only workflow
-- The write password is stored in Supabase Vault. vault_secret_id is a reference
-- to the Vault entry — never the password itself.

CREATE TABLE nfc_tags (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Physical chip identifier (written to NDEF)
  tag_id           TEXT UNIQUE NOT NULL,
  status           nfc_tag_status NOT NULL DEFAULT 'provisioned',
  -- Exactly one of asset_id or vehicle_id must be set (enforced by CHECK below)
  asset_id         UUID REFERENCES assets(id),
  vehicle_id       UUID REFERENCES vehicles(id),
  -- Reference to Supabase Vault secret entry for NTAG write password
  vault_secret_id  TEXT,
  provisioned_by   UUID NOT NULL REFERENCES users(id),
  -- Self-reference: when a tag is replaced, replaced_by points to the new tag
  replaced_by      UUID REFERENCES nfc_tags(id),
  -- GPS + photo set by field technician when confirming installation
  install_lat      DECIMAL(10,8),
  install_lng      DECIMAL(11,8),
  install_photo_url TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Enforce mutual exclusivity: tag targets exactly one entity type
  CONSTRAINT nfc_tag_single_target CHECK (
    (asset_id IS NOT NULL AND vehicle_id IS NULL)
    OR
    (asset_id IS NULL AND vehicle_id IS NOT NULL)
  )
);

CREATE TRIGGER nfc_tags_updated_at
  BEFORE UPDATE ON nfc_tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_nfc_tags_asset   ON nfc_tags(asset_id)   WHERE asset_id IS NOT NULL;
CREATE INDEX idx_nfc_tags_vehicle ON nfc_tags(vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE INDEX idx_nfc_tags_status  ON nfc_tags(status);
