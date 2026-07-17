import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import SnowEventForm from "./SnowEventForm";

export const metadata: Metadata = { title: "New Snow Event" };

export default function NewSnowEventPage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/snow-events" className="text-sm text-muted hover:text-charcoal">Snow Events</Link>
          <ChevronRight size={14} className="text-muted" />
          <span className="text-sm text-charcoal font-medium">New Event</span>
        </div>
        <h1 className="text-2xl font-bold text-charcoal">New Snow Event</h1>
        <p className="text-sm text-muted mt-1">Create a snow event to coordinate routes and crews.</p>
      </div>
      <SnowEventForm />
    </div>
  );
}
