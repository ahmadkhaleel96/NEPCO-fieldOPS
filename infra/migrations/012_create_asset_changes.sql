-- Migration 012: Asset changes — pending approval records from inspections

CREATE TABLE asset_changes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id UUID NOT NULL REFERENCES asset_inspections(id),
  asset_id      UUID NOT NULL REFERENCES assets(id),
  field_name    TEXT NOT NULL,
  old_value     JSONB,
  new_value     JSONB NOT NULL,
  status        approval_status NOT NULL DEFAULT 'pending',
  reviewed_by   UUID REFERENCES users(id),
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_asset_changes_inspection ON asset_changes(inspection_id);
CREATE INDEX idx_asset_changes_asset      ON asset_changes(asset_id);
CREATE INDEX idx_asset_changes_status     ON asset_changes(status);
