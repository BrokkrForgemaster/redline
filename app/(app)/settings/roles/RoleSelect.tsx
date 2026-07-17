"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateProfileRole } from "@/lib/actions/settings";
import { Loader2 } from "lucide-react";

const ROLES = [
  "administrator",
  "operations_manager",
  "office_manager",
  "estimator",
  "crew_leader",
  "crew_member",
  "snow_operations_manager",
  "inventory_manager",
  "bookkeeper",
  "read_only",
];

interface Props {
  profileId: string;
  currentRole: string;
  roleLabels: Record<string, string>;
}

export default function RoleSelect({ profileId, currentRole, roleLabels }: Props) {
  const [role, setRole] = useState(currentRole);
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value;
    const previousRole = role;
    setRole(newRole);

    startTransition(async () => {
      const result = await updateProfileRole(profileId, newRole);
      if (result.error) {
        toast.error(result.error);
        setRole(previousRole);
      } else {
        toast.success("Role updated");
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={role}
        onChange={handleChange}
        disabled={isPending}
        className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-charcoal focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors disabled:opacity-60"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {roleLabels[r] ?? r}
          </option>
        ))}
      </select>
      {isPending && <Loader2 size={14} className="animate-spin text-muted" />}
    </div>
  );
}
