-- ============================================================
-- Redline Landscaping & Snow Removal – Initial Database Schema
-- Migration: 001_initial_schema.sql
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE app_role AS ENUM (
  'owner',
  'administrator',
  'operations_manager',
  'office_manager',
  'estimator',
  'crew_leader',
  'crew_member',
  'snow_operations_manager',
  'inventory_manager',
  'bookkeeper',
  'read_only',
  'customer'
);

CREATE TYPE lead_status AS ENUM (
  'new', 'contacted', 'site_visit_scheduled', 'site_visit_completed',
  'estimate_in_progress', 'estimate_sent', 'awaiting_customer',
  'won', 'lost', 'archived'
);

CREATE TYPE estimate_status AS ENUM (
  'draft', 'ready_for_review', 'sent', 'viewed', 'changes_requested',
  'approved', 'declined', 'expired', 'converted', 'voided'
);

CREATE TYPE contract_status AS ENUM (
  'draft', 'sent', 'viewed', 'approved', 'active', 'suspended',
  'expired', 'renewed', 'cancelled', 'completed'
);

CREATE TYPE job_status AS ENUM (
  'pending_approval', 'approved', 'awaiting_deposit', 'awaiting_materials',
  'ready_to_schedule', 'scheduled', 'en_route', 'arrived', 'in_progress',
  'paused', 'quality_review', 'completed', 'follow_up_required',
  'cancelled', 'weather_delayed', 'archived'
);

CREATE TYPE snow_event_status AS ENUM (
  'monitoring', 'preparing', 'activated', 'in_progress',
  'paused', 'cleanup', 'completed', 'cancelled'
);

CREATE TYPE route_type AS ENUM (
  'mowing', 'general_maintenance', 'snow_plowing', 'salting',
  'sidewalk_clearing', 'inspection', 'estimate_visits'
);

CREATE TYPE invoice_status AS ENUM (
  'draft', 'issued', 'sent', 'viewed', 'partially_paid',
  'paid', 'overdue', 'voided', 'refunded', 'written_off'
);

CREATE TYPE asset_status AS ENUM (
  'available', 'assigned', 'in_use', 'maintenance_due',
  'out_of_service', 'retired', 'sold'
);

CREATE TYPE inventory_transaction_type AS ENUM (
  'initial_stock', 'purchase_receipt', 'job_usage', 'snow_event_usage',
  'return_from_job', 'supplier_return', 'adjustment', 'damage',
  'loss', 'transfer', 'cycle_count', 'disposal', 'expiration'
);

CREATE TYPE purchase_order_status AS ENUM (
  'draft', 'submitted', 'confirmed', 'partially_received',
  'received', 'cancelled', 'closed'
);

CREATE TYPE consent_status AS ENUM (
  'not_requested', 'pending', 'approved', 'approved_with_restrictions',
  'declined', 'revoked'
);

-- ============================================================
-- DOCUMENT NUMBERING (collision-safe)
-- ============================================================

CREATE TABLE document_sequences (
  prefix     TEXT        NOT NULL,
  year       INTEGER     NOT NULL,
  last_seq   INTEGER     NOT NULL DEFAULT 0,
  PRIMARY KEY (prefix, year)
);

