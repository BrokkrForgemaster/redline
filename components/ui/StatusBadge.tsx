import { cn } from "@/lib/utils/cn";

type Variant = "green" | "red" | "yellow" | "blue" | "gray" | "orange" | "purple";

const variants: Record<Variant, string> = {
  green: "bg-lawn/10 text-lawn",
  red: "bg-redline/10 text-redline",
  yellow: "bg-yellow-100 text-yellow-700",
  blue: "bg-blue-100 text-blue-700",
  gray: "bg-gray-100 text-gray-600",
  orange: "bg-orange-100 text-orange-700",
  purple: "bg-purple-100 text-purple-700",
};

interface Props {
  label: string;
  variant?: Variant;
  className?: string;
}

export default function StatusBadge({ label, variant = "gray", className }: Props) {
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
      variants[variant],
      className
    )}>
      {label}
    </span>
  );
}

export function estimateStatusBadge(status: string): { label: string; variant: Variant } {
  const map: Record<string, { label: string; variant: Variant }> = {
    draft: { label: "Draft", variant: "gray" },
    ready_for_review: { label: "Ready", variant: "blue" },
    sent: { label: "Sent", variant: "blue" },
    viewed: { label: "Viewed", variant: "purple" },
    approved: { label: "Approved", variant: "green" },
    declined: { label: "Declined", variant: "red" },
    expired: { label: "Expired", variant: "orange" },
    converted: { label: "Converted", variant: "green" },
    voided: { label: "Voided", variant: "gray" },
    changes_requested: { label: "Changes Requested", variant: "yellow" },
  };
  return map[status] ?? { label: status, variant: "gray" };
}

export function jobStatusBadge(status: string): { label: string; variant: Variant } {
  const map: Record<string, { label: string; variant: Variant }> = {
    scheduled: { label: "Scheduled", variant: "blue" },
    en_route: { label: "En Route", variant: "orange" },
    arrived: { label: "Arrived", variant: "yellow" },
    in_progress: { label: "In Progress", variant: "green" },
    completed: { label: "Completed", variant: "green" },
    cancelled: { label: "Cancelled", variant: "gray" },
    weather_delayed: { label: "Weather Delay", variant: "blue" },
    quality_review: { label: "QC Review", variant: "purple" },
    paused: { label: "Paused", variant: "yellow" },
  };
  return map[status] ?? { label: status.replace(/_/g, " "), variant: "gray" };
}

export function invoiceStatusBadge(status: string): { label: string; variant: Variant } {
  const map: Record<string, { label: string; variant: Variant }> = {
    draft: { label: "Draft", variant: "gray" },
    issued: { label: "Issued", variant: "blue" },
    sent: { label: "Sent", variant: "blue" },
    viewed: { label: "Viewed", variant: "purple" },
    partially_paid: { label: "Partial", variant: "yellow" },
    paid: { label: "Paid", variant: "green" },
    overdue: { label: "Overdue", variant: "red" },
    voided: { label: "Voided", variant: "gray" },
  };
  return map[status] ?? { label: status, variant: "gray" };
}
