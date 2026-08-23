import { z } from "zod";

export const PUBLIC_REVIEW_FIELDS =
  "id,rating,author_name,image_url,body,created_at,product_slug,medusa_product_id,is_verified_buyer,helpful_votes,status" as const;

export const PUBLIC_REVIEW_FIELD_NAMES = PUBLIC_REVIEW_FIELDS.split(",");

export const reviewReportBodySchema = z.object({
  reason: z.enum(["spam", "harassment", "hate", "personal_data", "other"]),
  details: z.string().trim().max(500).nullable().optional(),
  csrfToken: z.string().trim().min(20).max(500),
}).strict();

export type ReviewCursor = { createdAt: string; id?: string };

export function encodeReviewCursor(createdAt: string, id: string): string {
  return `${encodeURIComponent(createdAt)}:${id}`;
}

export function decodeReviewCursor(value: string): ReviewCursor | null {
  const raw = value.trim();
  if (!raw) return null;

  // Preserve cursors issued before the composite timestamp/id format.
  if (Number.isFinite(Date.parse(raw))) return { createdAt: raw };

  const separator = raw.lastIndexOf(":");
  if (separator < 1) return null;
  let createdAt: string;
  try {
    createdAt = decodeURIComponent(raw.slice(0, separator));
  } catch {
    return null;
  }
  const id = raw.slice(separator + 1);
  if (!Number.isFinite(Date.parse(createdAt)) || !isReviewId(id)) return null;
  return { createdAt, id };
}

export function isReviewId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

export function publicReviewFieldsAreSafe(): boolean {
  return PUBLIC_REVIEW_FIELD_NAMES.includes("helpful_votes") &&
    !PUBLIC_REVIEW_FIELD_NAMES.some((field) =>
      ["customer_email", "medusa_customer_id", "verified_medusa_order_id", "risk_score"].includes(field),
    );
}
