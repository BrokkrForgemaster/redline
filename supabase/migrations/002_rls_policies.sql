-- ============================================================
-- Redline – Row-Level Security Policies
-- Migration: 002_rls_policies.sql
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties            ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE crews                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE products              ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets                ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates             ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_assignments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_status_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_checklists        ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_checklist_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_notes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE snow_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stops           ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices              ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_projects      ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_images        ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_consents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION auth_role()
RETURNS app_role
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role NOT IN ('customer')
    AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION is_owner_or_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('owner', 'administrator')
    AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION is_financial_role()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('owner', 'administrator', 'office_manager', 'bookkeeper')
    AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION can_manage_field_work()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('owner', 'administrator', 'operations_manager', 'crew_leader', 'snow_operations_manager')
    AND status = 'active'
  )
$$;

-- ============================================================
-- PROFILES POLICIES
-- ============================================================

CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Staff can view all profiles"
  ON profiles FOR SELECT
  USING (is_staff());

CREATE POLICY "Owners and admins can manage profiles"
  ON profiles FOR ALL
  USING (is_owner_or_admin());

CREATE POLICY "Users can update their own non-role fields"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

-- ============================================================
-- BUSINESS SETTINGS POLICIES
-- ============================================================

CREATE POLICY "Staff can view business settings"
  ON business_settings FOR SELECT
  USING (is_staff());

CREATE POLICY "Owners and admins can modify settings"
  ON business_settings FOR ALL
  USING (is_owner_or_admin());

-- ============================================================
-- CUSTOMERS POLICIES
-- ============================================================

CREATE POLICY "Staff can view active customers"
  ON customers FOR SELECT
  USING (is_staff() AND deleted_at IS NULL);

CREATE POLICY "Customer role can view own record"
  ON customers FOR SELECT
  USING (
    auth_role() = 'customer'
    AND id IN (
      SELECT customer_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Staff can create customers"
  ON customers FOR INSERT
  WITH CHECK (is_staff());

CREATE POLICY "Staff can update customers"
  ON customers FOR UPDATE
  USING (is_staff() AND deleted_at IS NULL);

CREATE POLICY "Only owners and admins can archive customers"
  ON customers FOR UPDATE
  USING (is_owner_or_admin() OR (is_staff() AND deleted_at IS NULL));

-- Allow anonymous insert for estimate requests (leads only, not customers directly)

-- ============================================================
-- PROPERTIES POLICIES
-- ============================================================

CREATE POLICY "Staff can view properties"
  ON properties FOR SELECT
  USING (is_staff() AND deleted_at IS NULL);

CREATE POLICY "Assigned crews can view property details for their jobs"
  ON properties FOR SELECT
  USING (
    auth_role() IN ('crew_leader', 'crew_member')
    AND id IN (
      SELECT j.property_id FROM jobs j
      INNER JOIN job_assignments ja ON ja.job_id = j.id
      WHERE ja.employee_id = auth.uid()
      AND j.status IN ('scheduled','en_route','arrived','in_progress')
    )
  );

CREATE POLICY "Staff can manage properties"
  ON properties FOR ALL
  USING (is_staff());

-- ============================================================
-- LEADS POLICIES
-- ============================================================

CREATE POLICY "Staff can view leads"
  ON leads FOR SELECT
  USING (is_staff());

CREATE POLICY "Anonymous can insert leads"
  ON leads FOR INSERT
  WITH CHECK (auth.role() = 'anon');

CREATE POLICY "Staff can insert leads"
  ON leads FOR INSERT
  WITH CHECK (is_staff());

CREATE POLICY "Staff can update leads"
  ON leads FOR UPDATE
  USING (is_staff());

-- ============================================================
-- CREWS POLICIES
-- ============================================================

CREATE POLICY "Staff can view crews"
  ON crews FOR SELECT
  USING (is_staff());

CREATE POLICY "Managers can manage crews"
  ON crews FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('owner','administrator','operations_manager','snow_operations_manager')
      AND status = 'active'
    )
  );

CREATE POLICY "Staff can view crew members"
  ON crew_members FOR SELECT
  USING (is_staff());

CREATE POLICY "Managers can manage crew members"
  ON crew_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('owner','administrator','operations_manager','snow_operations_manager')
      AND status = 'active'
    )
  );

-- ============================================================
-- ESTIMATES POLICIES
-- ============================================================

CREATE POLICY "Staff can view estimates"
  ON estimates FOR SELECT
  USING (is_staff());

CREATE POLICY "Customer can view own estimates"
  ON estimates FOR SELECT
  USING (
    auth_role() = 'customer'
    AND customer_id IN (SELECT customer_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Estimators and above can create estimates"
  ON estimates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('owner','administrator','operations_manager','office_manager','estimator')
      AND status = 'active'
    )
  );

CREATE POLICY "Estimators and above can update draft estimates"
  ON estimates FOR UPDATE
  USING (is_staff() AND status IN ('draft','ready_for_review'));

