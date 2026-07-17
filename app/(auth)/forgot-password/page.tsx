"use client";

import type { Metadata } from "next";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations/auth";
import { Loader2, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(data: ForgotPasswordInput) {
    const supabase = createClient();
    // Always show success to avoid revealing whether an account exists
    await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-lawn/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-lawn" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-charcoal">Check your email</h1>
        <p className="mt-3 text-sm text-muted leading-relaxed">
          If an account with that email exists, we sent a password reset link.
          The link expires in 1 hour.
        </p>
        <p className="mt-2 text-xs text-muted">
          Didn&apos;t receive it? Check your spam folder.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center gap-2 text-sm text-redline hover:underline"
        >
          <ArrowLeft size={14} />
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link href="/login" className="inline-flex items-center gap-1 text-sm text-muted hover:text-charcoal mb-6">
        <ArrowLeft size={14} />
        Back to sign in
      </Link>
      <h1 className="text-2xl font-bold text-charcoal">Reset your password</h1>
      <p className="mt-2 text-sm text-muted">
        Enter your email and we&apos;ll send you a reset link.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
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
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-600" role="alert">{errors.email.message}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 bg-redline text-white font-semibold py-3 px-6 rounded-lg hover:bg-redline-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          {isSubmitting ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </div>
  );
}
