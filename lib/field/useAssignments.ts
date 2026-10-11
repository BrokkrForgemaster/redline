"use client";

import { useEffect, useState, useCallback } from "react";
import { openFieldDb, idbGet, idbPut, type SyncMetadataEntry } from "./db";
import { createClient } from "@/lib/supabase/client";

const CACHE_KEY = "assignments_cache";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface WorkOrderAssignment {
  id: string;
  assignment_type: string;
  work_orders: {
    id: string;
    work_order_number: string;
    title: string;
    status: string;
    scheduled_start: string | null;
    scheduled_end: string | null;
    timezone: string;
    instructions: string | null;
    customers: {
      id: string;
      first_name: string;
      last_name: string;
      business_name: string | null;
    } | null;
    properties: {
      id: string;
      property_name: string | null;
      address_line1: string;
      city: string;
      state: string;
      zip: string;
      latitude: number | null;
      longitude: number | null;
      geofence_radius_meters: number;
      timezone: string;
      access_instructions: string | null;
      service_instructions: string | null;
      safety_instructions: string | null;
    } | null;
  } | null;
}

export interface LegacyJob {
  id: string;
  job_number: string;
  title: string;
  service_type: string;
  status: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  work_instructions: string | null;
  access_notes: string | null;
  customers: { id: string; first_name: string; last_name: string; business_name: string | null } | null;
  properties: { id: string; property_name: string | null; address_line1: string; city: string; state: string; zip: string; latitude: number | null; longitude: number | null } | null;
}

export interface AssignmentsResult {
  assignments: WorkOrderAssignment[];
  legacy_jobs: LegacyJob[];
  warnings: string[];
}

interface CachedAssignments {
  key: string;
  data: AssignmentsResult;
  fetched_at: string;
}

export interface UseAssignmentsState {
  data: AssignmentsResult | null;
  loading: boolean;
  error: string | null;
  fromCache: boolean;
  refetch: () => void;
}

export function useAssignments(): UseAssignmentsState {
  const [data, setData] = useState<AssignmentsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [fetchTick, setFetchTick] = useState(0);

  const refetch = useCallback(() => setFetchTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      // Serve from cache immediately if fresh enough
      try {
        const db = await openFieldDb();
        const cached = await idbGet<CachedAssignments>(db, "syncMetadata", CACHE_KEY);
        if (cached && !cancelled) {
          const age = Date.now() - new Date(cached.fetched_at).getTime();
          if (age < CACHE_TTL_MS) {
            setData(cached.data);
            setFromCache(true);
            setLoading(false);
          }
        }
      } catch {
        // IndexedDB unavailable — proceed to network fetch
      }

      // Always attempt fresh fetch
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const res = await fetch("/api/v1/me/assignments", {
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: AssignmentsResult = await res.json();

        if (!cancelled) {
          setData(json);
          setFromCache(false);
          setLoading(false);
          setError(null);
        }

        // Write back to cache
        try {
          const db = await openFieldDb();
          const entry: SyncMetadataEntry & { data: AssignmentsResult } = {
            key: CACHE_KEY,
            value: null,
            data: json,
            updated_at: new Date().toISOString(),
          };
          // Store using idbPut with a custom shape under syncMetadata
          const cacheRecord: CachedAssignments = {
            key: CACHE_KEY,
            data: json,
            fetched_at: new Date().toISOString(),
          };
          await idbPut(db, "syncMetadata", cacheRecord);
        } catch {
          // Cache write failure is non-fatal
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Failed to load assignments.";
          setError(msg);
          if (!data) setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchTick]);

  return { data, loading, error, fromCache, refetch };
}
