"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupportRequest, replyToSupportRequest, changeSupportRequestStatus } from "@/lib/actions/support";

export function NewSupportForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = event.currentTarget;
    const fields = new FormData(form);
    try {
      const result = await createSupportRequest({
        subject: fields.get("subject"), category: fields.get("category"),
        affectedPage: fields.get("affectedPage"), body: fields.get("body"),
      });
      if (!result.ok) { setError(result.error); return; }
      router.push(`/support/${result.id}`);
      router.refresh();
    } catch {
      setError("Could not save the request. Please retry.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border bg-white p-5">
      <h2 className="font-semibold text-charcoal">Contact developer support</h2>
      <p className="text-sm text-muted">Describe the issue without passwords, tokens, customer details or precise locations.</p>
      <input name="subject" required minLength={3} maxLength={150} placeholder="Subject" aria-label="Subject" className="w-full rounded-lg border px-3 py-2" />
      <div className="grid gap-3 sm:grid-cols-2">
        <select name="category" aria-label="Category" className="rounded-lg border px-3 py-2">
          <option value="technical_issue">Technical issue</option>
          <option value="access">Access</option>
          <option value="change_request">Change request</option>
          <option value="other">Other</option>
        </select>
        <input name="affectedPage" maxLength={300} placeholder="Affected page (optional)" aria-label="Affected page" className="rounded-lg border px-3 py-2" />
      </div>
      <textarea name="body" required minLength={1} maxLength={4000} rows={4} placeholder="What happened?" aria-label="Description" className="w-full rounded-lg border px-3 py-2" />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={pending} className="rounded-lg bg-redline px-4 py-2 font-semibold text-white disabled:opacity-50">{pending ? "Saving…" : "Send support request"}</button>
    </form>
  );
}

export function SupportReplyForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = event.currentTarget;
    const fields = new FormData(form);
    try {
      const result = await replyToSupportRequest({ ticketId, body: fields.get("body") });
      if (!result.ok) { setError(result.error); return; }
      form.reset();
      router.refresh();
    } catch {
      setError("Could not save the reply. Please retry.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border bg-white p-5">
      <label htmlFor="supportReply" className="font-semibold text-charcoal">Reply</label>
      <textarea id="supportReply" name="body" required maxLength={4000} rows={4} className="w-full rounded-lg border px-3 py-2" />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={pending} className="rounded-lg bg-redline px-4 py-2 font-semibold text-white disabled:opacity-50">{pending ? "Saving…" : "Send reply"}</button>
    </form>
  );
}

export function SupportStatusForm({ ticketId, currentStatus }: { ticketId: string; currentStatus: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const fields = new FormData(event.currentTarget);
    try {
      const result = await changeSupportRequestStatus({ ticketId, status: fields.get("status") });
      if (!result.ok) { setError(result.error); return; }
      router.refresh();
    } catch {
      setError("Could not update the support status. Please retry.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4">
      <label htmlFor="supportStatus" className="text-sm font-semibold">Status</label>
      <select id="supportStatus" name="status" defaultValue={currentStatus} className="rounded-lg border px-3 py-2 text-sm">
        {["open", "triaged", "in_progress", "waiting_on_owner", "resolved", "closed"].map(status =>
          <option key={status} value={status}>{status.replace(/_/g, " ")}</option>
        )}
      </select>
      <button type="submit" disabled={pending} className="rounded-lg bg-charcoal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save status</button>
      {error && <p role="alert" className="w-full text-sm text-red-700">{error}</p>}
    </form>
  );
}
