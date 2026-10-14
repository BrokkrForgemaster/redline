-- Legacy one-time field jobs complete when an authorized worker finishes the
-- job clock with confirmed after evidence and a current finish location.
-- A personal workday clock, recurring parent and canonical project stay open.
CREATE FUNCTION public.legacy_job_actor_assigned(p_actor uuid, p_job uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles profile
    JOIN public.jobs job ON job.id = p_job
    WHERE profile.id = p_actor AND profile.status = 'active'
      AND (profile.role = 'owner' OR
        (profile.role IN ('mowing_crew_lead','mowing_crew_laborer','snow_plow_operator','subcontractor')
          AND (EXISTS (SELECT 1 FROM public.job_assignments assignment
            WHERE assignment.job_id = job.id AND assignment.employee_id = p_actor)
          OR EXISTS (SELECT 1 FROM public.crews crew
            JOIN public.crew_members member ON member.crew_id = crew.id
            WHERE crew.id = job.crew_id AND crew.active AND member.employee_id = p_actor)
          OR EXISTS (SELECT 1 FROM public.crews crew
            JOIN public.subcontractor_companies company
              ON company.id = crew.subcontractor_company_id AND company.status = 'active'
            JOIN public.subcontractor_memberships membership
              ON membership.subcontractor_company_id = company.id
              AND membership.user_id = p_actor AND membership.active
              AND membership.role IN ('owner','manager')
            WHERE crew.id = job.crew_id AND crew.active
              AND profile.role = 'subcontractor'))))
  )
$$;
REVOKE ALL ON FUNCTION public.legacy_job_actor_assigned(uuid,uuid) FROM PUBLIC;

CREATE FUNCTION public.reconcile_legacy_job_finish(p_job uuid, p_actor uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE current_job public.jobs%ROWTYPE; finished_entry record;
BEGIN
  IF NOT public.legacy_job_actor_assigned(p_actor, p_job) THEN RETURN false; END IF;
  SELECT * INTO current_job FROM public.jobs WHERE id = p_job FOR UPDATE;
  IF NOT FOUND OR current_job.status NOT IN ('in_progress','paused') THEN RETURN false; END IF;
  SELECT entry.id, entry.clock_out INTO finished_entry
    FROM public.time_entries entry
    WHERE entry.job_id = p_job AND entry.employee_id = p_actor
      AND entry.clock_out IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.job_location_tags tag
        WHERE tag.job_id = p_job AND tag.employee_id = p_actor AND tag.tag_type = 'finish'
          AND tag.created_at BETWEEN entry.clock_out - interval '10 minutes'
            AND entry.clock_out + interval '10 minutes')
    ORDER BY entry.clock_out DESC LIMIT 1;
  IF NOT FOUND OR (SELECT count(DISTINCT photo.storage_path) FROM public.job_photos photo
    JOIN storage.objects object ON object.bucket_id = 'job-photos'
      AND object.name = photo.storage_path
    WHERE photo.job_id = p_job AND photo.photo_type = 'after') < 3 THEN
    RETURN false;
  END IF;
  IF current_job.is_recurring OR EXISTS (
    SELECT 1 FROM public.work_orders wo WHERE wo.legacy_job_id = p_job
  ) THEN
    PERFORM public.emit_legacy_job_alert(p_job, p_actor, finished_entry.id,
      'legacy_job_visit_finished', 'Job visit finished',
      'A worker finished this visit; the recurring or project work remains open.');
    RETURN true;
  END IF;
  UPDATE public.jobs SET status = 'completed', actual_end = finished_entry.clock_out,
    updated_at = now() WHERE id = p_job AND status IN ('in_progress','paused');
  INSERT INTO public.job_status_history(job_id, from_status, to_status, changed_by, notes)
    VALUES (p_job, current_job.status, 'completed', p_actor,
      'Field job finish confirmed with GPS and three stored after photos');
  PERFORM public.emit_legacy_job_alert(p_job, p_actor, finished_entry.id,
    'legacy_job_finish', 'Job completed', 'An assigned job has been completed.');
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.reconcile_legacy_job_finish(uuid,uuid) FROM PUBLIC;

CREATE FUNCTION public.on_legacy_job_clock_finish()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.job_id IS NULL OR OLD.clock_out IS NOT NULL OR NEW.clock_out IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.employee_id IS DISTINCT FROM OLD.employee_id OR
     NEW.job_id IS DISTINCT FROM OLD.job_id THEN
    RAISE EXCEPTION 'Job clock identity changed' USING ERRCODE = '42501';
  END IF;
  IF auth.uid() IS NOT NULL THEN
    IF auth.uid() <> NEW.employee_id OR
       COALESCE(auth.jwt()->>'aal','') <> 'aal2' OR
       NOT public.legacy_job_actor_assigned(NEW.employee_id, NEW.job_id) THEN
      RAISE EXCEPTION 'Active assigned MFA worker required' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.job_location_tags tag
      WHERE tag.job_id = NEW.job_id AND tag.employee_id = NEW.employee_id
        AND tag.tag_type = 'finish' AND tag.created_at >= now() - interval '10 minutes') OR
       (SELECT count(DISTINCT photo.storage_path) FROM public.job_photos photo
         JOIN storage.objects object ON object.bucket_id = 'job-photos'
           AND object.name = photo.storage_path
         WHERE photo.job_id = NEW.job_id AND photo.photo_type = 'after') < 3 THEN
      RAISE EXCEPTION 'Saved finish GPS and three stored after photos required'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  -- Existing service-role clock-outs remain compatible during app rollout.
  -- They are reconciled only after the user's scoped finish tag is saved.
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.on_legacy_job_clock_finish() FROM PUBLIC;
CREATE TRIGGER legacy_job_clock_finish_gate
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.on_legacy_job_clock_finish();

