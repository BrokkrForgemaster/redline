# Database Improvement Plan

**Project:** Redline Landscaping & Snow Removal  
**Date:** October 2026  
**Scope:** Professional business-grade database evolution from the current 57-table schema

---

## Current State Summary

The existing schema covers the core service loop well — customers → jobs → time entries → invoices/payments — plus a newer field service layer (work orders, service runs, GPS tracking). The foundation is solid. This plan addresses gaps, data integrity issues, and missing business domains needed to run a professional landscaping operation.

**Current table count:** 57 tables across 20 migrations  
**Coverage by domain:**

| Domain | Tables | Completeness |
|---|---|---|
| CRM | 6 | 70% |
| Jobs / Field Ops | 17 | 60% (dual legacy + new system) |
| Routes / Logistics | 2 | 50% |
| Inventory | 5 | 60% |
| Assets / Fleet | 3 | 40% |
| Time / Payroll | 5 | 30% |
| Financial | 6 | 70% |
| Reporting / Compliance | 5 | 20% |

---

## Phase 1 — Fix & Harden Existing Schema

*No new features — just correctness. These are bugs waiting to happen.*

### Missing Foreign Key Constraints

| Table | Column | Fix |
|---|---|---|
| `jobs` | `invoice_id` | Add `REFERENCES invoices(id) ON DELETE SET NULL` |
| `inventory_transactions` | `purchase_order_id` | Add proper FK to `purchase_orders` |

### Missing CHECK Constraints

| Table | Column | Constraint |
|---|---|---|
| `products` | `current_quantity` | `CHECK (current_quantity >= 0)` |
| `invoices` | `amount_paid` | `CHECK (amount_paid <= total)` |
| `products` | `min_stock`, `max_stock` | `CHECK (min_stock <= max_stock)` |
| `routes` | `estimated_end` | `CHECK (estimated_end >= estimated_start)` |

### Missing Performance Indexes

```sql
CREATE INDEX idx_jobs_contract       ON jobs(contract_id);
CREATE INDEX idx_invoices_contract   ON invoices(contract_id);
CREATE INDEX idx_invoices_estimate   ON invoices(estimate_id);
CREATE INDEX idx_route_stops_contract ON route_stops(contract_id);
CREATE INDEX idx_estimates_customer_status ON estimates(customer_id, status, created_at DESC);
CREATE INDEX idx_jobs_customer_status ON jobs(customer_id, status, scheduled_date);
CREATE INDEX idx_invoices_customer_status ON invoices(customer_id, status, due_date DESC);
```

### Redundant / Deprecated Tables

- **`audit_logs` vs `audit_events`** — two tables serving the same purpose. Consolidate to `audit_events` (the newer, richer table).
- **`job_checklists` / `job_checklist_items` / `job_status_history`** — superseded by the new field service template system. Mark as deprecated, archive data, remove from active queries.
- **`job_photos`** — superseded by `media_assets` (already linked via `legacy_job_photo_id`). Retain for backward compatibility only.
- **`job_location_tags`** — partially superseded by `location_events`. Retain until GPS flows are fully migrated to the new system.

---

## Phase 2 — Complete the Core Business Loop

*Things that break the daily workflow without them.*

### 2A — Service Pricing & Rate Cards

No central place to define what services cost. Every estimate is entered manually with no baseline.

**New tables:**

```sql
-- Base price per service type by property/customer tier
CREATE TABLE service_price_tiers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_type    TEXT NOT NULL,               -- lawn_mowing, snow_push, aeration, etc.
  tier_name       TEXT NOT NULL,               -- residential_small, commercial_large, etc.
  base_price      NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
  unit            TEXT NOT NULL DEFAULT 'per_visit', -- per_visit, per_hour, per_sqft, per_push
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seasonal or situational price modifiers
CREATE TABLE service_price_modifiers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,               -- winter_surcharge, steep_terrain, after_hours
  modifier_type   TEXT NOT NULL                -- percentage, flat_amount
                  CHECK (modifier_type IN ('percentage', 'flat_amount')),
  modifier_value  NUMERIC(10,2) NOT NULL,      -- e.g., 15.00 = 15% or $15 flat
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hourly labor rates by role for cost calculation
CREATE TABLE labor_rates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role            TEXT NOT NULL,               -- crew_leader, crew_member
  rate_type       TEXT NOT NULL                -- regular, overtime, double_time
                  CHECK (rate_type IN ('regular', 'overtime', 'double_time')),
  hourly_rate     NUMERIC(10,2) NOT NULL CHECK (hourly_rate > 0),
  effective_from  DATE NOT NULL,
  effective_to    DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2B — Job Cost Tracking

Jobs have `estimated_hours` but no cost breakdown. Cannot determine if a job was profitable.

**Add columns to `jobs`:**

```sql
ALTER TABLE jobs
  ADD COLUMN estimated_labor_cost    NUMERIC(12,2),
  ADD COLUMN estimated_material_cost NUMERIC(12,2),
  ADD COLUMN estimated_equipment_cost NUMERIC(12,2),
  ADD COLUMN actual_labor_cost       NUMERIC(12,2),
  ADD COLUMN actual_material_cost    NUMERIC(12,2),
  ADD COLUMN actual_equipment_cost   NUMERIC(12,2);
