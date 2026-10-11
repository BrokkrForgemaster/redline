"use client";

import Link from "next/link";
import { Briefcase, MapPin, Clock, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { useAssignments } from "@/lib/field/useAssignments";
import { useOutbox } from "@/lib/field/useOutbox";
import { OfflineBanner } from "@/components/field/OfflineBanner";
import { SyncStatusBar } from "@/components/field/SyncStatusBar";

const SERVICE_LABELS: Record<string, string> = {
  lawn_mowing: "Lawn Mowing",
  landscaping: "Landscaping",
  aeration_overseeding: "Aeration & Overseeding",
  snow_removal: "Snow Removal",
  spring_cleanup: "Spring Cleanup",
  fall_cleanup: "Fall Cleanup",
  mulching: "Mulching",
  irrigation: "Irrigation",
  other: "General Service",
};

export default function MyJobsPage() {
  const { data, loading, error, fromCache, refetch } = useAssignments();
  const outbox = useOutbox();

  const dayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const totalItems =
    (data?.assignments?.length ?? 0) + (data?.legacy_jobs?.length ?? 0);

  return (
    <div className="space-y-4 max-w-xl mx-auto px-1">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">My Jobs</h1>
          <p className="text-sm text-muted mt-0.5">{dayLabel}</p>
        </div>
        <button
          onClick={refetch}
          disabled={loading}
          className="mt-1 p-2 text-muted hover:text-charcoal transition-colors disabled:opacity-40"
          aria-label="Refresh"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <OfflineBanner />

      <SyncStatusBar
        pendingCount={outbox.pendingCount}
        pendingMediaCount={outbox.pendingMediaCount}
        syncing={outbox.syncing}
        lastSyncAt={outbox.lastSyncAt}
        lastError={outbox.lastError}
        onDrain={outbox.drain}
      />

      {data?.warnings?.map((w, i) => (
        <div key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          {w}
        </div>
      ))}

      {loading && !data && (
        <div className="py-20 flex flex-col items-center gap-3 text-muted">
          <Loader2 size={28} className="animate-spin text-gray-300" />
          <p className="text-sm">Loading your jobs…</p>
        </div>
      )}

      {error && !data && (
        <div className="py-12 text-center space-y-3">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={refetch}
            className="text-sm font-medium text-redline underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && totalItems === 0 && (
        <div className="py-20 text-center bg-white rounded-2xl border border-gray-200">
          <Briefcase size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="font-semibold text-charcoal">No jobs today</p>
          <p className="text-sm text-muted mt-1 max-w-xs mx-auto">
            You&apos;re not assigned to any jobs today. Check with your manager if you think this is wrong.
          </p>
          {fromCache && (
            <button
              onClick={refetch}
              className="mt-4 text-sm font-medium text-redline underline underline-offset-2"
            >
              Refresh
            </button>
          )}
        </div>
      )}

      {/* New work-order assignments */}
      {(data?.assignments?.length ?? 0) > 0 && (
        <div className="space-y-3">
          {data!.assignments.map((a) => {
            const wo = a.work_orders;
            if (!wo) return null;
            const customerName =
              wo.customers?.business_name ??
              (wo.customers
                ? `${wo.customers.first_name} ${wo.customers.last_name}`
                : "");
            const address = wo.properties
              ? `${wo.properties.address_line1}, ${wo.properties.city}`
              : "";

            return (
              <Link
                key={a.id}
                href={`/my-jobs/run/${wo.id}`}
                className="flex items-center gap-3 bg-white rounded-2xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all active:scale-[0.98]"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
                        wo.status === "in_progress"
                          ? "bg-lawn/10 text-lawn"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {wo.status === "in_progress" && (
                        <span className="w-1.5 h-1.5 bg-lawn rounded-full animate-pulse" />
                      )}
                      {wo.status === "in_progress" ? "Active" : wo.work_order_number}
                    </span>
                  </div>
                  <p className="font-semibold text-charcoal leading-tight">{wo.title}</p>
                  {customerName && <p className="text-sm text-muted">{customerName}</p>}
                  {address && (
                    <div className="flex items-center gap-1 text-sm text-muted">
                      <MapPin size={12} className="flex-shrink-0" />
                      <span className="truncate">{address}</span>
                    </div>
                  )}
                  {wo.scheduled_start && (
                    <div className="flex items-center gap-1 text-sm text-muted">
                      <Clock size={12} className="flex-shrink-0" />
                      <span>
                        {new Date(wo.scheduled_start).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  )}
                </div>
                <ChevronRight size={20} className="text-gray-300 flex-shrink-0" />
              </Link>
            );
          })}
        </div>
      )}

      {/* Legacy jobs (bridged from old jobs table) */}
      {(data?.legacy_jobs?.length ?? 0) > 0 && (
        <div className="space-y-3">
          {(data?.assignments?.length ?? 0) > 0 && (
            <p className="text-xs font-semibold text-muted uppercase tracking-wide px-1">
              Legacy Jobs
            </p>
          )}
          {data!.legacy_jobs.map((job) => {
            const customerName =
              job.customers?.business_name ??
              (job.customers
                ? `${job.customers.first_name} ${job.customers.last_name}`
                : "");
            const address = job.properties
              ? `${job.properties.address_line1}, ${job.properties.city}`
              : "";
            const label = job.title || SERVICE_LABELS[job.service_type] || "Job";

            return (
              <Link
                key={job.id}
                href={`/my-jobs/${job.id}`}
                className="flex items-center gap-3 bg-white rounded-2xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all active:scale-[0.98]"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">#{job.job_number}</span>
                  </div>
                  <p className="font-semibold text-charcoal leading-tight">{label}</p>
                  {customerName && <p className="text-sm text-muted">{customerName}</p>}
                  {address && (
                    <div className="flex items-center gap-1 text-sm text-muted">
                      <MapPin size={12} className="flex-shrink-0" />
                      <span className="truncate">{address}</span>
                    </div>
                  )}
                  {job.scheduled_start && (
                    <div className="flex items-center gap-1 text-sm text-muted">
                      <Clock size={12} className="flex-shrink-0" />
                      <span>
                        {new Date(job.scheduled_start).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  )}
                </div>
                <ChevronRight size={20} className="text-gray-300 flex-shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
