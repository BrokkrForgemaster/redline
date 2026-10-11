import { redirect } from "next/navigation";

export default function FieldLoginShortcut() {
  redirect("/login?mode=subcontractor&next=/my-jobs");
}
