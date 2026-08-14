import { NextResponse } from "next/server";

export function tagResponse(
  res: NextResponse,
  correlationId: string,
): NextResponse {
  res.headers.set("x-request-id", correlationId);
  return res;
}

export function correlatedJson(
  correlationId: string,
  body: unknown,
  init?: Parameters<typeof NextResponse.json>[1],
): NextResponse {
  const res = NextResponse.json(body, init);
  return tagResponse(res, correlationId);
}

export type AdminApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "MISSING_PERMISSION"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR"
  | "SUPABASE_NOT_CONFIGURED"
  | "MEDUSA_UNAVAILABLE"
  | "VALIDATION_ERROR"
  | "INSUFFICIENT_STOCK"
  | "INVENTORY_CHECK_FAILED"
  | "POS_POLICY_DENIED";

/**
 * Standard error response for admin API routes.
 * All error responses follow `{ error: string, code: AdminApiErrorCode, requestId: string }`.
 */
export function correlatedError(
  correlationId: string,
  status: number,
  message: string,
  code: AdminApiErrorCode,
): NextResponse {
  const safeMessage =
    code === "INTERNAL_ERROR" || code === "SERVICE_UNAVAILABLE" || code === "MEDUSA_UNAVAILABLE"
      ? "The request could not be completed."
      : message;
  return correlatedJson(
    correlationId,
    { error: safeMessage, code, requestId: correlationId },
    { status },
  );
}
