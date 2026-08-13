"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function AnalyticsPeriodSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get("period") ?? "30";

  return (
    <select
      aria-label="Analytics period"
      className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
      value={value}
      onChange={(event) => {
        const next = new URLSearchParams(searchParams.toString());
        next.set("period", event.target.value);
        router.push(`${pathname}?${next.toString()}`);
      }}
    >
      <option value="30">Last 30 days</option>
      <option value="90">Last 90 days</option>
      <option value="365">Year to date</option>
    </select>
  );
}
