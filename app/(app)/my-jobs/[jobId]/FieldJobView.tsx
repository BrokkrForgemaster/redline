"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, MapPin, Clock, Camera, CheckCircle2,
  Loader2, PlayCircle, StopCircle, AlertTriangle, Upload,
} from "lucide-react";
import { clockIn, clockOut, tagJobLocation, uploadJobPhoto } from "@/lib/actions/field";
import { type GpsLocation, useGps } from "@/lib/field/useGps";

const BEFORE_REQUIRED = 3;
const AFTER_REQUIRED = 3;
const MAX_UPLOAD_BYTES = 24 * 1024 * 1024;
const PHOTO_TARGET_BYTES = 8 * 1024 * 1024;
const PHOTO_MAX_DIMENSION = 1800;
const PHOTO_JPEG_QUALITY = 0.82;
const PHOTO_PROCESS_TIMEOUT_MS = 15_000;
const PHOTO_UPLOAD_TIMEOUT_MS = 45_000;

interface Job {
  id: string;
  job_number: string;
  title: string;
  service_type: string;
  status: string;
  scheduled_start: string | null;
  actual_start: string | null;
  actual_end: string | null;
  work_instructions: string | null;
  access_notes: string | null;
  customers: { business_name: string | null } | null;
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
  locationTagged: boolean;
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

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const timeout = window.setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load timed out"));
    }, PHOTO_PROCESS_TIMEOUT_MS);
    img.onload = () => {
      window.clearTimeout(timeout);
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timeout);
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read image"));
    };
    img.src = url;
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

function photoFingerprint(file: File) {
  return [file.name, file.size, file.lastModified].join(":");
}

async function preparePhotoForUpload(file: File) {
  if (!file.type.startsWith("image/")) return file;

  try {
    const img = await loadImageFromFile(file);
    const scale = Math.min(1, PHOTO_MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale === 1 && file.size <= PHOTO_TARGET_BYTES) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await withTimeout(
      new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", PHOTO_JPEG_QUALITY);
      }),
      PHOTO_PROCESS_TIMEOUT_MS,
      "Photo processing timed out"
    );
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

function PhotoCounter({ count, required }: { count: number; required: number }) {
  const met = count >= required;
  return (
    <div className={`flex items-center gap-3 rounded-xl px-4 py-2.5 ${met ? "bg-green-50" : "bg-amber-50"}`}>
      <div className="flex gap-1">
        {Array.from({ length: required }).map((_, i) => (
          <span
            key={i}
            className={`w-2.5 h-2.5 rounded-full ${i < count ? (met ? "bg-green-500" : "bg-amber-500") : "bg-gray-200"}`}
          />
        ))}
      </div>
      <span className={`text-sm font-medium ${met ? "text-green-700" : "text-amber-700"}`}>
        {count} of {required} photos{count > required ? ` (${count} total)` : ""}
      </span>
      {met && <CheckCircle2 size={15} className="text-green-600 ml-auto" />}
    </div>
  );
}

