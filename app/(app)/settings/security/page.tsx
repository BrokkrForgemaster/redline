"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Shield, Key, Smartphone, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function SecuritySettingsPage() {
  const [mfaFactors, setMfaFactors] = useState<{ id: string; status: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.mfa.listFactors().then(({ data }) => {
      setMfaFactors(data?.totp ?? []);
      setLoading(false);
    });
  }, []);

  const hasMfa = mfaFactors.some(f => f.status === "verified");

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
        {!loading && (
          <Link
            href="/auth/mfa/enroll"
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${hasMfa
              ? "border border-gray-200 text-charcoal hover:bg-gray-50"
              : "bg-redline text-white hover:bg-redline-dark"}`}
          >
            <Shield size={14} />
            {hasMfa ? "Manage MFA" : "Enable MFA"}
          </Link>
        )}
      </div>

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
