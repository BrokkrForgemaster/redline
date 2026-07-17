"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { updateLeadStatus } from "@/lib/actions/leads";
import { Loader2 } from "lucide-react";

interface Props {
  leadId: string;
  status: string;
  label: string;
  variant?: "primary" | "secondary" | "danger";
}

export default function LeadStatusUpdater({ leadId, status, label, variant = "secondary" }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClick() {
    setLoading(true);
    const result = await updateLeadStatus(leadId, status);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Status updated to ${status.replace(/_/g, " ")}`);
      router.refresh();
    }
  }

  const baseClass = "inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60";
  const variantClass =
    variant === "primary"
      ? "bg-redline text-white hover:bg-redline-dark"
      : variant === "danger"
      ? "bg-red-100 text-red-700 hover:bg-red-200"
      : "border border-gray-200 hover:bg-gray-50 text-charcoal";

  return (
    <button onClick={handleClick} disabled={loading} className={`${baseClass} ${variantClass}`}>
      {loading && <Loader2 size={13} className="animate-spin" />}
      {label}
    </button>
  );
}
