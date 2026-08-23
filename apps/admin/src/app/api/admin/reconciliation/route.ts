import { NextResponse } from "next/server";
import {
  getPaymentPlatformMetrics,
  listPaymentProviderArtifacts,
  listRecentPaymentAttempts,
  type PaymentAttemptRow,
} from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { parseReconciliationQuery } from "@/lib/reconciliation-params";

export type ReconciliationRow = {
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
};

export type ReconciliationSummary = {
  period: string;
  rows: ReconciliationRow[];
  totalMedusaMinor: number;
  totalProviderConfirmedMinor: number;
  totalDiscrepancyMinor: number;
  paymentAttemptsStaleFinalize: number;
  paymentAttemptsNeedsReview: number;
  recentProblemAttempts: Array<{
    correlationId: string;
    provider: string;
    status: string;
    checkoutState: string;
    staleReason: string | null;
    updatedAt: string;
  }>;
  providerReconciliationArtifacts: Array<{
    provider: string;
    status: string;
    externalId: string;
    jobId: string | null;
    periodStart: string | null;
    periodEnd: string | null;
    idempotencyKey: string | null;
    updatedAt: string;
  }>;
  providerSettlementRecords: Array<{
    provider: string;
    externalId: string;
    status: string;
    amountMinor: number | null;
    currency: string | null;
    orderId: string | null;
    mismatchReason: string | null;
  }>;
};

const PROVIDER_CONFIRMED_STATUSES = new Set([
  "paid",
  "authorized",
  "completed",
  "pending_capture",
  "paid_awaiting_order",
  "finalizing_order",
]);
const OPEN_STATUSES = new Set([
  "initiated",
  "pending_provider_redirect",
  "awaiting_completion",
  "paid_awaiting_order",
  "finalizing_order",
]);
const PROBLEM_STATUSES = new Set(["expired", "needs_review", "failed"]);

function bucketDate(row: PaymentAttemptRow): string {
  const stamp = row.finalized_at ?? row.updated_at ?? row.created_at;
  return stamp.slice(0, 10);
}

function reconciliationProviders(input: string): string[] {
  return input === "all"
    ? ["stripe", "paypal", "xendit", "cod"]
    : [input];
}

