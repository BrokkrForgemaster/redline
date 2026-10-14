"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Shield, Key, Smartphone, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function SecuritySettingsPage() {
  const [mfaFactors, setMfaFactors] = useState<{ id: string; status: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [factorError, setFactorError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (error) setFactorError("Could not load authenticator factors.");
      setMfaFactors(data?.totp ?? []);
      setLoading(false);
    });
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
      setIsOwner(profile?.role === "owner");
    });
  }, []);

  const hasMfa = mfaFactors.some(f => f.status === "verified");
  const verifiedFactors = mfaFactors.filter(f => f.status === "verified");

  async function removeFactor(id: string) {
    if (!window.confirm("Remove this authenticator? Your other verified factor will remain active.")) return;
    setFactorError(null);
    const response = await fetch(`/api/auth/mfa/factors/${id}/remove`, { method: "POST" });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setFactorError(body.error ?? "Authenticator could not be removed.");
      return;
    }
    const { data, error } = await createClient().auth.mfa.listFactors();
    if (error) { setFactorError("Authenticator removed, but the list could not be refreshed."); return; }
    setMfaFactors(data?.totp ?? []);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Security & MFA</h1>
        <p className="text-sm text-muted mt-1">Manage your password and two-factor authentication.</p>
      </div>

      {/* MFA Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${hasMfa ? "bg-lawn/10" : "bg-yellow-50"}`}>
            <Smartphone size={20} className={hasMfa ? "text-lawn" : "text-yellow-500"} />
          </div>
          <div>
            <h2 className="font-semibold text-charcoal">Two-Factor Authentication</h2>
            <div className="flex items-center gap-1 mt-0.5">
              {hasMfa ? (
                <>
                  <CheckCircle2 size={14} className="text-lawn" />
                  <span className="text-sm text-lawn font-medium">Enabled</span>
                </>
              ) : (
                <>
                  <AlertCircle size={14} className="text-yellow-500" />
                  <span className="text-sm text-yellow-600 font-medium">Not configured</span>
                </>
              )}
            </div>
          </div>
        </div>
        <p className="text-sm text-muted">
          {hasMfa
            ? "Your account is protected with Google Authenticator-compatible MFA."
            : "Add an extra layer of security by enabling two-factor authentication with an authenticator app."}
        </p>
        {!loading && !hasMfa && (
          <Link
            href="/auth/mfa/enroll?next=%2Fsettings%2Fsecurity"
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${hasMfa
              ? "border border-gray-200 text-charcoal hover:bg-gray-50"
              : "bg-redline text-white hover:bg-redline-dark"}`}
          >
            <Shield size={14} />
            Enable MFA
          </Link>
        )}
        {hasMfa && <div className="space-y-3">
          <p className="text-sm">{verifiedFactors.length} verified authenticator{verifiedFactors.length === 1 ? "" : "s"}.</p>
          <Link href="/auth/mfa/enroll?add=1&next=%2Fsettings%2Fsecurity" className="inline-block rounded bg-redline px-4 py-2 text-sm font-medium text-white">
            Add another authenticator
          </Link>
          {verifiedFactors.map((factor, index) => <div key={factor.id} className="flex items-center justify-between rounded border p-3 text-sm">
            <span>Authenticator {index + 1} · added {new Date(factor.created_at).toLocaleDateString()}</span>
            {verifiedFactors.length > 1 && <button type="button" onClick={() => removeFactor(factor.id)} className="text-redline underline">Remove</button>}
          </div>)}
        </div>}
        {factorError && <p role="alert" className="text-sm text-red-700">{factorError}</p>}
      </div>

      {isOwner && <Link href="/settings/security/recovery" className="block rounded-xl border bg-white p-5 text-sm font-medium text-redline">
        Review staff MFA recovery requests
      </Link>}

      {/* Password */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
            <Key size={20} className="text-muted" />
          </div>
          <div>
            <h2 className="font-semibold text-charcoal">Password</h2>
            <p className="text-sm text-muted">Change your account password</p>
          </div>
        </div>
        <Link href="/settings/security/change-password"
          className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
          <span className="text-sm text-charcoal">Change password</span>
          <ChevronRight size={16} className="text-muted" />
        </Link>
      </div>
    </div>
  );
}
