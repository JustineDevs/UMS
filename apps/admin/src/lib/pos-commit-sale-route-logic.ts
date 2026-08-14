import type { AdminApiErrorCode } from "@/lib/staff-api-response";
import { buildPosSaleFeatureMetadata } from "@universal-music-store/platform-data";

export type PosCommitSaleInput = {
  items?: Array<{ variantId: string; quantity: number }>;
  email?: string;
  offlineSaleId?: string;
  shiftId?: string;
  paymentTerminalId?: string;
  paymentMethod?: "cash" | "card" | "wallet";
  paymentReference?: string;
  receiptReference?: string;
  posFeatures?: {
    orderTag?: string;
    eInvoiceRequested?: boolean;
    eInvoiceCustomerEmail?: string;
    eInvoiceCustomerTin?: string;
  };
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
    { ok: true } | { ok: false; message: string; code: AdminApiErrorCode }
  >;
  loadShiftStatus: (_shiftId: string) => Promise<"open" | "closed" | "missing">;
  assertTerminalReady?: (_terminalId: string) => Promise<boolean>;
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
  recordSaleLedger?: (_input: {
    orderId: string;
    orderNumber: string;
    shiftId?: string;
    terminalId?: string;
    totalMinor: number;
    idempotencyKey?: string;
  }) => Promise<boolean>;
  rememberCompletedReplay: (
    _idempotencyKey: string,
    _orderNumber: string,
  ) => void;
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
    const existing =
      await input.findExistingOrderByOfflineSaleId(offlineSaleId);
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
  const shiftStatus = shiftId
    ? await input.loadShiftStatus(shiftId)
    : "missing";
  const terminalId =
    typeof input.body.paymentTerminalId === "string"
      ? input.body.paymentTerminalId.trim()
      : "";
  const paymentMethod = input.body.paymentMethod ?? "cash";
  const paymentReference = input.body.paymentReference?.trim() ?? "";
  if (paymentMethod !== "cash" && !terminalId && !paymentReference) {
    return {
      status: 409,
      body: {
        error: "A certified terminal or provider payment reference is required",
        code: "POS_POLICY_DENIED",
      },
      logPhase: "error",
      logDetail: {
        message:
          "A certified terminal or provider payment reference is required",
      },
    };
  }
  if (
    terminalId &&
    input.assertTerminalReady &&
    !(await input.assertTerminalReady(terminalId))
  ) {
    return {
      status: 409,
      body: {
        error: "Payment terminal is not certified and ready",
        code: "POS_POLICY_DENIED",
      },
      logPhase: "error",
      logDetail: { message: "Payment terminal is not certified and ready" },
    };
  }
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
  if (terminalId) metadata.pos_payment_terminal_id = terminalId;
  if (input.body.paymentMethod)
    metadata.pos_payment_method = input.body.paymentMethod;
  if (input.body.paymentReference?.trim()) {
    metadata.pos_payment_reference = input.body.paymentReference
      .trim()
      .slice(0, 160);
  }
  if (input.body.receiptReference?.trim()) {
    metadata.pos_receipt_reference = input.body.receiptReference
      .trim()
      .slice(0, 160);
  }
  Object.assign(
    metadata,
    buildPosSaleFeatureMetadata(input.body.posFeatures ?? {}),
  );

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
    order.display_id != null
      ? String(order.display_id)
      : String(order.id ?? "");
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
    if (input.recordSaleLedger && orderId) {
      const recorded = await input.recordSaleLedger({
        orderId,
        orderNumber,
        shiftId: shiftId || undefined,
        terminalId: terminalId || undefined,
        totalMinor:
          typeof order.total === "number" && Number.isFinite(order.total)
            ? Math.round(order.total)
            : 0,
        idempotencyKey: input.idempotencyKey,
      });
      if (!recorded) {
        return {
          status: 503,
          body: {
            error: "POS sale ledger unavailable",
            code: "SUPABASE_NOT_CONFIGURED",
          },
          logPhase: "error",
          logDetail: { message: "POS sale ledger unavailable", orderId },
        };
      }
    }
    input.rememberCompletedReplay(input.idempotencyKey, orderNumber);
  } else if (input.recordSaleLedger && orderId) {
    await input.recordSaleLedger({
      orderId,
      orderNumber,
      shiftId: shiftId || undefined,
      terminalId: terminalId || undefined,
      totalMinor:
        typeof order.total === "number" && Number.isFinite(order.total)
          ? Math.round(order.total)
          : 0,
    });
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
