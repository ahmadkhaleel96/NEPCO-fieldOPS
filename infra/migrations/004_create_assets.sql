-- Migration 004: Assets table
-- The master registry for all field assets. Must exist before any permit can be created.

CREATE TABLE assets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_code  TEXT UNIQUE NOT NULL,
  asset_type  asset_type NOT NULL,
  name        TEXT NOT NULL,
  -- PostGIS point (SRID 4326 = WGS84 lat/lng)
  -- Stored as ST_SetSRID(ST_MakePoint(lng, lat), 4326) by the API
  location    geometry(Point, 4326),
  -- Flexible type-specific metadata; validated at API layer by Zod per asset_type
  metadata    JSONB NOT NULL DEFAULT '{}',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER assets_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Spatial index enables radius/bbox queries (e.g., "find all assets within 500m")
CREATE INDEX idx_assets_location ON assets USING GIST(location);
CREATE INDEX idx_assets_type     ON assets(asset_type);
CREATE INDEX idx_assets_active   ON assets(is_active) WHERE is_active = TRUE;
