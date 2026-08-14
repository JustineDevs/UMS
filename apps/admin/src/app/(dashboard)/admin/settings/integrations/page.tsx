"use client";

import useSWR from "swr";
import PancakeIntegrationCard from "./PancakeIntegrationCard";
import type { IntegrationHealthEntry } from "@/app/api/admin/integration-health/route";

const STATUS_STYLES: Record<IntegrationHealthEntry["status"], { bg: string; text: string; label: string }> = {
  healthy: { bg: "bg-green-50", text: "text-green-800", label: "Healthy" },
  degraded: { bg: "bg-amber-50", text: "text-amber-800", label: "Degraded" },
  down: { bg: "bg-red-50", text: "text-red-800", label: "Down" },
  unconfigured: { bg: "bg-neutral-100", text: "text-neutral-500", label: "Unconfigured" },
};

const WEBHOOK_STYLES: Record<IntegrationHealthEntry["webhookStatus"], string> = {
  healthy: "text-green-700",
  failing: "text-red-700",
  unknown: "text-neutral-400",
};

function callbackStatusLabel(status: IntegrationHealthEntry["webhookStatus"]): string {
  if (status === "healthy") return "OK";
  if (status === "failing") return "Issue";
  return "Unknown";
}

export default function IntegrationHealthPage() {
  const { data, error, isLoading, mutate } = useSWR<{ entries: IntegrationHealthEntry[] }>(
    "/api/admin/integration-health",
    async (url: string) => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as { entries: IntegrationHealthEntry[] };
    },
    { revalidateOnFocus: false },
  );
  const entries = data?.entries ?? [];

  const healthyCount = entries.filter((e) => e.status === "healthy").length;
  const degradedCount = entries.filter((e) => e.status === "degraded").length;
  const downCount = entries.filter((e) => e.status === "down").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integration Health</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Status of payment and shipping connections: software versions, partner callbacks, configuration, and
          notes from the last check.
        </p>
      </div>

      <PancakeIntegrationCard />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void mutate()}
          disabled={isLoading}
          className="rounded border border-outline-variant/30 px-3 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container-low disabled:opacity-50"
        >
          {isLoading ? "Checking…" : "Check again"}
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-neutral-400 py-12 text-center">Loading…</p>
      ) : error ? (
        <p className="py-12 text-center text-sm text-red-600" role="alert">
          {error instanceof Error ? error.message : "Failed to load"}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border p-4">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Healthy</p>
              <p className="text-3xl font-bold text-green-700 mt-1">{healthyCount}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Degraded</p>
              <p className="text-3xl font-bold text-amber-700 mt-1">{degradedCount}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Down</p>
              <p className="text-3xl font-bold text-red-700 mt-1">{downCount}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-neutral-50">
                  <th className="text-left px-4 py-3 font-medium text-neutral-600">Provider</th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-600">Library</th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-600">Callbacks</th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-600">Config</th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-600">Note</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const s = STATUS_STYLES[entry.status];
                  return (
                    <tr key={entry.provider} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium capitalize">{entry.provider}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-600 text-xs font-mono">
                        {entry.sdkVersion ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${WEBHOOK_STYLES[entry.webhookStatus]}`}>
                          {callbackStatusLabel(entry.webhookStatus)}
                        </span>
                        {entry.lastWebhookAt && (
                          <span className="block text-[10px] text-neutral-400 mt-0.5">
                            {new Date(entry.lastWebhookAt).toLocaleDateString()}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={entry.envPresent ? "text-green-700" : "text-neutral-400"}>
                          {entry.envPresent ? "Set" : "Not set"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-500 max-w-[200px] truncate">
                        {entry.note}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
