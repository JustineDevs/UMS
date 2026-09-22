import { fetchWorkerReconciliationForAdmin } from "@/lib/worker-admin-bridge";

export type ReconciliationSummary = {
  period: string;
  rows: Array<{
    date: string;
    provider: string;
    medusaOrderCount: number;
    medusaTotalMinor: number;
    providerConfirmedCount: number;
    providerConfirmedMinor: number;
    openAttemptCount: number;
    problemAttemptCount: number;
    discrepancyMinor: number;
    status: "matched" | "discrepancy" | "pending";
  }>;
  totalMedusaMinor: number;
  totalProviderConfirmedMinor: number;
  totalDiscrepancyMinor: number;
  paymentAttemptsStaleFinalize: number;
  paymentAttemptsNeedsReview: number;
  recentProblemAttempts: Array<{ correlationId: string; provider: string; status: string; checkoutState: string; staleReason: string | null; updatedAt: string }>;
  providerReconciliationArtifacts: unknown[];
  providerSettlementRecords: unknown[];
};

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url); const params = new URLSearchParams();
  for (const name of ["days", "provider"]) { const value = url.searchParams.get(name)?.trim(); if (value) params.set(name, value); }
  return await fetchWorkerReconciliationForAdmin(params.toString() ? `?${params}` : "") ?? new Response(JSON.stringify({ error: "Worker backend is unavailable" }), { status: 503, headers: { "Content-Type": "application/json" } });
}
