import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import CrewDetailClient from "./CrewDetailClient";

export const metadata = { title: "Crew" };

export default async function CrewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: crew } = await sb
    .from("crews")
    .select("id, name, description, active, leader_id, created_at")
    .eq("id", id)
    .single();

  if (!crew) notFound();

  const { data: members } = await sb
    .from("crew_members")
    .select("employee_id, role, joined_at, profiles(id, first_name, last_name, role, avatar_url)")
    .eq("crew_id", id)
    .order("joined_at");

  const { data: allEmployees } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, role")
    .eq("status", "active")
    .neq("role", "customer")
    .order("last_name");

  const memberIds = ((members ?? []) as { employee_id: string }[]).map(m => m.employee_id);
  const nonMembers = (allEmployees ?? []).filter(e => !memberIds.includes(e.id));

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/crews" className="text-muted hover:text-charcoal transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-charcoal">{crew.name}</h1>
          {crew.description && (
            <p className="text-sm text-muted mt-0.5">{crew.description}</p>
          )}
        </div>
      </div>

      <CrewDetailClient
        crew={crew}
        members={members ?? []}
        nonMembers={nonMembers ?? []}
      />
    </div>
  );
}
