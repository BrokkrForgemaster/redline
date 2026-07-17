"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createCrew } from "@/lib/actions/crews";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

export default function NewCrewForm({ employees }: { employees: Employee[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [leaderId, setLeaderId] = useState("");

  const fieldClass =
    "block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Crew name is required");
      return;
    }
    startTransition(async () => {
      const result = await createCrew({
        name,
        description,
        leader_id: leaderId || undefined,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Crew created");
        router.push(`/crews/${result.id}`);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">
            Crew Name <span className="text-redline">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className={fieldClass}
            placeholder="e.g. Mowing Crew A"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">
            Crew Leader
          </label>
          <select
            value={leaderId}
            onChange={e => setLeaderId(e.target.value)}
            className={fieldClass}
          >
            <option value="">— No leader assigned —</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.first_name} {emp.last_name}
                {" "}({emp.role.replace(/_/g, " ")})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            className={fieldClass}
            placeholder="Optional notes about this crew"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <a
          href="/crews"
          className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-charcoal"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors disabled:opacity-60"
        >
          {isPending && <Loader2 size={14} className="animate-spin" />}
          Create Crew
        </button>
      </div>
    </form>
  );
}
