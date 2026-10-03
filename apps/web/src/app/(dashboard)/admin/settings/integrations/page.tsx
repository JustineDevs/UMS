"use client";

import useSWR from "swr";
import PancakeIntegrationCard from "./PancakeIntegrationCard";
import type { IntegrationHealthEntry } from "@/app/api/admin/integration-health/route";
import { Button } from "@/components/ui/button";
import { AdminPageShell } from "@/components/admin-console";

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

function IntegrationHealthSkeleton() {
  return (
    <div aria-label="Loading integration health" aria-live="polite" className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-lg border bg-muted/40" />)}
      </div>
      <div className="overflow-hidden rounded-lg border bg-white p-4">
        <div className="min-w-[680px] animate-pulse space-y-4">
          <div className="grid grid-cols-6 gap-4 border-b pb-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-3 rounded bg-muted" />)}</div>
          {Array.from({ length: 4 }, (_, row) => <div key={row} className="grid grid-cols-6 gap-4 border-b py-5 last:border-0">{Array.from({ length: 6 }, (_, column) => <div key={column} className="h-4 rounded bg-muted/70" />)}</div>)}
        </div>
      </div>
    </div>
  );
}

export default function IntegrationHealthPage() {
  const { data, error, isLoading, mutate } = useSWR<{ entries: IntegrationHealthEntry[] }>(
    "/api/admin/integration-health",
    async (url: string) => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 8_000);
      let res: Response;
      try {
        res = await fetch(url, { credentials: "include", signal: controller.signal });
      } catch {
        throw new Error("Integration health is temporarily unavailable. Try again shortly.");
      } finally {
        window.clearTimeout(timeout);
      }
      if (!res.ok) throw new Error("Integration health is temporarily unavailable. Try again shortly.");
      const body = await res.json().catch(() => null) as { message?: string; entries?: unknown } | null;
      if (!body || !Array.isArray(body.entries)) throw new Error("Integration health returned an invalid response.");
      return body as { entries: IntegrationHealthEntry[] };
    },
    { revalidateOnFocus: false },
  );
  const entries = data?.entries ?? [];

  const healthyCount = entries.filter((e) => e.status === "healthy").length;
  const degradedCount = entries.filter((e) => e.status === "degraded").length;
  const downCount = entries.filter((e) => e.status === "down").length;
  const operationalCount = entries.filter((e) => e.status === "healthy").length;

  return (
    <AdminPageShell
      title="Integration health"
      subtitle="Verify operational status, partner callbacks, configuration, and the last health check."
    >
      <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">System connections</p>
          <p className="text-xs text-muted-foreground">Payment, shipping, POS, and callback health in one view.</p>
        </div>
        {!isLoading && !error ? (
          <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-800">
            {operationalCount} / {entries.length} connections operational
          </span>
        ) : null}
      </div>

      {isLoading ? <IntegrationHealthSkeleton /> : null}

      {!isLoading && !error ? <PancakeIntegrationCard /> : null}

      {!isLoading && !error ? <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => void mutate()}
          disabled={isLoading}
          className="rounded border border-outline-variant/30 px-3 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container-low disabled:opacity-50"
        >
          {isLoading ? "Checking…" : "Check again"}
        </Button>
      </div> : null}

      {error ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-red-600" role="alert">
            {error instanceof Error ? error.message : "Failed to load"}
          </p>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => void mutate()}
          >
            Check again
          </Button>
        </div>
      ) : !isLoading ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                            {new Date(entry.lastWebhookAt).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}
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
      ) : null}
      </div>
    </AdminPageShell>
  );
}
