"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeAuthNext } from "@/lib/auth/mfa-flow";
import { Loader2, Shield } from "lucide-react";
import Link from "next/link";

function MFAChallenge() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeAuthNext(searchParams.get("next"));
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [factors, setFactors] = useState<{ id: string; friendly_name?: string | null }[]>([]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.mfa.listFactors().then(({ data, error: listError }) => {
      if (listError) { setError("Could not load your authenticator. Try again."); return; }
      const verified = data?.totp?.filter(f => f.status === "verified") ?? [];
      if (verified.length) {
        setFactors(verified);
        setFactorId(verified[0].id);
      }
      else router.push(`/auth/mfa/enroll?next=${encodeURIComponent(next)}`);
    });
  }, [router, next]);

  function handleInput(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newCode = Array(6).fill("").map((_, i) => text[i] || "");
    setCode(newCode);
    inputRefs.current[Math.min(text.length, 5)]?.focus();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fullCode = code.join("");
    if (fullCode.length !== 6 || !factorId) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) {
      setError("Failed to initiate MFA challenge. Please try again.");
      setLoading(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: fullCode,
    });

    if (verifyError) {
      setError("Invalid code. Please check your authenticator app and try again.");
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      setLoading(false);
      return;
    }

    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || assurance?.currentLevel !== "aal2") {
      setError("Verification could not be confirmed. Please try again.");
      setLoading(false);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="text-center">
      <div className="w-14 h-14 bg-charcoal rounded-full flex items-center justify-center mx-auto mb-6">
        <Shield size={24} className="text-white" />
      </div>
      <h1 className="text-2xl font-bold text-charcoal">Two-factor verification</h1>
      <p className="mt-2 text-sm text-muted">
        Open your authenticator app and enter the 6-digit code.
      </p>

      <form onSubmit={handleSubmit} className="mt-8">
        {factors.length > 1 && <label className="mb-4 block text-left text-sm">Authenticator
          <select value={factorId ?? ""} onChange={event => setFactorId(event.target.value)}
            className="mt-1 block w-full rounded border p-2">
            {factors.map((factor, index) => <option key={factor.id} value={factor.id}>
              {factor.friendly_name || `Authenticator ${index + 1}`}
            </option>)}
          </select>
        </label>}
        <div className="flex gap-3 justify-center" onPaste={handlePaste}>
          {code.map((digit, index) => (
            <input
              key={index}
              ref={el => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleInput(index, e.target.value)}
              onKeyDown={e => handleKeyDown(index, e)}
              className="w-12 h-14 text-center text-2xl font-bold rounded-lg border-2 border-border focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
              aria-label={`Digit ${index + 1}`}
            />
          ))}
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600" role="alert">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || code.join("").length !== 6}
          className="mt-6 w-full flex items-center justify-center gap-2 bg-redline text-white font-semibold py-3 px-6 rounded-lg hover:bg-redline-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? "Verifying…" : "Verify"}
        </button>
      </form>

      <div className="mt-6 text-sm text-muted">
        Lost access to your authenticator?{" "}
        <Link href="/auth/mfa/recovery" className="text-redline hover:underline">
          Request verified account recovery
        </Link>
      </div>
    </div>
  );
}

export default function MFAChallengePage() {
  return <Suspense fallback={<p className="text-sm text-muted">Loading verification…</p>}>
    <MFAChallenge />
  </Suspense>;
}
