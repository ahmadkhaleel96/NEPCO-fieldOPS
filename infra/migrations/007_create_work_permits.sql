-- Migration 007: Work permits — the root record for all field operations

CREATE TABLE work_permits (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Human-readable: WP-YYYY-NNNN (populated by trigger below)
  permit_number   TEXT UNIQUE NOT NULL DEFAULT '',
  permit_type     work_permit_type NOT NULL,
  status          work_permit_status NOT NULL DEFAULT 'draft',
  engineer_id     UUID NOT NULL REFERENCES users(id),
  vehicle_id      UUID NOT NULL REFERENCES vehicles(id),
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end   TIMESTAMPTZ NOT NULL,
  safety_notes    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT permit_schedule_check CHECK (scheduled_end > scheduled_start)
);

-- Junction: which assets are included in this permit
CREATE TABLE permit_assets (
  permit_id UUID NOT NULL REFERENCES work_permits(id) ON DELETE CASCADE,
  asset_id  UUID NOT NULL REFERENCES assets(id),
  PRIMARY KEY (permit_id, asset_id)
);

-- Auto-generate permit_number: WP-YYYY-NNNN
CREATE SEQUENCE permit_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_permit_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.permit_number = 'WP-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                      LPAD(nextval('permit_number_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_permits_generate_number
  BEFORE INSERT ON work_permits
  FOR EACH ROW EXECUTE FUNCTION generate_permit_number();

CREATE TRIGGER work_permits_updated_at
  BEFORE UPDATE ON work_permits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Lock completed permits: no further changes allowed (RLS is a second layer)
CREATE OR REPLACE FUNCTION prevent_completed_permit_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'completed' THEN
    RAISE EXCEPTION 'Cannot modify a completed permit (id: %)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_permits_lock_completed
  BEFORE UPDATE ON work_permits
  FOR EACH ROW EXECUTE FUNCTION prevent_completed_permit_update();

CREATE INDEX idx_work_permits_engineer ON work_permits(engineer_id);
CREATE INDEX idx_work_permits_status   ON work_permits(status);
CREATE INDEX idx_work_permits_vehicle  ON work_permits(vehicle_id);
CREATE INDEX idx_permit_assets_permit  ON permit_assets(permit_id);
CREATE INDEX idx_permit_assets_asset   ON permit_assets(asset_id);