export async function GET(request: Request) {
  const staff = await requireStaffApiSession("dashboard:read");
  if (!staff.ok) return staff.response;
  const sup = adminSupabaseOr503("reconciliation");
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(
    sup.client,
    staff.session.user?.email,
  );
  if (!organization) {
    return NextResponse.json(
      { error: "Organization membership is not configured" },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const query = parseReconciliationQuery(searchParams);
  if (!query.ok) return NextResponse.json({ error: query.error }, { status: 400 });
  const { days, provider } = query.value;

  const rows: ReconciliationRow[] = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);

    const providers = reconciliationProviders(provider);

    for (const p of providers) {
      rows.push({
        date: dateStr,
        provider: p,
        medusaOrderCount: 0,
        medusaTotalMinor: 0,
        providerConfirmedCount: 0,
        providerConfirmedMinor: 0,
        openAttemptCount: 0,
        problemAttemptCount: 0,
        discrepancyMinor: 0,
        status: "pending",
      });
    }
  }

  const metrics = await getPaymentPlatformMetrics(sup.client, organization.id);
  const recentAttempts = await listRecentPaymentAttempts(sup.client, 500, organization.id);
  const reconciliationArtifacts = await listPaymentProviderArtifacts(sup.client, {
    organization_id: organization.id,
    provider:
      provider === "stripe" || provider === "paypal" || provider === "xendit"
        ? provider
        : "all",
    artifactTypes: ["reconciliation"],
    limit: 25,
  });
  const dayFloor = new Date(now);
  dayFloor.setUTCDate(dayFloor.getUTCDate() - (days - 1));
  dayFloor.setUTCHours(0, 0, 0, 0);
  let settlementQuery = sup.client
    .from("payment_settlement_records")
    .select("provider,external_id,status,amount_minor,currency,medusa_order_id,mismatch_reason,provider_occurred_at,updated_at")
    .eq("organization_id", organization.id)
    .gte("updated_at", dayFloor.toISOString())
    .limit(500);
  if (provider === "stripe" || provider === "paypal" || provider === "xendit") settlementQuery = settlementQuery.eq("provider", provider);
  const { data: settlementRows } = await settlementQuery;
  const rowMap = new Map(rows.map((row) => [`${row.date}:${row.provider}`, row]));
  const hasSettlementRows = (settlementRows?.length ?? 0) > 0;

  for (const attempt of recentAttempts) {
    const stamp = attempt.finalized_at ?? attempt.updated_at ?? attempt.created_at;
    const parsed = new Date(stamp);
    if (Number.isNaN(parsed.getTime()) || parsed < dayFloor) continue;
    const day = bucketDate(attempt);
    const key = `${day}:${attempt.provider}`;
    const row = rowMap.get(key);
    if (!row) continue;
    const amountMinor =
      typeof attempt.amount_minor === "number" && Number.isFinite(attempt.amount_minor)
        ? attempt.amount_minor
        : 0;

    if (attempt.medusa_order_id) {
      row.medusaOrderCount += 1;
      row.medusaTotalMinor += amountMinor;
    }
    if (!hasSettlementRows && (
      attempt.provider_payment_id ||
      attempt.webhook_last_status ||
      PROVIDER_CONFIRMED_STATUSES.has(attempt.status)
    )) {
      row.providerConfirmedCount += 1;
      row.providerConfirmedMinor += amountMinor;
    }
    if (OPEN_STATUSES.has(attempt.status)) {
      row.openAttemptCount += 1;
    }
    if (PROBLEM_STATUSES.has(attempt.status)) {
      row.problemAttemptCount += 1;
    }
  }

  if ((settlementRows?.length ?? 0) > 0) {
    for (const settlement of settlementRows ?? []) {
      const stamp = String(settlement.provider_occurred_at ?? settlement.updated_at ?? "");
      const day = stamp.slice(0, 10);
      const row = rowMap.get(`${day}:${settlement.provider}`);
      if (!row) continue;
      const amountMinor = settlement.amount_minor == null ? 0 : Number(settlement.amount_minor);
      if (settlement.status === "matched" || settlement.status === "resolved") {
        row.providerConfirmedCount += 1;
        row.providerConfirmedMinor += amountMinor;
      } else {
        row.problemAttemptCount += 1;
      }
    }
  }

  for (const row of rows) {
    row.discrepancyMinor = row.medusaTotalMinor - row.providerConfirmedMinor;
    row.status =
      row.problemAttemptCount > 0 || row.openAttemptCount > 0
        ? "pending"
        : row.discrepancyMinor !== 0 || row.medusaOrderCount !== row.providerConfirmedCount
          ? "discrepancy"
          : row.medusaOrderCount > 0 || row.providerConfirmedCount > 0
            ? "matched"
            : "pending";
  }

  const totalMedusa = rows.reduce((s, r) => s + r.medusaTotalMinor, 0);
  const totalProviderConfirmed = rows.reduce(
    (sum, row) => sum + row.providerConfirmedMinor,
    0,
  );
  const recentProblemAttempts = recentAttempts
    .filter(
      (row) =>
        row.status === "expired" ||
        row.status === "needs_review" ||
        row.status === "paid_awaiting_order" ||
        row.status === "finalizing_order",
    )
    .slice(0, 8)
    .map((row) => ({
      correlationId: row.correlation_id,
      provider: row.provider,
      status: row.status,
      checkoutState: row.checkout_state,
      staleReason: row.stale_reason ?? row.last_error,
      updatedAt: row.updated_at,
    }));

  const summary: ReconciliationSummary = {
    period: `Last ${days} days`,
    rows,
    totalMedusaMinor: totalMedusa,
    totalProviderConfirmedMinor: totalProviderConfirmed,
    totalDiscrepancyMinor: totalMedusa - totalProviderConfirmed,
    paymentAttemptsStaleFinalize: metrics?.paymentAttemptsStaleFinalize ?? 0,
    paymentAttemptsNeedsReview: metrics?.paymentAttemptsNeedsReview ?? 0,
    recentProblemAttempts,
    providerReconciliationArtifacts: reconciliationArtifacts.map((row) => ({
      provider: row.provider,
      status: row.status,
      externalId: row.external_id,
      jobId:
        typeof row.metadata?.job_id === "string" ? row.metadata.job_id : null,
      periodStart:
        typeof row.metadata?.period_start === "string"
          ? row.metadata.period_start
          : null,
      periodEnd:
        typeof row.metadata?.period_end === "string"
          ? row.metadata.period_end
          : null,
      idempotencyKey: row.idempotency_key,
      updatedAt: row.updated_at,
    })),
    providerSettlementRecords: (settlementRows ?? []).map((row) => ({
      provider: String(row.provider),
      externalId: String(row.external_id),
      status: String(row.status),
      amountMinor: row.amount_minor == null ? null : Number(row.amount_minor),
      currency: row.currency == null ? null : String(row.currency),
      orderId: row.medusa_order_id == null ? null : String(row.medusa_order_id),
      mismatchReason: row.mismatch_reason == null ? null : String(row.mismatch_reason),
    })),
  };

  return NextResponse.json(summary);
}
