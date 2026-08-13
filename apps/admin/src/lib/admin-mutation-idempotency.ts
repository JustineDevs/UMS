import { NextResponse } from "next/server";
import { checkStaffRole } from "@universal-music-store/database";
import { adminSupabaseOr503 } from "./require-admin-supabase";
import { getStaffSession } from "./requireStaffSession";
import { resolveStaffOrganization } from "./staff-organization";
import {
  claimAdminIdempotency,
  completeAdminIdempotency,
  getIdempotencyKey,
  getRequestHash,
} from "./admin-api-security";

function errorResponse(error: string, code: string, status: number): Response {
  return NextResponse.json({ error, code }, { status });
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
    const idempotencyKey = getIdempotencyKey(request);
    if (!idempotencyKey) {
      return errorResponse("Idempotency-Key is required", "IDEMPOTENCY_KEY_REQUIRED", 400);
    }

    const session = await getStaffSession();
    if (!session) {
      return errorResponse("Unauthorized", "NO_SESSION", 401);
    }
    const roleCheck = checkStaffRole(session);
    if (!roleCheck.ok) {
      return errorResponse(
        roleCheck.status === 401 ? "Unauthorized" : "Forbidden",
        roleCheck.code,
        roleCheck.status,
      );
    }

    const supabase = adminSupabaseOr503("admin-mutation-idempotency");
    if ("response" in supabase) {
      return errorResponse("Admin data service unavailable", "ADMIN_DATA_UNAVAILABLE", 503);
    }
    const organization = await resolveStaffOrganization(
      supabase.client,
      session.user?.email,
    );
    if (!organization) {
      return errorResponse("Organization membership is required", "ORGANIZATION_REQUIRED", 403);
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
      return NextResponse.json(claim.body, { status: claim.status });
    }
    if (claim.kind === "conflict") {
      return errorResponse("Idempotency key was already used", "IDEMPOTENCY_CONFLICT", 409);
    }
    if (claim.kind === "unavailable") {
      return errorResponse("Admin data service unavailable", "ADMIN_DATA_UNAVAILABLE", 503);
    }

    let response: Response | undefined;
    try {
      response = await handler(
        request as Parameters<T>[0],
        context as Parameters<T>[1],
      );
    } catch {
      const failure = errorResponse("Mutation failed", "MUTATION_FAILED", 500);
      await completeAdminIdempotency(supabase.client, claim.id, failure.status, { error: "MUTATION_FAILED" });
      return failure;
    }
    if (!response) {
      const failure = errorResponse("Mutation did not return a response", "MUTATION_NO_RESPONSE", 500);
      await completeAdminIdempotency(supabase.client, claim.id, failure.status, { error: "MUTATION_NO_RESPONSE" });
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
    return response;
  };
  return wrapped as T;
}
