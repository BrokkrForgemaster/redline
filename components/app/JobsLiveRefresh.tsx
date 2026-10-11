"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function JobsLiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-jobs-live-refresh")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs" },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "time_entries" },
        () => router.refresh()
      )
      .subscribe();

    const interval = window.setInterval(() => router.refresh(), 15000);

    return () => {
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
