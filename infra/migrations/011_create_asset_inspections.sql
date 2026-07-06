-- Migration 011: Asset inspections

CREATE TABLE asset_inspections (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id          UUID NOT NULL REFERENCES trips(id),
  asset_id         UUID NOT NULL REFERENCES assets(id),
  submitted_by     UUID NOT NULL REFERENCES users(id),
  status           inspection_status NOT NULL DEFAULT 'open',
  -- Full inspection form data (validated by Zod at API layer per asset_type)
  form_data        JSONB NOT NULL DEFAULT '{}',
  incomplete_reason incomplete_reason,
  -- Client-generated UUID for idempotent offline re-submissions
  idempotency_key  UUID UNIQUE NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER asset_inspections_updated_at
  BEFORE UPDATE ON asset_inspections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_asset_inspections_trip   ON asset_inspections(trip_id);
CREATE INDEX idx_asset_inspections_asset  ON asset_inspections(asset_id);
CREATE INDEX idx_asset_inspections_status ON asset_inspections(status);
