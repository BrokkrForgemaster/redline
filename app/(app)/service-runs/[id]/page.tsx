"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, MapPin, User,
  Camera, Loader2, ImageOff, AlertTriangle, ChevronDown, ChevronUp,
  Navigation, Download, FileText,
} from "lucide-react";

interface MediaAsset {
  id: string;
  evidence_type: string | null;
  media_category: string;
  status: string;
  mime_type: string;
  byte_size: number;
  created_at: string;
  signed_url: string | null;
}

interface ServiceNote {
  id: string;
  note_type: string;
  body: string;
  created_at: string;
  profiles: { first_name: string; last_name: string } | null;
}

interface LocationEvent {
  id: string;
  event_type: string;
  result: string;
  distance_meters: number | null;
  configured_radius_meters: number | null;
  accuracy_meters: number | null;
  override_reason: string | null;
  captured_at_device: string;
}

interface ReportVersion {
  id: string;
  version_number: number;
  generated_at: string;
  signed_url: string | null;
}

interface RunDetail {
  id: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  work_orders: {
    id: string;
    work_order_number: string;
    title: string;
    scheduled_start: string | null;
    instructions: string | null;
    customers: { id: string; first_name: string; last_name: string; business_name: string | null } | null;
    properties: { id: string; address_line1: string; city: string; state: string; zip: string } | null;
  } | null;
  profiles: { id: string; first_name: string; last_name: string } | null;
}

