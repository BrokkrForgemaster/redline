-- One unfinished shared visit per work order until explicit parallel-visit
-- scheduling is implemented. Audit existing duplicates before applying.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM service_runs
    WHERE status IN ('ready', 'in_progress', 'paused') AND submitted_at IS NULL
    GROUP BY work_order_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Resolve duplicate open service runs before migration 022';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_service_runs_one_open_visit
  ON service_runs(work_order_id)
  WHERE status IN ('ready', 'in_progress', 'paused') AND submitted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_location_events_run_tag
  ON location_events(service_run_id, received_at_server DESC)
  WHERE event_type = 'geofence_check';
