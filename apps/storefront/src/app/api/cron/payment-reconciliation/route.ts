import { NextResponse } from "next/server";
import {
  claimNextRunnableJob,
  completeJob,
  failJob,
  upsertPaymentProviderArtifact,
  reconcileSettlement,
  recordSettlementReconciliation,
} from "@universal-music-store/platform-data";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";

export const dynamic = "force-dynamic";

async function fetchProviderReport(provider: "stripe" | "paypal" | "xendit", periodStart: string, periodEnd: string, paymentRequestIds: string[] = []) {
  if (provider === "xendit" && paymentRequestIds.length === 0) return { source: "payment_requests", requests: [] as unknown[] };
  const base = (process.env.MEDUSA_ADMIN_API_URL ?? process.env.MEDUSA_BACKEND_URL ?? process.env.MEDUSA_URL)?.trim().replace(/\/$/, "");
  const secret = (process.env.MEDUSA_SECRET_API_KEY ?? process.env.MEDUSA_ADMIN_API_SECRET)?.trim();
  const internalToken = process.env.MEDUSA_INTERNAL_ADMIN_TOKEN?.trim();
  if (!base || !secret || !internalToken) throw new Error("Provider reconciliation service is not configured");
  const auth = Buffer.from(`${secret}:`, "utf8").toString("base64");
  const response = await fetch(`${base}/admin/payment-provider/${provider}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      "x-uvs-internal-token": internalToken,
    },
    body: JSON.stringify({ operation: "reconcile", period_start: periodStart, period_end: periodEnd, idempotency_key: `cron:${provider}:${periodStart}:${periodEnd}`,
      ...(provider === "xendit" ? { payment_request_ids: paymentRequestIds.slice(0, 100) } : {}) }),
  });
  const body = await response.json().catch(() => null) as { data?: Record<string, unknown> } | null;
  if (!response.ok || !body?.data) throw new Error(`Provider reconciliation failed for ${provider}`);
  return body.data;
}

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  const actual =
    req.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim() ?? req.headers.get("x-cron-secret")?.trim();
  return Boolean(expected && actual && expected === actual);
}

export async function GET(req: Request) {
  if (!authorized(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createStorefrontServiceSupabase();
  if (!supabase)
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const job = await claimNextRunnableJob(
    supabase,
    "reconcile_payment",
    `storefront-payment-reconciliation-${process.pid}`,
  );
  if (!job) return NextResponse.json({ processed: 0 });

  const payload = job.payload;
  const organizationId =
    typeof payload.organizationId === "string" ? payload.organizationId : null;
  const provider =
    payload.provider === "stripe" ||
    payload.provider === "paypal" ||
    payload.provider === "xendit"
      ? payload.provider
      : null;
  const periodStart =
    typeof payload.periodStart === "string" ? payload.periodStart : null;
  const periodEnd =
    typeof payload.periodEnd === "string" ? payload.periodEnd : null;
  const idempotencyKey =
    typeof payload.idempotencyKey === "string" ? payload.idempotencyKey : null;
  if (
    !organizationId ||
    !provider ||
    !periodStart ||
    !periodEnd ||
    !idempotencyKey
  ) {
    await failJob(supabase, job.id!, "Invalid reconciliation job payload");
    return NextResponse.json({ processed: 1, failed: true }, { status: 422 });
  }

  try {
    const [attempts, artifacts] = await Promise.all([
      supabase
        .from("payment_attempts")
        .select(
          "correlation_id,status,amount_minor,currency,provider_payload,provider_payment_id,medusa_order_id,created_at",
        )
        .eq("organization_id", organizationId)
        .eq("provider", provider)
        .gte("created_at", periodStart)
        .lte("created_at", periodEnd),
      supabase
        .from("payment_provider_artifacts")
        .select("external_id,status,amount_minor,currency,metadata,updated_at")
        .eq("organization_id", organizationId)
        .eq("provider", provider)
        .neq("artifact_type", "reconciliation")
        .gte("updated_at", periodStart)
        .lte("updated_at", periodEnd),
    ]);
    if (attempts.error || artifacts.error)
      throw new Error("Unable to read reconciliation ledger");

    const attemptRows = attempts.data ?? [];
    const artifactRows = artifacts.data ?? [];
    const paymentRequestIds = provider === "xendit"
      ? artifactRows.map((artifact) => String(artifact.external_id ?? "")).filter(Boolean)
      : [];
    const providerReport = await fetchProviderReport(provider, periodStart, periodEnd, paymentRequestIds);
    const providerRows = Array.isArray(providerReport.transactions)
      ? providerReport.transactions
      : Array.isArray(providerReport.requests)
        ? providerReport.requests
        : [];
    for (const raw of providerRows) {
      const row = raw as Record<string, unknown>;
      const externalId = String(row.external_id ?? row.payment_request_id ?? "").trim();
      if (!externalId) continue;
      const paymentExternalId = typeof row.payment_external_id === "string"
        ? row.payment_external_id
        : typeof row.payment_id === "string" ? row.payment_id : null;
      const attempt = attemptRows.find((candidate) =>
        paymentExternalId && candidate.provider_payment_id === paymentExternalId,
      );
      const expectedAmountMinor = attempt ? Number(attempt.amount_minor) : null;
      const expectedCurrency = attempt?.currency ? String(attempt.currency) : null;
      const match = reconcileSettlement({
        providerExternalId: externalId,
        providerPaymentExternalId: paymentExternalId,
        expectedPaymentExternalId: attempt?.provider_payment_id ?? null,
        expectedOrderId: attempt?.medusa_order_id ?? null,
        providerOrderId: typeof row.reference_id === "string" ? row.reference_id : null,
        expectedAmountMinor,
        providerAmountMinor: Number.isFinite(Number(row.amount_minor)) ? Number(row.amount_minor) : null,
        expectedCurrency,
        providerCurrency: typeof row.currency === "string" ? row.currency : null,
        providerStatus: String(row.status ?? "unknown"),
      });
      await recordSettlementReconciliation(supabase, {
        organizationId,
        provider,
        merchantIdentity: organizationId,
        externalId,
        artifactType: "balance_transaction",
        paymentExternalId,
        medusaOrderId: attempt?.medusa_order_id ?? null,
        amountMinor: Number.isFinite(Number(row.amount_minor)) ? Number(row.amount_minor) : null,
        feeMinor: Number.isFinite(Number(row.fee_minor)) ? Number(row.fee_minor) : 0,
        netMinor: Number.isFinite(Number(row.net_minor)) ? Number(row.net_minor) : null,
        currency: typeof row.currency === "string" ? row.currency : null,
        status: match.status,
        providerOccurredAt: typeof row.provider_occurred_at === "string" ? row.provider_occurred_at : null,
        idempotencyKey: `${idempotencyKey}:${externalId}`,
        mismatchReason: match.mismatchReason,
        metadata: { period_start: periodStart, period_end: periodEnd, provider_report_source: providerReport.source ?? null },
      });
    }
    for (const artifact of artifactRows) {
      if (!artifact.external_id || !artifact.status) continue;
      const invoiceProjection = await supabase
        .from("admin_invoices")
        .update({
          provider_status: artifact.status,
          provider_last_error: null,
          provider_retry_state: "idle",
          provider_updated_at: new Date().toISOString(),
        })
        .eq("organization_id", organizationId)
        .eq("provider", provider)
        .eq("provider_external_id", artifact.external_id);
      if (invoiceProjection.error)
        throw new Error("Unable to project provider status to invoices");
    }
    const terminalStatuses = new Set([
      "completed",
      "paid",
      "captured",
      "refunded",
      "partially_refunded",
    ]);
    const settledAttempts = attemptRows.filter((row) =>
      terminalStatuses.has(String(row.status)),
    ).length;
    const settledArtifacts = artifactRows.filter((row) =>
      terminalStatuses.has(String(row.status)),
    ).length;
    const attemptAmount = attemptRows.reduce(
      (sum, row) => sum + (Number(row.amount_minor) || 0),
      0,
    );
    const artifactAmount = artifactRows.reduce(
      (sum, row) => sum + (Number(row.amount_minor) || 0),
      0,
    );
    const result = {
      source: "uvs_ledger",
      provider,
      period_start: periodStart,
      period_end: periodEnd,
      payment_attempts: attemptRows.length,
      settled_attempts: settledAttempts,
      provider_artifacts: artifactRows.length,
      settled_artifacts: settledArtifacts,
      attempt_amount_minor: attemptAmount,
      artifact_amount_minor: artifactAmount,
      amount_delta_minor: attemptAmount - artifactAmount,
      status:
        attemptRows.length === artifactRows.length &&
        attemptAmount === artifactAmount
          ? "matched"
          : "review",
      provider_api_pull: true,
    };
    const externalId = `reconciliation:${provider}:${idempotencyKey}`;
    const reconciliationArtifactSaved = await upsertPaymentProviderArtifact(
      supabase,
      {
        organization_id: organizationId,
        merchant_identity: organizationId,
        provider,
        artifact_type: "reconciliation",
        external_id: externalId,
        status: result.status,
        idempotency_key: idempotencyKey,
        metadata: result,
      },
    );
    if (!reconciliationArtifactSaved)
      throw new Error("Unable to record reconciliation artifact");
    await completeJob(supabase, job.id!, result);
    return NextResponse.json({ processed: 1, job_id: job.id, result });
  } catch {
    await failJob(supabase, job.id!, "Payment reconciliation failed");
    return NextResponse.json({ processed: 1, failed: true }, { status: 502 });
  }
}
