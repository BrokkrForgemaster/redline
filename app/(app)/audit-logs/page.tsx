import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils/format";
import type { AuditLog } from "@/types/database";
import { Shield } from "lucide-react";

export const metadata = { title: "Audit Logs" };

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entity?: string; page?: string }>;
}) {
  const { action, entity, page = "1" } = await searchParams;
  const supabase = await createClient();
  const offset = (parseInt(page) - 1) * 50;

  let query = supabase
    .from("audit_logs")
    .select("id, actor_email, action, entity_type, entity_id, created_at, metadata", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + 49);

  if (action) query = query.eq("action", action);
  if (entity) query = query.eq("entity_type", entity);

  const { data: logs, count } = await query as { data: Pick<AuditLog, "id" | "actor_email" | "action" | "entity_type" | "entity_id" | "created_at" | "metadata">[] | null; count: number | null; error: unknown };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Audit Logs</h1>
        <p className="text-sm text-muted mt-1">Read-only record of all important business actions.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {(!logs || logs.length === 0) ? (
          <div className="py-16 text-center">
            <Shield size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-charcoal">No audit records found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase">Time</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase">Actor</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase">Action</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase hidden md:table-cell">Entity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-muted whitespace-nowrap">{formatDate(log.created_at, "MMM d, h:mm a")}</td>
                  <td className="px-5 py-3 text-charcoal">{log.actor_email ?? "System"}</td>
                  <td className="px-5 py-3">
                    <span className="font-medium text-charcoal capitalize">{log.action.replace(/_/g, " ")}</span>
                  </td>
                  <td className="px-5 py-3 text-muted hidden md:table-cell">
                    <span className="capitalize">{log.entity_type.replace(/_/g, " ")}</span>
                    {log.entity_id && <span className="text-xs block">{log.entity_id}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {count && count > 50 && (
          <div className="border-t border-gray-100 px-5 py-4 flex justify-between text-sm text-muted">
            <span>Showing {offset + 1}–{Math.min(offset + 50, count)} of {count}</span>
            <div className="flex gap-2">
              {parseInt(page) > 1 && (
                <a href={`/audit-logs?page=${parseInt(page) - 1}`} className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50">Previous</a>
              )}
              {offset + 50 < count && (
                <a href={`/audit-logs?page=${parseInt(page) + 1}`} className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50">Next</a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
