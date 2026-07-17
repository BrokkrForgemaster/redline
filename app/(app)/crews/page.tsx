import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Users2 } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/utils/format";

export const metadata = { title: "Crews" };

export default async function CrewsPage() {
  const supabase = await createClient();

  type CrewRow = {
    id: string; name: string; description: string | null; active: boolean; created_at: string;
    profiles: { first_name: string; last_name: string } | null;
  };
  const { data: crews } = await supabase
    .from("crews")
    .select("id, name, description, active, created_at, profiles(first_name, last_name)")
    .eq("active", true)
    .order("name") as { data: CrewRow[] | null };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Crews</h1>
          <p className="text-sm text-muted">{crews?.length ?? 0} active crews</p>
        </div>
        <Link
          href="/crews/new"
          className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors"
        >
          <Plus size={16} />
          New Crew
        </Link>
      </div>

      {!crews || crews.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <Users2 size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="font-medium text-charcoal">No crews yet</p>
          <p className="text-sm text-muted mt-1">
            Create your first crew to start scheduling work
          </p>
          <Link
            href="/crews/new"
            className="mt-4 inline-block text-sm text-redline hover:underline"
          >
            Create Crew
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {crews.map((crew) => {
            const leader = crew.profiles as {
              first_name: string;
              last_name: string;
            } | null;

            return (
              <Link
                key={crew.id}
                href={`/crews/${crew.id}`}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:border-redline/40 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h2 className="font-semibold text-charcoal text-base leading-tight">
                    {crew.name}
                  </h2>
                  <StatusBadge
                    label={crew.active ? "Active" : "Inactive"}
                    variant={crew.active ? "green" : "gray"}
                  />
                </div>

                {leader && (
                  <p className="text-sm text-muted mb-2">
                    <span className="font-medium text-charcoal">Leader:</span>{" "}
                    {leader.first_name} {leader.last_name}
                  </p>
                )}

                {crew.description && (
                  <p className="text-sm text-muted line-clamp-2 mb-3">
                    {crew.description}
                  </p>
                )}

                <p className="text-xs text-muted mt-auto">
                  Created {formatDate(crew.created_at)}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
