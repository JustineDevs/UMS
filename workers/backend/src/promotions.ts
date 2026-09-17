import type { WorkerDatabaseClient } from "./database.ts";
import { withWorkerTransaction } from "./database.ts";

type Promotion = {
  id: string;
  code: string;
  status: string;
  limit: number | null;
  used: number | null;
  method_id: string;
  value: string | number;
  method_type: string;
  target_type: string;
  currency_code: string | null;
  starts_at: string | null;
  ends_at: string | null;
  rule_count: number | string;
};

type CartTotal = { currency_code: string; subtotal: string | number };

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function parseBody(value: unknown): { cartId: string; code: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const cartId = typeof input.cartId === "string" ? input.cartId.trim() : "";
  const code = typeof input.code === "string" ? input.code.trim().toUpperCase() : "";
  if (!cartId || cartId.length > 120 || !code || code.length > 64) return null;
  return { cartId, code };
}

async function readPromotion(
  transaction: WorkerDatabaseClient,
  cartId: string,
  code: string,
): Promise<Promotion | null> {
  const result = await transaction.query<Promotion>(
    `SELECT p.id, p.code, p.status, p.limit, p.used,
            pam.id AS method_id, pam.value, pam.type AS method_type,
            pam.target_type, pam.currency_code,
            pc.starts_at, pc.ends_at,
            (SELECT count(*) FROM public.promotion_promotion_rule ppr
             JOIN public.promotion_rule pr ON pr.id = ppr.promotion_rule_id
             WHERE ppr.promotion_id = p.id AND ppr.deleted_at IS NULL
               AND pr.deleted_at IS NULL) AS rule_count
     FROM public.cart c
     JOIN public.promotion p ON upper(p.code) = upper($2) AND p.deleted_at IS NULL
     LEFT JOIN public.promotion_campaign pc ON pc.id = p.campaign_id AND pc.deleted_at IS NULL
     JOIN public.promotion_application_method pam
       ON pam.promotion_id = p.id AND pam.deleted_at IS NULL
     WHERE c.id = $1 AND c.deleted_at IS NULL AND c.completed_at IS NULL
     ORDER BY pam.created_at DESC
     LIMIT 1`,
    [cartId, code],
  );
  return result.rows[0] ?? null;
}

function invalidPromotion(promotion: Promotion | null): string | null {
  if (!promotion) return "promotion_invalid";
  if (!/active/i.test(promotion.status)) return "promotion_inactive";
  const now = Date.now();
  if (promotion.starts_at && Date.parse(promotion.starts_at) > now) return "promotion_not_started";
  if (promotion.ends_at && Date.parse(promotion.ends_at) <= now) return "promotion_expired";
  if (promotion.limit !== null && Number(promotion.used ?? 0) >= promotion.limit) return "promotion_limit_reached";
  if (Number(promotion.rule_count) > 0) return "promotion_rules_unsupported";
  if (!/^(fixed|percentage)$/i.test(promotion.method_type)) return "promotion_type_unsupported";
  if (!/^(order|items)$/i.test(promotion.target_type)) return "promotion_target_unsupported";
  return null;
}

function calculateDiscount(promotion: Promotion, subtotal: number, currency: string): number | null {
  if (promotion.method_type.toLowerCase() === "fixed" && promotion.currency_code && promotion.currency_code.toLowerCase() !== currency.toLowerCase()) return null;
  const value = Number(promotion.value);
  if (!Number.isFinite(value) || value < 0) return null;
  const discount = promotion.method_type.toLowerCase() === "percentage"
    ? Math.round(subtotal * value / 100)
    : Math.round(value);
  return Math.max(0, Math.min(subtotal, discount));
}

