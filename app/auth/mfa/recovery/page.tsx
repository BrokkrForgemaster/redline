"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function MfaRecoveryPage() {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (reason.trim().length < 10 || reason.trim().length > 500) {
      setMessage("Explain the access problem in 10 to 500 characters."); return;
    }
    setPending(true);
    try {
      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { setMessage("Sign in with your password first, then return here."); return; }
      const { error } = await supabase.rpc("request_mfa_recovery", { p_reason: reason.trim() });
      if (error) { setMessage("The request could not be saved. Please try again or contact the owner directly."); return; }
      setSubmitted(true);
    } finally { setPending(false); }
  }

  return <main className="mx-auto max-w-md space-y-4 p-6">
    <h1 className="text-2xl font-semibold">Authenticator recovery</h1>
    <p>If you have another enrolled authenticator, use it on the verification screen. If you lost every factor, sign in with your password and request an owner-assisted reset here.</p>
    <p>The owner must verify your identity directly before removing factors. A password reset email alone does not replace this check. No backup codes are available.</p>
    {submitted ? <p role="status" className="text-green-700">Your recovery request was saved. Contact the owner to complete identity verification.</p> :
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm" htmlFor="recovery-reason">What happened?
          <textarea id="recovery-reason" value={reason} maxLength={500}
            onChange={event => setReason(event.target.value)} className="mt-1 block w-full rounded border p-3" rows={4} />
        </label>
        {message && <p role="alert" className="text-red-700">{message}</p>}
        <button disabled={pending} className="rounded bg-redline px-4 py-3 font-semibold text-white disabled:opacity-50">
          {pending ? "Saving…" : "Request owner-assisted reset"}
        </button>
      </form>}
    <Link href="/mfa/challenge" className="block text-redline underline">Return to verification</Link>
  </main>;
}
