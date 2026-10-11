import NotificationsClient from "./NotificationsClient";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return <NotificationsClient defaultEmail={user?.email ?? ""} />;
}
