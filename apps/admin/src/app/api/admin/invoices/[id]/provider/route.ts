import { z } from "zod";
import { upsertPaymentProviderArtifact } from "@universal-music-store/platform-data";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { medusaAdminFetch } from "@/lib/medusa-admin-http";
import {
  claimAdminIdempotency,
  completeAdminIdempotency,
  getIdempotencyKey,
  getRequestHash,
  parseAdminJson,
} from "@/lib/admin-api-security";
import { insertStaffAuditLog } from "@/lib/staff-audit";

const schema = z
  .object({
    provider: z.enum(["stripe", "paypal", "xendit"]),
    action: z.enum(["create", "finalize", "send", "pay", "remind", "cancel"]),
  })
  .strict();

type InvoicePayload = {
  referenceNumber?: string;
  paymentDueDate?: string;
  to?: { name?: string; email?: string };
  items?: Array<{
    description?: string;
    quantity?: number;
    unitPrice?: number;
  }>;
};

function money(value: unknown) {
  const amount =
    typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.round(amount * 100) / 100;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffApiSession("receipts:send");
  if (!staff.ok) return staff.response;
  const parsed = await parseAdminJson(req, schema);
  if (!parsed.ok)
    return correlatedJson(
      correlationId,
      { error: parsed.error },
      { status: parsed.status },
    );
  const idempotencyKey = getIdempotencyKey(req);
  if (!idempotencyKey)
    return correlatedJson(
      correlationId,
      { error: "Idempotency-Key is required" },
      { status: 400 },
    );
  const { id } = await params;
  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(
    sup.client,
    staff.session.user?.email,
  );
  if (!organization)
    return correlatedJson(
      correlationId,
      { error: "Organization membership is not configured" },
      { status: 403 },
    );
  const invoiceResult = await sup.client
    .from("admin_invoices")
    .select(
      "id,reference_number,status,total,currency,payload,provider,provider_external_id,provider_retry_count",
    )
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (invoiceResult.error)
    return correlatedJson(
      correlationId,
      { error: "Unable to load invoice" },
      { status: 502 },
    );
  if (!invoiceResult.data)
    return correlatedJson(
      correlationId,
      { error: "Invoice not found" },
      { status: 404 },
    );
  const invoice = invoiceResult.data;
  if (parsed.data.provider === "xendit")
    return correlatedJson(
      correlationId,
      {
        error:
          "Xendit does not provide a native invoice resource; use a payment session",
        code: "PROVIDER_CAPABILITY_UNAVAILABLE",
      },
      { status: 409 },
    );
  if (
    parsed.data.action !== "create" &&
    !invoice.provider_external_id
  )
    return correlatedJson(
      correlationId,
      {
        error: "Create the provider invoice before performing this action",
        code: "PROVIDER_INVOICE_NOT_CREATED",
      },
      { status: 409 },
    );
  if (
    invoice.provider_external_id &&
    invoice.provider !== parsed.data.provider
  )
    return correlatedJson(
      correlationId,
      {
        error: "Invoice is connected to a different payment provider",
        code: "PROVIDER_INVOICE_MISMATCH",
      },
      { status: 409 },
    );
  if (
    parsed.data.provider === "paypal" &&
    ["finalize", "pay"].includes(parsed.data.action)
  )
    return correlatedJson(
      correlationId,
      {
        error: "PayPal invoices use send, remind, or cancel actions",
        code: "PROVIDER_CAPABILITY_UNAVAILABLE",
      },
      { status: 409 },
    );
  if (
    parsed.data.action === "create" &&
    invoice.provider === parsed.data.provider &&
    invoice.provider_external_id
  ) {
    return correlatedJson(correlationId, {
      data: {
        id: invoice.id,
        reference_number: invoice.reference_number,
        status: invoice.status,
        provider: invoice.provider,
        provider_external_id: invoice.provider_external_id,
      },
      replay: true,
    });
  }
  const payload = (invoice.payload ?? {}) as InvoicePayload;
  const connection = await sup.client
    .from("payment_nango_connections")
    .select("nango_connection_id,provider_config_key")
    .eq("organization_id", organization.id)
    .eq("provider", parsed.data.provider)
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (connection.error || !connection.data?.nango_connection_id)
    return correlatedJson(
      correlationId,
      {
        error: `${parsed.data.provider} is not connected for this organization`,
        code: "PAYMENT_CONNECTION_REQUIRED",
      },
      { status: 409 },
    );
  const internalToken = process.env.MEDUSA_INTERNAL_ADMIN_TOKEN?.trim();
  if (!internalToken)
    return correlatedJson(
      correlationId,
      { error: "Payment operations are not configured" },
      { status: 503 },
    );
  const claim = await claimAdminIdempotency(sup.client, {
    actorKey: `${organization.id}:${staff.session.user?.email?.trim().toLowerCase() ?? "unknown"}`,
    actionKey: `invoice.provider:${id}:${parsed.data.provider}:${parsed.data.action}`,
    idempotencyKey,
    requestHash: getRequestHash({
      invoiceId: id,
      provider: parsed.data.provider,
      action: parsed.data.action,
      providerExternalId: invoice.provider_external_id,
      total: invoice.total,
    }),
  });
  if (claim.kind === "replay")
    return correlatedJson(correlationId, claim.body, { status: claim.status });
  if (claim.kind === "conflict")
    return correlatedJson(
      correlationId,
      { error: "Idempotency key is already in use" },
      { status: 409 },
    );
  if (claim.kind !== "claimed")
    return correlatedJson(
      correlationId,
      { error: "Idempotency service unavailable" },
      { status: 503 },
    );
  const finish = async (status: number, body: Record<string, unknown>) => {
    await completeAdminIdempotency(sup.client, claim.id, status, body);
    return correlatedJson(correlationId, body, { status });
  };
  await sup.client
    .from("admin_invoices")
    .update({
      provider: parsed.data.provider,
      provider_retry_state: "processing",
      provider_updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", organization.id);
  const total = money(invoice.total);
  const items = Array.isArray(payload.items) ? payload.items : [];
  const responsePayload =
    parsed.data.provider === "stripe"
      ? {
          operation: "invoice",
          customer_email: payload.to?.email,
          invoice_id:
            parsed.data.action === "create"
              ? undefined
              : (invoice.provider_external_id ?? undefined),
          currency: invoice.currency,
          items:
            parsed.data.action === "create"
              ? [
                  {
                    amount_minor: Math.round(total * 100),
                    description: `Invoice ${invoiceResult.data.reference_number}`,
                  },
                ]
              : undefined,
          action:
            parsed.data.action === "create" ? "draft" : parsed.data.action,
          idempotency_key: idempotencyKey,
        }
      : {
          operation: "invoice",
          action:
            parsed.data.action === "create" ? "create" : parsed.data.action,
          invoice_id:
            parsed.data.action === "create"
              ? undefined
              : (invoice.provider_external_id ?? undefined),
          payload:
            parsed.data.action === "create"
              ? {
                  detail: {
                    invoice_number: invoice.reference_number,
                    invoice_date: new Date().toISOString().slice(0, 10),
                    currency_code: invoice.currency,
                    note: `UVS invoice ${invoice.reference_number}`,
                  },
                  primary_recipients: [
                    {
                      billing_info: {
                        email_address: payload.to?.email,
                        name: {
                          full_name: payload.to?.name ?? payload.to?.email,
                        },
                      },
                    },
                  ],
                  items: items.map((item) => ({
                    name: item.description,
                    quantity: String(item.quantity ?? 1),
                    unit_amount: {
                      currency_code: invoice.currency,
                      value: money(
                        (item.unitPrice ?? 0) * (item.quantity ?? 1),
                      ).toFixed(2),
                    },
                  })),
                  configuration: {
                    partial_payment: { allow_partial_payment: false },
                  },
                }
              : {},
          idempotency_key: idempotencyKey,
        };
  let providerResponse: Response;
  try {
    providerResponse = await medusaAdminFetch(
      `/admin/payment-provider/${parsed.data.provider}`,
      {
        method: "POST",
        headers: {
          "x-uvs-internal-token": internalToken,
          "x-nango-connection-id": connection.data.nango_connection_id,
          ...(connection.data.provider_config_key
            ? {
                "x-nango-provider-config-key":
                  connection.data.provider_config_key,
              }
            : {}),
        },
        body: JSON.stringify(responsePayload),
      },
    );
  } catch {
    await sup.client
      .from("admin_invoices")
      .update({
        provider_retry_count: Number(invoice.provider_retry_count ?? 0) + 1,
        provider_retry_state: "retryable",
        provider_last_error: "Provider operation unavailable",
        provider_updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", organization.id);
    return finish(502, {
      error: "Provider invoice operation unavailable",
      code: "PROVIDER_OPERATION_FAILED",
    });
  }
  const body = (await providerResponse
    .json()
    .catch(() => ({ error: "Provider operation failed" }))) as {
    data?: { id?: string; status?: string; hosted_invoice_url?: string };
    error?: string;
  };
  if (!providerResponse.ok) {
    await sup.client
      .from("admin_invoices")
      .update({
        provider: parsed.data.provider,
        provider_last_error: body.error ?? "Provider operation failed",
        provider_retry_count: Number(invoice.provider_retry_count ?? 0) + 1,
        provider_retry_state:
          providerResponse.status >= 500 ? "retryable" : "permanent_failure",
        provider_updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", organization.id);
    return finish(
      providerResponse.status >= 500 ? 502 : providerResponse.status,
      {
        error: body.error ?? "Provider invoice operation failed",
        code: "PROVIDER_OPERATION_FAILED",
      },
    );
  }
  const externalId = body.data?.id ?? invoice.provider_external_id;
  if (!externalId) {
    await sup.client
      .from("admin_invoices")
      .update({
        provider_retry_count: Number(invoice.provider_retry_count ?? 0) + 1,
        provider_retry_state: "retryable",
        provider_last_error: "Provider did not return an invoice id",
        provider_updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", organization.id);
    return finish(502, {
      error: "Provider did not return an invoice id",
      code: "PROVIDER_INVALID_RESPONSE",
    });
  }
  const artifactOk = await upsertPaymentProviderArtifact(sup.client, {
    organization_id: organization.id,
    merchant_identity: connection.data.nango_connection_id,
    provider: parsed.data.provider,
    artifact_type: "invoice",
    external_id: externalId,
    status: body.data?.status ?? parsed.data.action,
    amount_minor: Math.round(total * 100),
    currency: invoice.currency,
    idempotency_key: idempotencyKey,
    metadata: {
      admin_invoice_id: id,
      reference_number: invoice.reference_number,
      hosted_invoice_url: body.data?.hosted_invoice_url ?? null,
    },
  });
  if (!artifactOk) {
    await sup.client
      .from("admin_invoices")
      .update({
        provider_retry_count: Number(invoice.provider_retry_count ?? 0) + 1,
        provider_retry_state: "retryable",
        provider_last_error: "Provider invoice artifact could not be recorded",
        provider_updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", organization.id);
    return finish(502, {
      error:
        "Provider invoice succeeded but its local artifact could not be recorded",
      code: "LOCAL_ARTIFACT_WRITE_FAILED",
    });
  }
  const artifact = artifactOk
    ? await sup.client
        .from("payment_provider_artifacts")
        .select("id")
        .eq("organization_id", organization.id)
        .eq("provider", parsed.data.provider)
        .eq("artifact_type", "invoice")
        .eq("external_id", externalId)
        .maybeSingle()
    : { data: null };
  const updated = await sup.client
    .from("admin_invoices")
    .update({
      provider: parsed.data.provider,
      provider_external_id: externalId,
      provider_artifact_id: artifact.data?.id ?? null,
      provider_status: body.data?.status ?? parsed.data.action,
      provider_last_error: null,
      provider_retry_count: 0,
      provider_retry_state: "idle",
      provider_updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", organization.id)
    .select(
      "id,reference_number,status,provider,provider_external_id,provider_artifact_id,provider_status,provider_retry_state,provider_updated_at",
    )
    .single();
  if (updated.error || !updated.data)
    return finish(502, {
      error: "Provider invoice succeeded but local state could not be recorded",
    });
  await insertStaffAuditLog(sup.client, {
    actorEmail: staff.session.user?.email ?? "local-admin@localhost",
    action: `invoice.provider.${parsed.data.action}`,
    resource: "admin_invoice",
    resourceId: id,
    details: {
      organization_id: organization.id,
      provider: parsed.data.provider,
      external_id: externalId,
      status: updated.data.provider_status,
    },
  });
  return finish(200, { data: updated.data, provider: body.data ?? null });
}