export default function FieldJobView({
  job, activeEntry, completedEntry, beforeCount, afterCount, locationTagged,
}: Props) {
  const router = useRouter();
  const [isClocking, startClockTransition] = useTransition();
  const [isUploading, startUploadTransition] = useTransition();
  const [elapsed, setElapsed] = useState(0);
  const [localBefore, setLocalBefore] = useState(beforeCount);
  const [localAfter, setLocalAfter] = useState(afterCount);
  const [isLocationTagged, setIsLocationTagged] = useState(locationTagged);
  const beforeCameraRef = useRef<HTMLInputElement>(null);
  const beforeUploadRef = useRef<HTMLInputElement>(null);
  const afterCameraRef = useRef<HTMLInputElement>(null);
  const afterUploadRef = useRef<HTMLInputElement>(null);
  const gps = useGps();

  useEffect(() => {
    if (!activeEntry) return;
    const start = new Date(activeEntry.clock_in).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeEntry]);

  const customerName = job.customers?.business_name ?? "Job site";
  const address = job.properties
    ? `${job.properties.address_line1}, ${job.properties.city}, ${job.properties.state}`
    : "";
  const mapsUrl = address
    ? `https://maps.google.com/?q=${encodeURIComponent(address)}`
    : null;
  const jobLabel = job.title || SERVICE_LABELS[job.service_type] || "Job";

  const canStart = isLocationTagged && localBefore >= BEFORE_REQUIRED;
  const canClockOut = localAfter >= AFTER_REQUIRED;
  const isDone = !!completedEntry;
  const isActive = !isDone && !!activeEntry;
  const isReady = !isDone && !isActive;
  const statusLabel = job.status.replaceAll("_", " ");

  function appendGps(fd: FormData, loc: GpsLocation | null) {
    if (!loc) return;
    fd.append("latitude", String(loc.latitude));
    fd.append("longitude", String(loc.longitude));
    fd.append("accuracy_meters", String(loc.accuracy_meters));
    fd.append("captured_at_device", loc.captured_at_device);
  }

  async function captureLocation() {
    const loc = await gps.acquire();
    if (!loc) toast.error(gps.error ?? "Could not get GPS location.");
    return loc;
  }

  function handleTagLocation() {
    startClockTransition(async () => {
      const loc = await captureLocation();
      if (!loc) return;
      const fd = new FormData();
      appendGps(fd, loc);
      const result = await tagJobLocation(fd, job.id);
      if (result.error) toast.error(result.error);
      else {
        setIsLocationTagged(true);
        toast.success("Location tagged to this job.");
      }
    });
  }

  function handleClockIn() {
    startClockTransition(async () => {
      const loc = await captureLocation();
      const result = await clockIn(job.id, loc);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(loc ? "Clocked in and location tagged." : "Clocked in.");
        router.refresh();
      }
    });
  }

  function handleClockOut() {
    if (!activeEntry) return;
    startClockTransition(async () => {
      const loc = await captureLocation();
      const result = await clockOut(activeEntry.id, job.id, loc);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(loc ? "Clocked out and location tagged." : "Clocked out.");
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
      const selected = new Set<string>();
      try {
        for (const file of files) {
          const fingerprint = photoFingerprint(file);
          if (selected.has(fingerprint)) {
            toast.error("Skipped a duplicate photo from this selection.");
            continue;
          }
          selected.add(fingerprint);

          const uploadFile = await preparePhotoForUpload(file);
          if (uploadFile.size > MAX_UPLOAD_BYTES) {
            toast.error("Photo is too large to upload. Retake it at a lower resolution or choose a smaller image.");
            continue;
          }

          const loc = await gps.acquire();
          const fd = new FormData();
          fd.append("file", uploadFile);
          appendGps(fd, loc);
          const result = await withTimeout(
            uploadJobPhoto(fd, job.id, type),
            PHOTO_UPLOAD_TIMEOUT_MS,
            "Upload timed out. Check signal and try again."
          );
          if (result.photo_id) saved++;
          else toast.error(result.error ?? "Upload failed.");
        }
        if (saved > 0) {
          if (type === "before") setLocalBefore(n => n + saved);
          else setLocalAfter(n => n + saved);
          toast.success(`${saved} photo${saved !== 1 ? "s" : ""} saved.`);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Upload failed. Please try again.");
      }
    });

    e.target.value = "";
  }

  function openPhotoInput(input: HTMLInputElement | null) {
    if (!input || isUploading) return;
    input.click();
  }

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-28">
      <input
        ref={beforeCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => handlePhotoChange(e, "before")}
        disabled={isUploading}
      />
      <input
        ref={beforeUploadRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => handlePhotoChange(e, "before")}
        disabled={isUploading}
      />
      <input
        ref={afterCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => handlePhotoChange(e, "after")}
        disabled={isUploading}
      />
      <input
        ref={afterUploadRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => handlePhotoChange(e, "after")}
        disabled={isUploading}
      />

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

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`rounded-full px-3 py-1 font-semibold capitalize ${job.status === "in_progress" || isActive
            ? "bg-green-100 text-green-800"
            : job.status === "completed" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-charcoal"}`}>
            {isActive ? "In progress" : statusLabel}
          </span>
          {activeEntry && <span className="text-muted">You are clocked into this job</span>}
          {!activeEntry && completedEntry && <span className="text-muted">Your job time is recorded</span>}
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
              Planned{" "}
              {new Date(job.scheduled_start).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>
        )}

        {job.actual_start && (
          <p className="text-sm text-muted">Started {new Intl.DateTimeFormat("en-US", {
            timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short",
          }).format(new Date(job.actual_start))}</p>
        )}
        {job.actual_end && (
          <p className="text-sm text-muted">Finished {new Intl.DateTimeFormat("en-US", {
            timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short",
          }).format(new Date(job.actual_end))}</p>
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

        {gps.error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
            <AlertTriangle size={15} className="flex-shrink-0 mt-0.5 text-red-500" />
            <span>{gps.error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleTagLocation}
          disabled={isClocking || gps.acquiring}
          className={`w-full flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-colors disabled:opacity-60 ${
            isLocationTagged
              ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
              : "border-gray-200 bg-gray-50 text-charcoal hover:bg-gray-100"
          }`}
        >
          {gps.acquiring ? (
            <Loader2 size={16} className="animate-spin" />
          ) : isLocationTagged ? (
            <CheckCircle2 size={16} />
          ) : (
            <MapPin size={16} />
          )}
          {gps.acquiring ? "Getting GPS..." : isLocationTagged ? "Site Location Tagged" : "Tag Site Location"}
        </button>
      </div>

      {/* ── STATE: NOT STARTED ── */}
      {isReady && (
        <div className="space-y-3">
          {/* Before photos — required before starting */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
            <div>
              <p className="font-semibold text-charcoal">Before Photos</p>
              <p className="text-sm text-muted mt-0.5">
                Take {BEFORE_REQUIRED} photos of the property before starting work.
              </p>
            </div>

            {localBefore > 0 && (
              <PhotoCounter count={localBefore} required={BEFORE_REQUIRED} />
            )}

            {localBefore < BEFORE_REQUIRED && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => openPhotoInput(beforeCameraRef.current)}
                  disabled={isUploading}
                  className={`w-full flex items-center justify-center gap-3 py-5 rounded-xl border-2 border-dashed transition-colors ${isUploading ? "border-gray-200 bg-gray-50 opacity-60" : "border-amber-300 bg-amber-50 hover:bg-amber-100 active:bg-amber-200"}`}
                >
                  {isUploading ? (
                    <Loader2 size={20} className="text-gray-400 animate-spin" />
                  ) : (
                    <Camera size={22} className="text-amber-600" />
                  )}
                  <span className="font-semibold text-amber-700">
                    {gps.acquiring ? "Getting GPS..." : isUploading ? "Uploading..." : "Take Photo"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => openPhotoInput(beforeUploadRef.current)}
                  disabled={isUploading}
                  className={`w-full flex items-center justify-center gap-3 py-5 rounded-xl border-2 border-dashed transition-colors ${isUploading ? "border-gray-200 bg-gray-50 opacity-60" : "border-gray-300 bg-gray-50 hover:bg-gray-100 active:bg-gray-200"}`}
                >
                  {isUploading ? (
                    <Loader2 size={20} className="text-gray-400 animate-spin" />
                  ) : (
                    <Upload size={21} className="text-charcoal" />
                  )}
                  <span className="font-semibold text-charcoal">
                    Upload Photo
                  </span>
                </button>
              </div>
            )}

            {canStart && (
              <button
                type="button"
                onClick={() => openPhotoInput(beforeCameraRef.current)}
                disabled={isUploading}
                className="flex w-full items-center justify-center gap-2 text-sm text-green-600 font-medium hover:underline disabled:opacity-60"
              >
                <Camera size={14} />
                Add more before photos
              </button>
            )}
            {canStart && (
              <button
                type="button"
                onClick={() => openPhotoInput(beforeUploadRef.current)}
                disabled={isUploading}
                className="flex w-full items-center justify-center gap-2 text-sm text-charcoal font-medium hover:underline disabled:opacity-60"
              >
                <Upload size={14} />
                Upload before photo
              </button>
            )}
          </div>

          <button
            onClick={handleClockIn}
            disabled={isClocking || gps.acquiring || !canStart}
            className="w-full flex items-center justify-center gap-3 bg-lawn hover:bg-lawn/90 active:bg-lawn/80 text-white font-bold text-lg rounded-2xl py-6 transition-colors disabled:opacity-40 shadow-sm shadow-lawn/30"
          >
            {isClocking ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <PlayCircle size={28} />
            )}
            {gps.acquiring ? "Getting GPS..." : isClocking ? "Starting..." : "Start Job"}
          </button>
          {!canStart && (
            <p className="text-center text-sm text-muted">
              {!isLocationTagged
                ? "Tag this job's site location before starting."
                : `${BEFORE_REQUIRED} saved before photos required to start.`}
            </p>
          )}
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

          {/* After photos — required before clocking out */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
            <div>
              <p className="font-semibold text-charcoal">After Photos</p>
              <p className="text-sm text-muted mt-0.5">
                Take {AFTER_REQUIRED} photos of the finished work before clocking out.
              </p>
            </div>

            {localAfter > 0 && (
              <PhotoCounter count={localAfter} required={AFTER_REQUIRED} />
            )}

            {localAfter < AFTER_REQUIRED && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => openPhotoInput(afterCameraRef.current)}
                  disabled={isUploading}
                  className={`w-full flex items-center justify-center gap-3 py-5 rounded-xl border-2 border-dashed transition-colors ${isUploading ? "border-gray-200 bg-gray-50 opacity-60" : "border-blue-300 bg-blue-50 hover:bg-blue-100 active:bg-blue-200"}`}
                >
                  {isUploading ? (
                    <Loader2 size={20} className="text-gray-400 animate-spin" />
                  ) : (
                    <Camera size={22} className="text-blue-600" />
                  )}
                  <span className="font-semibold text-blue-700">
                    {gps.acquiring ? "Getting GPS..." : isUploading ? "Uploading..." : "Take Photo"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => openPhotoInput(afterUploadRef.current)}
                  disabled={isUploading}
                  className={`w-full flex items-center justify-center gap-3 py-5 rounded-xl border-2 border-dashed transition-colors ${isUploading ? "border-gray-200 bg-gray-50 opacity-60" : "border-gray-300 bg-gray-50 hover:bg-gray-100 active:bg-gray-200"}`}
                >
                  {isUploading ? (
                    <Loader2 size={20} className="text-gray-400 animate-spin" />
                  ) : (
                    <Upload size={21} className="text-charcoal" />
                  )}
                  <span className="font-semibold text-charcoal">
                    Upload Photo
                  </span>
                </button>
              </div>
            )}

            {canClockOut && (
              <button
                type="button"
                onClick={() => openPhotoInput(afterCameraRef.current)}
                disabled={isUploading}
                className="flex w-full items-center justify-center gap-2 text-sm text-green-600 font-medium hover:underline disabled:opacity-60"
              >
                <Camera size={14} />
                Add more after photos
              </button>
            )}
            {canClockOut && (
              <button
                type="button"
                onClick={() => openPhotoInput(afterUploadRef.current)}
                disabled={isUploading}
                className="flex w-full items-center justify-center gap-2 text-sm text-charcoal font-medium hover:underline disabled:opacity-60"
              >
                <Upload size={14} />
                Upload after photo
              </button>
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
            disabled={isClocking || gps.acquiring || !canClockOut}
            className="w-full flex items-center justify-center gap-3 bg-redline hover:bg-redline-dark active:bg-redline/80 text-white font-bold text-lg rounded-2xl py-6 transition-colors disabled:opacity-40 shadow-sm shadow-redline/30"
          >
            {isClocking ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <StopCircle size={28} />
            )}
            {gps.acquiring ? "Getting GPS..." : isClocking ? "Clocking out..." : "Clock Out"}
          </button>
          {!canClockOut && (
            <p className="text-center text-sm text-muted">
              {AFTER_REQUIRED} after photos required to clock out.
            </p>
          )}
        </div>
      )}

      {/* ── STATE: COMPLETED ── */}
      {isDone && (
        <div className="space-y-3">
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

          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-2">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 size={15} className="text-green-600" />
              <span>{localBefore} before photo{localBefore !== 1 ? "s" : ""} on file</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 size={15} className="text-green-600" />
              <span>{localAfter} after photo{localAfter !== 1 ? "s" : ""} on file</span>
            </div>
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
