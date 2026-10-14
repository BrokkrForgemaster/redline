import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireStaffUser } from "@/lib/api/auth";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireStaffUser("reviewer");
  if (!access.ok) redirect("/dashboard");
  const { id } = await params;
  const { data: person, error } = await access.supabase.from("profiles")
    .select("id,email,first_name,last_name,phone,role,status,last_sign_in_at")
    .eq("id", id).single();
  if (error || !person) notFound();
  return <main className="max-w-2xl space-y-5">
    <Link href="/employees" className="text-sm text-redline underline">Employees</Link>
    <h1 className="text-2xl font-bold">{person.first_name} {person.last_name}</h1>
    <dl className="grid gap-3 rounded border bg-white p-5 text-sm sm:grid-cols-2">
      <div><dt className="text-muted">Email</dt><dd>{person.email}</dd></div>
      <div><dt className="text-muted">Status</dt><dd className="capitalize">{person.status}</dd></div>
      <div><dt className="text-muted">Role</dt><dd className="capitalize">{String(person.role).replaceAll("_", " ")}</dd></div>
      <div><dt className="text-muted">Phone</dt><dd>{person.phone || "Not provided"}</dd></div>
      <div><dt className="text-muted">Last sign-in</dt><dd>{person.last_sign_in_at
        ? new Date(person.last_sign_in_at).toLocaleString() : "No sign-in recorded"}</dd></div>
    </dl>
  </main>;
}
