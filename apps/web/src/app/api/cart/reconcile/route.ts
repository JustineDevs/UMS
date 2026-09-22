import { applyRateLimit } from "@/lib/cart-api-helpers";
import { isSameOriginMutation } from "@/lib/request-origin";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { getCorrelationId } from "@/lib/request-correlation";
import { cartReconcileErrorResponseSchema, cartReconcileRequestSchema, cartReconcileResponseSchema } from "@/lib/admin-api-contracts";
import { readResponseJson } from "@/lib/read-response-json";

export const dynamic = "force-dynamic";


export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);
  if (!isSameOriginMutation(request)) {
    return Response.json(
      { error: "Cross-site mutation rejected" },
      { status: 403, headers: { "x-request-id": correlationId } },
    );
  }
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > 64 * 1024) {
    return Response.json({ error: "Request body too large", requestId: correlationId }, { status: 413, headers: { "x-request-id": correlationId } });
  }
  const rateLimit = await applyRateLimit(request, "cart-reconcile", 30, 60_000);
  if (!rateLimit.ok) {
    rateLimit.response.headers.set("x-request-id", correlationId);
    return rateLimit.response;
  }

  const bounded = await parseBoundedJson(request, 64 * 1024);
  if (bounded.tooLarge) {
    return Response.json({ error: "Request body too large", requestId: correlationId }, { status: 413, headers: { "x-request-id": correlationId } });
  }
  const parsed = cartReconcileRequestSchema.safeParse(bounded.valid ? bounded.value : null);
  if (!parsed.success)
    return Response.json({ error: "Invalid cart lines", requestId: correlationId }, { status: 400, headers: { "x-request-id": correlationId } });

  const workerApiUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!workerApiUrl) {
    return Response.json(
      { error: "Catalog reconciliation is temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store", "x-request-id": correlationId } },
    );
  }
  try {
    const response = await fetch(`${workerApiUrl}/store/cart/reconcile`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await readResponseJson<unknown>(response, null);
    if (!response.ok) {
      // The Worker uses a structured, redacted 503 for line-level catalog
      // misses. Preserve that public contract only after schema validation;
      // never forward arbitrary upstream error bodies.
      const validatedError = cartReconcileErrorResponseSchema.safeParse(payload);
      if (validatedError.success) {
        return Response.json(validatedError.data, {
          status: response.status >= 400 && response.status < 600 ? response.status : 502,
          headers: { "Cache-Control": "no-store", "x-request-id": correlationId },
        });
      }
      return Response.json(
        { error: "Catalog reconciliation failed", requestId: correlationId },
        { status: response.status >= 400 && response.status < 600 ? response.status : 502, headers: { "Cache-Control": "no-store", "x-request-id": correlationId } },
      );
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return Response.json(
        { error: "Catalog reconciliation returned an invalid response", requestId: correlationId },
        { status: 502, headers: { "Cache-Control": "no-store", "x-request-id": correlationId } },
      );
    }
    const validated = cartReconcileResponseSchema.safeParse(payload);
    if (!validated.success) return Response.json({ error: "Catalog reconciliation returned an invalid response", requestId: correlationId }, { status: 502, headers: { "Cache-Control": "no-store", "x-request-id": correlationId } });
    return Response.json(validated.data, { status: response.status, headers: { "Cache-Control": "no-store", "x-request-id": correlationId } });
  } catch {
    return Response.json(
      { error: "Catalog reconciliation is temporarily unavailable", requestId: correlationId },
      { status: 503, headers: { "Cache-Control": "no-store", "x-request-id": correlationId } },
    );
  }
}
