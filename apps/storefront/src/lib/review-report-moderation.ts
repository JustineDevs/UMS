export type ReviewModerationResult =
  | { status: 200; body: { ok: true } }
  | { status: 503; body: { error: string } };

export function reviewModerationResult(params: {
  openReportCount: number | null;
  countFailed: boolean;
  hideFailed: boolean;
}): ReviewModerationResult {
  if (params.countFailed) {
    return {
      status: 503,
      body: { error: "Report recorded, but moderation status is temporarily unavailable" },
    };
  }
  if ((params.openReportCount ?? 0) >= 3 && params.hideFailed) {
    return {
      status: 503,
      body: { error: "Report recorded, but moderation could not be applied" },
    };
  }
  return { status: 200, body: { ok: true } };
}
