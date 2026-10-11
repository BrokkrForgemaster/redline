"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, MapPin, Clock, AlertTriangle, Loader2,
  PlayCircle, PauseCircle, CheckCircle2, Send,
  Navigation, Camera, ChevronDown, ChevronUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useGps } from "@/lib/field/useGps";
import { useOutbox } from "@/lib/field/useOutbox";
import { useActiveRun } from "@/lib/field/useActiveRun";
import { OfflineBanner } from "@/components/field/OfflineBanner";
import { SyncStatusBar } from "@/components/field/SyncStatusBar";
import {
  ServiceChecklist, checklistComplete,
  type ChecklistSection, type ChecklistResponse,
} from "@/components/field/ServiceChecklist";

interface WorkOrderDetail {
  id: string;
  work_order_number: string;
  title: string;
  status: string;
  scheduled_start: string | null;
  instructions: string | null;
  customers: { first_name: string; last_name: string; business_name: string | null } | null;
  properties: {
    address_line1: string; city: string; state: string; zip: string;
    geofence_radius_meters: number;
    access_instructions: string | null;
    service_instructions: string | null;
    safety_instructions: string | null;
  } | null;
}

interface GeofenceInfo {
  result: string;
  distance_meters: number;
  configured_radius_meters: number;
  warning: string | null;
}

interface PhotoState {
  uploading: boolean;
}

const MIN_PHOTOS = 3;

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function geofenceBadge(result: string) {
  if (result === "on_site") return { label: "On site", cls: "bg-green-50 border-green-200 text-green-700" };
  if (result === "near") return { label: "Near site", cls: "bg-amber-50 border-amber-200 text-amber-700" };
  if (result === "override_approved") return { label: "Override approved", cls: "bg-blue-50 border-blue-200 text-blue-700" };
  return { label: result, cls: "bg-gray-50 border-gray-200 text-gray-600" };
}

