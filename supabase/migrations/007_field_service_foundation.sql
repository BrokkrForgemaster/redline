-- ============================================================
-- Redline Field Service Foundation
-- Migration: 007_field_service_foundation.sql
-- Adds geofence, idempotency, work-order/service-run, tracking,
-- media/report, and retention foundations without replacing
-- existing jobs/properties/time_entries/job_photos flows.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- ENUMS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_run_status') THEN
    CREATE TYPE service_run_status AS ENUM (
      'draft',
      'scheduled',
      'assigned',
      'ready',
      'in_progress',
      'paused',
      'submitted',
      'needs_review',
      'completed',
      'rejected',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'work_order_status') THEN
    CREATE TYPE work_order_status AS ENUM (
      'draft',
      'scheduled',
      'assigned',
      'ready',
      'in_progress',
      'paused',
      'submitted',
      'needs_review',
      'completed',
      'rejected',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_type') THEN
    CREATE TYPE assignment_type AS ENUM ('employee', 'crew', 'subcontractor');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'geofence_result') THEN
    CREATE TYPE geofence_result AS ENUM (
      'on_site',
      'near',
      'outside',
      'cannot_verify',
      'retry_required',
      'override_required',
      'override_approved'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_asset_status') THEN
    CREATE TYPE media_asset_status AS ENUM (
      'pending_upload',
      'uploaded',
      'attached',
      'finalized',
      'quarantined',
      'deleted'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'retention_hold_scope') THEN
    CREATE TYPE retention_hold_scope AS ENUM (
      'customer',
      'property',
      'work_order',
      'service_run',
      'incident',
      'date_range'
    );
  END IF;
END;
$$;

-- ============================================================
-- PROPERTIES: AUTHORITATIVE GEOFENCE FIELDS
-- ============================================================

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS geofence_radius_meters NUMERIC(8,2) NOT NULL DEFAULT 50
    CHECK (geofence_radius_meters > 0),
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS service_instructions TEXT,
  ADD COLUMN IF NOT EXISTS safety_instructions TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS geo GEOGRAPHY(Point, 4326);

UPDATE properties
SET geo = ST_SetSRID(ST_MakePoint(longitude::DOUBLE PRECISION, latitude::DOUBLE PRECISION), 4326)::GEOGRAPHY
WHERE geo IS NULL
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_properties_geo_gist ON properties USING gist (geo);
CREATE INDEX IF NOT EXISTS idx_properties_timezone ON properties(timezone);

-- ============================================================
-- SUBCONTRACTORS
-- ============================================================

CREATE TABLE IF NOT EXISTS subcontractor_companies (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  contact_name TEXT,
  email        TEXT,
  phone        TEXT,
  status       TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'inactive', 'suspended', 'archived')),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS subcontractor_memberships (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subcontractor_company_id UUID NOT NULL REFERENCES subcontractor_companies(id) ON DELETE CASCADE,
  user_id                  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role                     TEXT NOT NULL DEFAULT 'member'
                           CHECK (role IN ('owner', 'manager', 'member')),
  active                   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(subcontractor_company_id, user_id)
);

-- ============================================================
-- SERVICE TEMPLATES
-- ============================================================

