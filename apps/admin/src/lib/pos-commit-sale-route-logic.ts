import type { AdminApiErrorCode } from "@/lib/staff-api-response";

export type PosCommitSaleInput = {
  items?: Array<{ variantId: string; quantity: number }>;
  email?: string;
  offlineSaleId?: string;
  shiftId?: string;
};

export type PosCommitSaleRouteResult =
  | {
      status: number;
      body: {
        orderNumber: string;
        orderId?: string;
        idempotent?: boolean;
      };
      logPhase: "ok";
      logDetail: Record<string, unknown>;
    }
  | {
      status: number;
      body: {
        error: string;
        code: AdminApiErrorCode;
      };
      logPhase: "error";
      logDetail: Record<string, unknown>;
    };

type PosCommitSaleLogicInput = {
  body: PosCommitSaleInput;
  correlationId: string;
  idempotencyKey?: string;
  envReady: boolean;
  completedReplayOrderNumber: string | null;
  findExistingOrderByOfflineSaleId: (
    _offlineSaleId: string,
  ) => Promise<{ id: string; displayId: string } | null>;
  assertStock: (
    _items: Array<{ variantId: string; quantity: number }>,
  ) => Promise<
    | { ok: true }
    | { ok: false; message: string; code: AdminApiErrorCode }
  >;
  loadShiftStatus: (_shiftId: string) => Promise<"open" | "closed" | "missing">;
  evaluatePolicy: (_input: {
    stockVerified: true;
    hasOpenShift: boolean;
    shiftIdProvided: boolean;
  }) => { allowed: boolean; violations: string[] };
  createDraftOrder: (_input: {
    email: string;
    items: Array<{ variant_id: string; quantity: number }>;
    metadata?: Record<string, unknown>;
  }) => Promise<{ id?: string }>;
  convertDraftToOrder: (
    _draftOrderId: string,
  ) => Promise<{ id?: string; display_id?: string | number; total?: number }>;
  patchOrderMetadata: (
    _orderId: string,
    _metadata: Record<string, unknown>,
  ) => Promise<void>;
  rememberCompletedReplay: (_idempotencyKey: string, _orderNumber: string) => void;
};

export async function posCommitSaleRouteLogic(
  input: PosCommitSaleLogicInput,
): Promise<PosCommitSaleRouteResult> {
  if (!input.envReady) {
    return {
      status: 503,
      body: {
        error:
          "POS environment incomplete (MEDUSA_SECRET_API_KEY, MEDUSA_REGION_ID, MEDUSA_SALES_CHANNEL_ID)",
        code: "MEDUSA_UNAVAILABLE",
      },
      logPhase: "error",
      logDetail: {
        message:
          "POS environment incomplete (MEDUSA_SECRET_API_KEY, MEDUSA_REGION_ID, MEDUSA_SALES_CHANNEL_ID)",
      },
    };
  }

  if (input.idempotencyKey?.trim() && input.completedReplayOrderNumber) {
    return {
      status: 200,
      body: {
        orderNumber: input.completedReplayOrderNumber,
        idempotent: true,
      },
      logPhase: "ok",
      logDetail: {
        orderNumber: input.completedReplayOrderNumber,
        idempotent: true,
        replay: true,
      },
    };
  }

  const items = Array.isArray(input.body.items) ? input.body.items : [];
  if (items.length === 0) {
    return {
      status: 400,
      body: { error: "No items", code: "BAD_REQUEST" },
      logPhase: "error",
      logDetail: { message: "No items" },
    };
  }

  const offlineSaleId =
    typeof input.body.offlineSaleId === "string"
      ? input.body.offlineSaleId.trim()
      : "";
  if (offlineSaleId) {
    const existing = await input.findExistingOrderByOfflineSaleId(offlineSaleId);
    if (existing) {
      return {
        status: 200,
        body: { orderNumber: existing.displayId, idempotent: true },
        logPhase: "ok",
        logDetail: { orderNumber: existing.displayId, idempotent: true },
      };
    }
  }

  const stock = await input.assertStock(items);
  if (!stock.ok) {
    return {
      status: stock.code === "INSUFFICIENT_STOCK" ? 409 : 502,
      body: { error: stock.message, code: stock.code },
      logPhase: "error",
      logDetail: { message: stock.message, code: stock.code },
    };
  }

  const shiftId =
    typeof input.body.shiftId === "string" ? input.body.shiftId.trim() : "";
  const shiftStatus = shiftId ? await input.loadShiftStatus(shiftId) : "missing";
  const policy = input.evaluatePolicy({
    stockVerified: true,
    hasOpenShift: shiftStatus === "open",
    shiftIdProvided: Boolean(shiftId),
  });
  if (!policy.allowed) {
    return {
      status: 403,
      body: {
        error: policy.violations.join("; ") || "POS policy denied",
        code: "POS_POLICY_DENIED",
      },
      logPhase: "error",
      logDetail: {
        message: policy.violations.join("; ") || "POS policy denied",
      },
    };
  }

  const metadata: Record<string, unknown> = {};
  if (offlineSaleId) metadata.pos_offline_id = offlineSaleId;
  if (shiftId) metadata.pos_shift_id = shiftId;

  const draftOrder = await input.createDraftOrder({
    email: (input.body.email?.trim() || "pos@instore.local").slice(0, 320),
    items: items.map((item) => ({
      variant_id: item.variantId,
      quantity: Math.max(1, Math.floor(item.quantity)),
    })),
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  });

  if (!draftOrder.id) {
    return {
      status: 502,
      body: {
        error: "Draft order missing id from the store API",
        code: "MEDUSA_UNAVAILABLE",
      },
      logPhase: "error",
      logDetail: { message: "Draft order missing id from the store API" },
    };
  }

  const order = await input.convertDraftToOrder(draftOrder.id);
  if (order.id && Object.keys(metadata).length > 0) {
    await input.patchOrderMetadata(order.id, metadata);
  }

  const orderNumber =
    order.display_id != null ? String(order.display_id) : String(order.id ?? "");
  const orderId = order.id != null ? String(order.id) : undefined;

  if (!orderNumber) {
    return {
      status: 502,
      body: {
        error: "Converted draft order missing identifiers from the store API",
        code: "MEDUSA_UNAVAILABLE",
      },
      logPhase: "error",
      logDetail: {
        message: "Converted draft order missing identifiers from the store API",
      },
    };
  }

  if (input.idempotencyKey?.trim()) {
    input.rememberCompletedReplay(input.idempotencyKey, orderNumber);
  }

  return {
    status: 200,
    body: { orderNumber, orderId },
    logPhase: "ok",
    logDetail: {
      orderNumber,
      pos_sale: {
        order_id: orderId || orderNumber,
        total_minor:
          typeof order.total === "number" && Number.isFinite(order.total)
            ? Math.round(order.total)
            : 0,
      },
    },
  };
}
