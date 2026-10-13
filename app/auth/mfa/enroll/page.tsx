"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeAuthNext } from "@/lib/auth/mfa-flow";
import { hasRecentTotp } from "@/lib/auth/recent-mfa";

// Supabase otherwise labels the authenticator from the Auth project's Site URL.
// Keep the staff portal identity stable across local builds and preview hosts.
const MFA_ISSUER = "https://www.redlinelandscapingky.com";

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
  const [ready, setReady] = useState(false);
  const [incomplete, setIncomplete] = useState(false);

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
      setIncomplete(data?.all?.some(item => item.factor_type === "totp" && item.status === "unverified") ?? false);
      setReady(true);
    });
    return () => { active = false; };
  }, [router, next, addAnother]);

  async function startEnrollment() {
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setError("Your sign-in expired. Sign in again to set up an authenticator.");
      setBusy(false);
      return;
    }
    const { data: current, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError || !current) {
      setError("Could not check your authentication factors. Try again.");
      setBusy(false);
      return;
    }
    if (current.totp?.some(item => item.status === "verified")) {
      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError || assurance?.currentLevel !== "aal2" ||
          !hasRecentTotp(assurance.currentAuthenticationMethods)) {
        setError("Verify with your existing authenticator before adding another one.");
        setBusy(false);
        return;
      }
    }
    // A lost enrollment response leaves a factor without a recoverable secret.
    // Only an explicit restart removes the signed-in user's unverified TOTP factors.
    for (const pending of current.all.filter(item => item.factor_type === "totp" && item.status === "unverified")) {
      const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: pending.id });
      if (removeError) {
        setError("Could not restart the incomplete setup. Try again or contact support.");
        setBusy(false);
        return;
      }
    }
    const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      issuer: MFA_ISSUER,
    });
    if (enrollError || !enrolled?.totp) {
      setError(enrollError?.code === "mfa_totp_enroll_not_enabled"
        ? "Authenticator enrollment is disabled in the authentication provider. Contact the site owner."
        : "Could not start enrollment. Try again; if it continues, contact support.");
      setBusy(false);
      return;
    }
    setFactor({ id: enrolled.id, qr: enrolled.totp.qr_code, secret: enrolled.totp.secret });
    setIncomplete(false);
    setBusy(false);
  }

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
      <p>Scan the code with your authenticator app, then enter its first six-digit code.</p>
      {ready && !factor && <>
        {incomplete && <p>An earlier setup was not verified. Restart it to get a new QR code.</p>}
        <button type="button" onClick={startEnrollment} disabled={busy}
          className="rounded bg-redline px-4 py-2 text-white disabled:opacity-50">
          {busy ? "Preparing authenticator…" : incomplete ? "Restart setup" : "Start setup"}
        </button>
      </>}
      {factor && <><Image src={factor.qr} alt="Authenticator setup QR code" width={200} height={200} unoptimized />
        <p>Manual setup key: <code className="break-all">{factor.secret}</code></p>
        <form onSubmit={verify} className="space-y-3">
          <label htmlFor="totp-code">Authenticator code</label>
          <input id="totp-code" inputMode="numeric" autoComplete="one-time-code" value={code}
            onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            className="block border rounded p-2" />
          <button type="submit" disabled={busy || code.length !== 6} className="bg-redline text-white rounded px-4 py-2 disabled:opacity-50">Verify and enable</button>
        </form>
        <button type="button" onClick={startEnrollment} disabled={busy}
          className="text-sm underline disabled:opacity-50">Start over with a new code</button></>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
    </>}
  </main>;
}

export default function EnrollMfaPage() {
  return <Suspense fallback={<p className="p-6 text-sm">Loading authenticator setup…</p>}>
    <EnrollMfa />
  </Suspense>;
}
