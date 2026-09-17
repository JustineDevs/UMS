import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { z } from "zod";
import { medusaAdminFetch } from "@/lib/medusa-admin-http";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import {
  requestProviderReconciliationJob,
  upsertPaymentProviderArtifact,
  recordSettlementReconciliation,
} from "@universal-music-store/platform-data";
import { parseBoundedJson } from "@/lib/bounded-request-body";

const xenditSchema = z.discriminatedUnion("operation", [
  z
    .object({
      provider: z.literal("xendit"),
      operation: z.literal("reconcile"),
      period_start: z.string().datetime(),
      period_end: z.string().datetime(),
      idempotency_key: z.string().trim().min(8).max(255),
    })
    .strict(),
  z
    .object({
      provider: z.literal("xendit"),
      operation: z.literal("future_charge"),
      payment_token_id: z.string().trim().min(8).max(160),
      reference_id: z.string().trim().min(1).max(127),
      amount_minor: z.number().int().positive().max(10_000_000_000),
      currency: z
        .string()
        .trim()
        .regex(/^[A-Za-z]{3}$/),
      country: z
        .string()
        .trim()
        .regex(/^[A-Za-z]{2}$/),
      channel_code: z.string().trim().min(2).max(80),
      channel_properties: z.record(z.string(), z.unknown()).default({}),
      metadata: z.record(z.string(), z.string().max(500)).optional(),
      idempotency_key: z.string().trim().min(8).max(255),
    })
    .strict(),
  z
    .object({
      provider: z.literal("xendit"),
      operation: z.literal("payout"),
      reference_id: z.string().trim().min(1).max(127),
      channel_code: z.string().trim().min(2).max(80),
      amount_minor: z.number().int().positive().max(10_000_000_000),
      currency: z
        .string()
        .trim()
        .regex(/^[A-Za-z]{3}$/),
      channel_properties: z.record(z.string(), z.unknown()),
      description: z.string().trim().max(255).optional(),
      idempotency_key: z.string().trim().min(8).max(255),
    })
    .strict(),
]);

const stripeSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("reconcile"),
      period_start: z.string().datetime(),
      period_end: z.string().datetime(),
      idempotency_key: z.string().trim().min(8).max(255),
    })
    .strict(),
  z
    .object({
      operation: z.literal("setup_intent"),
      customer: z.string().trim().max(255).optional(),
      idempotency_key: z.string().trim().min(8).max(255),
    })
    .strict(),
  z
    .object({
      operation: z.literal("subscription"),
      customer: z.string().trim().min(1).max(255),
      items: z
        .array(
          z
            .object({
              price: z.string().trim().min(1).max(255),
              quantity: z.number().int().positive().max(1000).default(1),
            })
            .strict(),
        )
        .min(1)
        .max(50),
      idempotency_key: z.string().trim().min(8).max(255),
    })
    .strict(),
  z
    .object({
      operation: z.literal("invoice"),
      customer: z.string().trim().min(1).max(255).optional(),
      customer_email: z.string().email().max(320).optional(),
      invoice_id: z.string().trim().min(1).max(255).optional(),
      currency: z
        .string()
        .trim()
        .regex(/^[A-Za-z]{3}$/),
      items: z
        .array(
          z
            .object({
              amount_minor: z.number().int().positive().max(10_000_000_000),
              description: z.string().trim().min(1).max(500),
            })
            .strict(),
        )
        .min(1)
        .max(100),
      action: z.enum(["draft", "finalize", "pay", "send"]).default("draft"),
      idempotency_key: z.string().trim().min(8).max(255),
    })
    .strict(),
  z
    .object({
      operation: z.literal("payment"),
      action: z.enum(["retrieve", "authorize", "capture", "void"]),
      order_id: z.string().trim().min(1).max(255).optional(),
      authorization_id: z.string().trim().min(1).max(255).optional(),
      idempotency_key: z.string().trim().min(8).max(255),
    })
    .strict(),
  z
    .object({
      operation: z.literal("payment_link"),
      action: z.enum(["create", "retrieve", "deactivate"]),
      payment_resource_id: z.string().trim().min(1).max(255).optional(),
      payload: z.record(z.string(), z.unknown()).default({}),
      idempotency_key: z.string().trim().min(8).max(255),
    })
    .strict(),
  z
    .object({
      operation: z.literal("dispute"),
      dispute_id: z.string().trim().min(1).max(255),
      action: z.enum(["retrieve", "update", "close"]),
      evidence: z.record(z.string(), z.string().max(10000)).optional(),
      idempotency_key: z.string().trim().min(8).max(255),
    })
    .strict(),
  z
    .object({
      operation: z.literal("payout"),
      amount_minor: z.number().int().positive().max(10_000_000_000),
      currency: z
        .string()
        .trim()
        .regex(/^[A-Za-z]{3}$/),
      method: z.enum(["standard", "instant"]).default("standard"),
      idempotency_key: z.string().trim().min(8).max(255),
    })
    .strict(),
  z
    .object({
      operation: z.literal("connect_account"),
      country: z
        .string()
        .trim()
        .regex(/^[A-Za-z]{2}$/),
      email: z.string().email().max(320).optional(),
      return_url: z
        .string()
        .url()
        .refine((value) => value.startsWith("https://"), "HTTPS required"),
      refresh_url: z
        .string()
        .url()
        .refine((value) => value.startsWith("https://"), "HTTPS required"),
      idempotency_key: z.string().trim().min(8).max(255),
    })
    .strict(),
]);

const paypalSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("reconcile"),
      period_start: z.string().datetime(),
      period_end: z.string().datetime(),
      idempotency_key: z.string().trim().min(8).max(255),
    })
    .strict(),
  z
    .object({
      operation: z.literal("invoice"),
      action: z.enum(["create", "send", "remind", "cancel"]),
      invoice_id: z.string().trim().min(1).max(255).optional(),
      payload: z.record(z.string(), z.unknown()).default({}),
      idempotency_key: z.string().trim().min(8).max(255),
    })
    .strict(),
  z
    .object({
      operation: z.literal("subscription"),
      action: z.enum(["create", "suspend", "cancel"]),
      subscription_id: z.string().trim().min(1).max(255).optional(),
      payload: z.record(z.string(), z.unknown()).default({}),
      idempotency_key: z.string().trim().min(8).max(255),
    })
    .strict(),
  z
    .object({
      operation: z.literal("dispute"),
      action: z.enum([
        "get",
        "evidence",
        "accept",
        "escalate",
        "deny",
        "adjudicate",
      ]),
      dispute_id: z.string().trim().min(1).max(255),
      payload: z.record(z.string(), z.unknown()).default({}),
      idempotency_key: z.string().trim().min(8).max(255),
    })
    .strict(),
  z
    .object({
      operation: z.literal("payout"),
      payload: z.record(z.string(), z.unknown()),
      idempotency_key: z.string().trim().min(8).max(255),
    })
    .strict(),
]);

const paymentOperationSchema = z.union([
  stripeSchema.and(z.object({ provider: z.literal("stripe") })),
  paypalSchema.and(z.object({ provider: z.literal("paypal") })),
  xenditSchema.and(z.object({ provider: z.literal("xendit") })),
]);

