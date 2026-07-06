-- Migration 019: PostGIS views
-- Supabase PostgREST cannot use ST_X/ST_Y inline in select strings.
-- These views expose geometry columns as plain latitude/longitude floats
-- so the API can query them like regular columns.

CREATE OR REPLACE VIEW public.assets_view AS
SELECT
  id,
  asset_code,
  asset_type,
  name,
  metadata,
  is_active,
  created_by,
  created_at,
  updated_at,
  ST_Y(location::geometry) AS latitude,
  ST_X(location::geometry) AS longitude
FROM public.assets;
