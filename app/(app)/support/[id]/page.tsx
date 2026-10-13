import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasMfaAssurance } from "@/lib/api/auth";
import { SupportReplyForm, SupportStatusForm } from "../SupportForms";

export const metadata = { title: "Support Request" };

export default async function SupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await sb.from("profiles").select("role, status").eq("id", user.id).single();
  if (profile?.status !== "active" || !["owner", "developer"].includes(profile.role)) redirect("/dashboard");
  if (!(await hasMfaAssurance(sb))) redirect("/mfa/challenge");

  const { data: ticket, error } = await sb.from("support_tickets")
    .select("id, creator_id, subject, category, affected_page, status, created_at")
    .eq("id", id).single();
  if (error || !ticket) notFound();
  const { data: replies, error: repliesError } = await sb.from("support_replies")
    .select("id, author_id, body, created_at").eq("ticket_id", id)
    .order("created_at", { ascending: true });
  if (repliesError) throw new Error("Support replies could not be loaded.");
  const { data: changes, error: changesError } = await sb.from("support_status_events")
    .select("id, actor_id, old_status, new_status, created_at").eq("ticket_id", id)
    .order("created_at", { ascending: true });
  if (changesError) throw new Error("Support status history could not be loaded.");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/support" className="text-sm text-redline underline">Back to support</Link>
      <div className="rounded-xl border bg-white p-5">
        <h1 className="text-2xl font-bold text-charcoal">{ticket.subject}</h1>
        <p className="mt-1 text-sm capitalize text-muted">{ticket.category.replace(/_/g, " ")} · {ticket.status.replace(/_/g, " ")}</p>
        {ticket.affected_page && <p className="mt-1 text-sm text-muted">Affected page: {ticket.affected_page}</p>}
      </div>
      <SupportStatusForm ticketId={id} currentStatus={ticket.status} />
      <section className="space-y-3" aria-label="Support thread">
        {replies?.map(reply => (
          <div key={reply.id} className="rounded-xl border bg-white p-4">
            <div className="flex justify-between text-xs text-muted">
              <span>{reply.author_id === ticket.creator_id ? "Owner" : "Developer Support"}</span>
              <time dateTime={reply.created_at}>{new Date(reply.created_at).toLocaleString()}</time>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-charcoal">{reply.body}</p>
          </div>
        ))}
      </section>
      {!!changes?.length && (
        <section className="space-y-2 rounded-xl border bg-white p-4" aria-label="Status history">
          <h2 className="font-semibold text-charcoal">Status history</h2>
          {changes.map(change => (
            <p key={change.id} className="text-xs text-muted">
              {change.actor_id === ticket.creator_id ? "Owner" : "Developer Support"}: {change.old_status.replace(/_/g, " ")} → {change.new_status.replace(/_/g, " ")} · {new Date(change.created_at).toLocaleString()}
            </p>
          ))}
        </section>
      )}
      {ticket.status !== "closed" && <SupportReplyForm ticketId={id} />}
    </div>
  );
}
