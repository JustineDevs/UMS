import { checkStaffRole } from "@universal-music-store/database";
import { adminSupabaseOr503 } from "./require-admin-supabase";
import { getStaffSession } from "./requireStaffSession";
import { resolveStaffOrganization } from "./staff-organization";
import { insertStaffAuditLog } from "./staff-audit";
import {
  claimAdminIdempotency,
  completeAdminIdempotency,
  getIdempotencyKey,
  getRequestHash,
} from "./admin-api-security";
import { getCorrelationId } from "./request-correlation";
import { correlatedError, correlatedJson } from "./staff-api-response";
import { notifyStorefrontCmsInvalidation } from "./storefront-commerce-invalidation";

async function auditMutation(
  client: Parameters<typeof insertStaffAuditLog>[0],
  email: string,
  actionKey: string,
  organizationId: string,
  status: number,
  outcome: "completed" | "failed",
): Promise<void> {
  await insertStaffAuditLog(client, {
    actorEmail: email,
    action: outcome === "completed" ? "cms_mutation_completed" : "cms_mutation_failed",
    resource: "cms_mutation",
    details: { action_key: actionKey, organization_id: organizationId, status, outcome },
  });
}

/**
 * Durable replay boundary for admin mutations that do not need provider-specific
 * idempotency semantics. The route remains responsible for its own permission
 * and resource checks; this wrapper owns actor, tenant, key, and response replay.
 */
export function withAdminMutationIdempotency<T extends (...args: any[]) => Promise<Response | undefined>>(
  actionKey: string,
  handler: T,
): T {
  const wrapped = async (request: Request, context?: unknown) => {
    const correlationId = getCorrelationId(request);
    const idempotencyKey = getIdempotencyKey(request);
    if (!idempotencyKey) {
      return correlatedError(correlationId, 400, "Idempotency-Key is required", "BAD_REQUEST");
    }

    const session = await getStaffSession();
    if (!session) {
      return correlatedError(correlationId, 401, "Unauthorized", "UNAUTHORIZED");
    }
    const roleCheck = checkStaffRole(session);
    if (!roleCheck.ok) {
      return correlatedError(
        correlationId,
        roleCheck.status,
        roleCheck.status === 401 ? "Unauthorized" : "Forbidden",
        roleCheck.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
      );
    }

    const supabase = adminSupabaseOr503("admin-mutation-idempotency");
    if ("response" in supabase) {
      return correlatedError(correlationId, 503, "Admin data service unavailable", "SERVICE_UNAVAILABLE");
    }
    const organization = await resolveStaffOrganization(
      supabase.client,
      session.user?.email,
    );
    if (!organization) {
      return correlatedError(correlationId, 403, "Organization membership is required", "FORBIDDEN");
    }

    const rawBody = await request.clone().text();
    const requestHash = getRequestHash(rawBody);
    const actorKey = `${organization.id}:${session.user?.email?.toLowerCase() ?? "unknown"}`;
    const claim = await claimAdminIdempotency(supabase.client, {
      actorKey,
      actionKey,
      idempotencyKey,
      requestHash,
    });

    if (claim.kind === "replay") {
      return correlatedJson(correlationId, { ...claim.body, requestId: correlationId }, { status: claim.status });
    }
    if (claim.kind === "conflict") {
      return correlatedError(correlationId, 409, "Idempotency key was already used", "CONFLICT");
    }
    if (claim.kind === "unavailable") {
      return correlatedError(correlationId, 503, "Admin data service unavailable", "SERVICE_UNAVAILABLE");
    }

    let response: Response | undefined;
    try {
      response = await handler(
        request as Parameters<T>[0],
        context as Parameters<T>[1],
      );
    } catch {
      const failure = correlatedError(correlationId, 500, "Mutation failed", "INTERNAL_ERROR");
      await completeAdminIdempotency(supabase.client, claim.id, failure.status, { error: "MUTATION_FAILED" });
      await auditMutation(supabase.client, session.user?.email ?? "unknown", actionKey, organization.id, failure.status, "failed");
      return failure;
    }
    if (!response) {
      const failure = correlatedError(correlationId, 500, "Mutation did not return a response", "INTERNAL_ERROR");
      await completeAdminIdempotency(supabase.client, claim.id, failure.status, { error: "MUTATION_NO_RESPONSE" });
      await auditMutation(supabase.client, session.user?.email ?? "unknown", actionKey, organization.id, failure.status, "failed");
      return failure;
    }
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await response.clone().json();
      body = parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : { data: parsed };
    } catch {
      body = { ok: response.ok };
    }
    await completeAdminIdempotency(supabase.client, claim.id, response.status, body);
    await auditMutation(supabase.client, session.user?.email ?? "unknown", actionKey, organization.id, response.status, "completed");
    if (actionKey.startsWith("/admin/cms/") && response.ok) {
      await notifyStorefrontCmsInvalidation({ actorEmail: session.user?.email, reason: actionKey });
    }
    response.headers.set("x-request-id", correlationId);
    return response;
  };
  return wrapped as T;
}
