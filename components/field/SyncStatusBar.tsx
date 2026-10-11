"use client";

import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

interface SyncStatusBarProps {
  pendingCount: number;
  pendingMediaCount?: number;
  syncing: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  onDrain: () => void;
}

export function SyncStatusBar({
  pendingCount,
  pendingMediaCount = 0,
  syncing,
  lastSyncAt,
  lastError,
  onDrain,
}: SyncStatusBarProps) {
  const totalPending = pendingCount + pendingMediaCount;
  if (totalPending === 0 && !syncing && !lastError) {
    if (!lastSyncAt) return null;
    return (
      <div className="flex items-center gap-2 text-xs text-muted py-1 px-1">
        <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
        <span>All changes synced</span>
      </div>
    );
  }

  const isError = Boolean(lastError);

  function pendingLabel() {
    const parts: string[] = [];
    if (pendingCount > 0) parts.push(`${pendingCount} change${pendingCount !== 1 ? "s" : ""}`);
    if (pendingMediaCount > 0) parts.push(`${pendingMediaCount} photo${pendingMediaCount !== 1 ? "s" : ""}`);
    return `${parts.join(" + ")} pending sync`;
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm ${
        isError
          ? "bg-red-50 border border-red-200 text-red-800"
          : "bg-blue-50 border border-blue-200 text-blue-800"
      }`}
    >
      {syncing ? (
        <RefreshCw size={14} className="animate-spin flex-shrink-0" />
      ) : isError ? (
        <AlertCircle size={14} className="flex-shrink-0 text-red-500" />
      ) : (
        <RefreshCw size={14} className="flex-shrink-0 text-blue-500" />
      )}

      <span className="flex-1 min-w-0">
        {syncing ? "Syncing changes…" : isError ? lastError : pendingLabel()}
      </span>

      {!syncing && totalPending > 0 && (
        <button
          onClick={onDrain}
          className="font-semibold underline underline-offset-2 hover:no-underline flex-shrink-0"
        >
          Sync now
        </button>
      )}
    </div>
  );
}
