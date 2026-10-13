-- Supersedes the missing production effect of 013. 013's WITH CHECK
-- correction remains in history order; this final policy also enforces the
-- current business account and MFA for direct user-context access.
DROP POLICY IF EXISTS "Employees can update their own open entries" ON public.time_entries;

CREATE POLICY "Employees can update their own open entries"
ON public.time_entries FOR UPDATE TO authenticated
USING (
  employee_id = auth.uid()
  AND clock_out IS NULL
  AND public.has_current_business_account()
  AND COALESCE(auth.jwt()->>'aal', '') = 'aal2'
)
WITH CHECK (
  employee_id = auth.uid()
  AND public.has_current_business_account()
  AND COALESCE(auth.jwt()->>'aal', '') = 'aal2'
);

DROP POLICY IF EXISTS "Current active MFA account required" ON public.time_entries;
CREATE POLICY "Current active MFA account required"
ON public.time_entries AS RESTRICTIVE FOR ALL TO authenticated
USING (
  public.has_current_business_account()
  AND COALESCE(auth.jwt()->>'aal', '') = 'aal2'
)
WITH CHECK (
  public.has_current_business_account()
  AND COALESCE(auth.jwt()->>'aal', '') = 'aal2'
);
