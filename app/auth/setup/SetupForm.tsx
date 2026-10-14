"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SetupForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/staff-accounts/complete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "Account setup could not be completed.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again; your account remains inactive.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    const { error: signOutError } = await createClient().auth.signOut();
    if (signOutError) {
      setError("Could not sign out. Try again.");
      setBusy(false);
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return <><form onSubmit={submit} className="space-y-4">
    <label className="block text-sm font-medium">Initial password
      <input type="password" autoComplete="current-password" required value={currentPassword}
        onChange={event => setCurrentPassword(event.target.value)} className="mt-1 block w-full rounded border p-3" />
    </label>
    <label className="block text-sm font-medium">New password
      <input type="password" autoComplete="new-password" minLength={12} required value={newPassword}
        onChange={event => setNewPassword(event.target.value)} className="mt-1 block w-full rounded border p-3" />
    </label>
    <label className="block text-sm font-medium">Confirm new password
      <input type="password" autoComplete="new-password" minLength={12} required value={confirmPassword}
        onChange={event => setConfirmPassword(event.target.value)} className="mt-1 block w-full rounded border p-3" />
    </label>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <button disabled={busy} className="rounded bg-redline px-4 py-3 font-semibold text-white disabled:opacity-50">
      {busy ? "Completing setup…" : "Change password and activate"}
    </button>
  </form>
    <button type="button" disabled={busy} onClick={signOut}
      className="mt-4 text-sm text-redline underline disabled:opacity-50">Sign out</button>
  </>;
}
