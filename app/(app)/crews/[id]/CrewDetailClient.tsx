"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, X, Star, Loader2, Save } from "lucide-react";
import { addCrewMember, removeCrewMember, updateCrew, deactivateCrew } from "@/lib/actions/crews";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface Member {
  employee_id: string;
  role: string;
  joined_at: string;
  profiles: { id: string; first_name: string; last_name: string; role: string } | null;
}

interface Crew {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  leader_id: string | null;
}

interface Props {
  crew: Crew;
  members: Member[];
  nonMembers: Employee[];
}

const fieldClass =
  "block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors";

export default function CrewDetailClient({ crew, members, nonMembers }: Props) {
  const router = useRouter();
  const [isSaving, startSave] = useTransition();
  const [isAdding, startAdd] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isDeactivating, startDeactivate] = useTransition();

  const [name, setName] = useState(crew.name);
  const [description, setDescription] = useState(crew.description ?? "");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"member" | "leader">("member");

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Name is required"); return; }
    startSave(async () => {
      const result = await updateCrew(crew.id, { name, description });
      if (result.error) toast.error(result.error);
      else { toast.success("Crew updated"); router.refresh(); }
    });
  }

  function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEmployeeId) { toast.error("Select an employee"); return; }
    startAdd(async () => {
      const result = await addCrewMember(crew.id, selectedEmployeeId, selectedRole);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Member added");
        setSelectedEmployeeId("");
        setSelectedRole("member");
        router.refresh();
      }
    });
  }

  async function handleRemove(employeeId: string) {
    setRemovingId(employeeId);
    const result = await removeCrewMember(crew.id, employeeId);
    setRemovingId(null);
    if (result.error) toast.error(result.error);
    else { toast.success("Member removed"); router.refresh(); }
  }

  function handleDeactivate() {
    if (!confirm("Deactivate this crew? It will no longer appear in scheduling.")) return;
    startDeactivate(async () => {
      const result = await deactivateCrew(crew.id);
      if (result.error) toast.error(result.error);
      else { toast.success("Crew deactivated"); router.push("/crews"); }
    });
  }

  return (
    <div className="space-y-5">
      {/* Edit crew details */}
      <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-charcoal">Crew Details</h2>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">
            Name <span className="text-redline">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className={fieldClass}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className={fieldClass}
            placeholder="Optional notes"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 bg-charcoal text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-charcoal/90 transition-colors disabled:opacity-60"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </button>
        </div>
      </form>

      {/* Members list */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-charcoal">
          Members
          <span className="ml-2 text-sm font-normal text-muted">({members.length})</span>
        </h2>

        {members.length === 0 ? (
          <p className="text-sm text-muted py-2">No members yet. Add employees below.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {members.map(m => {
              const p = m.profiles;
              if (!p) return null;
              const isLeader = m.role === "leader";
              const isRemoving = removingId === m.employee_id;
              return (
                <li key={m.employee_id} className="flex items-center justify-between py-3 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-redline/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-redline">
                      {p.first_name[0]}{p.last_name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-charcoal truncate">
                        {p.first_name} {p.last_name}
                        {isLeader && (
                          <Star size={12} className="inline ml-1 text-yellow-500 fill-yellow-400" />
                        )}
                      </p>
                      <p className="text-xs text-muted capitalize">
                        {p.role.replace(/_/g, " ")} · {isLeader ? "Leader" : "Member"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(m.employee_id)}
                    disabled={isRemoving}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                    title="Remove from crew"
                  >
                    {isRemoving ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Add member */}
        {nonMembers.length > 0 && (
          <form onSubmit={handleAddMember} className="flex gap-2 pt-2 border-t border-gray-100 flex-wrap">
            <select
              value={selectedEmployeeId}
              onChange={e => setSelectedEmployeeId(e.target.value)}
              className="flex-1 min-w-0 rounded-lg border border-border bg-white px-3 py-2 text-sm text-charcoal focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            >
              <option value="">Add an employee…</option>
              {nonMembers.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name}
                </option>
              ))}
            </select>
            <select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value as "member" | "leader")}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-charcoal focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            >
              <option value="member">Member</option>
              <option value="leader">Leader</option>
            </select>
            <button
              type="submit"
              disabled={isAdding || !selectedEmployeeId}
              className="flex items-center gap-1.5 bg-redline text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-redline-dark transition-colors disabled:opacity-50"
            >
              {isAdding ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              Add
            </button>
          </form>
        )}
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-xl border border-red-100 p-5">
        <h2 className="font-semibold text-charcoal mb-1">Danger Zone</h2>
        <p className="text-sm text-muted mb-3">
          Deactivating this crew removes it from scheduling. Members and history are preserved.
        </p>
        <button
          onClick={handleDeactivate}
          disabled={isDeactivating || !crew.active}
          className="text-sm font-medium text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          {isDeactivating ? "Deactivating…" : crew.active ? "Deactivate Crew" : "Already Inactive"}
        </button>
      </div>
    </div>
  );
}