CREATE TABLE IF NOT EXISTS service_types (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_template_lineages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_type_id UUID NOT NULL REFERENCES service_types(id) ON DELETE RESTRICT,
  name            TEXT NOT NULL,
  description     TEXT,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_template_versions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lineage_id      UUID NOT NULL REFERENCES service_template_lineages(id) ON DELETE RESTRICT,
  version_number  INTEGER NOT NULL CHECK (version_number > 0),
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'active', 'retired')),
  frozen_at       TIMESTAMPTZ,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lineage_id, version_number),
  CONSTRAINT active_template_versions_are_frozen
    CHECK (status <> 'active' OR frozen_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS checklist_sections (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_version_id  UUID NOT NULL REFERENCES service_template_versions(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_id         UUID NOT NULL REFERENCES checklist_sections(id) ON DELETE CASCADE,
  label              TEXT NOT NULL,
  response_type      TEXT NOT NULL DEFAULT 'checkbox'
                     CHECK (response_type IN ('checkbox', 'text', 'number', 'photo', 'select')),
  required           BOOLEAN NOT NULL DEFAULT FALSE,
  options            JSONB NOT NULL DEFAULT '[]',
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- WORK ORDERS AND SERVICE RUNS
-- ============================================================

CREATE TABLE IF NOT EXISTS recurring_schedules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  service_type_id UUID REFERENCES service_types(id) ON DELETE SET NULL,
  rrule           TEXT,
  seasonal_start  DATE,
  seasonal_end    DATE,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_orders (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  legacy_job_id           UUID UNIQUE REFERENCES jobs(id) ON DELETE SET NULL,
  recurring_schedule_id   UUID REFERENCES recurring_schedules(id) ON DELETE SET NULL,
  customer_id             UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  property_id             UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  service_type_id          UUID REFERENCES service_types(id) ON DELETE SET NULL,
  template_version_id      UUID REFERENCES service_template_versions(id) ON DELETE RESTRICT,
  work_order_number        TEXT NOT NULL UNIQUE,
  status                  work_order_status NOT NULL DEFAULT 'draft',
  title                   TEXT NOT NULL,
  description             TEXT,
  scheduled_start         TIMESTAMPTZ,
  scheduled_end           TIMESTAMPTZ,
  timezone                TEXT NOT NULL DEFAULT 'America/New_York',
  priority                TEXT NOT NULL DEFAULT 'normal'
                          CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  instructions            TEXT,
  created_by              UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by              UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at            TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_work_orders_property ON work_orders(property_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_customer ON work_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_scheduled ON work_orders(scheduled_start);

CREATE TABLE IF NOT EXISTS work_order_assignments (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id            UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  assignment_type          assignment_type NOT NULL,
  employee_id              UUID REFERENCES profiles(id) ON DELETE CASCADE,
  crew_id                  UUID REFERENCES crews(id) ON DELETE CASCADE,
  subcontractor_company_id UUID REFERENCES subcontractor_companies(id) ON DELETE CASCADE,
  assigned_by              UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active                   BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (
    (assignment_type = 'employee' AND employee_id IS NOT NULL AND crew_id IS NULL AND subcontractor_company_id IS NULL)
    OR (assignment_type = 'crew' AND crew_id IS NOT NULL AND employee_id IS NULL AND subcontractor_company_id IS NULL)
    OR (assignment_type = 'subcontractor' AND subcontractor_company_id IS NOT NULL AND employee_id IS NULL AND crew_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_work_order_assignments_employee_unique
  ON work_order_assignments(work_order_id, employee_id)
  WHERE assignment_type = 'employee' AND active = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_work_order_assignments_crew_unique
  ON work_order_assignments(work_order_id, crew_id)
  WHERE assignment_type = 'crew' AND active = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_work_order_assignments_subcontractor_unique
  ON work_order_assignments(work_order_id, subcontractor_company_id)
  WHERE assignment_type = 'subcontractor' AND active = TRUE;

CREATE TABLE IF NOT EXISTS service_runs (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id         UUID NOT NULL REFERENCES work_orders(id) ON DELETE RESTRICT,
  template_version_id   UUID REFERENCES service_template_versions(id) ON DELETE RESTRICT,
  primary_worker_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status               service_run_status NOT NULL DEFAULT 'ready',
  started_at            TIMESTAMPTZ,
  finished_at           TIMESTAMPTZ,
  submitted_at          TIMESTAMPTZ,
  reviewed_at           TIMESTAMPTZ,
  reviewed_by           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at           TIMESTAMPTZ,
  rejected_at           TIMESTAMPTZ,
  rejection_reason      TEXT,
  frozen_at             TIMESTAMPTZ,
  version_number        INTEGER NOT NULL DEFAULT 1 CHECK (version_number > 0),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_run_finished_after_started
    CHECK (finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at),
  CONSTRAINT service_run_finalized_when_approved
    CHECK (status <> 'completed' OR frozen_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_service_runs_work_order ON service_runs(work_order_id);
CREATE INDEX IF NOT EXISTS idx_service_runs_status ON service_runs(status);
CREATE INDEX IF NOT EXISTS idx_service_runs_worker ON service_runs(primary_worker_id);

CREATE TABLE IF NOT EXISTS service_run_events (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_run_id UUID NOT NULL REFERENCES service_runs(id) ON DELETE CASCADE,
  event_type     TEXT NOT NULL,
  actor_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  from_status    service_run_status,
  to_status      service_run_status,
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_run_events_run ON service_run_events(service_run_id, created_at);

CREATE TABLE IF NOT EXISTS location_events (
  id                         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_run_id              UUID REFERENCES service_runs(id) ON DELETE CASCADE,
  work_order_id               UUID REFERENCES work_orders(id) ON DELETE CASCADE,
  actor_id                    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_type                  TEXT NOT NULL
                              CHECK (event_type IN ('start', 'finish', 'geofence_check', 'override')),
  latitude                    NUMERIC(10,7) NOT NULL,
  longitude                   NUMERIC(10,7) NOT NULL,
  accuracy_meters             NUMERIC(8,2) NOT NULL CHECK (accuracy_meters >= 0),
  captured_at_device          TIMESTAMPTZ NOT NULL,
  received_at_server          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  distance_meters             NUMERIC(10,2),
  configured_radius_meters    NUMERIC(8,2),
  result                      geofence_result NOT NULL,
  source                      TEXT NOT NULL DEFAULT 'online'
                              CHECK (source IN ('online', 'offline_synced')),
  override_reason             TEXT,
  suspicious_reason           TEXT,
  point                       GEOGRAPHY(Point, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(longitude::DOUBLE PRECISION, latitude::DOUBLE PRECISION), 4326)::GEOGRAPHY
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_location_events_run ON location_events(service_run_id, received_at_server);
CREATE INDEX IF NOT EXISTS idx_location_events_work_order ON location_events(work_order_id, received_at_server);
CREATE INDEX IF NOT EXISTS idx_location_events_point_gist ON location_events USING gist(point);

-- ============================================================
-- TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS registered_devices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform         TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_label     TEXT,
  installation_id  TEXT NOT NULL UNIQUE,
  app_version      TEXT,
  last_seen_at     TIMESTAMPTZ,
  tracking_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registered_devices_user ON registered_devices(user_id);

CREATE TABLE IF NOT EXISTS employee_work_sessions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  device_id          UUID REFERENCES registered_devices(id) ON DELETE SET NULL,
  clock_in_source    TEXT NOT NULL DEFAULT 'manual'
                     CHECK (clock_in_source IN ('manual', 'scheduled', 'admin')),
  started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stopped_at         TIMESTAMPTZ,
  stop_reason        TEXT,
  tracking_required  BOOLEAN NOT NULL DEFAULT TRUE,
  tracking_started_at TIMESTAMPTZ,
  tracking_stopped_at TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (stopped_at IS NULL OR stopped_at >= started_at)
);

CREATE INDEX IF NOT EXISTS idx_employee_work_sessions_employee ON employee_work_sessions(employee_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_employee_work_sessions_open ON employee_work_sessions(employee_id) WHERE stopped_at IS NULL;

CREATE TABLE IF NOT EXISTS employee_location_points (
  id                    UUID NOT NULL DEFAULT uuid_generate_v4(),
  point_uuid            UUID NOT NULL,
  employee_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  work_session_id        UUID REFERENCES employee_work_sessions(id) ON DELETE SET NULL,
  device_id              UUID REFERENCES registered_devices(id) ON DELETE SET NULL,
  device_sequence        BIGINT NOT NULL CHECK (device_sequence >= 0),
  latitude               NUMERIC(10,7) NOT NULL,
  longitude              NUMERIC(10,7) NOT NULL,
  accuracy_meters        NUMERIC(8,2) NOT NULL CHECK (accuracy_meters >= 0),
  speed_meters_per_second NUMERIC(8,3),
  heading_degrees        NUMERIC(6,2),
  captured_at_device     TIMESTAMPTZ NOT NULL,
  received_at_server     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source                 TEXT NOT NULL DEFAULT 'native_background'
                         CHECK (source IN ('native_background', 'native_foreground', 'web_foreground', 'offline_synced')),
  point                  GEOGRAPHY(Point, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(longitude::DOUBLE PRECISION, latitude::DOUBLE PRECISION), 4326)::GEOGRAPHY
  ) STORED,
  PRIMARY KEY (id, captured_at_device),
  UNIQUE(point_uuid, captured_at_device),
  UNIQUE(device_id, device_sequence, captured_at_device)
) PARTITION BY RANGE (captured_at_device);

CREATE TABLE IF NOT EXISTS employee_location_points_default
  PARTITION OF employee_location_points DEFAULT;

CREATE INDEX IF NOT EXISTS idx_employee_location_points_employee_time
  ON employee_location_points(employee_id, captured_at_device DESC);
CREATE INDEX IF NOT EXISTS idx_employee_location_points_session_time
  ON employee_location_points(work_session_id, captured_at_device DESC);
CREATE INDEX IF NOT EXISTS idx_employee_location_points_point_gist
  ON employee_location_points USING gist(point);

CREATE TABLE IF NOT EXISTS tracking_health_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  work_session_id  UUID REFERENCES employee_work_sessions(id) ON DELETE SET NULL,
  device_id        UUID REFERENCES registered_devices(id) ON DELETE SET NULL,
  event_type       TEXT NOT NULL,
  severity         TEXT NOT NULL DEFAULT 'info'
                   CHECK (severity IN ('info', 'warning', 'critical')),
  details          JSONB NOT NULL DEFAULT '{}',
  captured_at_device TIMESTAMPTZ,
  received_at_server TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_health_events_employee
  ON tracking_health_events(employee_id, received_at_server DESC);

-- ============================================================
-- EVIDENCE, MEDIA, REPORTS
-- ============================================================

CREATE TABLE IF NOT EXISTS checklist_responses (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_run_id       UUID NOT NULL REFERENCES service_runs(id) ON DELETE CASCADE,
  checklist_item_id    UUID NOT NULL REFERENCES checklist_items(id) ON DELETE RESTRICT,
  response_value       JSONB NOT NULL DEFAULT '{}',
  completed            BOOLEAN NOT NULL DEFAULT FALSE,
  completed_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  completed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(service_run_id, checklist_item_id)
);

CREATE TABLE IF NOT EXISTS service_notes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_run_id UUID NOT NULL REFERENCES service_runs(id) ON DELETE CASCADE,
  note_type      TEXT NOT NULL DEFAULT 'field'
                 CHECK (note_type IN ('field', 'admin', 'customer')),
  body           TEXT NOT NULL,
  created_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_issues (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_run_id UUID NOT NULL REFERENCES service_runs(id) ON DELETE CASCADE,
  issue_type     TEXT NOT NULL DEFAULT 'general',
  severity       TEXT NOT NULL DEFAULT 'normal'
                 CHECK (severity IN ('low', 'normal', 'high', 'urgent')),
  description    TEXT NOT NULL,
  resolved_at    TIMESTAMPTZ,
  created_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_material_usage (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_run_id UUID NOT NULL REFERENCES service_runs(id) ON DELETE CASCADE,
  product_id     UUID REFERENCES products(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  quantity       NUMERIC(12,4) NOT NULL CHECK (quantity >= 0),
  unit           TEXT NOT NULL,
  created_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_equipment_usage (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_run_id UUID NOT NULL REFERENCES service_runs(id) ON DELETE CASCADE,
  asset_id       UUID REFERENCES assets(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  hours_used     NUMERIC(8,2) CHECK (hours_used IS NULL OR hours_used >= 0),
  created_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS snow_service_details (
  id                         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_run_id              UUID NOT NULL UNIQUE REFERENCES service_runs(id) ON DELETE CASCADE,
  snow_depth_inches           NUMERIC(5,2),
  precipitation_observations  TEXT,
  surface_observations        TEXT,
  plowing_complete            BOOLEAN NOT NULL DEFAULT FALSE,
  sidewalks_complete          BOOLEAN NOT NULL DEFAULT FALSE,
  deicer_product              TEXT,
  deicer_quantity             NUMERIC(12,4),
  deicer_unit                 TEXT,
  areas_unable_to_service     TEXT,
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS media_assets (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  legacy_job_photo_id UUID UNIQUE REFERENCES job_photos(id) ON DELETE SET NULL,
  service_run_id     UUID REFERENCES service_runs(id) ON DELETE SET NULL,
  work_order_id      UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  property_id        UUID REFERENCES properties(id) ON DELETE SET NULL,
  uploaded_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  bucket             TEXT NOT NULL,
  object_key         TEXT NOT NULL,
  mime_type          TEXT NOT NULL,
  byte_size          BIGINT NOT NULL CHECK (byte_size >= 0),
  sha256_hex         TEXT CHECK (sha256_hex IS NULL OR sha256_hex ~ '^[a-f0-9]{64}$'),
  width              INTEGER,
  height             INTEGER,
  media_category     TEXT NOT NULL DEFAULT 'routine_evidence',
  evidence_type      TEXT,
  status             media_asset_status NOT NULL DEFAULT 'pending_upload',
  uploaded_at        TIMESTAMPTZ,
  finalized_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(bucket, object_key)
);

CREATE INDEX IF NOT EXISTS idx_media_assets_service_run ON media_assets(service_run_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_work_order ON media_assets(work_order_id);

CREATE TABLE IF NOT EXISTS report_versions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_run_id       UUID NOT NULL REFERENCES service_runs(id) ON DELETE RESTRICT,
  version_number       INTEGER NOT NULL CHECK (version_number > 0),
  source_version       INTEGER NOT NULL CHECK (source_version > 0),
  generated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  generated_by_process TEXT,
  bucket               TEXT NOT NULL,
  object_key           TEXT NOT NULL,
  sha256_hex           TEXT NOT NULL CHECK (sha256_hex ~ '^[a-f0-9]{64}$'),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(service_run_id, version_number),
  UNIQUE(bucket, object_key)
);

-- ============================================================
-- IDEMPOTENCY, AUDIT, RETENTION
-- ============================================================

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key             UUID NOT NULL,
  user_id          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  scope           TEXT NOT NULL,
  request_hash    TEXT,
  response_status INTEGER,
  response_body   JSONB,
  locked_until    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  UNIQUE(user_id, scope, key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires ON idempotency_keys(expires_at);

CREATE TABLE IF NOT EXISTS audit_events (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action         TEXT NOT NULL,
  entity_type    TEXT NOT NULL,
  entity_id      UUID,
  before_data    JSONB,
  after_data     JSONB,
  metadata       JSONB NOT NULL DEFAULT '{}',
  correlation_id UUID DEFAULT uuid_generate_v4(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events(actor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS retention_holds (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scope           retention_hold_scope NOT NULL,
  customer_id      UUID REFERENCES customers(id) ON DELETE CASCADE,
  property_id      UUID REFERENCES properties(id) ON DELETE CASCADE,
  work_order_id    UUID REFERENCES work_orders(id) ON DELETE CASCADE,
  service_run_id   UUID REFERENCES service_runs(id) ON DELETE CASCADE,
  date_range_start DATE,
  date_range_end   DATE,
  reason           TEXT NOT NULL,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  released_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at      TIMESTAMPTZ,
  CHECK (
    (scope = 'customer' AND customer_id IS NOT NULL)
    OR (scope = 'property' AND property_id IS NOT NULL)
    OR (scope = 'work_order' AND work_order_id IS NOT NULL)
    OR (scope = 'service_run' AND service_run_id IS NOT NULL)
    OR (scope = 'incident')
    OR (scope = 'date_range' AND date_range_start IS NOT NULL AND date_range_end IS NOT NULL AND date_range_end >= date_range_start)
  )
);

CREATE INDEX IF NOT EXISTS idx_retention_holds_active ON retention_holds(active) WHERE active = TRUE;

CREATE TABLE IF NOT EXISTS purge_runs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_version  TEXT NOT NULL,
  dry_run         BOOLEAN NOT NULL DEFAULT TRUE,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  requested_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  counts          JSONB NOT NULL DEFAULT '{}',
  bytes_deleted   BIGINT NOT NULL DEFAULT 0 CHECK (bytes_deleted >= 0),
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'subcontractor_companies',
    'service_types',
    'service_template_lineages',
    'service_template_versions',
    'recurring_schedules',
    'work_orders',
    'service_runs',
    'registered_devices',
    'employee_work_sessions',
    'checklist_responses',
    'snow_service_details'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'trg_updated_at_' || t
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
        'trg_updated_at_' || t,
        t
      );
    END IF;
  END LOOP;
END;
$$;

-- ============================================================
-- RLS BASELINE
-- Policies are intentionally conservative. Route handlers using
-- server-side command logic will add narrower access paths.
-- ============================================================

ALTER TABLE subcontractor_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractor_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_template_lineages ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_run_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE registered_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_location_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_health_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_material_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_equipment_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE snow_service_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE purge_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view service foundation data"
  ON service_types FOR SELECT
  USING (is_staff());

CREATE POLICY "Staff can view work orders"
  ON work_orders FOR SELECT
  USING (is_staff());

CREATE POLICY "Assigned employees can view work orders"
  ON work_orders FOR SELECT
  USING (
    id IN (
      SELECT work_order_id FROM work_order_assignments
      WHERE active = TRUE
        AND assignment_type = 'employee'
        AND employee_id = auth.uid()
    )
  );

CREATE POLICY "Staff can view service runs"
  ON service_runs FOR SELECT
  USING (is_staff());

CREATE POLICY "Assigned employees can view service runs"
  ON service_runs FOR SELECT
  USING (
    work_order_id IN (
      SELECT work_order_id FROM work_order_assignments
      WHERE active = TRUE
        AND assignment_type = 'employee'
        AND employee_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own work sessions"
  ON employee_work_sessions FOR SELECT
  USING (employee_id = auth.uid());

CREATE POLICY "Managers can view all work sessions"
  ON employee_work_sessions FOR SELECT
  USING (can_manage_field_work());

CREATE POLICY "Users can view own tracking points"
  ON employee_location_points FOR SELECT
  USING (employee_id = auth.uid());

CREATE POLICY "Managers can view tracking points"
  ON employee_location_points FOR SELECT
  USING (can_manage_field_work());

CREATE POLICY "Owners and admins can view retention holds"
  ON retention_holds FOR SELECT
  USING (is_owner_or_admin());

CREATE POLICY "Owners and admins can view purge runs"
  ON purge_runs FOR SELECT
  USING (is_owner_or_admin());

CREATE POLICY "Users can view accessible media assets"
  ON media_assets FOR SELECT
  USING (
    uploaded_by = auth.uid()
    OR is_staff()
    OR service_run_id IN (
      SELECT sr.id
      FROM service_runs sr
      JOIN work_order_assignments woa ON woa.work_order_id = sr.work_order_id
      WHERE woa.active = TRUE
        AND woa.assignment_type = 'employee'
        AND woa.employee_id = auth.uid()
    )
  );

CREATE POLICY "Assigned employees can create media assets"
  ON media_assets FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND service_run_id IN (
      SELECT sr.id
      FROM service_runs sr
      JOIN work_order_assignments woa ON woa.work_order_id = sr.work_order_id
      WHERE woa.active = TRUE
        AND woa.assignment_type = 'employee'
        AND woa.employee_id = auth.uid()
    )
  );

CREATE POLICY "Uploaders can update pending media assets"
  ON media_assets FOR UPDATE
  USING (
    uploaded_by = auth.uid()
    AND status = 'pending_upload'
  )
  WITH CHECK (
    uploaded_by = auth.uid()
    AND status IN ('pending_upload', 'uploaded', 'attached')
  );

CREATE POLICY "Uploaders can delete pending media assets"
  ON media_assets FOR DELETE
  USING (
    uploaded_by = auth.uid()
    AND status = 'pending_upload'
  );

CREATE POLICY "Staff can view report versions"
  ON report_versions FOR SELECT
  USING (is_staff());