CREATE POLICY "Owners and admins can update any estimate"
  ON estimates FOR UPDATE
  USING (is_owner_or_admin());

CREATE POLICY "Staff can view estimate items"
  ON estimate_items FOR SELECT
  USING (is_staff());

CREATE POLICY "Customer can view own estimate items"
  ON estimate_items FOR SELECT
  USING (
    auth_role() = 'customer'
    AND estimate_id IN (
      SELECT e.id FROM estimates e
      WHERE e.customer_id IN (SELECT customer_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Staff can manage estimate items"
  ON estimate_items FOR ALL
  USING (is_staff());

-- ============================================================
-- CONTRACTS POLICIES
-- ============================================================

CREATE POLICY "Staff can view contracts"
  ON contracts FOR SELECT
  USING (is_staff());

CREATE POLICY "Customer can view own contracts"
  ON contracts FOR SELECT
  USING (
    auth_role() = 'customer'
    AND customer_id IN (SELECT customer_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Staff can manage contracts"
  ON contracts FOR ALL
  USING (is_staff());

-- ============================================================
-- JOBS POLICIES
-- ============================================================

CREATE POLICY "Staff can view jobs"
  ON jobs FOR SELECT
  USING (is_staff());

CREATE POLICY "Crew members can view assigned jobs"
  ON jobs FOR SELECT
  USING (
    auth_role() IN ('crew_leader', 'crew_member')
    AND id IN (
      SELECT job_id FROM job_assignments WHERE employee_id = auth.uid()
    )
  );

CREATE POLICY "Customer can view own jobs"
  ON jobs FOR SELECT
  USING (
    auth_role() = 'customer'
    AND customer_id IN (SELECT customer_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Managers can manage jobs"
  ON jobs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('owner','administrator','operations_manager','office_manager')
      AND status = 'active'
    )
  );

CREATE POLICY "Crew leaders can update their jobs"
  ON jobs FOR UPDATE
  USING (
    auth_role() = 'crew_leader'
    AND crew_id IN (
      SELECT crew_id FROM crew_members WHERE employee_id = auth.uid()
    )
  );

CREATE POLICY "Staff can view job assignments"
  ON job_assignments FOR SELECT
  USING (is_staff());

CREATE POLICY "Managers can manage job assignments"
  ON job_assignments FOR ALL
  USING (can_manage_field_work());

CREATE POLICY "Staff can view job status history"
  ON job_status_history FOR SELECT
  USING (is_staff());

CREATE POLICY "Staff can insert job status history"
  ON job_status_history FOR INSERT
  WITH CHECK (is_staff());

CREATE POLICY "Staff can view checklists"
  ON job_checklists FOR SELECT
  USING (is_staff());

CREATE POLICY "Staff can manage checklists"
  ON job_checklists FOR ALL
  USING (is_staff());

CREATE POLICY "Staff can view checklist items"
  ON job_checklist_items FOR SELECT
  USING (is_staff());

CREATE POLICY "Staff can manage checklist items"
  ON job_checklist_items FOR ALL
  USING (is_staff());

CREATE POLICY "Staff can view job notes"
  ON job_notes FOR SELECT
  USING (is_staff());

CREATE POLICY "Staff can create job notes"
  ON job_notes FOR INSERT
  WITH CHECK (is_staff());

-- ============================================================
-- SNOW EVENTS POLICIES
-- ============================================================

CREATE POLICY "Staff can view snow events"
  ON snow_events FOR SELECT
  USING (is_staff());

CREATE POLICY "Snow managers can manage events"
  ON snow_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('owner','administrator','operations_manager','snow_operations_manager')
      AND status = 'active'
    )
  );

CREATE POLICY "Staff can view routes"
  ON routes FOR SELECT
  USING (is_staff());

CREATE POLICY "Managers can manage routes"
  ON routes FOR ALL
  USING (can_manage_field_work());

CREATE POLICY "Staff can view route stops"
  ON route_stops FOR SELECT
  USING (is_staff());

CREATE POLICY "Managers can manage route stops"
  ON route_stops FOR ALL
  USING (can_manage_field_work());

CREATE POLICY "Crew can update their route stops"
  ON route_stops FOR UPDATE
  USING (
    route_id IN (
      SELECT r.id FROM routes r
      INNER JOIN crew_members cm ON cm.crew_id = r.crew_id
      WHERE cm.employee_id = auth.uid()
    )
  );

-- ============================================================
-- INVOICES POLICIES
-- ============================================================

CREATE POLICY "Financial roles can view all invoices"
  ON invoices FOR SELECT
  USING (is_financial_role());

CREATE POLICY "Other staff can view non-financial invoices"
  ON invoices FOR SELECT
  USING (is_staff());

CREATE POLICY "Customers can view own invoices"
  ON invoices FOR SELECT
  USING (
    auth_role() = 'customer'
    AND customer_id IN (SELECT customer_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Financial roles can manage invoices"
  ON invoices FOR ALL
  USING (is_financial_role());

CREATE POLICY "Financial roles can view invoice items"
  ON invoice_items FOR SELECT
  USING (
    invoice_id IN (SELECT id FROM invoices)
    AND (is_financial_role() OR is_staff())
  );

CREATE POLICY "Financial roles can manage invoice items"
  ON invoice_items FOR ALL
  USING (is_financial_role());

CREATE POLICY "Financial roles can view payments"
  ON payments FOR SELECT
  USING (is_financial_role());

CREATE POLICY "Customers can view own payments"
  ON payments FOR SELECT
  USING (
    auth_role() = 'customer'
    AND customer_id IN (SELECT customer_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Financial roles can record payments"
  ON payments FOR INSERT
  WITH CHECK (is_financial_role());

-- ============================================================
-- INVENTORY POLICIES
-- ============================================================

CREATE POLICY "Staff can view products"
  ON products FOR SELECT
  USING (is_staff());

CREATE POLICY "Inventory managers and above can manage products"
  ON products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('owner','administrator','operations_manager','inventory_manager')
      AND status = 'active'
    )
  );

CREATE POLICY "Staff can view inventory transactions"
  ON inventory_transactions FOR SELECT
  USING (is_staff());

CREATE POLICY "Authorized staff can record transactions"
  ON inventory_transactions FOR INSERT
  WITH CHECK (is_staff());

CREATE POLICY "Staff can view suppliers"
  ON suppliers FOR SELECT
  USING (is_staff());

CREATE POLICY "Managers can manage suppliers"
  ON suppliers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('owner','administrator','operations_manager','inventory_manager')
      AND status = 'active'
    )
  );

CREATE POLICY "Staff can view purchase orders"
  ON purchase_orders FOR SELECT
  USING (is_staff());

CREATE POLICY "Managers can manage purchase orders"
  ON purchase_orders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('owner','administrator','operations_manager','inventory_manager')
      AND status = 'active'
    )
  );

CREATE POLICY "Staff can view purchase order items"
  ON purchase_order_items FOR SELECT
  USING (is_staff());

CREATE POLICY "Managers can manage purchase order items"
  ON purchase_order_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('owner','administrator','operations_manager','inventory_manager')
      AND status = 'active'
    )
  );

