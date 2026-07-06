-- Migration 015: Follow-up tasks
-- Created for incomplete/deferred inspections so partial data is not lost.

CREATE TABLE follow_up_tasks (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id     UUID NOT NULL REFERENCES asset_inspections(id),
  asset_id          UUID NOT NULL REFERENCES assets(id),
  assigned_to       UUID REFERENCES users(id),
  -- Saved partial form data — inspector resumes from here on next visit
  partial_form_data JSONB NOT NULL DEFAULT '{}',
  notes             TEXT,
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER follow_up_tasks_updated_at
  BEFORE UPDATE ON follow_up_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_follow_up_inspection ON follow_up_tasks(inspection_id);
CREATE INDEX idx_follow_up_asset      ON follow_up_tasks(asset_id);
CREATE INDEX idx_follow_up_assigned   ON follow_up_tasks(assigned_to);
