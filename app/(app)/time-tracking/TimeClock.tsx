"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clockInWorkday, clockOutWorkday } from "@/lib/actions/time-clock";

export default function TimeClock({ openEntry }: { openEntry: { id: string; job_id: string | null; clock_in: string } | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = openEntry ? await clockOutWorkday(openEntry.id) : await clockInWorkday();
      if (result.error) setError(result.error);
      else router.refresh();
    } catch {
      setError("The clock change could not be confirmed. Refresh to check its status before retrying.");
    } finally {
      setBusy(false);
    }
  }
  return <section className="rounded-xl border border-gray-200 bg-white p-5" aria-label="Employee clock">
    <h2 className="text-lg font-semibold">Your workday clock</h2>
    <p className="mt-1 text-sm text-muted">Records your personal elapsed work time. It does not start or finish a job or service visit.</p>
    {openEntry?.job_id ? <p className="mt-3 text-sm text-amber-800">You have an open job time entry. Close it from that job before starting a workday entry.</p> :
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={submit} disabled={busy} className="min-h-12 rounded-lg bg-redline px-6 py-3 font-semibold text-white disabled:opacity-60">
          {busy ? "Saving…" : openEntry ? "Clock out" : "Clock in"}
        </button>
        <span className="text-sm text-muted">{openEntry ? `Clocked in since ${new Date(openEntry.clock_in).toLocaleString()}` : "Currently clocked out"}</span>
      </div>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </section>;
}
