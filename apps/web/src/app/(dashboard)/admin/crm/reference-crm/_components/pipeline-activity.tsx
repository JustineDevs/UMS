"use client";

import dynamic from "next/dynamic";

const PipelineActivityRenderer = dynamic(
  () => import("./pipeline-activity-renderer").then((module) => module.PipelineActivityRenderer),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 w-full animate-pulse rounded-lg bg-muted motion-reduce:animate-none" aria-label="Loading pipeline activity" />
    ),
  },
);

export function PipelineActivity(props: { monthlyQualified: number[]; discoveryCallsBooked: number }) {
  return <PipelineActivityRenderer {...props} />;
}
