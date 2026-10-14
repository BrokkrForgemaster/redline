import { redirect } from "next/navigation";

export default async function InviteEmployeePage() {
  redirect("/employees/new");
}