export async function handlePromotionRequest(
  request: Request,
  database: WorkerDatabaseClient,
): Promise<Response> {
  if (request.method !== "POST" && request.method !== "DELETE") return json({ error: "method_not_allowed" }, 405);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const input = parseBody(body);
  if (!input) return json({ error: "cart_and_code_required" }, 400);

  try {
    return await withWorkerTransaction(database, async (transaction) => {
      const cart = await transaction.query<{ id: string; currency_code: string }>(
        `SELECT id, currency_code FROM public.cart
         WHERE id = $1 AND deleted_at IS NULL AND completed_at IS NULL
         FOR UPDATE`,
        [input.cartId],
      );
      const cartRow = cart.rows[0];
      if (!cartRow) return json({ error: "cart_not_available" }, 409);
      const subtotalResult = await transaction.query<{ subtotal: string | number }>(
        `SELECT COALESCE(sum(unit_price * quantity), 0) AS subtotal
         FROM public.cart_line_item WHERE cart_id = $1 AND deleted_at IS NULL`,
        [input.cartId],
      );
      const total: CartTotal = { currency_code: cartRow.currency_code, subtotal: subtotalResult.rows[0]?.subtotal ?? 0 };
      if (Number(total.subtotal) <= 0) return json({ error: "cart_not_available" }, 409);

      if (request.method === "DELETE") {
        await transaction.query(
          `UPDATE public.cart_promotion cp SET deleted_at = now(), updated_at = now()
           WHERE cp.cart_id = $1 AND cp.promotion_id IN
             (SELECT id FROM public.promotion WHERE upper(code) = upper($2))
             AND cp.deleted_at IS NULL`,
          [input.cartId, input.code],
        );
        await transaction.query(
          `UPDATE public.cart_line_item_adjustment a SET deleted_at = now(), updated_at = now()
           WHERE a.code = $2 AND a.item_id IN
             (SELECT id FROM public.cart_line_item WHERE cart_id = $1 AND deleted_at IS NULL)
             AND a.deleted_at IS NULL`,
          [input.cartId, input.code],
        );
        return json({ ok: true, discountAmount: 0 });
      }

      const promotion = await readPromotion(transaction, input.cartId, input.code);
      const reason = invalidPromotion(promotion);
      if (reason) return json({ error: reason }, 422);
      const discount = calculateDiscount(promotion!, Number(total.subtotal), total.currency_code);
      if (discount === null) return json({ error: "promotion_currency_mismatch" }, 422);
      const existing = await transaction.query<{ id: string }>(
        `SELECT cp.id FROM public.cart_promotion cp
         WHERE cp.cart_id = $1 AND cp.promotion_id = $2 AND cp.deleted_at IS NULL LIMIT 1`,
        [input.cartId, promotion!.id],
      );
      if (existing.rows[0]) return json({ error: "promotion_already_applied" }, 409);

      await transaction.query(
        `INSERT INTO public.cart_promotion (id, cart_id, promotion_id, created_at, updated_at)
         VALUES ($1, $2, $3, now(), now())`,
        [`cp_${crypto.randomUUID().replaceAll("-", "")}`, input.cartId, promotion!.id],
      );
      for (const line of (await transaction.query<{ id: string; quantity: number; unit_price: string | number }>(
        `SELECT id, quantity, unit_price FROM public.cart_line_item
         WHERE cart_id = $1 AND deleted_at IS NULL ORDER BY created_at, id`, [input.cartId])).rows) {
        const lineDiscount = Math.min(Math.round(Number(line.unit_price) * line.quantity), Math.round(discount * (Number(line.unit_price) * line.quantity / Number(total.subtotal))));
        if (lineDiscount <= 0) continue;
        await transaction.query(
          `INSERT INTO public.cart_line_item_adjustment
             (id, description, promotion_id, code, amount, raw_amount, metadata, created_at, updated_at, item_id, is_tax_inclusive)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, '{}'::jsonb, now(), now(), $7, false)`,
          [`clia_${crypto.randomUUID().replaceAll("-", "")}`, `Promotion ${input.code}`, promotion!.id, input.code, lineDiscount, JSON.stringify({ value: String(lineDiscount), precision: 20 }), line.id],
        );
      }
      return json({ ok: true, discountAmount: discount / 100 });
    });
  } catch {
    return json({ error: "promotion_unavailable" }, 503);
  }
}
