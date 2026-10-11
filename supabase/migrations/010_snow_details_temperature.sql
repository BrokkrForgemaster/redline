ALTER TABLE snow_service_details
  ADD COLUMN IF NOT EXISTS temperature_f      NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS weather_conditions TEXT;
