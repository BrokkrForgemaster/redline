"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { updateSnowEventStatus } from "@/lib/actions/snow-events";
import { Loader2 } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  monitoring: "Monitoring",
  preparing: "Start Preparing",
  activated: "Activate",
  in_progress: "Begin Operations",
  paused: "Pause",
  cleanup: "Begin Cleanup",
  completed: "Mark Completed",
  cancelled: "Cancel Event",
};

interface Props {
  eventId: string;
  status: string;
}

export default function SnowEventStatusUpdater({ eventId, status }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClick() {
    setLoading(true);
    const result = await updateSnowEventStatus(eventId, status);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Status updated to ${status.replace(/_/g, " ")}`);
      router.refresh();
    }
  }

  const isDanger = status === "cancelled";

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-60 text-left ${
        isDanger
          ? "border border-red-200 text-red-600 hover:bg-red-50"
          : "border border-gray-200 text-charcoal hover:bg-gray-50"
      }`}
    >
      <span>{STATUS_LABELS[status] ?? status.replace(/_/g, " ")}</span>
      {loading && <Loader2 size={13} className="animate-spin text-muted" />}
    </button>
  );
}
