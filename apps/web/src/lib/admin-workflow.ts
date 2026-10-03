const ALLOWED: Record<string, Set<string>> = {
  draft: new Set([
    "pending_review",
    "published",
    "archived",
    "failed",
    "canceled",
  ]),
  pending_review: new Set(["draft", "approved", "canceled", "failed"]),
  approved: new Set(["scheduled", "published", "draft", "failed"]),
  scheduled: new Set(["published", "draft", "canceled"]),
  published: new Set(["archived", "draft", "failed"]),
  archived: new Set(["draft"]),
  failed: new Set(["draft", "pending_review"]),
  canceled: new Set([]),
};

export function isAllowedTransition(from: string, to: string): boolean {
  const next = ALLOWED[from];
  return next ? next.has(to) : false;
}
