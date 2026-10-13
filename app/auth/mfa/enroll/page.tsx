"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeAuthNext } from "@/lib/auth/mfa-flow";
import { hasRecentTotp } from "@/lib/auth/recent-mfa";

function EnrollMfa() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeAuthNext(searchParams.get("next"));
  const addAnother = searchParams.get("add") === "1";
  const [factor, setFactor] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!active) return;
      if (!user) { setError("Sign in before adding an authenticator."); return; }
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (!active) return;
      if (listError) { setError("Could not load authentication factors."); return; }
      if (data?.totp?.some(item => item.status === "verified")) {
        const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (assurance?.currentLevel !== "aal2" || assurance.nextLevel !== "aal2" ||
            (addAnother && !hasRecentTotp(assurance.currentAuthenticationMethods))) {
          const returnPath = addAnother ? `/auth/mfa/enroll?add=1&next=${encodeURIComponent(next)}` : next;
          router.replace(`/mfa/challenge?next=${encodeURIComponent(returnPath)}`);
          return;
        }
        if (!addAnother) { setVerified(true); return; }
      }
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (!active) return;
      if (enrollError || !enrolled?.totp) { setError("Could not start enrollment."); return; }
      setFactor({ id: enrolled.id, qr: enrolled.totp.qr_code, secret: enrolled.totp.secret });
    });
    return () => { active = false; };
  }, [router, next, addAnother]);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!factor || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (challengeError || !challenge) { setError("Could not start verification. Try again."); setBusy(false); return; }
    const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code });
    if (verifyError) { setError("That code was not accepted. Check your authenticator and try again."); setBusy(false); return; }
    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || assurance?.currentLevel !== "aal2") {
      setError("Verification could not be confirmed. Please try again."); setBusy(false); return;
    }
    setVerified(true);
    setFactor(null);
    setBusy(false);
  }

  return <main className="mx-auto max-w-md p-6 space-y-4">
    <h1 className="text-2xl font-semibold">Authenticator setup</h1>
    {verified ? <p>Authenticator verified. <Link href={next}>Continue</Link>.</p> : <>
      <p>Scan this code with your authenticator app, then enter its first six-digit code.</p>
      {factor && <><Image src={factor.qr} alt="Authenticator setup QR code" width={200} height={200} unoptimized />
        <p>Manual setup key: <code className="break-all">{factor.secret}</code></p>
        <form onSubmit={verify} className="space-y-3">
          <label htmlFor="totp-code">Authenticator code</label>
          <input id="totp-code" inputMode="numeric" autoComplete="one-time-code" value={code}
            onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            className="block border rounded p-2" />
          <button type="submit" disabled={busy || code.length !== 6} className="bg-redline text-white rounded px-4 py-2 disabled:opacity-50">Verify and enable</button>
        </form></>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
    </>}
  </main>;
}

export default function EnrollMfaPage() {
  return <Suspense fallback={<p className="p-6 text-sm">Loading authenticator setup…</p>}>
    <EnrollMfa />
  </Suspense>;
}
