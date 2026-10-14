import { redirect } from "next/navigation";
import { requireStaffUser } from "@/lib/api/auth";

export default async function LeadsLayout({ children }: { children: React.ReactNode }) {
  const access = await requireStaffUser("reviewer");
  if (!access.ok) redirect("/dashboard");
  return children;
}