CREATE OR REPLACE FUNCTION get_next_document_number(p_prefix TEXT, p_year INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  INSERT INTO document_sequences (prefix, year, last_seq)
  VALUES (p_prefix, p_year, 1)
  ON CONFLICT (prefix, year)
  DO UPDATE SET last_seq = document_sequences.last_seq + 1
  RETURNING last_seq INTO v_seq;

  RETURN p_prefix || '-' || p_year::TEXT || '-' || LPAD(v_seq::TEXT, 5, '0');
END;
$$;

-- ============================================================
-- BUSINESS SETTINGS
-- ============================================================

CREATE TABLE business_settings (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_name             TEXT NOT NULL DEFAULT 'Redline Landscaping & Snow Removal',
  legal_name                TEXT,
  logo_url                  TEXT,
  address_line1             TEXT,
  address_line2             TEXT,
  city                      TEXT,
  state                     TEXT,
  zip                       TEXT,
  phone                     TEXT,
  email                     TEXT,
  website                   TEXT,
  tax_id                    TEXT,
  default_tax_rate          NUMERIC(5,2) NOT NULL DEFAULT 0,
  estimate_prefix           TEXT NOT NULL DEFAULT 'EST',
  contract_prefix           TEXT NOT NULL DEFAULT 'CON',
  job_prefix                TEXT NOT NULL DEFAULT 'JOB',
  invoice_prefix            TEXT NOT NULL DEFAULT 'INV',
  po_prefix                 TEXT NOT NULL DEFAULT 'PO',
  snow_event_prefix         TEXT NOT NULL DEFAULT 'SNOW',
  default_payment_terms     INTEGER NOT NULL DEFAULT 30,
  estimate_expiration_days  INTEGER NOT NULL DEFAULT 30,
  default_deposit_percent   NUMERIC(5,2) NOT NULL DEFAULT 0,
  currency                  TEXT NOT NULL DEFAULT 'USD',
  timezone                  TEXT NOT NULL DEFAULT 'America/New_York',
  pdf_footer                TEXT,
  terms_and_conditions      TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================

CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  phone           TEXT,
  avatar_url      TEXT,
  role            app_role NOT NULL DEFAULT 'crew_member',
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'inactive', 'invited', 'suspended')),
  mfa_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  last_sign_in_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PERMISSIONS
-- ============================================================

CREATE TABLE permissions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE role_permissions (
  role        app_role NOT NULL,
  permission  TEXT NOT NULL REFERENCES permissions(name) ON DELETE CASCADE,
  PRIMARY KEY (role, permission)
);

-- ============================================================
-- CUSTOMERS
-- ============================================================

CREATE TABLE customers (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_type          TEXT NOT NULL DEFAULT 'individual'
                        CHECK (account_type IN ('individual', 'business')),
  first_name            TEXT NOT NULL,
  last_name             TEXT NOT NULL,
  business_name         TEXT,
  primary_contact       TEXT,
  email                 TEXT NOT NULL,
  mobile_phone          TEXT,
  alternate_phone       TEXT,
  billing_address_line1 TEXT,
  billing_address_line2 TEXT,
  billing_city          TEXT,
  billing_state         TEXT,
  billing_zip           TEXT,
  preferred_contact     TEXT CHECK (preferred_contact IN ('email', 'phone', 'text')),
  customer_source       TEXT,
  tax_exempt            BOOLEAN NOT NULL DEFAULT FALSE,
  tax_exemption_id      TEXT,
  communication_prefs   JSONB NOT NULL DEFAULT '{}',
  internal_notes        TEXT,
  tags                  TEXT[] NOT NULL DEFAULT '{}',
  status                TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'inactive', 'archived')),
  portal_access         BOOLEAN NOT NULL DEFAULT FALSE,
  created_by            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_status ON customers(status) WHERE deleted_at IS NULL;

-- Link customer-portal users back to their customer record (added after customers table to avoid circular ref)
ALTER TABLE profiles ADD COLUMN customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX idx_customers_search ON customers USING gin(to_tsvector('english', first_name || ' ' || last_name || ' ' || COALESCE(business_name, '') || ' ' || email));

-- ============================================================
-- PROPERTIES
-- ============================================================

CREATE TABLE properties (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id             UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  property_name           TEXT,
  address_line1           TEXT NOT NULL,
  address_line2           TEXT,
  city                    TEXT NOT NULL,
  state                   TEXT NOT NULL,
  zip                     TEXT NOT NULL,
  property_type           TEXT NOT NULL DEFAULT 'residential'
                          CHECK (property_type IN ('residential', 'commercial')),
  residential_type        TEXT,
  lot_size_sqft           NUMERIC(12,2),
  turf_area_sqft          NUMERIC(12,2),
  bed_area_sqft           NUMERIC(12,2),
  sidewalk_area_sqft      NUMERIC(12,2),
  parking_area_sqft       NUMERIC(12,2),
  driveway_area_sqft      NUMERIC(12,2),
  snow_service_area_sqft  NUMERIC(12,2),
  salt_treatment_area_sqft NUMERIC(12,2),
  access_instructions     TEXT,
  gate_code_encrypted     TEXT,
  water_access_notes      TEXT,
  irrigation_notes        TEXT,
  hazards                 TEXT,
  pets_on_property        BOOLEAN NOT NULL DEFAULT FALSE,
  utility_notes           TEXT,
  preferred_service_days  TEXT[] NOT NULL DEFAULT '{}',
  service_restrictions    TEXT,
  property_notes          TEXT,
  active                  BOOLEAN NOT NULL DEFAULT TRUE,
  latitude                NUMERIC(10,7),
  longitude               NUMERIC(10,7),
  created_by              UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by              UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at              TIMESTAMPTZ
);

