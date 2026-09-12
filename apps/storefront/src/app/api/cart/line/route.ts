import { NextResponse } from "next/server";
import { z } from "zod";
import {
  applyRateLimit,
  clearCartCookie,
  parseJsonBody,
  readCartIdFromCookie,
} from "@/lib/cart-api-helpers";
import { isSameOriginMutation } from "@/lib/request-origin";

const bodySchema = z
  .object({
    variantId: z.string().trim().min(1).max(200),
    quantity: z.number().int().min(0).max(10_000).optional(),
  })
  .strict();

function workerBaseUrl(): string | null {
  const value = process.env.API_URL?.trim().replace(/\/$/, "");
  return value || null;
}

async function workerCartLineIds(cartId: string, variantId: string): Promise<string[]> {
  const baseUrl = workerBaseUrl();
  if (!baseUrl) throw new Error("worker_api_not_configured");
  const response = await fetch(
    `${baseUrl}/store/carts/${encodeURIComponent(cartId)}`,
    { headers: { Accept: "application/json" }, cache: "no-store" },
  );
  if (response.status === 404) throw new Error("cart_not_found");
  if (!response.ok) throw new Error(`worker_cart_${response.status}`);
  const payload = (await response.json()) as {
    cart?: { items?: Array<{ id?: unknown; variant_id?: unknown }> };
  };
  return (payload.cart?.items ?? [])
    .filter(
      (item): item is { id: string; variant_id: string } =>
        typeof item.id === "string" && item.id.length > 0 && item.variant_id === variantId,
    )
    .map((item) => item.id);
}

async function updateWorkerLine(
  cartId: string,
  lineId: string,
  quantity: number,
): Promise<Response> {
  const baseUrl = workerBaseUrl();
  if (!baseUrl) throw new Error("worker_api_not_configured");
  return fetch(
    `${baseUrl}/store/carts/${encodeURIComponent(cartId)}/line-items/${encodeURIComponent(lineId)}`,
    {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Idempotency-Key": `storefront-cart-line-${crypto.randomUUID()}`,
      },
      body: JSON.stringify({ quantity }),
      cache: "no-store",
    },
  );
}

/** Updates a quantity on the cookie-bound Worker cart without clamping it. */
export async function PUT(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json(
      { error: "Cross-site mutation rejected" },
      { status: 403 },
    );
  }
  const rateLimit = await applyRateLimit(
    request,
    "cart-line-update",
    60,
    60_000,
  );
  if (!rateLimit.ok) return rateLimit.response;

  const parsed = await parseJsonBody<unknown>(request);
  if (!parsed.ok) return parsed.response;
  const body = bodySchema.safeParse(parsed.data);
  if (!body.success || body.data.quantity === undefined) {
    return NextResponse.json(
      { error: "Invalid cart line quantity" },
      { status: 400 },
    );
  }

  const cartId = await readCartIdFromCookie();
  if (!cartId)
    return NextResponse.json({ ok: true, updated: 0, skipped: true });

  try {
    const lineIds = await workerCartLineIds(
      cartId,
      body.data.variantId,
    );
    if (body.data.quantity === 0) {
      for (const lineId of lineIds) {
        const response = await updateWorkerLine(cartId, lineId, 0);
        if (!response.ok && response.status !== 404) {
          throw new Error(`worker_cart_line_${response.status}`);
        }
      }
      return NextResponse.json({
        ok: true,
        updated: 0,
        removed: lineIds.length,
      });
    }
    const [lineId, ...duplicateIds] = lineIds;
    if (!lineId) return NextResponse.json({ ok: true, updated: 0 });
    const updateResponse = await updateWorkerLine(cartId, lineId, body.data.quantity);
    if (!updateResponse.ok) {
      const payload = (await updateResponse.json().catch(() => null)) as { error?: unknown } | null;
      throw new Error(typeof payload?.error === "string" ? payload.error : `worker_cart_line_${updateResponse.status}`);
    }
    for (const duplicateId of duplicateIds) {
      const response = await updateWorkerLine(cartId, duplicateId, 0);
      if (!response.ok && response.status !== 404) {
        throw new Error(`worker_cart_line_${response.status}`);
      }
    }
    return NextResponse.json({
      ok: true,
      updated: 1,
      removed: duplicateIds.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/cart_not_found|already completed|completed/i.test(message)) {
      await clearCartCookie();
      return NextResponse.json(
        { error: "Cart expired", code: "CART_COMPLETED", recovered: true },
        { status: 409 },
      );
    }
    console.error("[cart/line] update failed", message);
    return NextResponse.json(
      { error: "Cart line could not be updated" },
      { status: 502 },
    );
  }
}

/** Removes a zero-quantity variant from the cookie-bound Worker cart. */
export async function DELETE(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json(
      { error: "Cross-site mutation rejected" },
      { status: 403 },
    );
  }
  const rateLimit = await applyRateLimit(
    request,
    "cart-line-delete",
    30,
    60_000,
  );
  if (!rateLimit.ok) return rateLimit.response;

  const parsed = await parseJsonBody<unknown>(request);
  if (!parsed.ok) return parsed.response;
  const body = bodySchema.safeParse(parsed.data);
  if (!body.success)
    return NextResponse.json({ error: "Invalid cart line" }, { status: 400 });

  const cartId = await readCartIdFromCookie();
  if (!cartId)
    return NextResponse.json({ ok: true, removed: 0, skipped: true });

  try {
    const lineIds = await workerCartLineIds(
      cartId,
      body.data.variantId,
    );
    for (const lineId of lineIds) {
      const response = await updateWorkerLine(cartId, lineId, 0);
      if (!response.ok && response.status !== 404) {
        throw new Error(`worker_cart_line_${response.status}`);
      }
    }
    return NextResponse.json({ ok: true, removed: lineIds.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/cart_not_found|already completed|completed/i.test(message)) {
      await clearCartCookie();
      return NextResponse.json(
        { error: "Cart expired", code: "CART_COMPLETED", recovered: true },
        { status: 409 },
      );
    }
    console.error("[cart/line] delete failed", message);
    return NextResponse.json(
      { error: "Cart line could not be removed" },
      { status: 502 },
    );
  }
}
