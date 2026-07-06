-- Migration 010: NFC event audit log — append-only

CREATE TABLE nfc_events (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tag_id           TEXT NOT NULL,
  event_type       nfc_event_type NOT NULL,
  trip_id          UUID REFERENCES trips(id),
  permit_id        UUID REFERENCES work_permits(id),
  user_id          UUID NOT NULL REFERENCES users(id),
  lat              DECIMAL(10,8) NOT NULL,
  lng              DECIMAL(11,8) NOT NULL,
  -- Client-generated for idempotent upserts
  client_id        UUID UNIQUE NOT NULL,
  -- Timestamp as captured on the device (may differ from server created_at when offline)
  client_timestamp TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce append-only: any attempt to UPDATE or DELETE raises an exception
CREATE OR REPLACE FUNCTION prevent_nfc_events_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'nfc_events is append-only — no UPDATE or DELETE permitted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER nfc_events_no_update
  BEFORE UPDATE ON nfc_events
  FOR EACH ROW EXECUTE FUNCTION prevent_nfc_events_modification();

CREATE TRIGGER nfc_events_no_delete
  BEFORE DELETE ON nfc_events
  FOR EACH ROW EXECUTE FUNCTION prevent_nfc_events_modification();

CREATE INDEX idx_nfc_events_trip       ON nfc_events(trip_id);
CREATE INDEX idx_nfc_events_permit     ON nfc_events(permit_id);
CREATE INDEX idx_nfc_events_user       ON nfc_events(user_id);
CREATE INDEX idx_nfc_events_event_type ON nfc_events(event_type);
