import { redirect } from "next/navigation";
import { requireStaffUser } from "@/lib/api/auth";

export default async function JobsLayout({ children }: { children: React.ReactNode }) {
  const access = await requireStaffUser("reviewer");
  if (!access.ok) redirect("/dashboard");
  return children;
}