```

**New table for ad-hoc job costs:**

```sql
CREATE TABLE job_expenses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  category     TEXT NOT NULL,        -- dump_fee, subcontractor, rental, materials, other
  description  TEXT NOT NULL,
  amount       NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  receipt_url  TEXT,
  entered_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2C — Customer Communications Log

No record of calls, emails, site visits, or complaints. Essential for CRM.

```sql
CREATE TABLE customer_communications (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  property_id   UUID REFERENCES properties(id) ON DELETE SET NULL,
  job_id        UUID REFERENCES jobs(id) ON DELETE SET NULL,
  channel       TEXT NOT NULL        -- call, email, text, visit, portal_message
                CHECK (channel IN ('call', 'email', 'text', 'visit', 'portal_message', 'other')),
  direction     TEXT NOT NULL        -- inbound, outbound
                CHECK (direction IN ('inbound', 'outbound')),
  subject       TEXT,
  body          TEXT,
  outcome       TEXT,               -- scheduled, resolved, follow_up_needed, no_answer, etc.
  follow_up_date DATE,
  logged_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_communications_customer ON customer_communications(customer_id, created_at DESC);
CREATE INDEX idx_customer_communications_followup ON customer_communications(follow_up_date) WHERE follow_up_date IS NOT NULL;
```

### 2D — Customer Contacts

One customer account often has multiple contacts (billing contact, property manager, on-site supervisor).

```sql
CREATE TABLE customer_contacts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  title               TEXT,                  -- Owner, Property Manager, Billing, etc.
  email               TEXT,
  phone               TEXT,
  phone_ext           TEXT,
  is_primary          BOOLEAN NOT NULL DEFAULT FALSE,
  receives_estimates  BOOLEAN NOT NULL DEFAULT FALSE,
  receives_invoices   BOOLEAN NOT NULL DEFAULT FALSE,
  receives_scheduling BOOLEAN NOT NULL DEFAULT FALSE,
  notes               TEXT,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_contacts_customer ON customer_contacts(customer_id) WHERE active = TRUE;
```

---

## Phase 3 — Workforce Management

*Needed once you have more than 2–3 employees.*

### 3A — Employee HR Profile

The `profiles` table has name/email/role but nothing about employment terms.

**Add columns to `profiles`:**

```sql
ALTER TABLE profiles
  ADD COLUMN hire_date            DATE,
  ADD COLUMN termination_date     DATE,
  ADD COLUMN employment_type      TEXT      -- full_time, part_time, seasonal, contractor
                                  CHECK (employment_type IN ('full_time', 'part_time', 'seasonal', 'contractor')),
  ADD COLUMN base_hourly_rate     NUMERIC(10,2),
  ADD COLUMN overtime_rate        NUMERIC(10,2),
  ADD COLUMN emergency_contact_name  TEXT,
  ADD COLUMN emergency_contact_phone TEXT;
```

### 3B — Employee Certifications & Licenses

Landscaping requires pesticide applicator licenses, CDL, heavy equipment certs, first aid.

```sql
CREATE TABLE employee_certifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cert_type       TEXT NOT NULL,         -- pesticide_applicator, cdl_class_a, first_aid_cpr, etc.
  cert_number     TEXT,
  issued_by       TEXT,
  issued_date     DATE,
  expires_at      DATE,
  document_url    TEXT,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_employee_certifications_employee ON employee_certifications(employee_id);
CREATE INDEX idx_employee_certifications_expiry ON employee_certifications(expires_at) WHERE active = TRUE;
```

### 3C — Payroll Basics

Time entries exist but there is no mechanism to calculate a paycheck.