function elapsedStr(startedAt: string | null, finishedAt: string | null) {
  if (!startedAt || !finishedAt) return null;
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export default function ServiceRunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [run, setRun] = useState<RunDetail | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [notes, setNotes] = useState<ServiceNote[]>([]);
  const [locationEvents, setLocationEvents] = useState<LocationEvent[]>([]);
  const [report, setReport] = useState<ReportVersion | null>(null);
  const [counts, setCounts] = useState({ before: 0, after: 0 });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/v1/service-runs/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setRun(json.service_run);
      setAssets(json.assets ?? []);
      setNotes(json.notes ?? []);
      setLocationEvents(json.location_events ?? []);
      setReport(json.report ?? null);
      setCounts(json.counts ?? { before: 0, after: 0 });
    } catch {
      setFetchError("Failed to load service run details.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = useCallback(async () => {
    setActing(true);
    try {
      const res = await fetch(`/api/v1/service-runs/${id}/approve`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? `HTTP ${res.status}`);
      toast.success(json.report_url ? "Approved — report generated." : "Service run approved.");
      router.push("/service-runs");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve.");
      setActing(false);
    }
  }, [id, router]);

  const handleReject = useCallback(async () => {
    if (!rejectReason.trim()) {
      toast.error("Enter a rejection reason.");
      return;
    }
    setActing(true);
    try {
      const res = await fetch(`/api/v1/service-runs/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? `HTTP ${res.status}`);
      toast.success("Service run rejected.");
      router.push("/service-runs");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject.");
      setActing(false);
    }
  }, [id, rejectReason, router]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-20 flex flex-col items-center gap-3 text-muted">
        <Loader2 size={28} className="animate-spin text-gray-300" />
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  if (fetchError || !run) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Link href="/service-runs" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-charcoal">
          <ArrowLeft size={16} /> Service Runs
        </Link>
        <div className="py-12 text-center space-y-3">
          <p className="text-sm text-red-600">{fetchError ?? "Not found."}</p>
          <button onClick={load} className="text-sm font-medium text-redline underline underline-offset-2">Try again</button>
        </div>
      </div>
    );
  }

  const wo = run.work_orders;
  const customer = wo?.customers?.business_name
    ?? (wo?.customers ? `${wo.customers.first_name} ${wo.customers.last_name}` : "");
  const address = wo?.properties
    ? `${wo.properties.address_line1}, ${wo.properties.city}, ${wo.properties.state} ${wo.properties.zip}`
    : "";
  const worker = run.profiles
    ? `${run.profiles.first_name} ${run.profiles.last_name}`
    : "Unknown";
  const duration = elapsedStr(run.started_at, run.finished_at);

  const isReviewable = run.status === "submitted" || run.status === "needs_review";
  const isApproved = run.status === "completed";
  const isRejected = run.status === "rejected";

  const beforeAssets = assets.filter((a) => a.evidence_type === "before");
  const afterAssets = assets.filter((a) => a.evidence_type === "after");

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-10">
      {/* Back */}
      <Link href="/service-runs" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-charcoal transition-colors">
        <ArrowLeft size={16} /> Service Runs
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {wo?.work_order_number && (
              <p className="text-xs text-muted mb-0.5">#{wo.work_order_number}</p>
            )}
            <h1 className="text-xl font-bold text-charcoal leading-tight">{wo?.title ?? "Untitled"}</h1>
            {customer && <p className="text-sm text-muted mt-0.5">{customer}</p>}
          </div>
          {isApproved && (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full flex-shrink-0">
              <CheckCircle2 size={15} /> Approved
            </span>
          )}
          {isRejected && (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-full flex-shrink-0">
              <XCircle size={15} /> Rejected
            </span>
          )}
          {isReviewable && (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full flex-shrink-0">
              Needs Review
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted">
            <User size={14} className="flex-shrink-0" />
            <span>{worker}</span>
          </div>
          {address && (
            <div className="flex items-center gap-2 text-muted">
              <MapPin size={14} className="flex-shrink-0" />
              <span className="truncate">{address}</span>
            </div>
          )}
          {run.started_at && (
            <div className="flex items-center gap-2 text-muted">
              <Clock size={14} className="flex-shrink-0" />
              <span>Started {formatDateTime(run.started_at)}</span>
            </div>
          )}
          {duration && (
            <div className="flex items-center gap-2 text-muted">
              <Clock size={14} className="flex-shrink-0" />
              <span>{duration} on site</span>
            </div>
          )}
        </div>

        {run.submitted_at && (
          <p className="text-xs text-muted">Submitted {formatDateTime(run.submitted_at)}</p>
        )}

        {isRejected && run.rejection_reason && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800">
            <AlertTriangle size={15} className="flex-shrink-0 mt-0.5 text-red-400" />
            <div><span className="font-semibold">Rejection reason: </span>{run.rejection_reason}</div>
          </div>
        )}
      </div>

      {/* Evidence photos */}
      <div className="space-y-4">
        <PhotoSection label="Before Photos" assets={beforeAssets} count={counts.before} onOpen={setLightbox} />
        <PhotoSection label="After Photos" assets={afterAssets} count={counts.after} onOpen={setLightbox} />
      </div>

      {/* Location verification */}
      {locationEvents.length > 0 && (
        <GeofenceTimeline events={locationEvents} />
      )}

      {/* Report download */}
      {isApproved && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Service Report</p>
          {report?.signed_url ? (
            <a
              href={report.signed_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-charcoal hover:bg-charcoal/90 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
            >
              <Download size={16} />
              Download PDF (v{report.version_number})
            </a>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted">
              <FileText size={16} className="text-gray-300" />
              <span>Report not yet available</span>
            </div>
          )}
        </div>
      )}

      {/* Work order instructions */}
      {wo?.instructions && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Instructions</p>
          <p className="text-sm text-charcoal whitespace-pre-line">{wo.instructions}</p>
        </div>
      )}

      {/* Notes */}
      {notes.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => setShowNotes((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-charcoal hover:bg-gray-50 transition-colors"
          >
            <span>Field Notes ({notes.length})</span>
            {showNotes ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showNotes && (
            <div className="px-5 pb-4 space-y-3 border-t border-gray-100">
              {notes.map((note) => (
                <div key={note.id} className="pt-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-medium text-muted">
                      {note.profiles
                        ? `${note.profiles.first_name} ${note.profiles.last_name}`
                        : "Unknown"}
                    </span>
                    <span className="text-xs text-muted">{formatDateTime(note.created_at)}</span>
                  </div>
                  <p className="text-sm text-charcoal whitespace-pre-line">{note.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Review actions */}
      {isReviewable && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <p className="font-semibold text-charcoal">Review Decision</p>

          {!showRejectForm ? (
            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={acting}
                className="flex-1 flex items-center justify-center gap-2 bg-lawn hover:bg-lawn/90 text-white font-bold rounded-xl py-3.5 transition-colors disabled:opacity-60"
              >
                {acting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={20} />}
                Approve
              </button>
              <button
                onClick={() => setShowRejectForm(true)}
                disabled={acting}
                className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 text-charcoal font-semibold rounded-xl py-3.5 hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                <XCircle size={20} className="text-red-400" />
                Reject
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Describe what needs to be corrected or re-done…"
                className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
                rows={3}
              />
              <div className="flex gap-3">
                <button
                  onClick={handleReject}
                  disabled={acting || !rejectReason.trim()}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl py-3 transition-colors disabled:opacity-60"
                >
                  {acting ? <Loader2 size={18} className="animate-spin" /> : <XCircle size={18} />}
                  Confirm Reject
                </button>
                <button
                  onClick={() => { setShowRejectForm(false); setRejectReason(""); }}
                  disabled={acting}
                  className="px-5 text-sm font-medium text-muted hover:text-charcoal transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Evidence photo"
            className="max-w-full max-h-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white text-lg font-bold"
            onClick={() => setLightbox(null)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// ── GeofenceTimeline ─────────────────────────────────────────────────────────
const GEOFENCE_BADGE: Record<string, { label: string; cls: string }> = {
  on_site: { label: "On site", cls: "bg-green-50 border-green-200 text-green-700" },
  near: { label: "Near site", cls: "bg-amber-50 border-amber-200 text-amber-700" },
  outside: { label: "Outside", cls: "bg-red-50 border-red-200 text-red-700" },
  override_approved: { label: "Override", cls: "bg-blue-50 border-blue-200 text-blue-700" },
  cannot_verify: { label: "Can't verify", cls: "bg-gray-50 border-gray-200 text-gray-500" },
};

function GeofenceTimeline({ events }: { events: LocationEvent[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
      <p className="text-xs font-semibold text-muted uppercase tracking-wide">Location Verification</p>
      <div className="space-y-2">
        {events.map((evt) => {
          const badge = GEOFENCE_BADGE[evt.result] ?? { label: evt.result, cls: "bg-gray-50 border-gray-200 text-gray-500" };
          const eventLabel = evt.event_type === "start" ? "Start"
            : evt.event_type === "finish" ? "Finish"
            : evt.event_type === "override" ? "Override"
            : evt.event_type;
          return (
            <div key={evt.id} className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <Navigation size={14} className="text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-charcoal">{eventLabel}</span>
                  <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border ${badge.cls}`}>
                    {badge.label}
                  </span>
                  {evt.distance_meters != null && (
                    <span className="text-xs text-muted">
                      {Math.round(evt.distance_meters)}m from site
                      {evt.configured_radius_meters != null
                        ? ` (radius ${Math.round(evt.configured_radius_meters)}m)`
                        : ""}
                    </span>
                  )}
                </div>
                {evt.override_reason && (
                  <p className="text-xs text-amber-700 mt-0.5 italic">&ldquo;{evt.override_reason}&rdquo;</p>
                )}
                <p className="text-xs text-muted mt-0.5">
                  {new Date(evt.captured_at_device).toLocaleString("en-US", {
                    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                  })}
                  {evt.accuracy_meters != null && ` · ±${Math.round(evt.accuracy_meters)}m accuracy`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── PhotoSection ─────────────────────────────────────────────────────────────
function PhotoSection({
  label,
  assets,
  count,
  onOpen,
}: {
  label: string;
  assets: MediaAsset[];
  count: number;
  onOpen: (url: string) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-charcoal">{label}</p>
        <span className="text-sm text-muted">{count} photo{count !== 1 ? "s" : ""}</span>
      </div>

      {count === 0 && (
        <div className="flex items-center justify-center gap-2 py-8 rounded-xl bg-gray-50 text-muted text-sm">
          <Camera size={18} className="text-gray-300" />
          <span>No photos submitted</span>
        </div>
      )}

      {count > 0 && assets.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-8 rounded-xl bg-gray-50 text-muted text-sm">
          <ImageOff size={18} className="text-gray-300" />
          <span>Photos pending upload</span>
        </div>
      )}

      {assets.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {assets.map((asset) =>
            asset.signed_url ? (
              <button
                key={asset.id}
                onClick={() => onOpen(asset.signed_url!)}
                className="aspect-square rounded-xl overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-redline"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.signed_url}
                  alt={`${label} evidence`}
                  className="w-full h-full object-cover"
                />
              </button>
            ) : (
              <div key={asset.id} className="aspect-square rounded-xl bg-gray-100 flex items-center justify-center">
                <ImageOff size={20} className="text-gray-300" />
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
