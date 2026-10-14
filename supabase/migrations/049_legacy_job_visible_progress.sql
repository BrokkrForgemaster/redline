-- Legacy field-job time entries and photo evidence must produce the same
-- persisted owner-visible progress that canonical service visits produce.
-- Personal workday entries remain separate and never change a job.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_legacy_event_recipient_unique
  ON public.notifications(user_id, type, entity_type, entity_id)
  WHERE entity_type = 'legacy_job_event' AND entity_id IS NOT NULL;

CREATE FUNCTION public.emit_legacy_job_alert(
  p_job_id uuid, p_actor_id uuid, p_event_id uuid,
  p_type text, p_title text, p_body text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE recipient record;
BEGIN
  FOR recipient IN
    SELECT DISTINCT scoped.id, scoped.role FROM (
      SELECT p.id, p.role FROM public.profiles p
        WHERE p.role = 'owner' AND p.status = 'active'
      UNION
      SELECT p.id, p.role FROM public.jobs j
        JOIN public.crews c ON c.id = j.crew_id AND c.active
        JOIN public.profiles p ON p.id = c.leader_id AND p.status = 'active'
        WHERE j.id = p_job_id
      UNION
      SELECT p.id, p.role FROM public.jobs j
        JOIN public.crews c ON c.id = j.crew_id AND c.active
        JOIN public.subcontractor_companies company
          ON company.id = c.subcontractor_company_id AND company.status = 'active'
        JOIN public.subcontractor_memberships membership
          ON membership.subcontractor_company_id = company.id
          AND membership.active AND membership.role IN ('owner', 'manager')
        JOIN public.profiles p ON p.id = membership.user_id
          AND p.role = 'subcontractor' AND p.status = 'active'
        WHERE j.id = p_job_id
    ) scoped WHERE scoped.id <> p_actor_id
  LOOP
    INSERT INTO public.notifications(user_id, type, title, body, action_url,
      entity_type, entity_id)
    VALUES (recipient.id, p_type, p_title, p_body,
      CASE WHEN recipient.role = 'owner' THEN '/jobs/' ELSE '/my-jobs/' END || p_job_id,
      'legacy_job_event', p_event_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.emit_legacy_job_alert(uuid,uuid,uuid,text,text,text) FROM PUBLIC;

CREATE FUNCTION public.on_legacy_job_clock_start()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE previous_status public.job_status;
BEGIN
  IF NEW.job_id IS NULL OR NEW.clock_out IS NOT NULL OR NEW.is_manual THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL OR auth.uid() <> NEW.employee_id OR
     COALESCE(auth.jwt()->>'aal', '') <> 'aal2' OR
     NOT public.can_access_legacy_job(NEW.job_id) THEN
    RAISE EXCEPTION 'Active assigned MFA worker required' USING ERRCODE = '42501';
  END IF;
  SELECT status INTO previous_status FROM public.jobs WHERE id = NEW.job_id FOR UPDATE;
  IF NOT FOUND OR previous_status IN ('completed', 'cancelled', 'archived') THEN
    RAISE EXCEPTION 'Job is unavailable for start' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.job_location_tags tag
      WHERE tag.job_id = NEW.job_id AND tag.employee_id = NEW.employee_id
        AND tag.tag_type = 'manual') OR
     (SELECT count(*) FROM public.job_photos photo
       JOIN storage.objects object ON object.bucket_id = 'job-photos'
         AND object.name = photo.storage_path
       WHERE photo.job_id = NEW.job_id AND photo.employee_id = NEW.employee_id
         AND photo.photo_type = 'before') < 3 THEN
    RAISE EXCEPTION 'Saved site tag and three stored before photos required'
      USING ERRCODE = '23514';
  END IF;
  IF previous_status IN ('approved', 'ready_to_schedule', 'scheduled', 'en_route', 'arrived') THEN
    UPDATE public.jobs SET status = 'in_progress',
      actual_start = COALESCE(actual_start, NEW.clock_in), updated_at = now()
      WHERE id = NEW.job_id;
    INSERT INTO public.job_status_history(job_id, from_status, to_status, changed_by, notes)
      VALUES (NEW.job_id, previous_status, 'in_progress', NEW.employee_id,
        'Field job clock-in confirmed');
    PERFORM public.emit_legacy_job_alert(NEW.job_id, NEW.employee_id, NEW.id,
      'legacy_job_start', 'Job started', 'An assigned job is now in progress.');
  ELSIF previous_status NOT IN ('in_progress', 'paused') THEN
    RAISE EXCEPTION 'Job status does not permit a field start' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.on_legacy_job_clock_start() FROM PUBLIC;
CREATE TRIGGER legacy_job_clock_start_progress
  AFTER INSERT ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.on_legacy_job_clock_start();

CREATE FUNCTION public.on_legacy_job_photo_saved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE verified_count integer;
BEGIN
  -- A metadata row without a stored object cannot satisfy the photo gate.
  IF NOT EXISTS (SELECT 1 FROM storage.objects object
      WHERE object.bucket_id = 'job-photos' AND object.name = NEW.storage_path) THEN
    RAISE EXCEPTION 'Stored job photo object required' USING ERRCODE = '23514';
  END IF;
  PERFORM 1 FROM public.jobs WHERE id = NEW.job_id FOR UPDATE;
  SELECT count(*) INTO verified_count FROM public.job_photos photo
    JOIN storage.objects object ON object.bucket_id = 'job-photos'
      AND object.name = photo.storage_path
    WHERE photo.job_id = NEW.job_id AND photo.photo_type = NEW.photo_type;
  IF verified_count = 3 AND NEW.id = (
    SELECT photo.id FROM public.job_photos photo
    JOIN storage.objects object ON object.bucket_id = 'job-photos'
      AND object.name = photo.storage_path
    WHERE photo.job_id = NEW.job_id AND photo.photo_type = NEW.photo_type
    ORDER BY photo.created_at, photo.id OFFSET 2 LIMIT 1
  ) THEN
    PERFORM public.emit_legacy_job_alert(NEW.job_id, NEW.employee_id, NEW.id,
      'legacy_' || NEW.photo_type || '_photos_ready',
      CASE WHEN NEW.photo_type = 'before' THEN 'Before photos ready' ELSE 'After photos ready' END,
      'Three saved job photos are available for review.');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.on_legacy_job_photo_saved() FROM PUBLIC;
CREATE TRIGGER legacy_job_photo_saved_progress
  AFTER INSERT ON public.job_photos
  FOR EACH ROW EXECUTE FUNCTION public.on_legacy_job_photo_saved();

-- Reconcile previously confirmed field work, including the currently open
-- production job. Do not infer a start from a lone photo or time entry.
DO $$
DECLARE current_entry record; photo_ready record; previous_status public.job_status;
BEGIN
  FOR current_entry IN
    SELECT DISTINCT ON (entry.job_id) entry.id, entry.job_id, entry.employee_id, entry.clock_in
    FROM public.time_entries entry
    WHERE entry.job_id IS NOT NULL AND entry.clock_out IS NULL AND NOT entry.is_manual
      AND EXISTS (SELECT 1 FROM public.job_location_tags tag
        WHERE tag.job_id = entry.job_id AND tag.employee_id = entry.employee_id
          AND tag.tag_type = 'manual')
      AND (SELECT count(*) FROM public.job_photos photo
        JOIN storage.objects object ON object.bucket_id = 'job-photos'
          AND object.name = photo.storage_path
        WHERE photo.job_id = entry.job_id AND photo.employee_id = entry.employee_id
          AND photo.photo_type = 'before') >= 3
    ORDER BY entry.job_id, entry.clock_in
  LOOP
    SELECT status INTO previous_status FROM public.jobs
      WHERE id = current_entry.job_id FOR UPDATE;
    IF previous_status IN ('approved', 'ready_to_schedule', 'scheduled', 'en_route', 'arrived') THEN
      UPDATE public.jobs SET status = 'in_progress',
        actual_start = COALESCE(actual_start, current_entry.clock_in), updated_at = now()
        WHERE id = current_entry.job_id;
      INSERT INTO public.job_status_history(job_id, from_status, to_status, changed_by, notes)
        VALUES (current_entry.job_id, previous_status, 'in_progress',
          current_entry.employee_id, 'Reconciled confirmed field job clock-in');
      PERFORM public.emit_legacy_job_alert(current_entry.job_id,
        current_entry.employee_id, current_entry.id,
        'legacy_job_start', 'Job started', 'An assigned job is now in progress.');
    END IF;
  END LOOP;

  FOR photo_ready IN
    SELECT DISTINCT ON (photo.job_id, photo.photo_type)
      photo.id, photo.job_id, photo.employee_id, photo.photo_type
    FROM public.job_photos photo
    JOIN storage.objects object ON object.bucket_id = 'job-photos'
      AND object.name = photo.storage_path
    WHERE (SELECT count(*) FROM public.job_photos checked
      JOIN storage.objects stored ON stored.bucket_id = 'job-photos'
        AND stored.name = checked.storage_path
      WHERE checked.job_id = photo.job_id AND checked.photo_type = photo.photo_type) >= 3
    ORDER BY photo.job_id, photo.photo_type, photo.created_at DESC, photo.id DESC
  LOOP
    PERFORM public.emit_legacy_job_alert(photo_ready.job_id, photo_ready.employee_id,
      photo_ready.id, 'legacy_' || photo_ready.photo_type || '_photos_ready',
      CASE WHEN photo_ready.photo_type = 'before' THEN 'Before photos ready' ELSE 'After photos ready' END,
      'Three saved job photos are available for review.');
  END LOOP;
END $$;