```sql
-- Add work classification to time entries
ALTER TABLE time_entries
  ADD COLUMN work_type      TEXT NOT NULL DEFAULT 'regular'
                            CHECK (work_type IN ('regular', 'overtime', 'double_time', 'training', 'admin', 'drive_time')),
  ADD COLUMN hourly_rate    NUMERIC(10,2),   -- rate at time of entry (snapshot)
  ADD COLUMN billed_hours   NUMERIC(8,2),    -- may differ from actual (discounts, rounding)
  ADD COLUMN is_billable    BOOLEAN NOT NULL DEFAULT TRUE;

-- Pay period definitions
CREATE TABLE pay_periods (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  pay_date      DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'locked', 'processed', 'paid')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (period_end > period_start),
  CHECK (pay_date >= period_end)
);

-- Payroll summary per employee per period
CREATE TABLE payroll_summaries (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pay_period_id     UUID NOT NULL REFERENCES pay_periods(id) ON DELETE RESTRICT,
  employee_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  regular_hours     NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (regular_hours >= 0),
  overtime_hours    NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (overtime_hours >= 0),
  double_time_hours NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (double_time_hours >= 0),
  gross_pay         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (gross_pay >= 0),
  deductions        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (deductions >= 0),
  net_pay           NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (net_pay >= 0),
  notes             TEXT,
  approved_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pay_period_id, employee_id)
);
```

### 3D — Time Off Tracking

```sql
CREATE TABLE time_off_requests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  request_type  TEXT NOT NULL CHECK (request_type IN ('vacation', 'sick', 'pto', 'unpaid', 'bereavement', 'other')),
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  hours         NUMERIC(6,2),
  reason        TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
  reviewed_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  review_notes  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);
```

---

## Phase 4 — Fleet & Equipment Management

*The `assets` table exists but has no maintenance detail.*

### 4A — Maintenance Schedules & Records

```sql
-- Preventive maintenance plan per asset
CREATE TABLE maintenance_schedules (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id              UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  task_name             TEXT NOT NULL,         -- Oil Change, Blade Sharpening, Annual Inspection
  interval_type         TEXT NOT NULL          -- hours, miles, months, calendar_date
                        CHECK (interval_type IN ('hours', 'miles', 'months', 'calendar_date')),
  interval_value        NUMERIC(10,2) NOT NULL CHECK (interval_value > 0),
  last_performed_at     DATE,
  last_performed_hours  NUMERIC(10,2),
  next_due_date         DATE,
  next_due_hours        NUMERIC(10,2),
  active                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Log of maintenance work performed
CREATE TABLE maintenance_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id        UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  schedule_id     UUID REFERENCES maintenance_schedules(id) ON DELETE SET NULL,
  task_name       TEXT NOT NULL,
  performed_at    DATE NOT NULL,
  hours_at_service NUMERIC(10,2),
  miles_at_service NUMERIC(10,2),
  vendor          TEXT,                  -- who performed the work
  parts_used      TEXT,
  labor_cost      NUMERIC(12,2) CHECK (labor_cost >= 0),
  parts_cost      NUMERIC(12,2) CHECK (parts_cost >= 0),
  total_cost      NUMERIC(12,2) CHECK (total_cost >= 0),
  notes           TEXT,
  performed_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_maintenance_records_asset ON maintenance_records(asset_id, performed_at DESC);
```

### 4B — Fuel Log

```sql
CREATE TABLE fuel_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id        UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  fill_date       DATE NOT NULL,
  gallons         NUMERIC(8,3) NOT NULL CHECK (gallons > 0),
  price_per_gallon NUMERIC(8,3) NOT NULL CHECK (price_per_gallon > 0),
  total_cost      NUMERIC(10,2) NOT NULL CHECK (total_cost > 0),
  odometer_miles  NUMERIC(10,2),
  engine_hours    NUMERIC(10,2),
  fuel_type       TEXT NOT NULL DEFAULT 'gasoline'
                  CHECK (fuel_type IN ('gasoline', 'diesel', 'propane', 'electric')),
  station         TEXT,
  logged_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fuel_log_asset ON fuel_log(asset_id, fill_date DESC);
```

### 4C — Vehicle Inspections (Pre-Trip)

```sql
CREATE TABLE vehicle_inspections (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id      UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  inspected_by  UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  inspected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  inspection_type TEXT NOT NULL DEFAULT 'pre_trip'
                  CHECK (inspection_type IN ('pre_trip', 'post_trip', 'weekly', 'annual')),
  odometer_miles NUMERIC(10,2),
  passed        BOOLEAN NOT NULL,
  defects_noted TEXT,
  defects_resolved_at TIMESTAMPTZ,
  resolved_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes         TEXT
);
```

