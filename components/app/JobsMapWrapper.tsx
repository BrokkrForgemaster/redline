"use client";

import dynamic from "next/dynamic";
import type { JobMapMarker } from "./JobsMap";

const JobsMap = dynamic(() => import("./JobsMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[420px] rounded-b-xl bg-gray-100 animate-pulse" />
  ),
});

export default function JobsMapWrapper({ jobs }: { jobs: JobMapMarker[] }) {
  return <JobsMap jobs={jobs} />;
}
