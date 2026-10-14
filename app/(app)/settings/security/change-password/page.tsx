"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validations/auth";

export default function ChangePasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  async function submit(input: ChangePasswordInput) {
    setMessage(null);
    const response = await fetch("/api/auth/password", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "change", password: input.newPassword,
        currentPassword: input.currentPassword }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setMessage(result.error ?? "Password could not be changed.");
      return;
    }
    reset();
    setSuccess(true);
    setMessage("Password changed. Review your other signed-in devices.");
  }

  return <main className="max-w-md space-y-5">
    <h1 className="text-2xl font-bold text-charcoal">Change password</h1>
    <p className="text-sm text-muted">A recent authenticator verification and your current password are required.</p>
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <label className="block text-sm">Current password
        <input type="password" autoComplete="current-password" {...register("currentPassword")}
          className="mt-1 block w-full rounded border p-3" />
        {errors.currentPassword && <span role="alert" className="text-red-700">{errors.currentPassword.message}</span>}
      </label>
      <label className="block text-sm">New password
        <input type="password" autoComplete="new-password" {...register("newPassword")}
          className="mt-1 block w-full rounded border p-3" />
        {errors.newPassword && <span role="alert" className="text-red-700">{errors.newPassword.message}</span>}
      </label>
      <label className="block text-sm">Confirm new password
        <input type="password" autoComplete="new-password" {...register("confirmPassword")}
          className="mt-1 block w-full rounded border p-3" />
        {errors.confirmPassword && <span role="alert" className="text-red-700">{errors.confirmPassword.message}</span>}
      </label>
      {message && <p role="status" className={success ? "text-green-700" : "text-red-700"}>{message}</p>}
      <button disabled={isSubmitting} className="rounded bg-redline px-4 py-3 font-semibold text-white disabled:opacity-50">
        {isSubmitting ? "Changing…" : "Change password"}
      </button>
    </form>
    <Link href="/mfa/challenge?next=%2Fsettings%2Fsecurity%2Fchange-password" className="text-sm text-redline underline">
      Verify authenticator again
    </Link>
  </main>;
}
