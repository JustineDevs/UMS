import { medusaAdminFetch } from "@/lib/medusa-admin-http";

export type MedusaGovernanceResult = {
  ok: boolean;
  promotionCount: number;
  warnings: string[];
};

/**
 * Confirms Medusa promotion catalog is reachable before campaigns send discount messaging.
 * Medusa remains the single owner of cart discounts; campaigns must not imply unpublished codes.
 */
export async function validateCampaignAgainstMedusaPromotions(params: {
  bodyTemplate: string;
  subject: string;
}): Promise<MedusaGovernanceResult> {
  const warnings: string[] = [];
  try {
    const res = await medusaAdminFetch("/admin/promotions?limit=500");
    if (!res.ok) {
      warnings.push(`medusa_promotions_http_${res.status}`);
      return { ok: false, promotionCount: 0, warnings };
    }
    const json = (await res.json()) as {
      promotions?: Array<{ code?: string | null; status?: string }>;
      data?: Array<{ code?: string | null; status?: string }>;
    };
    const promos = json.promotions ?? json.data ?? [];
    const codes = new Set(
      promos
        .map((p) => String(p.code ?? "").trim().toUpperCase())
        .filter(Boolean),
    );
    const haystack = `${params.subject}\n${params.bodyTemplate}`.toUpperCase();
    /** Likely promo codes: letters+digits cluster (e.g. SAVE20), not plain words. */
    const tokenRe = /\b([A-Z]{2,}\d{2,}|\d{2,}[A-Z]{2,}|[A-Z]{2,}-\d{2,})\b/g;
    let m: RegExpExecArray | null;
    const mentioned: string[] = [];
    while ((m = tokenRe.exec(haystack)) !== null) {
      const tok = m[1].replace(/-/g, "");
      if (tok.length > 3 && codes.size > 0 && !codes.has(tok)) {
        mentioned.push(tok);
      }
    }
    if (mentioned.length > 0) {
      warnings.push(
        `campaign_mentions_tokens_not_in_medusa_promotions:${mentioned.slice(0, 8).join(",")}`,
      );
    }
    return {
      ok: mentioned.length === 0,
      promotionCount: promos.length,
      warnings,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    warnings.push(`governance_error:${msg.slice(0, 160)}`);
    return { ok: false, promotionCount: 0, warnings };
  }
}