async function post(req: Request) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffApiSession("settings:write");
  if (!staff.ok) return staff.response;
  const parsedBody = await parseBoundedJson(req, 512 * 1024);
  if (parsedBody.tooLarge) return correlatedJson(correlationId, { error: "Payload too large" }, { status: 413 });
  const raw = (parsedBody.valid ? parsedBody.value : null) as Record<string, unknown> | null;
  const parsed = paymentOperationSchema.safeParse(raw);
  if (!parsed.success)
    return correlatedJson(
      correlationId,
      { error: "Invalid payment operation payload" },
      { status: 400 },
    );
  if (
    parsed.data.provider === "stripe" &&
    parsed.data.operation === "invoice" &&
    !parsed.data.customer &&
    !parsed.data.customer_email &&
    !parsed.data.invoice_id
  ) {
    return correlatedJson(
      correlationId,
      { error: "Invoice customer or invoice id is required" },
      { status: 400 },
    );
  }

  const supabase = adminSupabaseOr503(correlationId);
  if ("response" in supabase) return supabase.response;
  const organization = await resolveStaffOrganization(
    supabase.client,
    staff.session.user?.email,
  );
  if (!organization)
    return correlatedJson(
      correlationId,
      { error: "Organization membership is not configured" },
      { status: 403 },
    );
  const { data: connection } = await supabase.client
    .from("payment_nango_connections")
    .select("nango_connection_id,provider_config_key")
    .eq("organization_id", organization.id)
    .eq("provider", parsed.data.provider)
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (
    (parsed.data.provider === "stripe" || parsed.data.provider === "paypal") &&
    parsed.data.operation !== "reconcile" &&
    !connection?.nango_connection_id
  ) {
    return correlatedJson(
      correlationId,
      {
        error: "Payment provider connection is not configured",
        code: "PAYMENT_CONNECTION_REQUIRED",
      },
      { status: 503 },
    );
  }
  if (parsed.data.operation === "reconcile") {
    const start = new Date(parsed.data.period_start);
    const end = new Date(parsed.data.period_end);
    if (!(start < end)) {
      return correlatedJson(
        correlationId,
        { error: "Reconciliation period_start must be before period_end" },
        { status: 400 },
      );
    }
    const internalToken = process.env.MEDUSA_INTERNAL_ADMIN_TOKEN?.trim();
    const providerRequest = { ...((({ provider: _provider, ...operation }) => operation)(parsed.data)), ...(parsed.data.provider === "xendit" ? {
      payment_request_ids: (await supabase.client
        .from("payment_provider_artifacts")
        .select("external_id")
        .eq("organization_id", organization.id)
        .eq("provider", "xendit")
        .in("artifact_type", ["payment_request", "payment_intent"])
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString())
        .limit(100)).data?.map((row) => row.external_id).filter((id): id is string => typeof id === "string" && id.length > 0),
    } : {}) };
    if (internalToken && (parsed.data.provider !== "xendit" || (providerRequest.payment_request_ids?.length ?? 0) > 0)) {
      const providerResponse = await medusaAdminFetch(`/admin/payment-provider/${parsed.data.provider}`, {
        method: "POST",
        headers: {
          "x-uvs-internal-token": internalToken,
          ...(connection?.nango_connection_id ? { "x-nango-connection-id": connection.nango_connection_id } : {}),
          ...(connection?.provider_config_key ? { "x-nango-provider-config-key": connection.provider_config_key } : {}),
        },
        body: JSON.stringify(providerRequest),
      });
      const providerBody = await providerResponse.json().catch(() => ({ error: "Payment provider reconciliation failed" }));
      if (providerResponse.ok) {
        const report = providerBody && typeof providerBody === "object" && "data" in providerBody ? (providerBody as { data: unknown }).data : providerBody;
        const externalId = `reconcile:${parsed.data.provider}:${start.toISOString()}:${end.toISOString()}`;
        const reportRows = report && typeof report === "object"
          ? (Array.isArray((report as { transactions?: unknown[] }).transactions)
              ? (report as { transactions: unknown[] }).transactions
              : Array.isArray((report as { requests?: unknown[] }).requests)
                ? (report as { requests: unknown[] }).requests
                : [])
          : [];
        for (const raw of reportRows) {
          if (!raw || typeof raw !== "object") continue;
          const item = raw as Record<string, unknown>;
          const rowExternalId = String(item.external_id ?? item.payment_request_id ?? "").trim();
          if (!rowExternalId) continue;
          await recordSettlementReconciliation(supabase.client, {
            organizationId: organization.id,
            provider: parsed.data.provider,
            merchantIdentity: connection?.nango_connection_id ?? organization.id,
            externalId: rowExternalId,
            artifactType: "settlement",
            paymentExternalId: typeof item.payment_external_id === "string" ? item.payment_external_id : typeof item.payment_id === "string" ? item.payment_id : null,
            amountMinor: typeof item.amount_minor === "number" ? item.amount_minor : null,
            feeMinor: typeof item.fee_minor === "number" ? item.fee_minor : 0,
            netMinor: typeof item.net_minor === "number" ? item.net_minor : null,
            currency: typeof item.currency === "string" ? item.currency : null,
            status: "needs_review",
            providerOccurredAt: typeof item.provider_occurred_at === "string" ? item.provider_occurred_at : null,
            idempotencyKey: `${parsed.data.idempotency_key}:${rowExternalId}`,
            mismatchReason: "provider_operation_report_requires_attempt_match",
            metadata: { source: "admin-provider-operation", period_start: start.toISOString(), period_end: end.toISOString() },
          });
        }
        await upsertPaymentProviderArtifact(supabase.client, {
          organization_id: organization.id,
          merchant_identity: connection?.nango_connection_id ?? organization.id,
          provider: parsed.data.provider,
          artifact_type: "reconciliation",
          external_id: externalId,
          status: "synced",
          idempotency_key: parsed.data.idempotency_key,
          metadata: { period_start: start.toISOString(), period_end: end.toISOString(), provider_report: report },
        });
        return correlatedJson(correlationId, { data: { provider_api_pull: true, provider_report: report, artifact_external_id: externalId } });
      }
    }
    const result = await requestProviderReconciliationJob(supabase.client, {
      organizationId: organization.id,
      merchantIdentity: connection?.nango_connection_id ?? organization.id,
      provider: parsed.data.provider,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      idempotencyKey: parsed.data.idempotency_key,
      createdBy: staff.session.user?.email ?? "admin",
    });
    if (!result.jobId) {
      return correlatedJson(
        correlationId,
        { error: "Unable to enqueue reconciliation job" },
        { status: 503 },
      );
    }
    return correlatedJson(correlationId, {
      data: {
        job_id: result.jobId,
        artifact_external_id: result.artifactExternalId,
        reused: result.reused,
        provider_api_pull: false,
      },
    });
  }
  const internalToken = process.env.MEDUSA_INTERNAL_ADMIN_TOKEN?.trim();
  if (!internalToken)
    return correlatedJson(
      correlationId,
      { error: "Payment operations are not configured" },
      { status: 503 },
    );
  const response = await medusaAdminFetch(
    `/admin/payment-provider/${parsed.data.provider}`,
    {
      method: "POST",
      headers: {
        "x-uvs-internal-token": internalToken,
        ...(connection?.nango_connection_id
          ? { "x-nango-connection-id": connection.nango_connection_id }
          : {}),
        ...(connection?.provider_config_key
          ? { "x-nango-provider-config-key": connection.provider_config_key }
          : {}),
      },
      body: JSON.stringify(
        (({ provider: _provider, ...operation }) => operation)(parsed.data),
      ),
    },
  );
  const providerBody = await response
    .json()
    .catch(() => ({ error: "Payment operation failed" }));
  if (response.ok && providerBody && typeof providerBody === "object") {
    const data = (providerBody as { data?: unknown }).data;
    const externalId =
      data &&
      typeof data === "object" &&
      typeof (data as { id?: unknown }).id === "string"
        ? (data as { id: string }).id
        : null;
    const artifactType =
      parsed.data.operation === "invoice"
        ? "invoice"
        : parsed.data.operation === "payment_link"
          ? "payment_link"
          : parsed.data.operation === "payment"
            ? parsed.data.action === "authorize" || parsed.data.action === "void"
              ? "authorization"
              : parsed.data.action === "capture"
                ? "capture"
                : "checkout_session"
            : parsed.data.operation === "subscription"
              ? "payment_request"
              : parsed.data.operation === "dispute"
                ? "dispute"
                : parsed.data.operation === "payout"
                  ? "payout"
                  : parsed.data.operation === "setup_intent" ||
                      parsed.data.operation === "future_charge"
                    ? "payment_token"
                    : null;
    if (externalId && artifactType) {
      await upsertPaymentProviderArtifact(supabase.client, {
        organization_id: organization.id,
        merchant_identity: connection?.nango_connection_id ?? organization.id,
        provider: parsed.data.provider,
        artifact_type: artifactType,
        external_id: externalId,
        parent_external_id:
          "invoice_id" in parsed.data
            ? parsed.data.invoice_id
            : "subscription_id" in parsed.data
              ? parsed.data.subscription_id
              : "dispute_id" in parsed.data
                ? parsed.data.dispute_id
                : "order_id" in parsed.data
                  ? parsed.data.order_id
                  : "authorization_id" in parsed.data
                    ? parsed.data.authorization_id
                    : null,
        status:
          data &&
          typeof data === "object" &&
          typeof (data as { status?: unknown }).status === "string"
            ? (data as { status: string }).status
            : "created",
        currency:
          "currency" in parsed.data && typeof parsed.data.currency === "string"
            ? parsed.data.currency.toUpperCase()
            : null,
        idempotency_key: parsed.data.idempotency_key,
        metadata: { operation: parsed.data.operation },
      });
    }
  }
  return correlatedJson(correlationId, providerBody, { status: response.status });
}

export const POST = withAdminMutationIdempotency("/admin/payments/provider-operation:POST", post);
