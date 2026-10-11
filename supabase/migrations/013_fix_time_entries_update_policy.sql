-- Fix: UPDATE policy on time_entries lacked a WITH CHECK clause.
-- PostgreSQL defaults WITH CHECK to the USING expression, so after setting
-- clock_out to a non-null value the post-update row failed the
-- "clock_out IS NULL" check and the write was rejected.

DROP POLICY IF EXISTS "Employees can update their own open entries" ON time_entries;

CREATE POLICY "Employees can update their own open entries"
  ON time_entries FOR UPDATE
  USING  (employee_id = auth.uid() AND clock_out IS NULL)
  WITH CHECK (employee_id = auth.uid());
