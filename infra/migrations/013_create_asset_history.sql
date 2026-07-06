-- Migration 013: Asset history — append-only permanent record of approved changes
-- The BEFORE UPDATE trigger on asset_changes automatically writes here.

CREATE TABLE asset_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id    UUID NOT NULL REFERENCES assets(id),
  change_id   UUID NOT NULL REFERENCES asset_changes(id),
  field_name  TEXT NOT NULL,
  old_value   JSONB,
  new_value   JSONB NOT NULL,
  approved_by UUID NOT NULL REFERENCES users(id),
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce append-only
CREATE OR REPLACE FUNCTION prevent_asset_history_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'asset_history is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER asset_history_no_update
  BEFORE UPDATE ON asset_history
  FOR EACH ROW EXECUTE FUNCTION prevent_asset_history_modification();

CREATE TRIGGER asset_history_no_delete
  BEFORE DELETE ON asset_history
  FOR EACH ROW EXECUTE FUNCTION prevent_asset_history_modification();

-- Trigger on asset_changes: when approved, write history + update asset metadata atomically
CREATE OR REPLACE FUNCTION on_asset_change_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    -- Permanently record the old value
    INSERT INTO asset_history (
      asset_id, change_id, field_name, old_value, new_value,
      approved_by, approved_at
    ) VALUES (
      NEW.asset_id, NEW.id, NEW.field_name, NEW.old_value, NEW.new_value,
      NEW.reviewed_by, COALESCE(NEW.reviewed_at, NOW())
    );

    -- Update the asset's metadata jsonb
    UPDATE assets
    SET metadata = jsonb_set(
      COALESCE(metadata, '{}'),
      ARRAY[NEW.field_name],
      NEW.new_value
    )
    WHERE id = NEW.asset_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER asset_change_on_approval
  AFTER UPDATE ON asset_changes
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status = 'pending')
  EXECUTE FUNCTION on_asset_change_approved();

CREATE INDEX idx_asset_history_asset       ON asset_history(asset_id);
CREATE INDEX idx_asset_history_approved_at ON asset_history(approved_at);
