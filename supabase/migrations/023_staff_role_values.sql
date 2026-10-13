-- Enum additions must commit before they can be used in data updates.
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'mowing_crew_lead';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'mowing_crew_laborer';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'snow_plow_operator';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'subcontractor';
