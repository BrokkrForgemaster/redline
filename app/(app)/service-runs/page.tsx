"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardCheck, ChevronRight, Loader2, RefreshCw,
  CheckCircle2, XCircle, Clock, MapPin, User,
} from "lucide-react";

type RunStatus = "submitted" | "needs_review" | "completed" | "rejected";

interface ServiceRunSummary {
  id: string;
  status: RunStatus;
  started_at: string | null;
  finished_at: string | null;
  submitted_at: string | null;
  work_orders: {
    id: string;
    work_order_number: string;
    title: string;
    scheduled_start: string | null;
    customers: { first_name: string; last_name: string; business_name: string | null } | null;
    properties: { address_line1: string; city: string; state: string } | null;
  } | null;
  profiles: { id: string; first_name: string; last_name: string } | null;
}

const STATUS_TABS: { value: RunStatus; label: string }[] = [
  { value: "submitted", label: "Needs Review" },
  { value: "needs_review", label: "In Review" },
  { value: "completed", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_BADGE: Record<RunStatus, { label: string; cls: string }> = {
  submitted: { label: "Submitted", cls: "bg-amber-100 text-amber-700" },
  needs_review: { label: "In Review", cls: "bg-blue-100 text-blue-700" },
  completed: { label: "Approved", cls: "bg-green-100 text-green-700" },
  rejected: { label: "Rejected", cls: "bg-red-100 text-red-700" },
};

function elapsed(startedAt: string | null, finishedAt: string | null) {
  if (!startedAt || !finishedAt) return null;
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function ServiceRunsPage() {
  const [tab, setTab] = useState<RunStatus>("submitted");
  const [runs, setRuns] = useState<ServiceRunSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (status: RunStatus) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/service-runs?status=${status}&limit=50`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setRuns(json.service_runs ?? []);
      setTotal(json.total ?? 0);
    } catch {
      setError("Failed to load service runs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Service Runs</h1>
          <p className="text-sm text-muted mt-0.5">Review and approve submitted field work</p>
        </div>
        <button
          onClick={() => load(tab)}
          disabled={loading}
          className="p-2 text-muted hover:text-charcoal transition-colors disabled:opacity-40"
          aria-label="Refresh"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.value
                ? "bg-white text-charcoal shadow-sm"
                : "text-muted hover:text-charcoal"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="py-16 flex flex-col items-center gap-3 text-muted">
          <Loader2 size={28} className="animate-spin text-gray-300" />
          <p className="text-sm">Loading…</p>
        </div>
      )}

      {error && !loading && (
        <div className="py-12 text-center space-y-3">
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={() => load(tab)} className="text-sm font-medium text-redline underline underline-offset-2">
            Try again
          </button>
        </div>
      )}

      {!loading && !error && runs.length === 0 && (
        <div className="py-20 text-center bg-white rounded-2xl border border-gray-200">
          <ClipboardCheck size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="font-semibold text-charcoal">Nothing here</p>
          <p className="text-sm text-muted mt-1">No service runs with status &ldquo;{STATUS_TABS.find(t => t.value === tab)?.label}&rdquo;.</p>
        </div>
      )}

      {!loading && runs.length > 0 && (
        <div className="space-y-2">
          {total > runs.length && (
            <p className="text-xs text-muted px-1">Showing {runs.length} of {total}</p>
          )}
          {runs.map((run) => {
            const wo = run.work_orders;
            const badge = STATUS_BADGE[run.status];
            const worker = run.profiles
              ? `${run.profiles.first_name} ${run.profiles.last_name}`
              : "Unknown";
            const customer = wo?.customers?.business_name
              ?? (wo?.customers ? `${wo.customers.first_name} ${wo.customers.last_name}` : "");
            const address = wo?.properties
              ? `${wo.properties.address_line1}, ${wo.properties.city}`
              : "";
            const duration = elapsed(run.started_at, run.finished_at);

            return (
              <Link
                key={run.id}
                href={`/service-runs/${run.id}`}
                className="flex items-center gap-3 bg-white rounded-2xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
                      {badge.label}
                    </span>
                    {wo?.work_order_number && (
                      <span className="text-xs text-muted">#{wo.work_order_number}</span>
                    )}
                  </div>
                  <p className="font-semibold text-charcoal leading-tight">{wo?.title ?? "Untitled"}</p>
                  {customer && <p className="text-sm text-muted">{customer}</p>}
                  {address && (
                    <div className="flex items-center gap-1 text-sm text-muted">
                      <MapPin size={12} className="flex-shrink-0" />
                      <span className="truncate">{address}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted pt-0.5">
                    <div className="flex items-center gap-1">
                      <User size={11} />
                      <span>{worker}</span>
                    </div>
                    {run.submitted_at && (
                      <div className="flex items-center gap-1">
                        <Clock size={11} />
                        <span>
                          Submitted {new Date(run.submitted_at).toLocaleDateString("en-US", {
                            month: "short", day: "numeric",
                          })}
                        </span>
                      </div>
                    )}
                    {duration && (
                      <span>{duration} on site</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  {run.status === "submitted" && (
                    <CheckCircle2 size={18} className="text-amber-400" />
                  )}
                  {run.status === "completed" && (
                    <CheckCircle2 size={18} className="text-green-500" />
                  )}
                  {run.status === "rejected" && (
                    <XCircle size={18} className="text-red-400" />
                  )}
                  <ChevronRight size={18} className="text-gray-300" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