---

## Phase 5 — Expense & Accounts Payable

*Cannot measure business profit without tracking what goes out.*

```sql
CREATE TABLE expense_categories (
  id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name  TEXT NOT NULL UNIQUE,      -- Fuel, Insurance, Equipment, Advertising, Uniforms
  tax_category TEXT,               -- IRS Schedule C line for tax prep
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE expenses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id     UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  description     TEXT NOT NULL,
  vendor          TEXT,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  expense_date    DATE NOT NULL,
  payment_method  TEXT CHECK (payment_method IN ('check', 'credit_card', 'ach', 'cash', 'other')),
  is_reimbursable BOOLEAN NOT NULL DEFAULT FALSE,
  employee_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- if employee-submitted
  job_id          UUID REFERENCES jobs(id) ON DELETE SET NULL,       -- if job-specific
  receipt_url     TEXT,
  approved_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX idx_expenses_category ON expenses(category_id, expense_date DESC);
```

---

## Phase 6 — Reporting Layer

*Fast dashboard queries without hammering the primary tables.*

```sql
-- Nightly customer metric snapshots (populated by cron or edge function)
CREATE TABLE customer_metrics (
  customer_id       UUID PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  lifetime_revenue  NUMERIC(14,2) NOT NULL DEFAULT 0,
  open_balance      NUMERIC(14,2) NOT NULL DEFAULT 0,
  jobs_completed    INT NOT NULL DEFAULT 0,
  last_service_date DATE,
  avg_job_value     NUMERIC(12,2),
  payment_avg_days  NUMERIC(8,2),   -- average days to pay invoice
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reporting views (no data storage — calculated on demand)
-- Revenue by month and service type
CREATE VIEW v_monthly_revenue AS
  SELECT
    DATE_TRUNC('month', i.issue_date) AS month,
    ii.description AS service,
    SUM(ii.unit_price * ii.quantity) AS revenue,
    COUNT(DISTINCT i.id) AS invoice_count
  FROM invoices i
  JOIN invoice_items ii ON ii.invoice_id = i.id
  WHERE i.status NOT IN ('voided', 'draft')
  GROUP BY 1, 2;

-- Job profitability view
CREATE VIEW v_job_profitability AS
  SELECT
    j.id,
    j.job_number,
    j.title,
    j.service_type,
    j.scheduled_date,
    (j.estimated_labor_cost + COALESCE(j.estimated_material_cost, 0) + COALESCE(j.estimated_equipment_cost, 0)) AS estimated_cost,
    (COALESCE(j.actual_labor_cost, 0) + COALESCE(j.actual_material_cost, 0) + COALESCE(j.actual_equipment_cost, 0)) AS actual_cost,
    i.total AS invoiced_amount,
    i.amount_paid,
    (i.total - COALESCE(j.actual_labor_cost, 0) - COALESCE(j.actual_material_cost, 0) - COALESCE(j.actual_equipment_cost, 0)) AS gross_profit
  FROM jobs j
  LEFT JOIN invoices i ON i.id = j.invoice_id
  WHERE j.status = 'completed';
```

---

## Migration Order

| Migration # | Phase | Description |
|---|---|---|
| 021 | 1 | Fix FK constraints, CHECK constraints, missing indexes |
| 022 | 1 | Deprecate legacy tables (job_checklists, job_status_history, audit_logs) |
| 023 | 2A | Service pricing tiers, modifiers, labor rates |
| 024 | 2B | Job cost columns + job_expenses table |
| 025 | 2C | Customer communications log |
| 026 | 2D | Customer contacts |
| 027 | 3A | Employee HR profile columns |
| 028 | 3B | Employee certifications |
| 029 | 3C | Pay periods + payroll summaries + time_entries work_type |
| 030 | 3D | Time off requests |
| 031 | 4A | Maintenance schedules + records |
| 032 | 4B | Fuel log |
| 033 | 4C | Vehicle inspections |
| 034 | 5 | Expense categories + expenses |
| 035 | 6 | Reporting views + customer_metrics snapshot table |

---

## What to Skip (For Now)

The schema already defines tables that can be left alone until needed:

- `retention_holds`, `purge_runs` — compliance/legal, not yet needed
- `idempotency_keys` — API deduplication, already wired in
- `service_template_lineages/versions` — leave for when checklist templates are actively used
- `registered_devices`, `employee_location_points` — GPS tracking infrastructure, already in place

---

*Last updated: October 2026*
