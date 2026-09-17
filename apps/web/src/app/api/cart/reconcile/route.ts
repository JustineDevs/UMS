import { z } from "zod";
import { applyRateLimit } from "@/lib/cart-api-helpers";
import { isSameOriginMutation } from "@/lib/request-origin";
import { parseBoundedJson } from "@/lib/bounded-request-body";

export const dynamic = "force-dynamic";

const requestSchema = z
  .object({
    lines: z
      .array(
        z
          .object({
            variantId: z.string().trim().min(1).max(200),
            quantity: z.number().int().min(1).max(999),
          })
          .strict(),
      )
      .max(50),
  })
  .strict();

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return Response.json(
      { error: "Cross-site mutation rejected" },
      { status: 403 },
    );
  }
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > 64 * 1024) {
    return Response.json({ error: "Request body too large" }, { status: 413 });
  }
  const rateLimit = await applyRateLimit(request, "cart-reconcile", 30, 60_000);
  if (!rateLimit.ok) return rateLimit.response;

  const bounded = await parseBoundedJson(request, 64 * 1024);
  if (bounded.tooLarge) {
    return Response.json({ error: "Request body too large" }, { status: 413 });
  }
  const parsed = requestSchema.safeParse(bounded.valid ? bounded.value : null);
  if (!parsed.success)
    return Response.json({ error: "Invalid cart lines" }, { status: 400 });

  const workerApiUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!workerApiUrl) {
    return Response.json(
      { error: "Catalog reconciliation is temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const response = await fetch(`${workerApiUrl}/store/cart/reconcile`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    });
    return new Response(await response.text(), {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "application/json",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return Response.json(
      { error: "Catalog reconciliation is temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
