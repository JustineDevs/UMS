import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { upsertPaymentTerminalArtifactBinding, validateFiscalProfile, validateTerminalCertification, type PaymentProvider } from "@universal-music-store/platform-data";
import { z } from "zod";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { parseBoundedJson } from "@/lib/bounded-request-body";

const bodySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("fiscal"), jurisdiction: z.string().trim().min(2).max(16), registrationNumber: z.string().trim().min(1).max(64), invoicePrefix: z.string().trim().min(1).max(16), enabled: z.boolean().default(false) }).strict(),
  z.object({ kind: z.literal("certification"), provider: z.string().trim().min(1).max(120), model: z.string().trim().min(1).max(120), firmware: z.string().trim().min(1).max(80), certificationId: z.string().trim().min(1).max(120), expiresAt: z.string().datetime().nullable().optional() }).strict(),
  z.object({ kind: z.literal("payment_terminal"), provider: z.string().trim().min(1).max(120), model: z.string().trim().min(1).max(120), serialNumber: z.string().trim().min(1).max(120), deviceId: z.string().uuid().optional(), providerTerminalExternalId: z.string().trim().min(1).max(255).optional(), certificationId: z.string().trim().max(120).optional(), status: z.enum(["pending", "certified", "degraded", "disabled"]).default("pending"), metadata: z.record(z.string().max(80), z.unknown()).default({}) }).strict(),
]);

const paymentArtifactProviders = new Set<string>(["stripe", "paypal", "xendit"]);

async function sessionFor(req: NextRequest, permission: "pos:use" | "pos:shift_manage") {
  const session = await getStaffSession();
  if (!session?.user) return { response: correlatedJson(getCorrelationId(req), { error: "Unauthorized" }, { status: 401 }) };
  if (!staffSessionAllows(session, permission)) return { response: correlatedJson(getCorrelationId(req), { error: "Forbidden" }, { status: 403 }) };
  return { session };
}

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req); const auth = await sessionFor(req, "pos:use"); if ("response" in auth) return auth.response;
  const sup = adminSupabaseOr503(cid); if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, auth.session.user?.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  const [fiscal, certifications, terminals] = await Promise.all([
    sup.client.from("pos_fiscal_profiles").select("*").eq("organization_id", organization.id).order("created_at", { ascending: false }),
    sup.client.from("pos_terminal_certifications").select("*").eq("organization_id", organization.id).order("created_at", { ascending: false }),
    sup.client.from("pos_payment_terminals").select("*").eq("organization_id", organization.id).order("created_at", { ascending: false }),
  ]);
  if ([fiscal, certifications, terminals].some((result) => result.error && !/relation .* does not exist/i.test(result.error.message))) return correlatedJson(cid, { error: "Unable to load POS controls" }, { status: 503 });
  return correlatedJson(cid, { data: { fiscal: fiscal.data ?? [], certifications: certifications.data ?? [], paymentTerminals: terminals.data ?? [] } });
}

async function post(req: NextRequest) {
  const cid = getCorrelationId(req); const auth = await sessionFor(req, "pos:shift_manage"); if ("response" in auth) return auth.response;
  const body = await parseBoundedJson(req, 128 * 1024);
  if (body.tooLarge) return correlatedJson(cid, { error: "Payload too large" }, { status: 413 });
  const parsed = bodySchema.safeParse(body.valid ? body.value : null);
  if (!parsed.success) return correlatedJson(cid, { error: "Invalid POS control payload" }, { status: 400 });
  const sup = adminSupabaseOr503(cid); if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, auth.session.user?.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  const value = parsed.data;
  if (value.kind === "fiscal") {
    const fiscal = validateFiscalProfile({ jurisdiction: value.jurisdiction, registrationNumber: value.registrationNumber, invoicePrefix: value.invoicePrefix, enabled: value.enabled });
    const result = await sup.client.from("pos_fiscal_profiles").upsert({ organization_id: organization.id, jurisdiction: fiscal.jurisdiction, registration_number: fiscal.registrationNumber, invoice_prefix: fiscal.invoicePrefix, enabled: fiscal.enabled }, { onConflict: "organization_id,jurisdiction,registration_number" }).select("*").single();
    if (result.error) return correlatedJson(cid, { error: "Unable to save fiscal profile" }, { status: 503 }); return correlatedJson(cid, { data: result.data }, { status: 201 });
  }
  if (value.kind === "certification") {
    const certification = validateTerminalCertification({ provider: value.provider, model: value.model, firmware: value.firmware, certificationId: value.certificationId, expiresAt: value.expiresAt });
    const result = await sup.client.from("pos_terminal_certifications").upsert({ organization_id: organization.id, provider: certification.provider, model: certification.model, firmware: certification.firmware, certification_id: certification.certificationId, expires_at: certification.expiresAt }, { onConflict: "organization_id,certification_id" }).select("*").single();
    if (result.error) return correlatedJson(cid, { error: "Unable to save terminal certification" }, { status: 503 }); return correlatedJson(cid, { data: result.data }, { status: 201 });
  }
  if (value.deviceId && value.providerTerminalExternalId) {
    if (!paymentArtifactProviders.has(value.provider)) return correlatedJson(cid, { error: "Unsupported payment artifact provider" }, { status: 400 });
    const ok = await upsertPaymentTerminalArtifactBinding(sup.client, { organization_id: organization.id, merchant_identity: organization.id, provider: value.provider as PaymentProvider, external_id: value.providerTerminalExternalId, device_id: value.deviceId, model: value.model, serial_number: value.serialNumber, status: value.status, metadata: { ...value.metadata, certification_id: value.certificationId ?? null } });
    if (!ok) return correlatedJson(cid, { error: "Unable to save payment terminal artifact mapping" }, { status: 503 });
    const saved = await sup.client.from("pos_payment_terminals").select("*").eq("organization_id", organization.id).eq("provider_terminal_external_id", value.providerTerminalExternalId).single();
    if (saved.error) return correlatedJson(cid, { error: "Unable to load payment terminal" }, { status: 503 });
    return correlatedJson(cid, { data: saved.data }, { status: 201 });
  }
  const result = await sup.client.from("pos_payment_terminals").upsert({ organization_id: organization.id, device_id: value.deviceId ?? null, provider: value.provider, model: value.model, serial_number: value.serialNumber, provider_terminal_external_id: value.providerTerminalExternalId ?? null, certification_id: value.certificationId ?? null, status: value.status, metadata: value.metadata }, { onConflict: "organization_id,serial_number" }).select("*").single();
  if (result.error) return correlatedJson(cid, { error: "Unable to save payment terminal" }, { status: 503 }); return correlatedJson(cid, { data: result.data }, { status: 201 });
}

export const POST = withAdminMutationIdempotency("/admin/pos/enterprise:POST", post);
