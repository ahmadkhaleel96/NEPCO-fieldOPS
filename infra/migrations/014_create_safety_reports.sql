-- Migration 014: Safety reports
-- Auto-created when an inspection has incomplete_reason = 'safety_hazard'.
-- Suspends the originating permit.

CREATE TABLE safety_reports (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Human-readable: SAF-YYYY-NNNN
  report_number      TEXT UNIQUE NOT NULL DEFAULT '',
  inspection_id      UUID NOT NULL REFERENCES asset_inspections(id),
  trip_id            UUID NOT NULL REFERENCES trips(id),
  reported_by        UUID NOT NULL REFERENCES users(id),
  hazard_description TEXT NOT NULL,
  photo_urls         TEXT[] NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE safety_report_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_safety_report_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.report_number = 'SAF-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                      LPAD(nextval('safety_report_number_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER safety_reports_generate_number
  BEFORE INSERT ON safety_reports
  FOR EACH ROW EXECUTE FUNCTION generate_safety_report_number();

CREATE INDEX idx_safety_reports_trip       ON safety_reports(trip_id);
CREATE INDEX idx_safety_reports_inspection ON safety_reports(inspection_id);
