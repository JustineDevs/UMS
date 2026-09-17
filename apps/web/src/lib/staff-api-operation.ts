import type { AdminOperationResult } from "@/lib/admin-operation-result";
import { correlatedJson } from "@/lib/staff-api-response";

/**
 * Maps application-layer {@link AdminOperationResult} to Next `Response` JSON.
 */
export function jsonFromAdminOperationResult<T>(
  correlationId: string,
  result: AdminOperationResult<T>,
  successStatus: number,
): ReturnType<typeof correlatedJson> {
  if (!result.ok) {
    return correlatedJson(
      correlationId,
      { error: result.message, code: result.code },
      { status: result.httpStatus },
    );
  }
  return correlatedJson(correlationId, result.data as unknown, {
    status: successStatus,
  });
}
