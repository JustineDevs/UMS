import type {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils";
import { z } from "@medusajs/framework/zod";
import {
  createReservationsWorkflow,
  deleteReservationsWorkflow,
} from "@medusajs/medusa/core-flows";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const operationSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("reserve"),
    tenant_id: z.string().trim().min(1).max(255),
    location_id: z.string().trim().min(1).max(255),
    inventory_item_id: z.string().trim().min(1).max(255),
    quantity: z.number().int().positive().max(1_000_000),
    idempotency_key: z.string().trim().min(8).max(255),
    reference_type: z.string().trim().max(80).optional(),
    reference_id: z.string().trim().max(255).optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  }).strict(),
  z.object({
    operation: z.enum(["release", "commit"]),
    tenant_id: z.string().trim().min(1).max(255),
    reservation_id: z.string().trim().min(1).max(255),
    idempotency_key: z.string().trim().min(8).max(255),
  }).strict(),
]);

function tryCreateSupabaseClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || (!serviceKey && !anonKey)) return null;
  return createClient(url, serviceKey ?? anonKey!);
}

function availableFromLevel(level: Record<string, unknown> | undefined): number {
  if (!level) return 0;
  const stocked = Number(level.stocked_quantity ?? 0);
  const reserved = Number(level.reserved_quantity ?? 0);
  return Math.max(0, Math.floor(stocked - reserved));
}

async function getAvailableQuantity(
  req: MedusaRequest,
  input: { inventory_item_id: string; location_id: string },
): Promise<number> {
  const inventory = req.scope.resolve(Modules.INVENTORY) as unknown as {
    listInventoryLevels: (filters: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
  };
  const levels = await inventory.listInventoryLevels({
    inventory_item_id: input.inventory_item_id,
    location_id: input.location_id,
  });
  return availableFromLevel(levels[0]);
}

async function runLifecycleRpc(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc("inventory_reservation_lifecycle", args);
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const parsed = operationSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid inventory reservation payload" });
    return;
  }
  const supabase = tryCreateSupabaseClient();
  if (!supabase) {
    res.status(503).json({
      error: "Inventory reservation ledger is not configured",
      code: "INVENTORY_RESERVATIONS_NOT_CONFIGURED",
    });
    return;
  }

  const body = parsed.data;
  if (body.operation === "reserve") {
    const availableQuantity = await getAvailableQuantity(req, body);
    const ledger = await runLifecycleRpc(supabase, {
      p_operation: "reserve",
      p_tenant_id: body.tenant_id,
      p_location_id: body.location_id,
      p_inventory_item_id: body.inventory_item_id,
      p_quantity: body.quantity,
      p_available_quantity: availableQuantity,
      p_idempotency_key: body.idempotency_key,
      p_reference_type: body.reference_type ?? null,
      p_reference_id: body.reference_id ?? null,
      p_metadata: body.metadata,
    });
    const medusaReservationId = String(ledger.medusa_reservation_id ?? "");
    if (medusaReservationId) {
      res.status(200).json({ reservation: ledger, medusa_reservation_id: medusaReservationId });
      return;
    }
    let result: { id?: string }[];
    try {
      ({ result } = await createReservationsWorkflow(req.scope).run({
        input: {
          reservations: [
            {
              location_id: body.location_id,
              inventory_item_id: body.inventory_item_id,
              quantity: body.quantity,
              description: `tenant:${body.tenant_id}`,
              metadata: {
                ...body.metadata,
                tenant_id: body.tenant_id,
                inventory_reservation_id: ledger.id,
                idempotency_key: body.idempotency_key,
              },
            },
          ],
        },
      }));
    } catch (error) {
      await runLifecycleRpc(supabase, {
        p_operation: "release",
        p_tenant_id: body.tenant_id,
        p_reservation_id: ledger.id,
        p_idempotency_key: `${body.idempotency_key}:compensate`,
      }).catch(() => undefined);
      throw error;
    }
    const reservationId = String(result[0]?.id ?? "");
    try {
      await runLifecycleRpc(supabase, {
        p_operation: "attach_medusa",
        p_tenant_id: body.tenant_id,
        p_reservation_id: ledger.id,
        p_idempotency_key: `${body.idempotency_key}:attach`,
        p_medusa_reservation_id: reservationId,
      });
    } catch (error) {
      await deleteReservationsWorkflow(req.scope).run({
        input: { ids: [reservationId] },
      }).catch(() => undefined);
      await runLifecycleRpc(supabase, {
        p_operation: "release",
        p_tenant_id: body.tenant_id,
        p_reservation_id: ledger.id,
        p_idempotency_key: `${body.idempotency_key}:compensate`,
      }).catch(() => undefined);
      throw error;
    }
    res.status(200).json({
      reservation: { ...ledger, medusa_reservation_id: reservationId },
      medusa_reservation_id: reservationId,
    });
    return;
  }

  const ledger = await runLifecycleRpc(supabase, {
    p_operation: body.operation,
    p_tenant_id: body.tenant_id,
    p_reservation_id: body.reservation_id,
    p_idempotency_key: body.idempotency_key,
  });
  const medusaReservationId = String(ledger.medusa_reservation_id ?? "");
  if (!medusaReservationId) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Inventory reservation is missing its Medusa reservation id",
    );
  }
  if (!ledger.medusa_closed_at) {
    await deleteReservationsWorkflow(req.scope).run({
      input: { ids: [medusaReservationId] },
    });
    await runLifecycleRpc(supabase, {
      p_operation: "close_medusa",
      p_tenant_id: body.tenant_id,
      p_reservation_id: body.reservation_id,
      p_idempotency_key: `${body.idempotency_key}:close`,
    });
  }
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as {
    info?: (message: string) => void;
  };
  logger.info?.(`inventory reservation ${body.operation}: ${body.reservation_id}`);
  res.status(200).json({ reservation: ledger, medusa_reservation_id: medusaReservationId });
}
