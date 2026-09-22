import { fetchWorkerPromotionCodesForAdmin } from "@/lib/worker-admin-bridge";

export type PromotionGovernanceResult = {
  ok: boolean;
  promotionCount: number;
  warnings: string[];
};

/**
 * Confirms the commerce promotion catalog is reachable before campaigns send
 * discount messaging. The Worker owns this read so admin never falls back to
 * a separate Medusa HTTP runtime.
 */
export async function validateCampaignAgainstWorkerPromotions(params: {
  bodyTemplate: string;
  subject: string;
}): Promise<PromotionGovernanceResult> {
  const warnings: string[] = [];
  try {
    const codesList = await fetchWorkerPromotionCodesForAdmin();
    if (!codesList) {
      warnings.push("worker_promotions_unavailable");
      return { ok: false, promotionCount: 0, warnings };
    }
    const codes = new Set(
      codesList.flatMap((code) => {
        const normalized = code.trim().toUpperCase();
        return normalized ? [normalized] : [];
      }),
    );
    const haystack = `${params.subject}\n${params.bodyTemplate}`.toUpperCase();
    /** Likely promo codes: letters+digits cluster (e.g. SAVE20), not plain words. */
    const tokenRe = /\b([A-Z]{2,}\d{2,}|\d{2,}[A-Z]{2,}|[A-Z]{2,}-\d{2,})\b/g;
    let m: RegExpExecArray | null;
    const mentioned: string[] = [];
    while ((m = tokenRe.exec(haystack)) !== null) {
      const tok = m[1].replace(/-/g, "");
      if (tok.length > 3 && !codes.has(tok)) {
        mentioned.push(tok);
      }
    }
    if (mentioned.length > 0) {
      warnings.push(
        `campaign_mentions_tokens_not_in_commerce_promotions:${mentioned.slice(0, 8).join(",")}`,
      );
    }
    return {
      ok: mentioned.length === 0,
      promotionCount: codes.size,
      warnings,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    warnings.push(`governance_error:${msg.slice(0, 160)}`);
    return { ok: false, promotionCount: 0, warnings };
  }
}
