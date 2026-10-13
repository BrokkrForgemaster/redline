"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { mfaDestination } from "@/lib/auth/mfa-flow";

export default function AcceptInvitationPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function accept() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/auth/invitations/accept", { method: "POST" });
    if (!response.ok) {
      setError("The invitation could not be activated. Ask the owner to review its status.");
      setBusy(false);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return <main className="mx-auto max-w-md space-y-4 p-6">
    <h1 className="text-2xl font-semibold">Complete staff setup</h1>
    <p>Your email invitation and authenticator must both be verified before work access begins.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {ready && <button onClick={accept} disabled={busy}
      className="rounded bg-redline px-4 py-3 font-semibold text-white disabled:opacity-50">
      {busy ? "Activating…" : "Activate my staff account"}
    </button>}
  </main>;
}
