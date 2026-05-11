/* global jest, describe, it, expect, beforeEach, afterAll */
import crypto from "node:crypto";

import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

import { POST } from "./route";
import { claimJntWebhookDedup } from "../../../lib/jnt-webhook-dedup";
import {
  enqueueReconciliationJob,
  findPaymentAttemptByMedusaOrderId,
  markWebhookProcessed,
  mergePaymentAttemptPayloadByMedusaOrderId,
  recordWebhookEvent,
  tryCreateSupabaseClient,
} from "../../../lib/payment-supabase-bridge";

jest.mock("../../../lib/payment-supabase-bridge", () => ({
  enqueueReconciliationJob: jest.fn().mockResolvedValue(undefined),
  findPaymentAttemptByMedusaOrderId: jest.fn().mockResolvedValue(null),
  markWebhookProcessed: jest.fn(),
  mergePaymentAttemptPayloadByMedusaOrderId: jest.fn(),
  PAYMENT_RECONCILIATION_JOB_TYPES: { CAPTURE_COD_PAYMENT: "capture_cod_payment" },
  recordWebhookEvent: jest.fn(),
  tryCreateSupabaseClient: jest.fn(),
}));

jest.mock("../../../lib/jnt-webhook-dedup", () => {
  const actual = jest.requireActual<
    typeof import("../../../lib/jnt-webhook-dedup")
  >("../../../lib/jnt-webhook-dedup");
  return {
    ...actual,
    claimJntWebhookDedup: jest.fn(),
  };
});

const mockCaptureRun = jest.fn();
jest.mock("@medusajs/medusa/core-flows", () => ({
  capturePaymentWorkflow: jest.fn(() => ({ run: mockCaptureRun })),
}));

function sign(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

function createRes() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

function createReq(rawBody: Buffer, signature: string | undefined, options?: {
  codPaymentId?: string | null;
  alreadyCaptured?: boolean;
}) {
  const logger = { info: jest.fn(), warn: jest.fn() };
  const orderModule = {
    retrieveOrder: jest.fn().mockResolvedValue({ id: "order_1", metadata: { prior: true } }),
    updateOrders: jest.fn().mockResolvedValue(undefined),
  };
  const query = {
    graph: jest.fn().mockResolvedValue({
      data: [
        {
          payment_collections: [
            {
              payments: options?.codPaymentId
                ? [
                    {
                      id: options.codPaymentId,
                      provider_id: "pp_cod_cod",
                      captured_at: null,
                    },
                  ]
                : [],
            },
          ],
        },
      ],
    }),
  };

  const scope = {
    resolve(token: unknown) {
      if (token === ContainerRegistrationKeys.LOGGER) return logger;
      if (token === ContainerRegistrationKeys.QUERY) return query;
      if (token === Modules.ORDER) return orderModule;
      throw new Error(`unexpected resolve token: ${String(token)}`);
    },
  };

  return {
    headers: {
      "x-jnt-signature": signature,
    },
    rawBody,
    scope,
    __orderModule: orderModule,
    __query: query,
    __logger: logger,
  };
}

describe("J&T webhook route", () => {
  const secret = "jnt-secret";
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      JNT_WEBHOOK_SECRET: secret,
    };
    (tryCreateSupabaseClient as jest.Mock).mockReturnValue({ kind: "supabase" });
    (recordWebhookEvent as jest.Mock).mockResolvedValue({ inserted: true, id: "wh_1" });
    (mergePaymentAttemptPayloadByMedusaOrderId as jest.Mock).mockResolvedValue(undefined);
    (markWebhookProcessed as jest.Mock).mockResolvedValue(undefined);
    (claimJntWebhookDedup as jest.Mock).mockResolvedValue(true);
    (enqueueReconciliationJob as jest.Mock).mockResolvedValue(undefined);
    (findPaymentAttemptByMedusaOrderId as jest.Mock).mockResolvedValue(null);
    mockCaptureRun.mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("rejects invalid signatures before mutation", async () => {
    const body = Buffer.from(JSON.stringify({ orderNo: "order_1", billCode: "JT123", status: "TRANSIT" }));
    const req = createReq(body, "bad");
    const res = createRes();

    await POST(req as never, res as never);

    expect(res.statusCode).toBe(401);
    expect(recordWebhookEvent).not.toHaveBeenCalled();
    expect(markWebhookProcessed).not.toHaveBeenCalled();
  });

  it("updates order metadata and ledger exactly once for a transit event", async () => {
    const payload = JSON.stringify({
      orderNo: "order_1",
      billCode: "JT123",
      status: "TRANSIT",
      statusDesc: "Package moving",
      updateTime: "2026-04-18 10:00:00",
    });
    const req = createReq(Buffer.from(payload), sign(payload, secret));
    const res = createRes();

    await POST(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(recordWebhookEvent).toHaveBeenCalledTimes(1);
    expect(mergePaymentAttemptPayloadByMedusaOrderId).toHaveBeenCalledTimes(1);
    expect(markWebhookProcessed).toHaveBeenCalledWith({ kind: "supabase" }, "wh_1", true, undefined);
    expect(req.__orderModule.updateOrders).toHaveBeenCalledTimes(1);
    expect(mockCaptureRun).not.toHaveBeenCalled();
  });

  it("captures COD exactly once on SIGNED (delivered) events", async () => {
    const payload = JSON.stringify({
      orderNo: "order_1",
      billCode: "JT123",
      status: "SIGNED",
    });
    const req = createReq(Buffer.from(payload), sign(payload, secret), {
      codPaymentId: "pay_1",
    });
    const res = createRes();

    await POST(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(mockCaptureRun).toHaveBeenCalledWith({ input: { payment_id: "pay_1" } });
    expect(mergePaymentAttemptPayloadByMedusaOrderId).toHaveBeenCalled();
    expect(markWebhookProcessed).toHaveBeenCalledWith({ kind: "supabase" }, "wh_1", true, undefined);
  });

  it("returns duplicate without reapplying mutations", async () => {
    (claimJntWebhookDedup as jest.Mock).mockResolvedValue(false);
    const payload = JSON.stringify({
      orderNo: "order_1",
      billCode: "JT123",
      status: "SIGNED",
    });
    const req = createReq(Buffer.from(payload), sign(payload, secret));
    const res = createRes();

    await POST(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true, duplicate: true });
    expect(recordWebhookEvent).not.toHaveBeenCalled();
    expect(req.__orderModule.updateOrders).not.toHaveBeenCalled();
  });

  it("fails explicitly when webhook deduplication is unavailable", async () => {
    (claimJntWebhookDedup as jest.Mock).mockRejectedValue(
      new Error("JNT_DEDUP_UNAVAILABLE"),
    );
    const payload = JSON.stringify({
      orderNo: "order_1",
      billCode: "JT123",
      status: "SIGNED",
    });
    const req = createReq(Buffer.from(payload), sign(payload, secret));
    const res = createRes();

    await POST(req as never, res as never);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({
      error: "J&T webhook deduplication is not configured",
      code: "WEBHOOK_DEDUP_UNAVAILABLE",
    });
    expect(recordWebhookEvent).not.toHaveBeenCalled();
    expect(req.__orderModule.updateOrders).not.toHaveBeenCalled();
  });
});
