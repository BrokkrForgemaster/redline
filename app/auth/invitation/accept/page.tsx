"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { mfaDestination } from "@/lib/auth/mfa-flow";

export default function AcceptInvitationPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data, error: authError }) => {
      if (authError || !data.user) { setError("The invitation link is invalid or expired. Ask the owner to review it."); return; }
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error || !assurance.data) { setError("Could not verify account security."); return; }
      const destination = mfaDestination(assurance.data.currentLevel, assurance.data.nextLevel,
        "/auth/invitation/accept");
      if (destination) { router.replace(destination); return; }
      setReady(true);
    });
  }, [router]);

  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        setError(result.error ?? "The invitation could not be activated. Ask the owner to review its status.");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server. Your invitation remains pending; try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="mx-auto max-w-md space-y-4 p-6">
    <h1 className="text-2xl font-semibold">Complete staff setup</h1>
    <p>Your email invitation and authenticator must both be verified. Create a password to finish setup.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {ready && <form onSubmit={accept} className="space-y-4">
      <label className="block text-sm font-medium">New password
        <input type="password" autoComplete="new-password" minLength={12} required
          value={password} onChange={event => setPassword(event.target.value)}
          className="mt-1 block w-full rounded border p-3" />
      </label>
      <label className="block text-sm font-medium">Confirm password
        <input type="password" autoComplete="new-password" minLength={12} required
          value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)}
          className="mt-1 block w-full rounded border p-3" />
      </label>
      <button type="submit" disabled={busy}
        className="rounded bg-redline px-4 py-3 font-semibold text-white disabled:opacity-50">
        {busy ? "Activating…" : "Create password and activate account"}
      </button>
    </form>}
  </main>;
}