-- ============================================================
-- ASSETS POLICIES
-- ============================================================

CREATE POLICY "Staff can view assets"
  ON assets FOR SELECT
  USING (is_staff());

CREATE POLICY "Managers can manage assets"
  ON assets FOR ALL
  USING (can_manage_field_work());

-- ============================================================
-- TIME ENTRIES POLICIES
-- ============================================================

CREATE POLICY "Employees can view their own time entries"
  ON time_entries FOR SELECT
  USING (employee_id = auth.uid());

CREATE POLICY "Managers can view all time entries"
  ON time_entries FOR SELECT
  USING (can_manage_field_work());

CREATE POLICY "Employees can insert their own time entries"
  ON time_entries FOR INSERT
  WITH CHECK (employee_id = auth.uid() AND is_staff());

CREATE POLICY "Employees can update their own open entries"
  ON time_entries FOR UPDATE
  USING (employee_id = auth.uid() AND clock_out IS NULL);

CREATE POLICY "Managers can update any time entry"
  ON time_entries FOR UPDATE
  USING (can_manage_field_work());

-- ============================================================
-- GALLERY POLICIES
-- ============================================================

CREATE POLICY "Anyone can view published gallery projects"
  ON gallery_projects FOR SELECT
  USING (status = 'published');

CREATE POLICY "Staff can view all gallery projects"
  ON gallery_projects FOR SELECT
  USING (is_staff());

CREATE POLICY "Staff can manage gallery projects"
  ON gallery_projects FOR ALL
  USING (is_staff());

CREATE POLICY "Anyone can view published gallery images"
  ON gallery_images FOR SELECT
  USING (
    project_id IN (SELECT id FROM gallery_projects WHERE status = 'published')
  );

CREATE POLICY "Staff can view all gallery images"
  ON gallery_images FOR SELECT
  USING (is_staff());

CREATE POLICY "Staff can manage gallery images"
  ON gallery_images FOR ALL
  USING (is_staff());

CREATE POLICY "Staff can view consents"
  ON gallery_consents FOR SELECT
  USING (is_staff());

CREATE POLICY "Staff can manage consents"
  ON gallery_consents FOR ALL
  USING (is_staff());

-- ============================================================
-- NOTIFICATIONS POLICIES
-- ============================================================

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (TRUE);

-- ============================================================
-- AUDIT LOGS POLICIES
-- ============================================================

CREATE POLICY "Owners and admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (is_owner_or_admin());

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (TRUE);

-- Audit logs cannot be updated or deleted by normal users
-- Service role bypasses RLS for server-side operations
