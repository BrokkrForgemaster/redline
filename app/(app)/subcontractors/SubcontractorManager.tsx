"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addSubcontractorToCompany, createSubcontractorCompany } from "@/lib/actions/subcontractors";

type Company = { id: string; name: string; status: string };
type Membership = { subcontractor_company_id: string; user_id: string; role: string; active: boolean };
type Person = { id: string; first_name: string; last_name: string; status: string; role: string };

export default function SubcontractorManager({ companies, memberships, people }: {
  companies: Company[]; memberships: Membership[]; people: Person[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [roles, setRoles] = useState<Record<string, "owner" | "manager" | "member">>({});
  const [message, setMessage] = useState("");
  function create(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    start(async () => {
      const result = await createSubcontractorCompany(name);
      if (result.error) setMessage(result.error);
      else { setName(""); setMessage("Company saved."); router.refresh(); }
    });
  }
  function add(event: React.FormEvent, companyId: string) {
    event.preventDefault();
    setMessage("");
    start(async () => {
      const result = await addSubcontractorToCompany(companyId, selected[companyId] ?? "",
        roles[companyId] ?? "manager");
      if (result.error) setMessage(result.error);
      else { setSelected(prev => ({ ...prev, [companyId]: "" })); setMessage("Member saved."); router.refresh(); }
    });
  }
  return <main className="space-y-6">
    <div className="flex items-start justify-between gap-4">
      <div><h1 className="text-2xl font-bold">Subcontractors</h1>
        <p className="text-sm text-muted">Create a company, attach an active Subcontractor account, then create its crew.</p></div>
      <Link href="/employees/invite" className="text-redline underline">Invite account</Link>
    </div>
    {message && <p role="status" className="rounded border p-3">{message}</p>}
    <form onSubmit={create} className="rounded border bg-white p-5 space-y-3">
      <label className="block text-sm font-medium" htmlFor="company-name">Company name</label>
      <input id="company-name" value={name} onChange={e => setName(e.target.value)}
        maxLength={120} required className="w-full rounded border p-3" />
      <button disabled={pending || !name.trim()} className="rounded bg-redline px-4 py-3 text-white disabled:opacity-50">Add company</button>
    </form>
    {companies.map(company => {
      const memberIds = new Set(memberships.filter(m => m.subcontractor_company_id === company.id).map(m => m.user_id));
      const available = people.filter(person => !memberIds.has(person.id));
      return <section key={company.id} className="rounded border bg-white p-5 space-y-3">
        <h2 className="font-semibold">{company.name} <span className="text-xs text-muted">({company.status})</span></h2>
        <p className="text-sm text-muted">{people.filter(person => memberIds.has(person.id))
          .map(person => `${person.first_name} ${person.last_name} (${memberships.find(m => m.subcontractor_company_id === company.id && m.user_id === person.id)?.role ?? "member"})`)
          .join(", ") || "No active members"}</p>
        {company.status === "active" && available.length > 0 && <form onSubmit={e => add(e, company.id)} className="flex flex-wrap gap-2">
          <select value={selected[company.id] ?? ""} onChange={e => setSelected(prev => ({ ...prev, [company.id]: e.target.value }))}
            aria-label={`Add member to ${company.name}`} className="min-w-48 flex-1 rounded border p-3" required>
            <option value="">Select active Subcontractor account</option>
            {available.map(person => <option key={person.id} value={person.id}>{person.first_name} {person.last_name}</option>)}
          </select>
          <select value={roles[company.id] ?? "manager"}
            onChange={e => setRoles(prev => ({ ...prev, [company.id]: e.target.value as "owner" | "manager" | "member" }))}
            aria-label={`Company role for ${company.name}`} className="rounded border p-3">
            <option value="manager">Manager</option>
            <option value="owner">Company owner</option>
            <option value="member">Member</option>
          </select>
          <button disabled={pending || !selected[company.id]} className="rounded bg-redline px-4 py-3 text-white disabled:opacity-50">Add member</button>
        </form>}
      </section>;
    })}
  </main>;
}
