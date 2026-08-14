import type { NextResponse } from "next/server";
import {
  correlatedError,
  correlatedJson,
  tagResponse,
} from "./staff-api-response";
import type {
  PosCommitSaleInput,
  PosCommitSaleRouteResult,
} from "./pos-commit-sale-route-logic";
import type { AdminApiLogPhase } from "./admin-api-log";

type StaffResult = { ok: true } | { ok: false; response: NextResponse };

export type PosCommitSaleRouteDeps = {
  getCorrelationId: (_req: Request) => string;
  requireStaffApiSession: (_permission: string) => Promise<StaffResult>;
  logAdminApiEvent: (_payload: {
    route: string;
    correlationId: string;
    phase: AdminApiLogPhase;
    detail?: Record<string, unknown>;
  }) => void;
  getIdempotencyKey: (_req: Request) => string | undefined;
  getCompletedReplayOrderNumber: (_key: string) => string | undefined;
  isInflight: (_key: string) => boolean;
  startInflight: (_key: string) => void;
  clearInflight: (_key: string) => void;
  executeCommitSale: (_input: {
    body: PosCommitSaleInput;
    correlationId: string;
    idempotencyKey?: string;
    organizationId?: string;
  }) => Promise<PosCommitSaleRouteResult>;
  resolveOrganizationId?: (_correlationId: string) => Promise<string | null>;
};

export async function handlePosCommitSaleRequest(
  req: Request,
  deps: PosCommitSaleRouteDeps,
): Promise<Response> {
  const correlationId = deps.getCorrelationId(req);
  const staff = await deps.requireStaffApiSession("pos:use");
  if (!staff.ok) {
    return tagResponse(staff.response, correlationId);
  }
  const organizationId = deps.resolveOrganizationId
    ? await deps.resolveOrganizationId(correlationId)
    : undefined;
  if (deps.resolveOrganizationId && !organizationId) {
    return correlatedError(
      correlationId,
      403,
      "Organization scope required",
      "FORBIDDEN",
    );
  }

  deps.logAdminApiEvent({
    route: "POST /api/pos/medusa/commit-sale",
    correlationId,
    phase: "start",
  });

  const idempotencyKey = deps.getIdempotencyKey(req)?.trim();
  if (idempotencyKey) {
    const replay = deps.getCompletedReplayOrderNumber(idempotencyKey);
    if (replay) {
      deps.logAdminApiEvent({
        route: "POST /api/pos/medusa/commit-sale",
        correlationId,
        phase: "ok",
        detail: { orderNumber: replay, idempotent: true, replay: true },
      });
      return correlatedJson(correlationId, {
        orderNumber: replay,
        idempotent: true,
      });
    }

    if (deps.isInflight(idempotencyKey)) {
      return correlatedError(
        correlationId,
        409,
        "Duplicate request in flight",
        "CONFLICT",
      );
    }
    deps.startInflight(idempotencyKey);
  }

  const body = (await req.json().catch(() => ({}))) as PosCommitSaleInput;

  try {
    const result = await deps.executeCommitSale({
      body,
      correlationId,
      idempotencyKey,
      organizationId: organizationId ?? undefined,
    });

    deps.logAdminApiEvent({
      route: "POST /api/pos/medusa/commit-sale",
      correlationId,
      phase: result.logPhase,
      detail: result.logDetail,
    });

    if (result.logPhase === "error") {
      return correlatedError(
        correlationId,
        result.status,
        result.body.error,
        result.body.code,
      );
    }

    return correlatedJson(correlationId, result.body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unable to complete POS sale";
    deps.logAdminApiEvent({
      route: "POST /api/pos/medusa/commit-sale",
      correlationId,
      phase: "error",
      detail: { message: msg },
    });
    return correlatedError(correlationId, 502, msg, "INTERNAL_ERROR");
  } finally {
    if (idempotencyKey) deps.clearInflight(idempotencyKey);
  }
}