CREATE FUNCTION public.on_legacy_job_clock_finished()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.job_id IS NOT NULL AND OLD.clock_out IS NULL AND NEW.clock_out IS NOT NULL THEN
    PERFORM public.reconcile_legacy_job_finish(NEW.job_id, NEW.employee_id);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.on_legacy_job_clock_finished() FROM PUBLIC;
CREATE TRIGGER legacy_job_clock_finished_progress
  AFTER UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.on_legacy_job_clock_finished();

CREATE FUNCTION public.on_legacy_job_finish_tag_saved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.tag_type = 'finish' THEN
    PERFORM public.reconcile_legacy_job_finish(NEW.job_id, NEW.employee_id);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.on_legacy_job_finish_tag_saved() FROM PUBLIC;
CREATE TRIGGER legacy_job_finish_tag_progress
  AFTER INSERT ON public.job_location_tags
  FOR EACH ROW EXECUTE FUNCTION public.on_legacy_job_finish_tag_saved();

CREATE FUNCTION public.finish_legacy_job_clock(
  p_entry_id uuid, p_job_id uuid, p_latitude numeric, p_longitude numeric,
  p_accuracy_meters numeric, p_captured_at_device timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE actor uuid := auth.uid(); current_entry public.time_entries%ROWTYPE;
  result_status public.job_status;
BEGIN
  IF actor IS NULL OR COALESCE(auth.jwt()->>'aal','') <> 'aal2' OR
     NOT public.legacy_job_actor_assigned(actor, p_job_id) THEN
    RAISE EXCEPTION 'Active assigned MFA worker required' USING ERRCODE = '42501';
  END IF;
  IF p_latitude IS NULL OR p_latitude < -90 OR p_latitude > 90 OR
     p_longitude IS NULL OR p_longitude < -180 OR p_longitude > 180 OR
     p_accuracy_meters IS NULL OR p_accuracy_meters < 0 OR p_accuracy_meters > 75 OR
     p_captured_at_device IS NULL OR
     p_captured_at_device > now() + interval '5 minutes' OR
     p_captured_at_device < now() - interval '30 minutes' THEN
    RAISE EXCEPTION 'A current GPS fix with acceptable accuracy is required'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO current_entry FROM public.time_entries
    WHERE id = p_entry_id AND job_id = p_job_id AND employee_id = actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job clock entry unavailable' USING ERRCODE = 'P0002'; END IF;
  IF current_entry.clock_out IS NULL THEN
    INSERT INTO public.job_location_tags(job_id, employee_id, tag_type,
      latitude, longitude, accuracy_meters, captured_at_device)
    VALUES (p_job_id, actor, 'finish', p_latitude, p_longitude,
      p_accuracy_meters, p_captured_at_device);
    UPDATE public.time_entries SET clock_out = now(), updated_at = now()
      WHERE id = p_entry_id AND clock_out IS NULL;
  END IF;
  SELECT status INTO result_status FROM public.jobs WHERE id = p_job_id;
  RETURN jsonb_build_object('entryId', p_entry_id, 'jobStatus', result_status,
    'clockOut', (SELECT clock_out FROM public.time_entries WHERE id = p_entry_id));
END $$;
REVOKE ALL ON FUNCTION public.finish_legacy_job_clock(uuid,uuid,numeric,numeric,numeric,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finish_legacy_job_clock(uuid,uuid,numeric,numeric,numeric,timestamptz) TO authenticated;

-- Reconcile only saved, GPS-tagged finishes. Open job clocks and recurrence
-- definitions are unchanged. Repeating the scan cannot duplicate history.
DO $$ DECLARE finished record;
BEGIN
  FOR finished IN SELECT DISTINCT entry.job_id, entry.employee_id
    FROM public.time_entries entry JOIN public.jobs job ON job.id = entry.job_id
    WHERE entry.clock_out IS NOT NULL AND job.status IN ('in_progress','paused')
      AND EXISTS (SELECT 1 FROM public.job_location_tags tag
        WHERE tag.job_id = entry.job_id AND tag.employee_id = entry.employee_id
          AND tag.tag_type = 'finish'
          AND tag.created_at BETWEEN entry.clock_out - interval '10 minutes'
            AND entry.clock_out + interval '10 minutes')
  LOOP
    PERFORM public.reconcile_legacy_job_finish(finished.job_id, finished.employee_id);
  END LOOP;
END $$;
