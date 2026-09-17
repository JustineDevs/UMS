/**
 * Shared typed outcomes for admin command handlers (application layer).
 * API routes map these to HTTP + correlated JSON.
 */

export type AdminOk<T> = { ok: true; data: T };
export type AdminErr = {
  ok: false;
  code: string;
  message: string;
  httpStatus: number;
};

export type AdminOperationResult<T> = AdminOk<T> | AdminErr;

export function adminOk<T>(data: T): AdminOk<T> {
  return { ok: true, data };
}

export function adminErr(
  code: string,
  message: string,
  httpStatus: number,
): AdminErr {
  return { ok: false, code, message, httpStatus };
}
