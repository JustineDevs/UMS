"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import {
  Alert,
  AlertDescription,
} from "@universal-music-store/ui";
import {
  analyticsChartsPayloadSchema,
} from "@/lib/analytics-chart";

type Props = {
  payload: unknown;
};

const AnalyticsChartsRenderer = dynamic(
  () => import("./AnalyticsChartsRenderer").then((module) => module.AnalyticsChartsRenderer),
  {
    ssr: false,
    loading: () => <ChartLoading />,
  },
);

function ChartLoading() {
  return (
    <section className="mt-10" aria-busy="true" aria-live="polite">
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <div className="h-96 animate-pulse rounded-xl bg-muted/40" />
        <div className="h-96 animate-pulse rounded-xl bg-muted/40" />
      </div>
    </section>
  );
}

export function AnalyticsChartsPanel({ payload }: Props) {
  const parsed = useMemo(
    () => analyticsChartsPayloadSchema.safeParse(payload),
    [payload],
  );

  if (!parsed.success) {
    return (
      <section className="mt-10" aria-live="polite">
        <Alert>
          <AlertDescription className="text-sm leading-relaxed text-on-surface-variant">
            Chart data is unavailable. Refresh the page. If the issue continues,
            contact support with the time it occurred.
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  return <AnalyticsChartsRenderer data={parsed.data} />;
}
