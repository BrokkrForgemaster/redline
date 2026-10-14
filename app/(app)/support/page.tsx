import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasMfaAssurance } from "@/lib/api/auth";
import { NewSupportForm } from "./SupportForms";

export const metadata = { title: "Support" };

export default async function SupportPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await sb.from("profiles").select("role, status").eq("id", user.id).single();
  if (profile?.status !== "active" || !["owner", "developer"].includes(profile.role)) redirect("/dashboard");
  if (!(await hasMfaAssurance(sb))) redirect("/mfa/challenge");
  const { data: tickets, error } = await sb.from("support_tickets")
    .select("id, subject, category, status, updated_at, creator_id")
    .order("updated_at", { ascending: false }).limit(100);
  if (error) throw new Error("Support requests could not be loaded.");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">{profile.role === "owner" ? "Developer Support" : "Support Queue"}</h1>
        <p className="mt-1 text-sm text-muted">Owner and developer support requests are private.</p>
      </div>
      {profile.role === "owner" && <NewSupportForm />}
      <section className="space-y-3">
        <h2 className="font-semibold text-charcoal">Requests</h2>
        {!tickets?.length && <p className="rounded-xl border bg-white p-6 text-sm text-muted">No support requests.</p>}
        {tickets?.map(ticket => (
          <Link key={ticket.id} href={`/support/${ticket.id}`} className="block rounded-xl border bg-white p-4 hover:border-redline">
            <div className="flex justify-between gap-3">
              <span className="font-semibold text-charcoal">{ticket.subject}</span>
              <span className="text-xs capitalize text-muted">{ticket.status.replace(/_/g, " ")}</span>
            </div>
            <p className="mt-1 text-xs text-muted">{ticket.category.replace(/_/g, " ")} · Updated {new Date(ticket.updated_at).toLocaleString()}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
