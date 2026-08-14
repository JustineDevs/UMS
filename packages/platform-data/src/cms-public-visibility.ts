import type { CmsPublishStatus } from "./cms-types.js";

/**
 * Whether a CMS page or blog row may be shown on the public storefront.
 * Draft is never public. Scheduled becomes public once scheduled_publish_at is in the past.
 */
export function isCmsPubliclyVisible(
  status: CmsPublishStatus,
  scheduledPublishAt: string | null,
  nowMs: number = Date.now(),
): boolean {
  if (status === "draft") return false;
  if (status === "published") return true;
  if (status === "scheduled") {
    if (!scheduledPublishAt?.trim()) return false;
    const t = new Date(scheduledPublishAt).getTime();
    return Number.isFinite(t) && t <= nowMs;
  }
  return false;
}
