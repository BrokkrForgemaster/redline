"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, MapPin, Clock, Camera, CheckCircle2,
  Loader2, PlayCircle, StopCircle, AlertTriangle,
} from "lucide-react";
import { clockIn, clockOut, uploadJobPhoto } from "@/lib/actions/field";

interface Job {
  id: string;
  job_number: string;
  title: string;
  service_type: string;
  status: string;
  scheduled_start: string | null;
  work_instructions: string | null;
  access_notes: string | null;
  customers: { first_name: string; last_name: string; business_name: string | null } | null;
  properties: { address_line1: string; city: string; state: string } | null;
}

interface TimeEntry {
  id: string;
  clock_in: string;
  clock_out?: string | null;
  total_minutes?: number | null;
}

interface Props {
  job: Job;
  activeEntry: TimeEntry | null;
  completedEntry: TimeEntry | null;
  beforeCount: number;
  afterCount: number;
}

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

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function formatMinutes(mins: number | null | undefined) {
  if (!mins) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function FieldJobView({
  job, activeEntry, completedEntry, beforeCount, afterCount,
}: Props) {
  const router = useRouter();
  const [isClocking, startClockTransition] = useTransition();
  const [isUploading, startUploadTransition] = useTransition();
  const [elapsed, setElapsed] = useState(0);
  const [localBefore, setLocalBefore] = useState(beforeCount);
  const [localAfter, setLocalAfter] = useState(afterCount);
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  // Live timer while clocked in
  useEffect(() => {
    if (!activeEntry) return;
    const start = new Date(activeEntry.clock_in).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeEntry]);

  const customerName =
    job.customers?.business_name ??
    (job.customers ? `${job.customers.first_name} ${job.customers.last_name}` : "");
  const address = job.properties
    ? `${job.properties.address_line1}, ${job.properties.city}, ${job.properties.state}`
    : "";
  const mapsUrl = address
    ? `https://maps.google.com/?q=${encodeURIComponent(address)}`
    : null;
  const jobLabel = job.title || SERVICE_LABELS[job.service_type] || "Job";

  // Determine state
  const isDone = !!completedEntry;
  const isActive = !isDone && !!activeEntry;
  const isReady = !isDone && !isActive;

  function handleClockIn() {
    startClockTransition(async () => {
      const result = await clockIn(job.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Clocked in — time is running!");
        router.refresh();
      }
    });
  }

  function handleClockOut() {
    if (!activeEntry) return;
    startClockTransition(async () => {
      const result = await clockOut(activeEntry.id, job.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Clocked out. Nice work!");
        router.refresh();
      }
    });
  }

  function handlePhotoChange(
    e: React.ChangeEvent<HTMLInputElement>,
    type: "before" | "after"
  ) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    startUploadTransition(async () => {
      let saved = 0;
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const result = await uploadJobPhoto(fd, job.id, type);
        if (result.error) {
          toast.error(result.error);
        } else {
          saved++;
        }
      }
      if (saved > 0) {
        if (type === "before") setLocalBefore(n => n + saved);
        else setLocalAfter(n => n + saved);
        toast.success(saved === 1 ? "Photo saved" : `${saved} photos saved`);
      }
    });

    // Clear so the same file can be re-selected if needed
    e.target.value = "";
  }

  return (
    <div className="max-w-lg mx-auto space-y-4 px-1 pb-8">
      {/* Back */}
      <Link
        href="/my-jobs"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-charcoal transition-colors"
      >
        <ArrowLeft size={16} />
        My Jobs
      </Link>

      {/* Job info card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-muted mb-0.5">#{job.job_number}</p>
            <h1 className="text-lg font-bold text-charcoal leading-tight">{jobLabel}</h1>
            {customerName && <p className="text-sm text-muted mt-0.5">{customerName}</p>}
          </div>
        </div>

        {address && (
          <a
            href={mapsUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 text-sm text-redline hover:underline"
          >
            <MapPin size={15} className="flex-shrink-0 mt-0.5" />
            <span>{address}</span>
          </a>
        )}

        {job.scheduled_start && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Clock size={14} />
            <span>
              Scheduled{" "}
              {new Date(job.scheduled_start).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>
        )}

        {job.access_notes && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
            <AlertTriangle size={15} className="flex-shrink-0 mt-0.5 text-amber-500" />
            <div>
              <span className="font-semibold">Access: </span>
              {job.access_notes}
            </div>
          </div>
        )}
      </div>

      {/* ── STATE: NOT STARTED ── */}
      {isReady && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center text-sm text-muted">
            Tap <strong className="text-charcoal">Start Job</strong> when you arrive on site.
            This clocks you in and starts time tracking automatically.
          </div>
          <button
            onClick={handleClockIn}
            disabled={isClocking}
            className="w-full flex items-center justify-center gap-3 bg-lawn hover:bg-lawn/90 active:bg-lawn/80 text-white font-bold text-lg rounded-2xl py-6 transition-colors disabled:opacity-60 shadow-sm shadow-lawn/30"
          >
            {isClocking ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <PlayCircle size={28} />
            )}
            {isClocking ? "Starting…" : "Start Job"}
          </button>
        </div>
      )}

      {/* ── STATE: IN PROGRESS ── */}
      {isActive && (
        <div className="space-y-3">
          {/* Live timer */}
          <div className="bg-lawn/10 border border-lawn/20 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-lawn rounded-full animate-pulse" />
              <span className="text-sm font-semibold text-lawn">In Progress</span>
            </div>
            <span className="text-2xl font-bold text-lawn tabular-nums">
              {formatElapsed(elapsed)}
            </span>
          </div>

          {/* Before photos */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
            <div>
              <p className="font-semibold text-charcoal">Before Photos</p>
              <p className="text-sm text-muted mt-0.5">
                Take photos of the property before you start work.
              </p>
            </div>

            {localBefore > 0 && (
              <div className="flex items-center justify-between bg-green-50 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-600" />
                  <span className="text-sm font-medium text-green-700">
                    {localBefore} photo{localBefore !== 1 ? "s" : ""} saved
                  </span>
                </div>
                <label className="text-sm text-green-600 font-medium cursor-pointer hover:underline">
                  Add more
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => handlePhotoChange(e, "before")}
                    disabled={isUploading}
                  />
                </label>
              </div>
            )}

            {localBefore === 0 && (
              <label className="block cursor-pointer">
                <div className={`flex items-center justify-center gap-3 py-5 rounded-xl border-2 border-dashed transition-colors ${isUploading ? "border-gray-200 bg-gray-50 opacity-60" : "border-amber-300 bg-amber-50 hover:bg-amber-100 active:bg-amber-200"}`}>
                  {isUploading ? (
                    <Loader2 size={20} className="text-gray-400 animate-spin" />
                  ) : (
                    <Camera size={22} className="text-amber-600" />
                  )}
                  <span className="font-semibold text-amber-700">
                    {isUploading ? "Uploading…" : "Take Before Photos"}
                  </span>
                </div>
                <input
                  ref={beforeRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => handlePhotoChange(e, "before")}
                  disabled={isUploading}
                />
              </label>
            )}
          </div>

          {job.work_instructions && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Instructions</p>
              <p className="text-sm text-charcoal whitespace-pre-line">{job.work_instructions}</p>
            </div>
          )}

          {/* Clock out */}
          <button
            onClick={handleClockOut}
            disabled={isClocking}
            className="w-full flex items-center justify-center gap-3 bg-redline hover:bg-redline-dark active:bg-redline/80 text-white font-bold text-lg rounded-2xl py-6 transition-colors disabled:opacity-60 shadow-sm shadow-redline/30"
          >
            {isClocking ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <StopCircle size={28} />
            )}
            {isClocking ? "Clocking out…" : "Clock Out"}
          </button>
        </div>
      )}

      {/* ── STATE: COMPLETED ── */}
      {isDone && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={22} className="text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-charcoal">Clocked Out</p>
                {completedEntry?.total_minutes != null && (
                  <p className="text-sm text-muted">
                    {formatMinutes(completedEntry.total_minutes)} worked
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* After photos */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
            <div>
              <p className="font-semibold text-charcoal">After Photos</p>
              <p className="text-sm text-muted mt-0.5">
                Take photos of the finished work so the office can see the results.
              </p>
            </div>

            {localAfter > 0 && (
              <div className="flex items-center justify-between bg-green-50 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-600" />
                  <span className="text-sm font-medium text-green-700">
                    {localAfter} photo{localAfter !== 1 ? "s" : ""} saved
                  </span>
                </div>
                <label className="text-sm text-green-600 font-medium cursor-pointer hover:underline">
                  Add more
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => handlePhotoChange(e, "after")}
                    disabled={isUploading}
                  />
                </label>
              </div>
            )}

            {localAfter === 0 && (
              <label className="block cursor-pointer">
                <div className={`flex items-center justify-center gap-3 py-5 rounded-xl border-2 border-dashed transition-colors ${isUploading ? "border-gray-200 bg-gray-50 opacity-60" : "border-blue-300 bg-blue-50 hover:bg-blue-100 active:bg-blue-200"}`}>
                  {isUploading ? (
                    <Loader2 size={20} className="text-gray-400 animate-spin" />
                  ) : (
                    <Camera size={22} className="text-blue-600" />
                  )}
                  <span className="font-semibold text-blue-700">
                    {isUploading ? "Uploading…" : "Take After Photos"}
                  </span>
                </div>
                <input
                  ref={afterRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => handlePhotoChange(e, "after")}
                  disabled={isUploading}
                />
              </label>
            )}
          </div>

          <Link
            href="/my-jobs"
            className="block text-center py-4 text-sm font-medium text-muted hover:text-charcoal transition-colors"
          >
            Back to My Jobs
          </Link>
        </div>
      )}
    </div>
  );
}
