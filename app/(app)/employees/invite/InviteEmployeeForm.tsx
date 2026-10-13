"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { inviteEmployeeSchema, type InviteEmployeeInput } from "@/lib/validations/auth";

const roles = [
  { value: "mowing_crew_lead", label: "Mowing Crew Lead" },
  { value: "mowing_crew_laborer", label: "Mowing Crew Laborer" },
  { value: "snow_plow_operator", label: "Snow Plow Operator" },
  { value: "subcontractor", label: "Subcontractor" },
] as const;

export default function InviteEmployeeForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<InviteEmployeeInput>({ resolver: zodResolver(inviteEmployeeSchema) });

  async function submit(input: InviteEmployeeInput) {
    setMessage(null);
    const response = await fetch("/api/auth/invitations", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setMessage(result.error ?? "Invitation could not be sent.");
      return;
    }
    setSent(true);
  }

  if (sent) return <div className="space-y-3 rounded border bg-white p-5">
    <p role="status">The invitation is pending. The worker must verify email and MFA before access.</p>
    <Link href="/employees" className="text-redline underline">Return to employees</Link>
  </div>;

  return <form onSubmit={handleSubmit(submit)} className="space-y-4 rounded border bg-white p-5">
    <label className="block text-sm">First name
      <input {...register("firstName")} className="mt-1 block w-full rounded border p-3" />
      {errors.firstName && <span role="alert" className="text-red-700">{errors.firstName.message}</span>}
    </label>
    <label className="block text-sm">Last name
      <input {...register("lastName")} className="mt-1 block w-full rounded border p-3" />
      {errors.lastName && <span role="alert" className="text-red-700">{errors.lastName.message}</span>}
    </label>
    <label className="block text-sm">Email
      <input type="email" autoComplete="email" {...register("email")}
        className="mt-1 block w-full rounded border p-3" />
      {errors.email && <span role="alert" className="text-red-700">{errors.email.message}</span>}
    </label>
    <label className="block text-sm">Staff role
      <select {...register("role")} className="mt-1 block w-full rounded border p-3" defaultValue="">
        <option value="" disabled>Choose role</option>
        {roles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
      </select>
      {errors.role && <span role="alert" className="text-red-700">{errors.role.message}</span>}
    </label>
    {message && <p role="alert" className="text-red-700">{message}</p>}
    <button disabled={isSubmitting} className="rounded bg-redline px-4 py-3 font-semibold text-white disabled:opacity-50">
      {isSubmitting ? "Saving…" : "Send invitation"}
    </button>
  </form>;
}
