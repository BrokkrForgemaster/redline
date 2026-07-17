"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Shield } from "lucide-react";
import Link from "next/link";

export default function MFAChallengePage() {
  const router = useRouter();
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const verified = data?.totp?.find(f => f.status === "verified");
      if (verified) setFactorId(verified.id);
      else router.push("/dashboard");
    });
  }, [router]);

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

    router.push("/dashboard");
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
          Use a recovery code
        </Link>
      </div>
    </div>
  );
}
