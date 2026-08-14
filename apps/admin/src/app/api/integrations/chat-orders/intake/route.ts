import {
  tryCreateSupabaseClient,
  staffHasPermission,
} from "@universal-music-store/database";
import {
  getMedusaAdminSdk,
  getMedusaRegionId,
  getMedusaSalesChannelId,
} from "@/lib/medusa-pos";
import { logAdminApiEvent } from "@/lib/admin-api-log";
import { getCorrelationId } from "@/lib/request-correlation";
import { requireStaffSession } from "@/lib/requireStaffSession";
import {
  correlatedJson,
  correlatedError,
  tagResponse,
} from "@/lib/staff-api-response";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { parseAdminJson, verifySignedRequest } from "@/lib/admin-api-security";
import { getStaffSession } from "@/lib/requireStaffSession";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { z } from "zod";

export const dynamic = "force-dynamic";

type IntakeItem = { variantId: string; quantity: number };
const intakeSchema = z
  .object({
    source: z.string().trim().min(1).max(40).default("chat"),
    raw_text: z.string().max(10_000).optional(),
    phone: z.string().trim().max(40).optional(),
    address: z.string().trim().max(500).optional(),
    items: z
      .array(
        z
          .object({
            variantId: z.string().trim().min(1).max(128),
            quantity: z.number().int().positive().max(100),
          })
          .strict(),
      )
      .min(1, "At least one item is required")
      .max(100),
  })
  .strict();

export async function POST(req: Request) {
  const correlationId = getCorrelationId(req);
  const internalKey = process.env.INTERNAL_CHAT_INTAKE_KEY?.trim();
  const headerKey = req.headers.get("x-internal-key")?.trim();
  const useInternal = internalKey && headerKey === internalKey;

  if (!useInternal) {
    const staff = await requireStaffSession();
    if (!staff.ok) {
      return tagResponse(staff.response, correlationId);
    }
    const session = await getServerSession(authOptions);
    const perms = session?.user?.permissions;
    if (!staffHasPermission(perms ?? [], "chat_orders:manage")) {
      return correlatedError(
        correlationId,
        403,
        "Forbidden",
        "MISSING_PERMISSION",
      );
    }
  }

  if (useInternal && process.env.NODE_ENV === "production") {
    const secret = process.env.INTERNAL_CHAT_INTAKE_KEY?.trim();
    const timestamp = req.headers.get("x-internal-timestamp") ?? "";
    const signature = req.headers.get("x-internal-signature") ?? "";
    const raw = await req.clone().text();
    if (!secret || !verifySignedRequest(raw, secret, signature, timestamp)) {
      return correlatedError(
        correlationId,
        401,
        "Unauthorized",
        "UNAUTHORIZED",
      );
    }
  }

  const parsed = await parseAdminJson(req, intakeSchema);
  if (!parsed.ok)
    return correlatedError(
      correlationId,
      parsed.status,
      parsed.error,
      "VALIDATION_ERROR",
    );
  const body = parsed.data;
  const actorSession = useInternal ? null : await getStaffSession();
  const idempotencyKey = req.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || !/^[A-Za-z0-9._:-]{8,200}$/.test(idempotencyKey)) {
    return correlatedError(
      correlationId,
      400,
      "Idempotency-Key is required",
      "BAD_REQUEST",
    );
  }

  const source = body.source;
  const items: IntakeItem[] = [];
  for (const row of body.items ?? [])
    items.push({ variantId: row.variantId, quantity: row.quantity });

  const supabase = tryCreateSupabaseClient();
  if (!supabase) {
    return correlatedError(
      correlationId,
      503,
      "Supabase is not configured",
      "SUPABASE_NOT_CONFIGURED",
    );
  }
  const organizationId = useInternal
    ? process.env.INTERNAL_CHAT_ORGANIZATION_ID?.trim()
    : (await resolveStaffOrganization(supabase, actorSession?.user?.email))?.id;
  if (!organizationId) {
    return correlatedError(
      correlationId,
      403,
      "Organization membership is not configured",
      "FORBIDDEN",
    );
  }
  const { data: existing } = await supabase
    .from("chat_order_intake")
    .select("id,medusa_draft_order_id,status")
    .eq("idempotency_key", idempotencyKey)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (existing) {
    return correlatedJson(correlationId, {
      intakeId: existing.id,
      draftOrderId: existing.medusa_draft_order_id ?? null,
      status: existing.status,
      replayed: true,
    });
  }
  const { data: inserted, error: insErr } = await supabase
    .from("chat_order_intake")
    .insert({
      idempotency_key: idempotencyKey,
      organization_id: organizationId,
      source,
      raw_text: body.raw_text ?? null,
      phone: body.phone ?? null,
      address: body.address ?? null,
      items,
      status: "pending",
      metadata: { correlation_id: correlationId },
    })
    .select("id")
    .maybeSingle();

  if (insErr?.code === "23505") {
    const { data: raced } = await supabase
      .from("chat_order_intake")
      .select("id,medusa_draft_order_id,status")
      .eq("idempotency_key", idempotencyKey)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (raced)
      return correlatedJson(correlationId, {
        intakeId: raced.id,
        draftOrderId: raced.medusa_draft_order_id ?? null,
        status: raced.status,
        replayed: true,
      });
  }
  if (insErr || !inserted?.id) {
    logAdminApiEvent({
      route: "POST /api/integrations/chat-orders/intake",
      correlationId,
      phase: "error",
      detail: { db: insErr?.message },
    });
    return correlatedError(
      correlationId,
      502,
      "Unable to record chat order",
      "INTERNAL_ERROR",
    );
  }

  let draftOrderId: string | undefined;
  if (items.length > 0) {
    const adminSdk = getMedusaAdminSdk();
    const regionId = getMedusaRegionId();
    const salesChannelId = getMedusaSalesChannelId();
    if (adminSdk && regionId && salesChannelId) {
      try {
        const { draft_order } = await adminSdk.admin.draftOrder.create({
          email: "chat-intake@instore.local",
          region_id: regionId,
          sales_channel_id: salesChannelId,
          items: items.map((i) => ({
            variant_id: i.variantId,
            quantity: Math.max(1, Math.floor(Number(i.quantity) || 1)),
          })),
          metadata: { chat_intake_id: inserted.id },
        });
        draftOrderId = draft_order?.id;
        if (draftOrderId) {
          await supabase
            .from("chat_order_intake")
            .update({
              medusa_draft_order_id: draftOrderId,
              status: "draft_created",
            })
            .eq("id", inserted.id);
        }
      } catch (e) {
        logAdminApiEvent({
          route: "POST /api/integrations/chat-orders/intake",
          correlationId,
          phase: "error",
          detail: { medusa: e instanceof Error ? e.message : String(e) },
        });
      }
    }
  }

  logAdminApiEvent({
    route: "POST /api/integrations/chat-orders/intake",
    correlationId,
    phase: "ok",
    detail: { intakeId: inserted.id },
  });

  return correlatedJson(correlationId, {
    intakeId: inserted.id,
    draftOrderId: draftOrderId ?? null,
  });
}
