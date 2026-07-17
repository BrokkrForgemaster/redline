"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { updateJobStatus } from "@/lib/actions/jobs";
import { Loader2 } from "lucide-react";
import { jobStatusBadge } from "@/components/ui/StatusBadge";

interface Props {
  jobId: string;
  status: string;
}

export default function JobStatusUpdater({ jobId, status }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const badge = jobStatusBadge(status);

  async function handleClick() {
    setLoading(true);
    const result = await updateJobStatus(jobId, status);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Status updated to ${badge.label}`);
      router.refresh();
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60 text-left"
    >
      <span className="text-charcoal">{badge.label}</span>
      {loading && <Loader2 size={13} className="animate-spin text-muted" />}
    </button>
  );
}
