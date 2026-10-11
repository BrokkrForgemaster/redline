import { redirect } from "next/navigation";

export default function SubcontractorLoginShortcut() {
  redirect("/login?mode=subcontractor&next=/my-jobs");
}
