/* global describe, it, expect */
import crypto from "node:crypto";

import {
  applyJntWebhookEvent,
  prepareJntWebhookEvent,
  verifyJntHmac,
} from "./route-logic";

describe("J&T webhook preparation", () => {
  const secret = "jnt-secret";

  function sign(body: string): string {
    return crypto.createHmac("sha256", secret).update(body).digest("hex");
  }

  it("rejects missing signing configuration", () => {
    const result = prepareJntWebhookEvent({
      secret: undefined,
      rawBody: Buffer.from("{}"),
      signatureHeader: "sig",
    });
    expect(result.status).toBe(503);
  });

  it("verifies valid HMAC signatures (hex)", () => {
    const body = Buffer.from('{"orderNo":"order_1","status":"SIGNED"}');
    expect(verifyJntHmac(body, sign(body.toString("utf8")), secret)).toBe(true);
    expect(verifyJntHmac(body, "bad", secret)).toBe(false);
  });

  it("rejects invalid signatures and malformed JSON", () => {
    const body = Buffer.from("{not-json");
    const invalidSignature = prepareJntWebhookEvent({
      secret,
      rawBody: body,
      signatureHeader: "bad",
    });
    expect(invalidSignature.status).toBe(401);

    const malformed = prepareJntWebhookEvent({
      secret,
      rawBody: body,
      signatureHeader: sign(body.toString("utf8")),
    });
    expect(malformed.status).toBe(400);
  });

  it("includes sha256 payload hash on parsed tracking events", () => {
    const payload = { orderNo: "order_1", status: "TRANSIT", billCode: "JT123" };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const result = prepareJntWebhookEvent({
      secret,
      rawBody,
      signatureHeader: sign(rawBody.toString("utf8")),
    });
    expect(result.parsed?.payloadHash).toBe(
      crypto.createHash("sha256").update(rawBody).digest("hex"),
    );
    expect(result.parsed?.dedupId).toContain(result.parsed?.payloadHash);
  });

  it("skips payloads without orderNo", () => {
    const noOrderBody = Buffer.from(JSON.stringify({ billCode: "JT123", status: "SIGNED" }));
    const result = prepareJntWebhookEvent({
      secret,
      rawBody: noOrderBody,
      signatureHeader: sign(noOrderBody.toString("utf8")),
    });
    expect(result.body).toEqual({ received: true, skipped: true });
  });

  it("maps status and extracts lastCheckpoint from statusDesc and updateTime", () => {
    const payload = {
      orderNo: "order_1",
      billCode: "JT123",
      status: "SIGNED",
      statusDesc: "Package delivered",
      updateTime: "2026-04-18 10:00:00",
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const result = prepareJntWebhookEvent({
      secret,
      rawBody,
      signatureHeader: sign(rawBody.toString("utf8")),
    });
    expect(result.parsed?.mappedStatus).toBe("delivered");
    expect(result.parsed?.lastCheckpoint).toBe("Package delivered · 2026-04-18 10:00:00");
    expect(result.parsed?.trackingNumber).toBe("JT123");
    expect(result.parsed?.orderId).toBe("order_1");
  });

  it("uses distinct dedup ids for same-status events with different payloads", () => {
    const firstPayload = Buffer.from(
      JSON.stringify({
        orderNo: "order_1",
        billCode: "JT123",
        status: "TRANSIT",
        statusDesc: "Checkpoint A",
        updateTime: "2026-04-18 10:00:00",
      }),
    );
    const secondPayload = Buffer.from(
      JSON.stringify({
        orderNo: "order_1",
        billCode: "JT123",
        status: "TRANSIT",
        statusDesc: "Checkpoint B",
        updateTime: "2026-04-18 11:00:00",
      }),
    );

    const first = prepareJntWebhookEvent({
      secret,
      rawBody: firstPayload,
      signatureHeader: sign(firstPayload.toString("utf8")),
    });
    const second = prepareJntWebhookEvent({
      secret,
      rawBody: secondPayload,
      signatureHeader: sign(secondPayload.toString("utf8")),
    });

    expect(first.parsed?.dedupId).not.toBe(second.parsed?.dedupId);
  });
});

describe("J&T webhook mutation safety", () => {
  function parsedDelivered() {
    return {
      orderId: "order_1",
      statusCode: "SIGNED",
      trackingNumber: "JT123",
      dedupId: "jnt:order_1:SIGNED:deadbeef",
      mappedStatus: "delivered",
      lastCheckpoint: "Delivered · 2026-04-18 10:00:00",
      payloadHash: "deadbeef",
    };
  }

  it("returns duplicate without mutating state twice", async () => {
    const result = await applyJntWebhookEvent({
      parsed: parsedDelivered(),
      claimDedup: async () => false,
      releaseDedupClaim: async () => {},
      recordWebhookEvent: async () => ({ inserted: false }),
      updateOrderMetadata: async () => {
        throw new Error("should not update");
      },
      mergePaymentAttemptPayload: async () => {
        throw new Error("should not merge");
      },
      getCodCaptureState: async () => null,
      captureCodPayment: async () => {},
      enqueueCaptureRetry: async () => {},
      markWebhookProcessed: async () => {},
      nowIso: () => "2026-04-18T10:00:00Z",
      log: () => {},
    });

    expect(result).toEqual({ status: 200, body: { received: true, duplicate: true } });
  });

  it("updates order metadata with jnt_* keys and marks webhook processed", async () => {
    const merged: Array<Record<string, unknown>> = [];
    const updated: Array<Record<string, unknown>> = [];
    let processed = false;

    const result = await applyJntWebhookEvent({
      parsed: {
        ...parsedDelivered(),
        mappedStatus: "in_transit",
        statusCode: "TRANSIT",
        dedupId: "jnt:order_1:TRANSIT:deadbeef",
      },
      claimDedup: async () => true,
      releaseDedupClaim: async () => {},
      recordWebhookEvent: async () => ({ inserted: true, id: "wh_1" }),
      updateOrderMetadata: async (_orderId, meta) => {
        updated.push(meta);
      },
      mergePaymentAttemptPayload: async (_orderId, merge) => {
        merged.push(merge);
      },
      getCodCaptureState: async () => null,
      captureCodPayment: async () => {},
      enqueueCaptureRetry: async () => {},
      markWebhookProcessed: async () => {
        processed = true;
      },
      nowIso: () => "2026-04-18T10:00:00Z",
      log: () => {},
    });

    expect(result).toEqual({ status: 200, body: { received: true } });
    expect(updated[0].jnt_status).toBe("in_transit");
    expect(updated[0].jnt_status_code).toBe("TRANSIT");
    expect(merged[0].jnt_status).toBe("in_transit");
    expect(processed).toBe(true);
  });

  it("captures COD payment exactly once when delivered", async () => {
    const merged: Array<Record<string, unknown>> = [];
    const captured: string[] = [];

    const result = await applyJntWebhookEvent({
      parsed: parsedDelivered(),
      claimDedup: async () => true,
      releaseDedupClaim: async () => {},
      recordWebhookEvent: async () => ({ inserted: true, id: "wh_1" }),
      updateOrderMetadata: async () => {},
      mergePaymentAttemptPayload: async (_orderId, merge) => {
        merged.push(merge);
      },
      getCodCaptureState: async () => ({ paymentId: "pay_1", alreadyCaptured: false }),
      captureCodPayment: async (paymentId) => {
        captured.push(paymentId);
      },
      enqueueCaptureRetry: async () => {},
      markWebhookProcessed: async () => {},
      nowIso: () => "2026-04-18T10:00:00Z",
      log: () => {},
    });

    expect(result).toEqual({ status: 200, body: { received: true } });
    expect(captured).toEqual(["pay_1"]);
    expect(merged.some((entry) => entry.cod_capture_complete === true)).toBe(true);
    expect(merged.some((entry) => entry.cod_capture_source === "jnt_webhook")).toBe(true);
  });

  it("does not recapture already captured COD payments", async () => {
    let captureCalled = false;

    const result = await applyJntWebhookEvent({
      parsed: parsedDelivered(),
      claimDedup: async () => true,
      releaseDedupClaim: async () => {},
      recordWebhookEvent: async () => ({ inserted: true, id: "wh_1" }),
      updateOrderMetadata: async () => {},
      mergePaymentAttemptPayload: async () => {},
      getCodCaptureState: async () => ({ paymentId: "pay_1", alreadyCaptured: true }),
      captureCodPayment: async () => {
        captureCalled = true;
      },
      enqueueCaptureRetry: async () => {},
      markWebhookProcessed: async () => {},
      nowIso: () => "2026-04-18T10:00:00Z",
      log: () => {},
    });

    expect(result).toEqual({
      status: 200,
      body: { received: true, cod_capture: "already_captured" },
    });
    expect(captureCalled).toBe(false);
  });

  it("marks needs review and enqueues retry when COD capture fails", async () => {
    const merged: Array<Record<string, unknown>> = [];
    const queued: Array<{ orderId: string; error: string }> = [];

    const result = await applyJntWebhookEvent({
      parsed: parsedDelivered(),
      claimDedup: async () => true,
      releaseDedupClaim: async () => {},
      recordWebhookEvent: async () => ({ inserted: true, id: "wh_1" }),
      updateOrderMetadata: async () => {},
      mergePaymentAttemptPayload: async (_orderId, merge) => {
        merged.push(merge);
      },
      getCodCaptureState: async () => ({ paymentId: "pay_1", alreadyCaptured: false }),
      captureCodPayment: async () => {
        throw new Error("capture failed");
      },
      enqueueCaptureRetry: async (orderId, error) => {
        queued.push({ orderId, error });
      },
      markWebhookProcessed: async () => {},
      nowIso: () => "2026-04-18T10:00:00Z",
      log: () => {},
    });

    expect(result).toEqual({ status: 200, body: { received: true } });
    expect(merged.some((entry) => entry.cod_needs_review === true)).toBe(true);
    expect(queued).toEqual([{ orderId: "order_1", error: "capture failed" }]);
  });

  it("releases the dedup claim when downstream mutation fails", async () => {
    const released: string[] = [];

    await expect(
      applyJntWebhookEvent({
        parsed: parsedDelivered(),
        claimDedup: async () => true,
        releaseDedupClaim: async (dedupId) => {
          released.push(dedupId);
        },
        recordWebhookEvent: async () => ({ inserted: true, id: "wh_1" }),
        updateOrderMetadata: async () => {
          throw new Error("db write failed");
        },
        mergePaymentAttemptPayload: async () => {},
        getCodCaptureState: async () => null,
        captureCodPayment: async () => {},
        enqueueCaptureRetry: async () => {},
        markWebhookProcessed: async () => {},
        nowIso: () => "2026-04-18T10:00:00Z",
        log: () => {},
      }),
    ).rejects.toThrow("db write failed");

    expect(released).toEqual(["jnt:order_1:SIGNED:deadbeef"]);
  });
});
