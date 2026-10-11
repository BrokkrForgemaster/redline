"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  business_name: string | null;
  account_type: string;
}

interface Crew {
  id: string;
  name: string;
}

interface Props {
  customers: Customer[];
  crews: Crew[];
}

const selectClass =
  "text-sm rounded-lg border border-gray-200 px-3 py-1.5 bg-white text-charcoal focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors";

export default function JobsFilters({ customers, crews }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    router.push(`/jobs?${p.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-100">
      <select
        value={searchParams.get("customer") ?? ""}
        onChange={e => update("customer", e.target.value)}
        className={selectClass}
      >
        <option value="">All customers</option>
        {customers.map(c => (
          <option key={c.id} value={c.id}>
            {c.account_type === "business" && c.business_name
              ? `${c.business_name} (${c.first_name} ${c.last_name})`
              : `${c.first_name} ${c.last_name}`}
          </option>
        ))}
      </select>
      <select
        value={searchParams.get("crew") ?? ""}
        onChange={e => update("crew", e.target.value)}
        className={selectClass}
      >
        <option value="">All crews</option>
        {crews.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  );
}
