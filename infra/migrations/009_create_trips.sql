-- Migration 009: Trips + GPS track points

CREATE TABLE trips (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  permit_id   UUID NOT NULL REFERENCES work_permits(id),
  driver_id   UUID NOT NULL REFERENCES users(id),
  vehicle_id  UUID NOT NULL REFERENCES vehicles(id),
  start_time  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time    TIMESTAMPTZ,
  start_lat   DECIMAL(10,8) NOT NULL,
  start_lng   DECIMAL(11,8) NOT NULL,
  end_lat     DECIMAL(10,8),
  end_lng     DECIMAL(11,8),
  -- Client-generated UUID for idempotent offline-first upserts
  client_id   UUID UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Only one trip per permit (a permit is single-use)
  UNIQUE(permit_id)
);

-- Activate permit when a trip row is created
CREATE OR REPLACE FUNCTION activate_permit_on_trip_start()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE work_permits
  SET status = 'active'
  WHERE id = NEW.permit_id AND status = 'issued';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trips_activate_permit
  AFTER INSERT ON trips
  FOR EACH ROW EXECUTE FUNCTION activate_permit_on_trip_start();

-- GPS track points — stored separately for efficient time-range queries
CREATE TABLE trip_locations (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id      UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  lat          DECIMAL(10,8) NOT NULL,
  lng          DECIMAL(11,8) NOT NULL,
  accuracy     DECIMAL(6,2),
  captured_at  TIMESTAMPTZ NOT NULL,
  -- Client-generated for idempotent upserts (INSERT ... ON CONFLICT DO NOTHING)
  client_id    UUID UNIQUE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trips_permit          ON trips(permit_id);
CREATE INDEX idx_trips_driver          ON trips(driver_id);
CREATE INDEX idx_trip_locations_trip   ON trip_locations(trip_id);
CREATE INDEX idx_trip_locs_captured_at ON trip_locations(trip_id, captured_at);