function fmtTime(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function ServiceRunPage() {
  const { workOrderId } = useParams<{ workOrderId: string }>();
  const gps = useGps();
  const outbox = useOutbox();
  const { run, updateRun, clearRun } = useActiveRun(workOrderId);

  const [workOrder, setWorkOrder] = useState<WorkOrderDetail | null>(null);
  const [geofence, setGeofence] = useState<GeofenceInfo | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [acting, setActing] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [showOverride, setShowOverride] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [photos, setPhotos] = useState<PhotoState>({ uploading: false });
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  const [checklistSections, setChecklistSections] = useState<ChecklistSection[]>([]);
  const [checklistResponses, setChecklistResponses] = useState<Record<string, ChecklistResponse>>({});
  const checklistSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  // Live timer
  useEffect(() => {
    if (!run.startedAt || run.status !== "in_progress" || run.finishedAt) return;
    const start = new Date(run.startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [run.startedAt, run.status, run.finishedAt]);

  const loadWorkOrder = useCallback(async () => {
    setFetching(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/v1/work-orders/${workOrderId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.work_order) throw new Error("Not found");
      setWorkOrder(json.work_order as WorkOrderDetail);
    } catch {
      setFetchError("Could not load job details. You may be offline.");
    } finally {
      setFetching(false);
    }
  }, [workOrderId]);

  useEffect(() => { loadWorkOrder(); }, [loadWorkOrder]);

  // Load checklist template + saved responses once the run is active
  useEffect(() => {
    if (!run.serviceRunId) return;
    let cancelled = false;

    async function loadChecklist() {
      try {
        const [tmplRes, respRes] = await Promise.all([
          fetch(`/api/v1/work-orders/${workOrderId}/template`),
          fetch(`/api/v1/service-runs/${run.serviceRunId}/checklist`),
        ]);
        if (cancelled) return;
        if (tmplRes.ok) {
          const tmpl = await tmplRes.json();
          setChecklistSections(tmpl.sections ?? []);
        }
        if (respRes.ok) {
          const resp = await respRes.json();
          setChecklistResponses(resp.responses ?? {});
        }
      } catch {
        // Offline — checklist will be empty; state preserved in memory
      }
    }

    loadChecklist();
    return () => { cancelled = true; };
  }, [run.serviceRunId, workOrderId]);

  const handleChecklistChange = useCallback(
    (itemId: string, completed: boolean, value?: Record<string, unknown>) => {
      setChecklistResponses((prev) => ({
        ...prev,
        [itemId]: { completed, response_value: value ?? {}, completed_at: completed ? new Date().toISOString() : null },
      }));

      // Debounced save
      if (checklistSaveTimer.current) clearTimeout(checklistSaveTimer.current);
      checklistSaveTimer.current = setTimeout(async () => {
        if (!run.serviceRunId) return;
        const key = crypto.randomUUID();
        try {
          await fetch(`/api/v1/service-runs/${run.serviceRunId}/checklist`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Idempotency-Key": key },
            body: JSON.stringify({
              responses: [{ checklist_item_id: itemId, completed, response_value: value ?? {} }],
            }),
          });
        } catch {
          // Offline — local state already updated; will sync on reconnect via outbox if needed
        }
      }, 800);
    },
    [run.serviceRunId]
  );

  // ── START ────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    setActing(true);
    try {
      const loc = await gps.acquire();
      if (!loc) { setActing(false); return; }

      const res = await fetch(`/api/v1/work-orders/${workOrderId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          location: { latitude: loc.latitude, longitude: loc.longitude, accuracy_meters: loc.accuracy_meters, captured_at_device: loc.captured_at_device },
          ...(overrideReason ? { override_reason: overrideReason } : {}),
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        const code: string = json?.code ?? "";
        if (code === "OUTSIDE_GEOFENCE" || code === "OVERRIDE_REQUIRED") {
          setShowOverride(true);
          toast.error(json.message ?? "Outside geofence. Enter an override reason.");
          setActing(false);
          return;
        }
        throw new Error(json.message ?? `HTTP ${res.status}`);
      }

      const sr = json.service_run;
      await updateRun({ serviceRunId: sr.id, status: "in_progress", startedAt: sr.started_at ?? new Date().toISOString(), finishedAt: null, submittedAt: null });
      setGeofence(json.geofence);
      setShowOverride(false);
      setOverrideReason("");
      toast.success("Job started!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start job.");
    } finally {
      setActing(false);
    }
  }, [gps, workOrderId, overrideReason, updateRun]);

  // ── PAUSE ────────────────────────────────────────────────────
  const handlePause = useCallback(async () => {
    if (!run.serviceRunId) return;
    setActing(true);
    try {
      await outbox.enqueue({
        action: "service-runs:pause",
        url: `/api/v1/service-runs/${run.serviceRunId}/pause`,
        method: "POST",
        body: {},
        idempotency_key: crypto.randomUUID(),
        queued_at: new Date().toISOString(),
        dependency_ids: [],
      });
      await outbox.drain();
      await updateRun({ status: "paused" });
      toast.success("Job paused.");
    } catch {
      toast.error("Pause queued — will sync when you reconnect.");
      await updateRun({ status: "paused" });
    } finally {
      setActing(false);
    }
  }, [run.serviceRunId, outbox, updateRun]);

  // ── RESUME ───────────────────────────────────────────────────
  const handleResume = useCallback(async () => {
    if (!run.serviceRunId) return;
    setActing(true);
    try {
      await outbox.enqueue({
        action: "service-runs:resume",
        url: `/api/v1/service-runs/${run.serviceRunId}/resume`,
        method: "POST",
        body: {},
        idempotency_key: crypto.randomUUID(),
        queued_at: new Date().toISOString(),
        dependency_ids: [],
      });
      await outbox.drain();
      await updateRun({ status: "in_progress" });
      toast.success("Job resumed.");
    } catch {
      toast.error("Resume queued — will sync when you reconnect.");
      await updateRun({ status: "in_progress" });
    } finally {
      setActing(false);
    }
  }, [run.serviceRunId, outbox, updateRun]);

  // ── FINISH ───────────────────────────────────────────────────
  const handleFinish = useCallback(async () => {
    if (!run.serviceRunId) return;
    setActing(true);
    try {
      const loc = await gps.acquire();
      if (!loc) { setActing(false); return; }

      const res = await fetch(`/api/v1/service-runs/${run.serviceRunId}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          location: { latitude: loc.latitude, longitude: loc.longitude, accuracy_meters: loc.accuracy_meters, captured_at_device: loc.captured_at_device },
          ...(overrideReason ? { override_reason: overrideReason } : {}),
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        const code: string = json?.code ?? "";
        if (code === "OUTSIDE_GEOFENCE" || code === "OVERRIDE_REQUIRED") {
          setShowOverride(true);
          toast.error(json.message ?? "Outside geofence. Enter an override reason.");
          setActing(false);
          return;
        }
        throw new Error(json.message ?? `HTTP ${res.status}`);
      }

      await updateRun({ status: json.service_run.status, finishedAt: json.service_run.finished_at });
      setGeofence(json.geofence);
      setShowOverride(false);
      setOverrideReason("");
      toast.success("Work finished! Add after photos and submit.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to finish job.");
    } finally {
      setActing(false);
    }
  }, [run.serviceRunId, gps, overrideReason, updateRun]);

  // ── SUBMIT ───────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!run.serviceRunId) return;
    setActing(true);
    try {
      await outbox.enqueue({
        action: "service-runs:submit",
        url: `/api/v1/service-runs/${run.serviceRunId}/submit`,
        method: "POST",
        body: {},
        idempotency_key: crypto.randomUUID(),
        queued_at: new Date().toISOString(),
        dependency_ids: [],
      });
      await outbox.drain();
      const submittedAt = new Date().toISOString();
      await updateRun({ status: "submitted", submittedAt });
      toast.success("Job submitted for review!");
      await clearRun();
    } catch {
      toast.error("Submit queued — will send when you reconnect.");
      await updateRun({ status: "submitted", submittedAt: new Date().toISOString() });
    } finally {
      setActing(false);
    }
  }, [run.serviceRunId, outbox, updateRun, clearRun]);

  // ── PHOTO CAPTURE ────────────────────────────────────────────
  const handlePhotoChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>, evidenceType: "before" | "after") => {
      const files = Array.from(e.target.files ?? []);
      if (!files.length || !run.serviceRunId) return;
      e.target.value = "";

      setPhotos({ uploading: true });
      let saved = 0;
      let queued = 0;

      for (const file of files) {
        let uploadedOnline = false;
        try {
          const presignRes = await fetch(`/api/v1/service-runs/${run.serviceRunId}/media/presign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mime_type: file.type, byte_size: file.size, evidence_type: evidenceType }),
          });
          if (!presignRes.ok) throw new Error("Presign failed");
          const { asset_id, bucket, path, token } = await presignRes.json();

          const supabase = createClient();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: uploadError } = await (supabase.storage as any)
            .from(bucket)
            .uploadToSignedUrl(path, token, file, { contentType: file.type });
          if (uploadError) throw uploadError;

          await fetch(`/api/v1/service-runs/${run.serviceRunId}/media/${asset_id}/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ byte_size: file.size }),
          });

          uploadedOnline = true;
          saved++;
        } catch {
          // Fall back to offline queue
        }

        if (!uploadedOnline) {
          try {
            await outbox.enqueueMedia({
              service_run_id: run.serviceRunId,
              blob: file,
              filename: file.name || `photo-${Date.now()}.jpg`,
              mime_type: file.type || "image/jpeg",
              evidence_type: evidenceType,
              byte_size: file.size,
              queued_at: new Date().toISOString(),
            });
            queued++;
          } catch {
            toast.error("Failed to save photo. Please try again.");
          }
        }
      }

      setPhotos({ uploading: false });

      const countKey = evidenceType === "before" ? "beforeCount" : "afterCount";
      const currentCount = evidenceType === "before" ? run.beforeCount : run.afterCount;
      if (saved + queued > 0) {
        await updateRun({ [countKey]: currentCount + saved + queued });
      }

      if (saved > 0 && queued === 0) {
        toast.success(saved === 1 ? "Photo saved" : `${saved} photos saved`);
      } else if (queued > 0 && saved === 0) {
        toast.success(`${queued} photo${queued !== 1 ? "s" : ""} queued — will upload when reconnected`);
      } else if (saved > 0 && queued > 0) {
        toast.success(`${saved} uploaded, ${queued} queued for sync`);
      }
    },
    [run.serviceRunId, run.beforeCount, run.afterCount, outbox, updateRun]
  );

  // ── Derived display state ─────────────────────────────────────
  const isReady = !run.status || (run.status !== "in_progress" && run.status !== "paused" && !run.finishedAt);
  const isInProgress = run.status === "in_progress" && !run.finishedAt;
  const isPaused = run.status === "paused" && !run.finishedAt;
  const isFinished = Boolean(run.finishedAt) && run.status !== "submitted";
  const isSubmitted = run.status === "submitted";

  const step = isSubmitted ? 3 : isFinished ? 2 : (isInProgress || isPaused) ? 1 : 0;

  const customerName =
    workOrder?.customers?.business_name ??
    (workOrder?.customers ? `${workOrder.customers.first_name} ${workOrder.customers.last_name}` : "");
  const address = workOrder?.properties
    ? `${workOrder.properties.address_line1}, ${workOrder.properties.city}, ${workOrder.properties.state}`
    : "";
  const mapsUrl = address ? `https://maps.google.com/?q=${encodeURIComponent(address)}` : null;

  const startTime = fmtTime(run.startedAt ?? null);
  const finishTime = fmtTime(run.finishedAt ?? null);

  // Status badge
  let badgeLabel = "Ready";
  let badgeCls = "bg-gray-100 text-gray-500";
  if (isSubmitted) { badgeLabel = "Submitted"; badgeCls = "bg-blue-100 text-blue-700"; }
  else if (isFinished) { badgeLabel = "Work Done"; badgeCls = "bg-green-100 text-green-700"; }
  else if (isInProgress) { badgeLabel = "In Progress"; badgeCls = "bg-lawn/15 text-lawn"; }
  else if (isPaused) { badgeLabel = "Paused"; badgeCls = "bg-amber-100 text-amber-700"; }

  const hasInstructions = !!(workOrder?.instructions || workOrder?.properties?.service_instructions);

  // ── Loading/error shell ───────────────────────────────────────
  if (fetching && !workOrder) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 flex flex-col items-center gap-3">
        <Loader2 size={28} className="animate-spin text-gray-300" />
        <p className="text-sm text-muted">Loading job details…</p>
      </div>
    );
  }

  if (fetchError && !workOrder) {
    return (
      <div className="max-w-lg mx-auto px-4 space-y-4 pt-4">
        <Link href="/my-jobs" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-charcoal">
          <ArrowLeft size={16} />
          My Jobs
        </Link>
        <div className="py-12 text-center space-y-3">
          <p className="text-sm text-red-600">{fetchError}</p>
          <button onClick={loadWorkOrder} className="text-sm font-medium text-redline underline underline-offset-2">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pt-4 pb-10 space-y-4">

        {/* Back */}
        <Link href="/my-jobs" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-charcoal transition-colors">
          <ArrowLeft size={16} />
          My Jobs
        </Link>

        <OfflineBanner />

        <SyncStatusBar
          pendingCount={outbox.pendingCount}
          pendingMediaCount={outbox.pendingMediaCount}
          syncing={outbox.syncing}
          lastSyncAt={outbox.lastSyncAt}
          lastError={outbox.lastError}
          onDrain={outbox.drain}
        />

        {/* ── Job header card ── */}
        {workOrder && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="p-5 space-y-3">
              {/* Title + status badge */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted mb-0.5">#{workOrder.work_order_number}</p>
                  <h1 className="text-xl font-bold text-charcoal leading-snug">{workOrder.title}</h1>
                  {customerName && <p className="text-sm text-muted mt-1">{customerName}</p>}
                </div>
                <span className={`flex-shrink-0 text-xs font-semibold rounded-full px-3 py-1.5 ${badgeCls}`}>
                  {badgeLabel}
                </span>
              </div>

              {/* Address */}
              {address && (
                <a
                  href={mapsUrl ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-redline hover:underline"
                >
                  <MapPin size={14} className="flex-shrink-0" />
                  <span>{address}</span>
                </a>
              )}

              {/* Scheduled time */}
              {workOrder.scheduled_start && (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Clock size={14} />
                  <span>
                    Scheduled{" "}
                    {new Date(workOrder.scheduled_start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {" at "}
                    {new Date(workOrder.scheduled_start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
              )}

              {/* Warnings */}
              {workOrder.properties?.access_instructions && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                  <AlertTriangle size={15} className="flex-shrink-0 mt-0.5 text-amber-500" />
                  <p><span className="font-semibold">Access: </span>{workOrder.properties.access_instructions}</p>
                </div>
              )}

              {workOrder.properties?.safety_instructions && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800">
                  <AlertTriangle size={15} className="flex-shrink-0 mt-0.5 text-red-400" />
                  <p><span className="font-semibold">Safety: </span>{workOrder.properties.safety_instructions}</p>
                </div>
              )}
            </div>

            {/* Start / Finish timestamps — appears after job is started */}
            {(startTime || finishTime) && (
              <div className="flex items-stretch divide-x divide-gray-100 border-t border-gray-100">
                {startTime && (
                  <div className="flex-1 flex items-center gap-2.5 px-5 py-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-lawn flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted uppercase tracking-wide leading-none mb-0.5">Started</p>
                      <p className="text-sm font-bold text-charcoal">{startTime}</p>
                    </div>
                  </div>
                )}
                {finishTime && (
                  <div className="flex-1 flex items-center gap-2.5 px-5 py-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-redline flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted uppercase tracking-wide leading-none mb-0.5">Finished</p>
                      <p className="text-sm font-bold text-charcoal">{finishTime}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Progress stepper ── */}
        <ProgressStepper step={step} />

        {/* ── Instructions (collapsible) ── */}
        {hasInstructions && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setInstructionsOpen((o) => !o)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-semibold text-charcoal">Job Instructions</span>
              {instructionsOpen
                ? <ChevronUp size={16} className="text-muted flex-shrink-0" />
                : <ChevronDown size={16} className="text-muted flex-shrink-0" />}
            </button>
            {instructionsOpen && (
              <div className="border-t border-gray-100 px-5 pb-4 pt-3 space-y-3">
                {workOrder?.instructions && (
                  <p className="text-sm text-charcoal whitespace-pre-line">{workOrder.instructions}</p>
                )}
                {workOrder?.properties?.service_instructions && (
                  <div>
                    <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Site Notes</p>
                    <p className="text-sm text-charcoal whitespace-pre-line">{workOrder.properties.service_instructions}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── GPS error ── */}
        {gps.error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800">
            <AlertTriangle size={15} className="flex-shrink-0 text-red-500" />
            {gps.error}
          </div>
        )}

        {/* ── Geofence badge ── */}
        {geofence && (() => {
          const g = geofenceBadge(geofence.result);
          return (
            <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm border ${g.cls}`}>
              <Navigation size={14} className="flex-shrink-0" />
              <span className="font-medium">{g.label}</span>
              <span className="text-xs text-muted ml-auto">{Math.round(geofence.distance_meters)}m from site</span>
            </div>
          );
        })()}

        {/* ── Override input ── */}
        {showOverride && (
          <div className="bg-white rounded-2xl border border-amber-300 p-5 space-y-3">
            <p className="text-sm font-semibold text-amber-800">
              You appear to be outside the expected service area. Enter a reason to override:
            </p>
            <textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="e.g. Access via back gate, GPS blocked by buildings…"
              className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
              rows={3}
            />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            STATE-SPECIFIC CONTENT
        ══════════════════════════════════════════════════════ */}

        {/* ── READY TO START ── */}
        {isReady && (
          <button
            onClick={handleStart}
            disabled={acting || gps.acquiring || !run.hydrated}
            className="w-full flex items-center justify-center gap-3 bg-lawn hover:bg-lawn/90 active:bg-lawn/80 text-white font-bold text-lg rounded-2xl py-6 transition-colors disabled:opacity-60 shadow-md shadow-lawn/20"
          >
            {!run.hydrated || acting || gps.acquiring
              ? <Loader2 size={24} className="animate-spin" />
              : <PlayCircle size={28} />}
            {!run.hydrated ? "Loading…" : gps.acquiring ? "Getting GPS…" : acting ? "Starting…" : "Start Job"}
          </button>
        )}

        {/* ── IN PROGRESS ── */}
        {isInProgress && (
          <div className="space-y-4">
            {/* Live timer */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
              <p className="text-xs text-muted uppercase tracking-wide mb-1">Time on Site</p>
              <p className="text-5xl font-bold tabular-nums text-lawn">{formatElapsed(elapsed)}</p>
              <div className="flex items-center justify-center gap-1.5 mt-2">
                <span className="w-2 h-2 bg-lawn rounded-full animate-pulse" />
                <span className="text-xs font-semibold text-lawn">In Progress</span>
              </div>
            </div>

            {/* Before photos */}
            <PhotoSection
              label="Before Photos"
              hint="Photograph the property condition before starting work."
              count={run.beforeCount}
              uploading={photos.uploading}
              inputRef={beforeRef}
              disabled={photos.uploading || !run.serviceRunId}
              onChange={(e) => handlePhotoChange(e, "before")}
            />

            {/* Service checklist */}
            {checklistSections.length > 0 && (
              <ServiceChecklist
                sections={checklistSections}
                responses={checklistResponses}
                onChange={handleChecklistChange}
                disabled={acting}
              />
            )}

            {/* Action row */}
            <div className="flex gap-3">
              <button
                onClick={handlePause}
                disabled={acting}
                className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-charcoal font-semibold rounded-2xl px-6 py-4 hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                {acting ? <Loader2 size={18} className="animate-spin" /> : <PauseCircle size={20} />}
                Pause
              </button>
              <button
                onClick={() => {
                  if (checklistSections.length > 0 && !checklistComplete(checklistSections, checklistResponses)) {
                    toast.error("Complete all required checklist items before finishing.");
                    return;
                  }
                  handleFinish();
                }}
                disabled={acting || gps.acquiring}
                className="flex-1 flex items-center justify-center gap-2 bg-redline hover:bg-redline/90 active:bg-redline/80 text-white font-bold text-base rounded-2xl py-4 transition-colors disabled:opacity-60 shadow-sm shadow-redline/20"
              >
                {acting || gps.acquiring ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={22} />}
                {gps.acquiring ? "Getting GPS…" : acting ? "Finishing…" : "Finish Job"}
              </button>
            </div>
          </div>
        )}

        {/* ── PAUSED ── */}
        {isPaused && (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
              <PauseCircle size={20} className="text-amber-500 flex-shrink-0" />
              <div>
                <p className="font-semibold text-amber-800">Job Paused</p>
                <p className="text-sm text-amber-700">Resume when you&apos;re ready to continue.</p>
              </div>
            </div>
            <button
              onClick={handleResume}
              disabled={acting}
              className="w-full flex items-center justify-center gap-3 bg-lawn hover:bg-lawn/90 text-white font-bold text-lg rounded-2xl py-6 transition-colors disabled:opacity-60 shadow-md shadow-lawn/20"
            >
              {acting ? <Loader2 size={24} className="animate-spin" /> : <PlayCircle size={28} />}
              {acting ? "Resuming…" : "Resume Job"}
            </button>
          </div>
        )}

        {/* ── FINISHED ── */}
        {isFinished && (
          <div className="space-y-4">
            {/* Before photos summary */}
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-600" />
                <span className="text-sm font-medium text-green-800">Before photos saved</span>
              </div>
              <span className="text-sm font-bold text-green-700">{run.beforeCount}</span>
            </div>

            {/* After photos */}
            <PhotoSection
              label="After Photos"
              hint="Photograph the completed work before submitting."
              count={run.afterCount}
              uploading={photos.uploading}
              inputRef={afterRef}
              disabled={photos.uploading || !run.serviceRunId}
              onChange={(e) => handlePhotoChange(e, "after")}
              accent="blue"
            />

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={acting}
              className="w-full flex items-center justify-center gap-3 bg-charcoal hover:bg-charcoal/90 active:bg-charcoal/80 text-white font-bold text-lg rounded-2xl py-6 transition-colors disabled:opacity-60 shadow-sm"
            >
              {acting ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}
              {acting ? "Submitting…" : "Submit for Review"}
            </button>
          </div>
        )}

        {/* ── SUBMITTED ── */}
        {isSubmitted && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-8 flex flex-col items-center text-center gap-3">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                <Send size={28} className="text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-charcoal">Job Submitted!</p>
                <p className="text-sm text-muted mt-1">Your report is in the office queue for review.</p>
              </div>
            </div>
            <Link
              href="/my-jobs"
              className="block w-full text-center bg-white border border-gray-200 font-semibold text-charcoal rounded-2xl py-4 hover:bg-gray-50 transition-colors"
            >
              Back to My Jobs
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}

// ── ProgressStepper ───────────────────────────────────────────────
const STEPS = ["Ready", "Working", "Done", "Submitted"] as const;

function ProgressStepper({ step }: { step: number }) {
  return (
    <div className="flex items-center px-1">
      {STEPS.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <React.Fragment key={label}>
            {i > 0 && (
              <div className={`flex-1 h-0.5 mx-1 transition-colors ${done ? "bg-lawn" : "bg-gray-200"}`} />
            )}
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                done
                  ? "bg-lawn"
                  : active
                    ? "bg-white border-2 border-lawn"
                    : "bg-white border-2 border-gray-200"
              }`}>
                {done
                  ? <CheckCircle2 size={16} className="text-white" />
                  : <span className={`text-xs font-bold ${active ? "text-lawn" : "text-gray-400"}`}>{i + 1}</span>}
              </div>
              <span className={`text-[10px] font-semibold leading-none ${
                active ? "text-lawn" : done ? "text-lawn/60" : "text-gray-400"
              }`}>
                {label}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── PhotoSection ─────────────────────────────────────────────────
interface PhotoSectionProps {
  label: string;
  hint: string;
  count: number;
  uploading: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  disabled: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  accent?: "amber" | "blue";
}

function PhotoSection({ label, hint, count, uploading, inputRef, disabled, onChange, accent = "amber" }: PhotoSectionProps) {
  const met = count >= MIN_PHOTOS;

  const addBtnCls = met
    ? "border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600"
    : accent === "blue"
      ? "border-dashed border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700"
      : "border-dashed border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-charcoal">{label}</p>
          <p className="text-xs text-muted mt-0.5">{hint}</p>
        </div>
        <span className={`flex-shrink-0 text-xs font-semibold rounded-full px-2.5 py-1 ${
          met ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
        }`}>
          {count}/{MIN_PHOTOS} min
        </span>
      </div>

      {/* Photo slot grid */}
      <div className="flex gap-2">
        {Array.from({ length: MIN_PHOTOS }).map((_, i) => {
          const filled = i < count;
          return (
            <div
              key={i}
              className={`flex-1 aspect-square rounded-xl flex items-center justify-center border-2 transition-colors ${
                filled
                  ? "border-green-300 bg-green-50"
                  : "border-dashed border-gray-200 bg-gray-50"
              }`}
            >
              {filled
                ? <CheckCircle2 size={22} className="text-green-500" />
                : <Camera size={22} className="text-gray-300" />}
            </div>
          );
        })}
        {count > MIN_PHOTOS && (
          <div className="flex-1 aspect-square rounded-xl flex items-center justify-center bg-green-100 border-2 border-green-300">
            <span className="text-sm font-bold text-green-700">+{count - MIN_PHOTOS}</span>
          </div>
        )}
      </div>

      {/* Add photo button */}
      <label className={`block cursor-pointer ${disabled ? "pointer-events-none opacity-50" : ""}`}>
        <div className={`flex items-center justify-center gap-2 py-3 rounded-xl border transition-colors ${addBtnCls}`}>
          {uploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
          <span className="text-sm font-semibold">
            {uploading ? "Uploading…" : met ? "Add More Photos" : `Take ${label.split(" ")[0]} Photo`}
          </span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={onChange}
          disabled={disabled}
        />
      </label>
    </div>
  );
}
