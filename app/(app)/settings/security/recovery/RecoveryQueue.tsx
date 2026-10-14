"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type RequestRow = {
  id: string;
  user_id: string;
  reason: string;
  status: string;
  requested_at: string;
  provider_error: string | null;
  account: { id: string; email: string; first_name: string; last_name: string } | null;
};

export default function RecoveryQueue({ requests }: { requests: RequestRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(event: React.FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const identityMethod = String(form.get("identityMethod") ?? "");
    const reviewNote = String(form.get("reviewNote") ?? "").trim();
    if (reviewNote.length < 10) { setError("Record how you verified the person before approving."); return; }
    setBusy(id);
    setError(null);
    try {
      const response = await fetch(`/api/auth/mfa/recovery/${id}/resolve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identityMethod, reviewNote }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        setError(result.error ?? "Recovery could not be completed. Retry after checking its status.");
        return;
      }
      router.refresh();
    } finally { setBusy(null); }
  }

  if (!requests.length) return <p>No pending requests.</p>;
  return <div className="space-y-4">
    {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-red-700">{error}</p>}
    {requests.map(item => <section key={item.id} className="space-y-3 rounded border bg-white p-4">
      <h2 className="font-semibold">{item.account?.first_name} {item.account?.last_name}</h2>
      <p className="text-sm">{item.account?.email ?? "Account details unavailable"}</p>
      <p className="text-sm">Requested {new Date(item.requested_at).toLocaleString()} · {item.status}</p>
      <p className="text-sm">{item.reason}</p>
      {item.provider_error && <p className="text-sm text-red-700">Provider step needs retry.</p>}
      <form onSubmit={event => resolve(event, item.id)} className="space-y-3">
        <label className="block text-sm">Verification method
          <select name="identityMethod" className="mt-1 block w-full rounded border p-2">
            <option value="in_person">Verified in person</option>
            <option value="known_callback">Called a previously known number</option>
          </select>
        </label>
        <label className="block text-sm">Verification note
          <textarea name="reviewNote" required minLength={10} maxLength={500} rows={3}
            className="mt-1 block w-full rounded border p-2" />
        </label>
        <button disabled={busy !== null} className="rounded bg-redline px-4 py-2 font-semibold text-white disabled:opacity-50">
          {busy === item.id ? "Working…" : item.status === "provider_pending" ? "Retry provider reset" : "Approve and reset factors"}
        </button>
      </form>
    </section>)}
  </div>;
}
