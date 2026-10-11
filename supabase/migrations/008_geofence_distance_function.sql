-- ============================================================
-- Geofence Distance Helper
-- Migration: 008_geofence_distance_function.sql
-- Provides a PostGIS-backed RPC for API route handlers.
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_property_geofence_distance(
  p_property_id UUID,
  p_latitude NUMERIC,
  p_longitude NUMERIC
)
RETURNS TABLE (
  distance_meters NUMERIC,
  configured_radius_meters NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    ST_Distance(
      p.geo,
      ST_SetSRID(
        ST_MakePoint(p_longitude::DOUBLE PRECISION, p_latitude::DOUBLE PRECISION),
        4326
      )::GEOGRAPHY
    )::NUMERIC AS distance_meters,
    p.geofence_radius_meters AS configured_radius_meters
  FROM properties p
  WHERE p.id = p_property_id
    AND p.geo IS NOT NULL
$$;
