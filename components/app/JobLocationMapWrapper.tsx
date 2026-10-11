"use client";

import dynamic from "next/dynamic";
import type { LocationTag } from "./JobLocationMap";

const JobLocationMap = dynamic(() => import("./JobLocationMap"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-gray-100 animate-pulse rounded-b-xl" />,
});

export default function JobLocationMapWrapper({ tags }: { tags: LocationTag[] }) {
  return <JobLocationMap tags={tags} />;
}
