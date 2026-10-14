-- Keep the PostGIS point used by geofence checks aligned with owner edits.
CREATE OR REPLACE FUNCTION public.sync_property_geo()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.geo := CASE
    WHEN NEW.latitude IS NULL OR NEW.longitude IS NULL THEN NULL
    ELSE ST_SetSRID(ST_MakePoint(NEW.longitude::double precision,
                                NEW.latitude::double precision), 4326)::geography
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sync_property_geo_on_write ON public.properties;
CREATE TRIGGER sync_property_geo_on_write
BEFORE INSERT OR UPDATE OF latitude, longitude ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.sync_property_geo();

UPDATE public.properties SET latitude = latitude
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
UPDATE public.properties SET latitude = latitude
WHERE latitude IS NULL AND longitude IS NULL AND geo IS NOT NULL;
