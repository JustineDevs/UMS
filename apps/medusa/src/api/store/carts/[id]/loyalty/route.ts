import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";
import { addToCartWorkflow } from "@medusajs/medusa/core-flows";
import {
  emailFromCartRow,
  emailFromCustomerRow,
  needsCustomerEmailLookup,
} from "../../../../../lib/loyalty-resolve-email";
import { tryCreateSupabaseClient } from "../../../../../lib/payment-supabase-bridge";

type Body = {
  points: number;
};

/** 1 loyalty point = 1.00 currency unit off; amounts use smallest currency unit (e.g. centavos). */
const MINOR_UNITS_PER_LOYALTY_POINT = 100;

/**
 * Apply loyalty points as a custom-priced line item discount.
 * Set MEDUSA_LOYALTY_DISCOUNT_VARIANT_ID to a dedicated variant (list price may be zero).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const cartId = req.params.id as string | undefined;
  if (!cartId) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Missing cart id");
  }

  const body = ((req as MedusaRequest & { validatedBody?: Body }).validatedBody ?? req.body ?? {}) as Body;
  const points = Math.floor(Number(body.points ?? 0));

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data: cartRows } = await query.graph({
    entity: "cart",
    fields: ["id", "email", "customer_id", "customer.email"],
    filters: { id: cartId },
  });
  const row = cartRows?.[0] as
    | {
        email?: string | null;
        customer_id?: string | null;
        customer?: { email?: string | null };
      }
    | undefined;
  let email = emailFromCartRow(row);
  const { lookupCustomerId } = needsCustomerEmailLookup(row);
  if (!email.includes("@") && lookupCustomerId) {
    const { data: custRows } = await query.graph({
      entity: "customer",
      fields: ["email"],
      filters: { id: lookupCustomerId },
    });
    email = emailFromCustomerRow(
      custRows?.[0] as { email?: string | null } | undefined,
    );
  }
  if (!email.includes("@")) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Set cart email or sign in before redeeming loyalty points",
    );
  }

  const variantId = process.env.MEDUSA_LOYALTY_DISCOUNT_VARIANT_ID?.trim();
  if (!variantId) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Loyalty discount variant is not configured (MEDUSA_LOYALTY_DISCOUNT_VARIANT_ID)",
    );
  }

  const sb = tryCreateSupabaseClient();
  if (!sb) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Supabase is not configured");
  }
  const { data: acct, error: acctErr } = await sb
    .from("loyalty_accounts")
    .select("id,points_balance")
    .eq("customer_email", email)
    .maybeSingle();

  if (acctErr) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, acctErr.message);
  }
  const balance = acct ? Number((acct as { points_balance?: number }).points_balance ?? 0) : 0;
  if (points > balance) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Insufficient points (have ${balance}, requested ${points})`,
    );
  }

  const discountMinor = points * MINOR_UNITS_PER_LOYALTY_POINT;

  const { result } = await addToCartWorkflow(req.scope).run({
    input: {
      cart_id: cartId,
      items: [
        {
          variant_id: variantId,
          quantity: 1,
          unit_price: -discountMinor,
          metadata: { loyalty_discount: true, loyalty_points: points },
        },
      ],
    } as never,
  });

  const cartPayload = (() => {
    if (result == null) return result;
    if (typeof result === "object" && "cart" in result) {
      return (result as { cart: unknown }).cart;
    }
    return result;
  })();

  return res.status(200).json({
    cart_id: cartId,
    loyalty_points: points,
    discount_minor: discountMinor,
    cart: cartPayload,
  });
}
