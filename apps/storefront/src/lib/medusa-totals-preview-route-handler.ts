import {
  type ServerCustomerProfile,
} from "@/lib/server-customer-profile";
import {
  type CodCartPayload,
  type MedusaCheckoutTotalsPreview,
} from "@/lib/medusa-checkout-cart-prep";
import type { MedusaCartAddressPayload } from "@/lib/medusa-profile-address";

type Body = {
  lines?: Array<{ variantId?: string; quantity?: number }>;
  email?: string;
  loyaltyPointsToRedeem?: number;
  paymentMethod?: string;
  shippingOptionId?: string;
};

type TotalsPreviewDependencies = {
  getSessionEmail: () => Promise<string | null>;
  loadCustomerProfile: (_email: string) => Promise<ServerCustomerProfile | null>;
  isProfileComplete: (_profile: ServerCustomerProfile | null) => boolean;
  listMissingProfileParts: (_profile: ServerCustomerProfile | null) => string[];
  profileToCodCartAddresses: (
    _profile: ServerCustomerProfile,
    _sessionEmail: string,
  ) => {
    email: string;
    shipping_address: MedusaCartAddressPayload;
    billing_address: MedusaCartAddressPayload;
  } | null;
  executePreview: (_input: {
    lines: Array<{ variantId: string; quantity: number }>;
    email?: string;
    loyaltyPointsToRedeem?: number;
    codCartPayload?: CodCartPayload;
    shippingOptionId?: string;
    signal?: AbortSignal;
  }) => Promise<MedusaCheckoutTotalsPreview>;
  logEvent: (_event: string, _payload: Record<string, unknown>) => void;
};

function isCodPaymentMethod(method: string | undefined): boolean {
  return String(method ?? "").toUpperCase() === "COD";
}

function normalizePreviewLines(
  lines: Body["lines"],
): Array<{ variantId: string; quantity: number }> {
  return (Array.isArray(lines) ? lines : [])
    .map((line) => ({
      variantId: typeof line?.variantId === "string" ? line.variantId.trim() : "",
      quantity:
        typeof line?.quantity === "number" && Number.isFinite(line.quantity)
          ? Math.floor(line.quantity)
          : 0,
    }))
    .filter((line) => line.variantId.length > 0 && line.quantity > 0);
}

function normalizeLoyaltyPoints(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : undefined;
}

function normalizeOptionalEmail(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function handleMedusaTotalsPreviewRequest(
  req: Request,
  deps: TotalsPreviewDependencies,
): Promise<Response> {
  const sessionEmail = (await deps.getSessionEmail())?.trim().toLowerCase() ?? "";

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const lines = normalizePreviewLines(body.lines);
  if (lines.length === 0) {
    return Response.json({ error: "Add at least one line item." }, { status: 400 });
  }

  const paymentMethod = String(body.paymentMethod ?? "STRIPE");
  const loyaltyPointsToRedeem = normalizeLoyaltyPoints(body.loyaltyPointsToRedeem);
  const emailFromBody = normalizeOptionalEmail(body.email);
  const shippingOptionId =
    typeof body.shippingOptionId === "string" && body.shippingOptionId.trim()
      ? body.shippingOptionId.trim()
      : undefined;
  const checkoutEmail = emailFromBody || sessionEmail;
  if (!checkoutEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(checkoutEmail)) {
    return Response.json({ error: "Enter a valid checkout email." }, { status: 400 });
  }

  try {
    if (isCodPaymentMethod(paymentMethod)) {
      if (!sessionEmail) {
        return Response.json({ error: "Sign in before using cash on delivery." }, { status: 401 });
      }
      const profile = await deps.loadCustomerProfile(sessionEmail);
      if (!profile || !deps.isProfileComplete(profile)) {
        return Response.json(
          {
            error:
              "Complete your delivery profile before previewing cash on delivery totals.",
            missingFields: deps.listMissingProfileParts(profile),
          },
          { status: 400 },
        );
      }
      const codCartPayload = deps.profileToCodCartAddresses(profile, sessionEmail);
      if (!codCartPayload) {
        return Response.json(
          { error: "Add a delivery address before previewing COD totals." },
          { status: 400 },
        );
      }
      const preview = await deps.executePreview({
        lines,
        loyaltyPointsToRedeem,
        codCartPayload,
        shippingOptionId,
        signal: req.signal,
      });
      deps.logEvent("checkout_quote_generated", {
        quoteFingerprint: preview.quoteFingerprint,
        lineCount: lines.length,
        flow: "cod",
        actorEmail: sessionEmail,
      });
      return Response.json(preview);
    }

    const preview = await deps.executePreview({
      lines,
      email: checkoutEmail,
      loyaltyPointsToRedeem,
      shippingOptionId,
      signal: req.signal,
    });
    deps.logEvent("checkout_quote_generated", {
      quoteFingerprint: preview.quoteFingerprint,
      lineCount: lines.length,
      flow: "standard",
      actorEmail: sessionEmail,
    });
    return Response.json(preview);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Checkout preview failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