CREATE INDEX idx_properties_customer ON properties(customer_id);
CREATE INDEX idx_properties_active ON properties(active) WHERE deleted_at IS NULL;

-- ============================================================
-- LEADS
-- ============================================================

CREATE TABLE leads (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source                TEXT NOT NULL DEFAULT 'website',
  first_name            TEXT NOT NULL,
  last_name             TEXT NOT NULL,
  email                 TEXT,
  phone                 TEXT,
  company_name          TEXT,
  service_address       TEXT,
  requested_services    TEXT[] NOT NULL DEFAULT '{}',
  status                lead_status NOT NULL DEFAULT 'new',
  assigned_to           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  follow_up_date        DATE,
  notes                 TEXT,
  loss_reason           TEXT,
  converted_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  created_by            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_assigned ON leads(assigned_to);
CREATE INDEX idx_leads_follow_up ON leads(follow_up_date) WHERE follow_up_date IS NOT NULL;

-- ============================================================
-- CREWS & EMPLOYEES
-- ============================================================

CREATE TABLE crews (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  leader_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  description TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE crew_members (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crew_id     UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member')),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(crew_id, employee_id)
);

-- ============================================================
-- PRODUCTS / INVENTORY
-- ============================================================

CREATE TABLE suppliers (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name   TEXT NOT NULL,
  contact_name   TEXT,
  email          TEXT,
  phone          TEXT,
  address        TEXT,
  website        TEXT,
  account_number TEXT,
  payment_terms  TEXT,
  notes          TEXT,
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT NOT NULL,
  category            TEXT NOT NULL,
  brand               TEXT,
  supplier_id         UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  location            TEXT,
  bin                 TEXT,
  unit_of_measure     TEXT NOT NULL DEFAULT 'each',
  purchase_cost       NUMERIC(12,4) NOT NULL DEFAULT 0,
  billable_price      NUMERIC(12,4) NOT NULL DEFAULT 0,
  taxable             BOOLEAN NOT NULL DEFAULT TRUE,
  reorder_point       NUMERIC(12,4) NOT NULL DEFAULT 0,
  reorder_quantity    NUMERIC(12,4) NOT NULL DEFAULT 0,
  current_quantity    NUMERIC(12,4) NOT NULL DEFAULT 0,
  reserved_quantity   NUMERIC(12,4) NOT NULL DEFAULT 0,
  min_stock           NUMERIC(12,4) NOT NULL DEFAULT 0,
  max_stock           NUMERIC(12,4) NOT NULL DEFAULT 0,
  barcode             TEXT UNIQUE,
  sku                 TEXT UNIQUE,
  manufacturer_part   TEXT,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_low_stock ON products(current_quantity, reorder_point) WHERE active = TRUE;

-- ============================================================
-- ASSETS (Equipment & Vehicles)
-- ============================================================

CREATE TABLE assets (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_number                TEXT NOT NULL UNIQUE,
  asset_type                  TEXT NOT NULL,
  make                        TEXT,
  model                       TEXT,
  year                        INTEGER CHECK (year > 1900 AND year <= EXTRACT(YEAR FROM NOW()) + 2),
  serial_number               TEXT,
  vin                         TEXT,
  license_plate               TEXT,
  purchase_date               DATE,
  purchase_price              NUMERIC(12,2),
  current_hours               NUMERIC(10,1),
  current_mileage             INTEGER,
  assigned_crew_id            UUID REFERENCES crews(id) ON DELETE SET NULL,
  assigned_employee_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status                      asset_status NOT NULL DEFAULT 'available',
  storage_location            TEXT,
  maintenance_interval_hours  NUMERIC(10,1),
  last_maintenance_date       DATE,
  next_maintenance_date       DATE,
  insurance_expiration        DATE,
  registration_expiration     DATE,
  notes                       TEXT,
  created_by                  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ESTIMATES
-- ============================================================

CREATE TABLE estimates (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  estimate_number  TEXT NOT NULL UNIQUE,
  version          INTEGER NOT NULL DEFAULT 1,
  customer_id      UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  property_id      UUID REFERENCES properties(id) ON DELETE SET NULL,
  estimator_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status           estimate_status NOT NULL DEFAULT 'draft',
  title            TEXT NOT NULL,
  description      TEXT,
  issue_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  expiration_date  DATE,
  subtotal         NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_type    TEXT CHECK (discount_type IN ('percent', 'fixed')),
  discount_value   NUMERIC(12,4) NOT NULL DEFAULT 0,
  discount_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate         NUMERIC(5,4) NOT NULL DEFAULT 0,
  tax_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  total            NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit_percent  NUMERIC(5,2) NOT NULL DEFAULT 0,
  deposit_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit_paid     NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_terms    TEXT,
  customer_notes   TEXT,
  internal_notes   TEXT,
  approval_name    TEXT,
  approval_ip      INET,
  approved_at      TIMESTAMPTZ,
  declined_at      TIMESTAMPTZ,
  decline_reason   TEXT,
  sent_at          TIMESTAMPTZ,
  viewed_at        TIMESTAMPTZ,
  converted_to     TEXT CHECK (converted_to IN ('contract', 'job')),
  converted_id     UUID,
  snapshot_data    JSONB,
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_estimates_customer ON estimates(customer_id);
CREATE INDEX idx_estimates_status ON estimates(status);
CREATE INDEX idx_estimates_number ON estimates(estimate_number);

CREATE TABLE estimate_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  estimate_id  UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  item_type    TEXT NOT NULL CHECK (item_type IN ('service', 'material', 'labor', 'equipment', 'subcontractor', 'fee', 'discount')),
  name         TEXT NOT NULL,
  description  TEXT,
  quantity     NUMERIC(12,4) NOT NULL DEFAULT 1,
  unit         TEXT,
  unit_price   NUMERIC(12,4) NOT NULL DEFAULT 0,
  total        NUMERIC(12,2) NOT NULL DEFAULT 0,
  taxable      BOOLEAN NOT NULL DEFAULT TRUE,
  product_id   UUID REFERENCES products(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CONTRACTS
-- ============================================================

CREATE TABLE contracts (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_number    TEXT NOT NULL UNIQUE,
  version            INTEGER NOT NULL DEFAULT 1,
  customer_id        UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  property_id        UUID REFERENCES properties(id) ON DELETE SET NULL,
  estimate_id        UUID REFERENCES estimates(id) ON DELETE SET NULL,
  contract_type      TEXT NOT NULL,
  status             contract_status NOT NULL DEFAULT 'draft',
  title              TEXT NOT NULL,
  description        TEXT,
  start_date         DATE NOT NULL,
  end_date           DATE,
  renewal_date       DATE,
  auto_renewal       BOOLEAN NOT NULL DEFAULT FALSE,
  frequency          TEXT,
  pricing_model      TEXT NOT NULL DEFAULT 'fixed'
                     CHECK (pricing_model IN ('fixed','per_visit','monthly','seasonal','per_push','per_event','time_material')),
  included_visits    INTEGER,
  snow_depth_trigger NUMERIC(4,2),
  service_window     TEXT,
  subtotal           NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate           NUMERIC(5,4) NOT NULL DEFAULT 0,
  tax_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  total              NUMERIC(12,2) NOT NULL DEFAULT 0,
  cancellation_terms TEXT,
  customer_notes     TEXT,
  internal_notes     TEXT,
  signature_name     TEXT,
  signature_ip       INET,
  signed_at          TIMESTAMPTZ,
  snapshot_data      JSONB,
  created_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contracts_customer ON contracts(customer_id);
CREATE INDEX idx_contracts_status ON contracts(status);

-- ============================================================
-- JOBS
-- ============================================================

CREATE TABLE jobs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_number       TEXT NOT NULL UNIQUE,
  customer_id      UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  property_id      UUID REFERENCES properties(id) ON DELETE SET NULL,
  estimate_id      UUID REFERENCES estimates(id) ON DELETE SET NULL,
  contract_id      UUID REFERENCES contracts(id) ON DELETE SET NULL,
  invoice_id       UUID, -- set after invoice created
  service_type     TEXT NOT NULL,
  priority         TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status           job_status NOT NULL DEFAULT 'approved',
  title            TEXT NOT NULL,
  description      TEXT,
  crew_id          UUID REFERENCES crews(id) ON DELETE SET NULL,
  scheduled_date   DATE,
  scheduled_start  TIMESTAMPTZ,
  scheduled_end    TIMESTAMPTZ,
  actual_start     TIMESTAMPTZ,
  actual_end       TIMESTAMPTZ,
  estimated_hours  NUMERIC(6,2),
  actual_hours     NUMERIC(6,2),
  work_instructions TEXT,
  access_notes     TEXT,
  crew_notes       TEXT,
  weather_conditions TEXT,
  is_recurring     BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_rule  TEXT,
  parent_job_id    UUID REFERENCES jobs(id) ON DELETE SET NULL,
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jobs_customer ON jobs(customer_id);
CREATE INDEX idx_jobs_crew ON jobs(crew_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_scheduled ON jobs(scheduled_date);

CREATE TABLE job_assignments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  employee_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader','member')),
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(job_id, employee_id)
);

CREATE TABLE job_status_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id      UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  from_status job_status,
  to_status   job_status NOT NULL,
  changed_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE job_checklists (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id      UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE job_checklist_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checklist_id UUID NOT NULL REFERENCES job_checklists(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  completed    BOOLEAN NOT NULL DEFAULT FALSE,
  completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE job_notes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  note_type    TEXT NOT NULL DEFAULT 'internal' CHECK (note_type IN ('internal','customer','crew')),
  body         TEXT NOT NULL,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SNOW EVENTS
-- ============================================================

CREATE TABLE snow_events (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_number             TEXT NOT NULL UNIQUE,
  event_name               TEXT NOT NULL,
  status                   snow_event_status NOT NULL DEFAULT 'monitoring',
  manager_id               UUID REFERENCES profiles(id) ON DELETE SET NULL,
  forecast_start           TIMESTAMPTZ,
  forecast_end             TIMESTAMPTZ,
  actual_start             TIMESTAMPTZ,
  actual_end               TIMESTAMPTZ,
  expected_snowfall_inches NUMERIC(5,2),
  actual_snowfall_inches   NUMERIC(5,2),
  ice_risk                 BOOLEAN NOT NULL DEFAULT FALSE,
  temperature_low          NUMERIC(5,1),
  weather_notes            TEXT,
  operational_priority     TEXT NOT NULL DEFAULT 'normal'
                           CHECK (operational_priority IN ('low','normal','high','emergency')),
  event_notes              TEXT,
  created_by               UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROUTES
-- ============================================================

CREATE TABLE routes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_name     TEXT NOT NULL,
  route_type     route_type NOT NULL,
  crew_id        UUID REFERENCES crews(id) ON DELETE SET NULL,
  vehicle_id     UUID REFERENCES assets(id) ON DELETE SET NULL,
  job_date       DATE,
  snow_event_id  UUID REFERENCES snow_events(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','assigned','in_progress','completed','cancelled')),
  estimated_start TIMESTAMPTZ,
  estimated_end   TIMESTAMPTZ,
  actual_start   TIMESTAMPTZ,
  actual_end     TIMESTAMPTZ,
  notes          TEXT,
  created_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE route_stops (
  id                         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id                   UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  property_id                UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  contract_id                UUID REFERENCES contracts(id) ON DELETE SET NULL,
  stop_order                 INTEGER NOT NULL,
  priority                   INTEGER NOT NULL DEFAULT 5,
  status                     TEXT NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','in_progress','completed','skipped','blocked')),
  estimated_duration_minutes INTEGER,
  actual_arrival             TIMESTAMPTZ,
  actual_completion          TIMESTAMPTZ,
  service_notes              TEXT,
  skip_reason                TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INVOICES
-- ============================================================

CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number  TEXT NOT NULL UNIQUE,
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  property_id     UUID REFERENCES properties(id) ON DELETE SET NULL,
  estimate_id     UUID REFERENCES estimates(id) ON DELETE SET NULL,
  contract_id     UUID REFERENCES contracts(id) ON DELETE SET NULL,
  job_id          UUID REFERENCES jobs(id) ON DELETE SET NULL,
  snow_event_id   UUID REFERENCES snow_events(id) ON DELETE SET NULL,
  status          invoice_status NOT NULL DEFAULT 'draft',
  issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE NOT NULL,
  payment_terms   INTEGER NOT NULL DEFAULT 30,
  subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate        NUMERIC(5,4) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid     NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance_due     NUMERIC(12,2) NOT NULL DEFAULT 0,
  customer_notes  TEXT,
  internal_notes  TEXT,
  sent_at         TIMESTAMPTZ,
  viewed_at       TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  voided_at       TIMESTAMPTZ,
  void_reason     TEXT,
  snapshot_data   JSONB,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date) WHERE status NOT IN ('paid','voided','written_off');

CREATE TABLE invoice_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id   UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  name         TEXT NOT NULL,
  description  TEXT,
  quantity     NUMERIC(12,4) NOT NULL DEFAULT 1,
  unit_price   NUMERIC(12,4) NOT NULL DEFAULT 0,
  total        NUMERIC(12,2) NOT NULL DEFAULT 0,
  taxable      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id       UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  customer_id      UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  amount           NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method   TEXT NOT NULL,
  reference_number TEXT,
  payment_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  notes            TEXT,
  recorded_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_customer ON payments(customer_id);

-- ============================================================
-- INVENTORY TRANSACTIONS
-- ============================================================

CREATE TABLE inventory_transactions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id        UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  transaction_type  inventory_transaction_type NOT NULL,
  quantity_change   NUMERIC(12,4) NOT NULL,
  quantity_before   NUMERIC(12,4) NOT NULL,
  quantity_after    NUMERIC(12,4) NOT NULL,
  unit_cost         NUMERIC(12,4),
  job_id            UUID REFERENCES jobs(id) ON DELETE SET NULL,
  snow_event_id     UUID REFERENCES snow_events(id) ON DELETE SET NULL,
  purchase_order_id UUID,
  reference_number  TEXT,
  notes             TEXT,
  created_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_tx_product ON inventory_transactions(product_id);
CREATE INDEX idx_inventory_tx_date ON inventory_transactions(created_at);

-- ============================================================
-- PURCHASE ORDERS
-- ============================================================

CREATE TABLE purchase_orders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_number         TEXT NOT NULL UNIQUE,
  supplier_id       UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  status            purchase_order_status NOT NULL DEFAULT 'draft',
  order_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery DATE,
  subtotal          NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  total             NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes             TEXT,
  created_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE purchase_order_items (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id  UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id         UUID REFERENCES products(id) ON DELETE SET NULL,
  description        TEXT NOT NULL,
  quantity_ordered   NUMERIC(12,4) NOT NULL,
  quantity_received  NUMERIC(12,4) NOT NULL DEFAULT 0,
  unit_cost          NUMERIC(12,4) NOT NULL,
  total              NUMERIC(12,2) NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TIME ENTRIES
-- ============================================================

CREATE TABLE time_entries (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  job_id           UUID REFERENCES jobs(id) ON DELETE SET NULL,
  snow_event_id    UUID REFERENCES snow_events(id) ON DELETE SET NULL,
  route_id         UUID REFERENCES routes(id) ON DELETE SET NULL,
  clock_in         TIMESTAMPTZ NOT NULL,
  clock_out        TIMESTAMPTZ,
  break_minutes    INTEGER NOT NULL DEFAULT 0,
  total_minutes    INTEGER GENERATED ALWAYS AS (
    CASE WHEN clock_out IS NOT NULL
    THEN GREATEST(0, EXTRACT(EPOCH FROM (clock_out - clock_in))::INTEGER / 60 - break_minutes)
    ELSE NULL END
  ) STORED,
  notes            TEXT,
  is_manual        BOOLEAN NOT NULL DEFAULT FALSE,
  correction_reason TEXT,
  corrected_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_overlap CHECK (clock_out IS NULL OR clock_out > clock_in)
);

CREATE INDEX idx_time_entries_employee ON time_entries(employee_id, clock_in);
CREATE INDEX idx_time_entries_job ON time_entries(job_id) WHERE job_id IS NOT NULL;

-- ============================================================
-- GALLERY
-- ============================================================

CREATE TABLE gallery_projects (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title               TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,
  summary             TEXT,
  description         TEXT,
  property_type       TEXT,
  city                TEXT,
  category            TEXT NOT NULL,
  services_performed  TEXT[] NOT NULL DEFAULT '{}',
  completion_date     DATE,
  cover_image_id      UUID,
  display_order       INTEGER NOT NULL DEFAULT 0,
  featured            BOOLEAN NOT NULL DEFAULT FALSE,
  status              TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','published','archived')),
  seo_title           TEXT,
  seo_description     TEXT,
  publication_date    TIMESTAMPTZ,
  job_id              UUID REFERENCES jobs(id) ON DELETE SET NULL,
  customer_consent_id UUID,
  created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gallery_status ON gallery_projects(status);
CREATE INDEX idx_gallery_featured ON gallery_projects(featured) WHERE status = 'published';
CREATE INDEX idx_gallery_slug ON gallery_projects(slug);

CREATE TABLE gallery_images (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id    UUID NOT NULL REFERENCES gallery_projects(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,
  url           TEXT NOT NULL,
  thumbnail_url TEXT,
  caption       TEXT,
  alt_text      TEXT NOT NULL DEFAULT '',
  image_type    TEXT NOT NULL DEFAULT 'general'
                CHECK (image_type IN ('before','after','during','general')),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  width         INTEGER,
  height        INTEGER,
  created_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE gallery_consents (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id          UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  project_id           UUID REFERENCES gallery_projects(id) ON DELETE SET NULL,
  status               consent_status NOT NULL DEFAULT 'not_requested',
  consent_date         DATE,
  consent_method       TEXT,
  recorded_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  allow_name_display   BOOLEAN NOT NULL DEFAULT FALSE,
  allow_address_display BOOLEAN NOT NULL DEFAULT FALSE,
  allow_marketing_use  BOOLEAN NOT NULL DEFAULT FALSE,
  restrictions         TEXT,
  notes                TEXT,
  revoked_at           TIMESTAMPTZ,
  revoked_reason       TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  action_url  TEXT,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  read_at     TIMESTAMPTZ,
  entity_type TEXT,
  entity_id   UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC) WHERE read = FALSE;

-- ============================================================
-- AUDIT LOGS
-- ============================================================

CREATE TABLE audit_logs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id       UUID,
  actor_email    TEXT,
  action         TEXT NOT NULL,
  entity_type    TEXT NOT NULL,
  entity_id      UUID,
  before_data    JSONB,
  after_data     JSONB,
  metadata       JSONB,
  ip_address     INET,
  user_agent     TEXT,
  correlation_id UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_date ON audit_logs(created_at DESC);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'business_settings','profiles','customers','properties','leads','crews',
    'suppliers','products','assets','estimates','estimate_items','contracts',
    'jobs','snow_events','routes','route_stops','invoices','purchase_orders',
    'time_entries','gallery_projects','gallery_consents'
  ] LOOP
    EXECUTE format('CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END;
$$;

-- ============================================================
-- PROFILE AUTO-CREATE ON AUTH SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, first_name, last_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'New'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'crew_member'),
    'active'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
