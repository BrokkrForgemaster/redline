"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { provisionStaffSchema, type ProvisionStaffInput } from "@/lib/validations/auth";

const roles = [
  { value: "mowing_crew_lead", label: "Mowing Crew Lead" },
  { value: "mowing_crew_laborer", label: "Mowing Crew Laborer" },
  { value: "snow_plow_operator", label: "Snow Plow Operator" },
  { value: "subcontractor", label: "Subcontractor" },
] as const;

export default function StaffAccountForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<ProvisionStaffInput>({ resolver: zodResolver(provisionStaffSchema) });

  async function submit(input: ProvisionStaffInput) {
    setMessage(null);
    const response = await fetch("/api/auth/staff-accounts", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setMessage(result.error ?? "Account could not be created.");
      return;
    }
    setCreated(true);
  }

  if (created) return <div className="space-y-3 rounded border bg-white p-5">
    <p role="status">Account created. Give the initial password directly to the intended worker after verifying their identity. They must set up an authenticator and change the password before work access.</p>
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
    <label className="block text-sm">Initial password
      <input type="password" autoComplete="new-password" {...register("initialPassword")}
        className="mt-1 block w-full rounded border p-3" />
      {errors.initialPassword && <span role="alert" className="text-red-700">{errors.initialPassword.message}</span>}
    </label>
    <p className="text-sm text-muted">Give the password to the worker in person or by a verified phone call. It is not emailed or displayed again.</p>
    {message && <p role="alert" className="text-red-700">{message}</p>}
    <button disabled={isSubmitting} className="rounded bg-redline px-4 py-3 font-semibold text-white disabled:opacity-50">
      {isSubmitting ? "Saving…" : "Create staff account"}
    </button>
  </form>;
}
