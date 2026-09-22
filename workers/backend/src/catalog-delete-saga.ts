type DeleteDependencies = {
  archiveProvider: (_request: Request) => Promise<Response>;
  deleteProduct: (_request: Request, _productId: string) => Promise<Response>;
};

function json(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  const value: unknown = await response.clone().json().catch(() => null);
  return object(value) ? value : {};
}

async function archiveIdempotencyKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  const suffix = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `catalog-provider-archive:${suffix}`;
}

export async function deleteCatalogProductWithProviderArchive(
  request: Request,
  productId: string,
  dependencies: DeleteDependencies,
): Promise<Response> {
  if (request.method !== "DELETE") return json({ error: "method_not_allowed" }, 405);
  const normalizedProductId = productId.trim();
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (!normalizedProductId) return json({ error: "invalid_product_id" }, 400);
  if (!idempotencyKey) {
    return json({ error: "idempotency_key_required", code: "IDEMPOTENCY_KEY_REQUIRED" }, 400);
  }

  const archiveHeaders = new Headers();
  for (const header of ["Authorization", "X-Request-ID", "X-Correlation-ID"]) {
    const value = request.headers.get(header);
    if (value) archiveHeaders.set(header, value);
  }
  archiveHeaders.set("Idempotency-Key", await archiveIdempotencyKey(idempotencyKey));
  archiveHeaders.set("Content-Type", "application/json");
  const archiveRequest = new Request(request.url, {
    method: "DELETE",
    headers: archiveHeaders,
    body: JSON.stringify({ productId: normalizedProductId }),
  });

  let archiveResponse: Response;
  try {
    archiveResponse = await dependencies.archiveProvider(archiveRequest);
  } catch {
    return json({
      error: "provider_archive_failed_product_not_deleted",
      code: "CATALOG_PROVIDER_ARCHIVE_FAILED",
    }, 502);
  }
  if (!archiveResponse.ok) {
    const providerBody = await responseBody(archiveResponse);
    return json({
      error: "provider_archive_failed_product_not_deleted",
      code: "CATALOG_PROVIDER_ARCHIVE_FAILED",
      ...(typeof providerBody.code === "string" ? { providerCode: providerBody.code } : {}),
    }, archiveResponse.status >= 500 ? archiveResponse.status : 502);
  }

  const archiveBody = await responseBody(archiveResponse);
  const archiveData = object(archiveBody.data) ? archiveBody.data : {};
  let deleteResponse: Response;
  try {
    deleteResponse = await dependencies.deleteProduct(request, normalizedProductId);
  } catch {
    return json({ error: "catalog_product_delete_unavailable", code: "CATALOG_PRODUCT_DELETE_UNAVAILABLE" }, 503);
  }
  if (!deleteResponse.ok) return deleteResponse;

  const deleteBody = await responseBody(deleteResponse);
  if (deleteBody.deleted !== true || deleteBody.productId !== normalizedProductId) {
    return json({ error: "catalog_delete_response_invalid", code: "CATALOG_DELETE_RESPONSE_INVALID" }, 502);
  }
  return json({
    ...deleteBody,
    stripeCatalogArchive: {
      state: archiveData.archived === true ? "archived" : "no_artifacts",
      ...(typeof archiveData.reason === "string" ? { reason: archiveData.reason } : {}),
    },
  });
}
