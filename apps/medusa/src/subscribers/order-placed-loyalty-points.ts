import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { tryCreateSupabaseClient } from "../lib/payment-supabase-bridge";

const POINTS_PER_100_CENTS = 1;

function extractRedeemedLoyaltyPoints(order: {
  metadata?: unknown;
  items?: Array<{ metadata?: unknown }>;
}): number {
  const meta = order.metadata as Record<string, unknown> | undefined;
  const fromMeta = Math.floor(Number(meta?.loyalty_points_redeemed ?? 0));
  if (fromMeta > 0) {
    return fromMeta;
  }
  let sum = 0;
  for (const it of order.items ?? []) {
    const m = it.metadata as Record<string, unknown> | undefined;
    if (m?.loyalty_discount) {
      sum += Math.floor(Number(m.loyalty_points ?? 0));
    }
  }
  return sum;
}

export default async function orderPlacedLoyaltyPoints({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const sb = tryCreateSupabaseClient();
  if (!sb) return;

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as {
    info?: (m: string) => void;
    warn?: (m: string) => void;
  };

  const orderModule = container.resolve(Modules.ORDER);
  const order = (await orderModule.retrieveOrder(data.id, {
    relations: ["items", "customer"],
  })) as {
    id?: string;
    email?: string;
    total?: number;
    metadata?: unknown;
    items?: Array<{ metadata?: unknown }>;
    customer?: { email?: string; id?: string } | null;
  };

  const email =
    (typeof order.email === "string" && order.email.trim()) ||
    (order.customer?.email?.trim()) ||
    "";
  if (!email) return;

  const redeemedPoints = extractRedeemedLoyaltyPoints(order);

  const totalCents = Number(order.total ?? 0);
  const points = Math.floor(totalCents / 100) * POINTS_PER_100_CENTS;
  if (points <= 0 && redeemedPoints <= 0) {
    return;
  }

  try {
    const { data: existing } = await sb
      .from("loyalty_accounts")
      .select("id,points_balance")
      .eq("customer_email", email)
      .maybeSingle();

    let accountId: string;
    if (existing) {
      accountId = String(existing.id);
    } else {
      const { randomBytes } = await import("crypto");
      const qrToken = randomBytes(16).toString("hex");
      const { data: created, error: createErr } = await sb
        .from("loyalty_accounts")
        .insert({
          customer_email: email,
          medusa_customer_id: order.customer?.id ?? null,
          qr_token: qrToken,
        })
        .select("id")
        .single();
      if (createErr) {
        logger.warn?.(`[loyalty] create account: ${createErr.message}`);
        return;
      }
      accountId = String(created.id);
    }

    if (redeemedPoints > 0) {
      const balRow = await sb
        .from("loyalty_accounts")
        .select("points_balance")
        .eq("id", accountId)
        .single();
      const bal = Number((balRow.data as { points_balance?: number })?.points_balance ?? 0);
      const toRedeem = Math.min(redeemedPoints, bal);
      if (toRedeem > 0) {
        const oid = order.id ?? data.id;
        await sb.from("loyalty_transactions").insert({
          loyalty_account_id: accountId,
          order_id: oid,
          medusa_order_id: oid ?? null,
          points_delta: -toRedeem,
          reason: "loyalty_redeemed_checkout",
        });
        const { data: acctAfter } = await sb
          .from("loyalty_accounts")
          .select("points_balance, lifetime_points")
          .eq("id", accountId)
          .single();
        if (acctAfter) {
          const newBal = Number(acctAfter.points_balance) - toRedeem;
          await sb
            .from("loyalty_accounts")
            .update({
              points_balance: newBal,
              updated_at: new Date().toISOString(),
            })
            .eq("id", accountId);
        }
        logger.info?.(`[loyalty] -${toRedeem} redeemed points for ${email} on order ${data.id}`);
      }
    }

    if (points > 0) {
      const placedOid = order.id ?? data.id;
      await sb.from("loyalty_transactions").insert({
        loyalty_account_id: accountId,
        order_id: placedOid,
        medusa_order_id: placedOid ?? null,
        points_delta: points,
        reason: "order_placed",
      });

      const { data: acct } = await sb
        .from("loyalty_accounts")
        .select("points_balance, lifetime_points")
        .eq("id", accountId)
        .single();

      if (acct) {
        const newBalance = Number(acct.points_balance) + points;
        const newLifetime = Number(acct.lifetime_points) + points;
        let tier = "standard";
        if (newLifetime >= 10000) tier = "platinum";
        else if (newLifetime >= 5000) tier = "gold";
        else if (newLifetime >= 1000) tier = "silver";

        await sb
          .from("loyalty_accounts")
          .update({
            points_balance: newBalance,
            lifetime_points: newLifetime,
            tier,
            updated_at: new Date().toISOString(),
          })
          .eq("id", accountId);
      }

      logger.info?.(`[loyalty] +${points} points for ${email} on order ${data.id}`);
    }
  } catch (err) {
    logger.warn?.(`[loyalty] ${err instanceof Error ? err.message : String(err)}`);
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
};
