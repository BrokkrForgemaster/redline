"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations/auth";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import PasswordStrength from "@/components/forms/PasswordStrength";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) });

  const passwordValue = watch("password", "");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setSessionValid(!!data.session);
    });
  }, []);

  async function onSubmit(data: ResetPasswordInput) {
    setServerError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: data.password });
    if (error) {
      setServerError("Unable to reset password. The link may have expired. Please request a new one.");
      return;
    }
    setSuccess(true);
    setTimeout(() => router.push("/dashboard"), 2500);
  }

  if (sessionValid === null) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted" /></div>;
  }

  if (!sessionValid) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-charcoal">Link expired</h1>
        <p className="mt-3 text-sm text-muted">This password reset link is invalid or has expired.</p>
        <Link href="/forgot-password" className="mt-6 inline-block text-sm text-redline hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-lawn/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-lawn" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-charcoal">Password updated</h1>
        <p className="mt-3 text-sm text-muted">Redirecting you to your dashboard…</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal">Create a new password</h1>
      <p className="mt-2 text-sm text-muted">
        Choose a strong password with at least 12 characters.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
        {serverError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4" role="alert">
            <p className="text-sm text-red-700">{serverError}</p>
          </div>
        )}

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-charcoal mb-1">
            New password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              {...register("password")}
              className="block w-full rounded-lg border border-border bg-white px-4 py-3 pr-12 text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
              placeholder="12+ characters"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted p-1" aria-label="Toggle password visibility">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <PasswordStrength password={passwordValue} />
          {errors.password && (
            <p className="mt-1 text-xs text-red-600" role="alert">{errors.password.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-charcoal mb-1">
            Confirm new password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              {...register("confirmPassword")}
              className="block w-full rounded-lg border border-border bg-white px-4 py-3 pr-12 text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
              placeholder="Repeat your password"
            />
            <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted p-1" aria-label="Toggle confirm password visibility">
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-red-600" role="alert">{errors.confirmPassword.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 bg-redline text-white font-semibold py-3 px-6 rounded-lg hover:bg-redline-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          {isSubmitting ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
