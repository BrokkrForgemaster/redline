"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { mfaDestination, safeAuthNext } from "@/lib/auth/mfa-flow";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginForm({ defaultNext = "/dashboard" }: { defaultNext?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? defaultNext;
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginInput) {
    setServerError(null);
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      setServerError("Staff sign-in is unavailable because the portal configuration is missing. Reload the page; if it continues, contact the administrator.");
      return;
    }

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      // Generic message to avoid revealing whether account exists
      setServerError("Invalid email or password. Please try again.");
      return;
    }

    // An owner-provisioned account stays invited until MFA and password change.
    if (authData.session && authData.session.user) {
      const { data: profile, error: profileError } = await supabase.from("profiles")
        .select("status").eq("id", authData.session.user.id).single();
      if (profileError || !profile || !["active", "invited"].includes(profile.status)) {
        setServerError("Account access is unavailable. Contact the owner.");
        return;
      }
      const destinationAfterMfa = profile.status === "invited" ? "/auth/setup" : safeAuthNext(next);
      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError || !assurance) {
        setServerError("Could not verify your security status. Please try again.");
        return;
      }
      const destination = mfaDestination(assurance.currentLevel, assurance.nextLevel, destinationAfterMfa);
      if (destination) { router.push(destination); return; }
      if (profile.status === "invited") { router.push("/auth/setup"); return; }
    }

    router.push(safeAuthNext(next));
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {serverError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4" role="alert">
          <p className="text-sm text-red-700">{serverError}</p>
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-charcoal mb-1">
          Email address
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          {...register("email")}
          className="block w-full rounded-lg border border-border bg-white px-4 py-3 text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
          placeholder="you@example.com"
          aria-describedby={errors.email ? "email-error" : undefined}
        />
        {errors.email && (
          <p id="email-error" className="mt-1 text-xs text-red-600" role="alert">
            {errors.email.message}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="password" className="block text-sm font-medium text-charcoal">
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-xs text-redline hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            {...register("password")}
            className="block w-full rounded-lg border border-border bg-white px-4 py-3 pr-12 text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            placeholder="Your password"
            aria-describedby={errors.password ? "password-error" : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-charcoal p-1"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {errors.password && (
          <p id="password-error" className="mt-1 text-xs text-red-600" role="alert">
            {errors.password.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full flex items-center justify-center gap-2 bg-redline text-white font-semibold py-3 px-6 rounded-lg hover:bg-redline-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isSubmitting && <Loader2 size={16} className="animate-spin" />}
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-center text-xs text-muted">
        New employee?{" "}
        <span className="text-charcoal">
          Contact the owner to set up your staff account.
        </span>
      </p>
    </form>
  );
}
