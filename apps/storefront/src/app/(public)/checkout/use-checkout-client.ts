"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PH_VAT_RATE,
  computeDisplayVat,
  sanitizeSameOriginUrl,
  sanitizeTrustedPublicUrl,
} from "@universal-music-store/sdk";
import { trackBeginCheckout, trackPurchase } from "@/lib/analytics";
import {
  readCart,
  clearCart,
  writeCart,
  type CartLine,
} from "@/lib/cart";
import {
  previewMedusaCheckoutTotals,
  startMedusaCheckout,
  PAYMENT_PROVIDER_IDS,
  type CodCartPayload,
  type MedusaCheckoutTotalsPreview,
  type PaymentProviderKey,
} from "@/lib/medusa-checkout";
import {
  CHECKOUT_AVAILABILITY,
  isCheckoutHardUnavailableCode,
} from "@/lib/checkout-availability-codes";
import { resolveCheckoutPaymentAvailability } from "@/lib/checkout-payment-availability";
import { minorUnitDivisor } from "@/lib/medusa-money";
import { CHECKOUT_SITE_ORIGIN } from "./checkout-utils";
import {
  buildCheckoutReviewItems,
  type CheckoutReviewItem,
} from "./checkout-review";
import { createCheckoutLeaseSubscriber } from "@/lib/checkout-tab-lease";
import { emitCommerceObservabilityClient } from "@/lib/commerce-observability";

export type CheckoutPendingPayment = {
  checkoutUrl: string;
  trackingPageUrl: string;
  providerLabel: string;
  confirmedTotal: number;
  currencyCode: string;
  priceMismatch: boolean;
  providerKey: string;
  correlationId?: string;
};

export type CheckoutEmbeddedData = {
  provider: "PAYPAL" | "XENDIT";
  paypalOrderId?: string;
  xenditComponentsSdkKey?: string;
  providerSessionId: string;
  cartId: string;
  trackingPageUrl: string;
  confirmedTotal: number;
  currencyCode: string;
  correlationId: string;
};

type ProfileGate = "idle" | "loading" | "complete" | "incomplete" | "error";
const FINALIZE_POLL_MS = 2_000;
const FINALIZE_POLL_MAX = 20;

export function useCheckoutClient({
  initialResumeCartId,
  initialStripeCheckoutCancel,
  initialReviewMessage,
  guestMode,
}: {
  initialResumeCartId?: string;
  initialStripeCheckoutCancel?: boolean;
  initialReviewMessage?: string;
  guestMode?: boolean;
}) {
  const { data: session, status: authStatus } = useSession();
  const payInFlightRef = useRef(false);
  const medusaPreviewSeqRef = useRef(0);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentProviderKey>("STRIPE");
  const [pendingPayment, setPendingPayment] = useState<CheckoutPendingPayment | null>(null);
  const [embeddedData, setEmbeddedData] = useState<CheckoutEmbeddedData | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [loyaltyPoints, setLoyaltyPoints] = useState("");
  const [loyaltyBalance, setLoyaltyBalance] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [medusaPricePreview, setMedusaPricePreview] =
    useState<MedusaCheckoutTotalsPreview | null>(null);
  const [medusaPreviewError, setMedusaPreviewError] = useState<string | null>(
    null,
  );
  const [medusaPriceStatus, setMedusaPriceStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [profileGate, setProfileGate] = useState<ProfileGate>("idle");
  const [profileMissing, setProfileMissing] = useState<string[]>([]);
  const [quoteReviewAcknowledged, setQuoteReviewAcknowledged] = useState(false);
  const [foreignCheckoutActive, setForeignCheckoutActive] = useState(false);
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState<{ code: string; discountAmount?: number } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const quoteFingerprintObsRef = useRef<string | null>(null);
  const leaseConflictLoggedRef = useRef(false);

  const fetchProfileStatus = useCallback(async (): Promise<
    "complete" | "incomplete" | "error"
  > => {
    try {
      const res = await fetch("/api/account/profile/status", {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        complete?: boolean;
        missingFields?: string[];
      };
      if (!res.ok) return "error";
      setProfileMissing(
        Array.isArray(data.missingFields) ? data.missingFields : [],
      );
      return data.complete === true ? "complete" : "incomplete";
    } catch {
      return "error";
    }
  }, []);

  const [payAvailability, setPayAvailability] = useState(() =>
    resolveCheckoutPaymentAvailability([]),
  );
  const [checkoutAvailabilityStatus, setCheckoutAvailabilityStatus] = useState<
    "loading" | "ready" | "unavailable"
  >("loading");
  const [checkoutUnavailableCode, setCheckoutUnavailableCode] = useState<
    string | null
  >(null);
  const [selectedShippingOptionId, setSelectedShippingOptionId] = useState<
    string | null
  >(null);

  const loadCheckoutPaymentMethods = useCallback(async () => {
    setCheckoutAvailabilityStatus("loading");
    setCheckoutUnavailableCode(null);
    try {
      const res = await fetch("/api/checkout/available-payment-methods", {
        cache: "no-store",
      });
      const j = (await res.json()) as {
        ok?: boolean;
        keys?: string[];
        code?: string;
      };

      if (j.ok === true && Array.isArray(j.keys) && j.keys.length > 0) {
        const allowed = new Set(j.keys);
        const valid = (Object.keys(PAYMENT_PROVIDER_IDS) as PaymentProviderKey[]).filter(
          (k) => allowed.has(k),
        );
        if (valid.length > 0) {
          setPayAvailability(resolveCheckoutPaymentAvailability(valid));
          setCheckoutAvailabilityStatus("ready");
          return;
        }
      }

      if (isCheckoutHardUnavailableCode(j.code)) {
        setPayAvailability(resolveCheckoutPaymentAvailability([]));
        setCheckoutUnavailableCode(j.code ?? null);
        setCheckoutAvailabilityStatus("unavailable");
        return;
      }

      setPayAvailability(resolveCheckoutPaymentAvailability([]));
      setCheckoutUnavailableCode(CHECKOUT_AVAILABILITY.PAYMENT_METHODS_LOAD_FAILED);
      setCheckoutAvailabilityStatus("unavailable");
    } catch {
      setPayAvailability(resolveCheckoutPaymentAvailability([]));
      setCheckoutUnavailableCode(CHECKOUT_AVAILABILITY.PAYMENT_METHODS_LOAD_FAILED);
      setCheckoutAvailabilityStatus("unavailable");
    }
  }, []);

  useEffect(() => {
    void loadCheckoutPaymentMethods();
  }, [loadCheckoutPaymentMethods]);

  const providerAvailable = payAvailability.available;
  const preferredKey = payAvailability.preferredKey;
  const paymentAvailabilitySource = payAvailability.source;

  useEffect(() => {
    const opts = medusaPricePreview?.shippingOptions ?? [];
    if (opts.length === 0) {
      setSelectedShippingOptionId(null);
      return;
    }
    setSelectedShippingOptionId((prev) =>
      prev && opts.some((o) => o.id === prev) ? prev : opts[0].id,
    );
  }, [medusaPricePreview?.quoteFingerprint, medusaPricePreview?.shippingOptions]);

  useEffect(() => {
    setPaymentMethod((prev) =>
      providerAvailable[prev] ? prev : preferredKey,
    );
  }, [providerAvailable, preferredKey]);

  const paymentMethodChangeSkipRef = useRef(true);
  useEffect(() => {
    if (paymentMethodChangeSkipRef.current) {
      paymentMethodChangeSkipRef.current = false;
      return;
    }
    setPendingPayment(null);
    setEmbeddedData(null);
    setCopyDone(false);
    setError(null);
  }, [paymentMethod]);

  useEffect(() => {
    if (authStatus !== "authenticated" || !session?.user) {
      if (guestMode) {
        // Guest mode: mark profile as complete for non-COD paths.
        // COD will be blocked at pay time via the COD payload endpoint.
        setProfileGate("complete");
        setProfileMissing([]);
      } else {
        setProfileGate("idle");
        setProfileMissing([]);
      }
      return;
    }
    let cancelled = false;
    setProfileGate("loading");
    void (async () => {
      const outcome = await fetchProfileStatus();
      if (cancelled) return;
      setProfileGate(outcome === "error" ? "error" : outcome);
    })();
    return () => {
      cancelled = true;
    };
  }, [authStatus, session?.user, guestMode, fetchProfileStatus]);

  useEffect(() => {
    if (profileGate !== "complete") return;
    const e = session?.user?.email?.trim();
    if (e) {
      setEmail((prev) => (prev.trim() === "" ? e : prev));
    }
  }, [profileGate, session?.user?.email]);

  useEffect(() => {
    if (!session?.user?.email) return;
    fetch("/api/checkout/loyalty-balance")
      .then((r) => (r.ok ? r.json() : { balance: 0 }))
      .then((d: { balance?: number }) => setLoyaltyBalance(Number(d.balance ?? 0)))
      .catch(() => setLoyaltyBalance(0));
  }, [session?.user?.email]);

  useEffect(() => {
    if (initialStripeCheckoutCancel) {
      setError(
        "You left the card checkout before paying. Your bag is unchanged. Choose a payment method and continue when you are ready.",
      );
    }
  }, [initialStripeCheckoutCancel]);

  useEffect(() => {
    if (initialReviewMessage?.trim()) {
      setError(initialReviewMessage.trim());
    }
  }, [initialReviewMessage]);

  const refresh = useCallback(() => {
    setLines(readCart());
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      const qs = initialResumeCartId?.trim()
        ? `?cartId=${encodeURIComponent(initialResumeCartId.trim())}`
        : "";
      try {
        const res = await fetch(`/api/cart/resume${qs}`);
        const data = (await res.json()) as { lines?: CartLine[] };
        if (cancelled) return;
        if (Array.isArray(data.lines) && data.lines.length > 0) {
          writeCart(data.lines);
          setLines(data.lines);
        } else {
          setLines(readCart());
        }
      } catch {
        // Cart hydration is an enhancement; a transient aborted request must
        // not strand the checkout screen before the local cart is available.
        if (!cancelled) setLines(readCart());
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [initialResumeCartId]);

  const checkoutLinesSignature = useMemo(
    () => lines.map((l) => `${l.variantId}:${l.quantity}`).join("|"),
    [lines],
  );

  useEffect(() => {
    if (profileGate !== "complete" || !hydrated || lines.length === 0) {
      setMedusaPricePreview(null);
      setMedusaPriceStatus("idle");
      setMedusaPreviewError(null);
      return;
    }

    setMedusaPriceStatus("loading");
    setMedusaPreviewError(null);
    const seq = ++medusaPreviewSeqRef.current;
    let cancelled = false;
    const t = setTimeout(() => {
      void (async () => {
        try {
          const lp = loyaltyPoints.trim();
          const parsedLoyalty =
            lp === "" ? undefined : Math.max(0, Math.floor(Number(lp)));

          const preview = await previewMedusaCheckoutTotals({
            lines: lines.map((l) => ({
              variantId: l.variantId,
              quantity: l.quantity,
            })),
            email:
              paymentMethod === "COD" ? undefined : email.trim() || undefined,
            loyaltyPointsToRedeem:
              parsedLoyalty !== undefined && parsedLoyalty > 0
                ? parsedLoyalty
                : undefined,
            paymentMethod,
            shippingOptionId: selectedShippingOptionId ?? undefined,
          });
          if (!cancelled && seq === medusaPreviewSeqRef.current) {
            setMedusaPricePreview(preview);
            setMedusaPriceStatus("ready");
            setMedusaPreviewError(null);
          }
        } catch (e) {
          if (!cancelled && seq === medusaPreviewSeqRef.current) {
            setMedusaPricePreview(null);
            setMedusaPriceStatus("error");
            setMedusaPreviewError(
              e instanceof Error ? e.message : "Could not load checkout totals.",
            );
          }
        }
      })();
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [
    profileGate,
    hydrated,
    checkoutLinesSignature,
    loyaltyPoints,
    email,
    paymentMethod,
    selectedShippingOptionId,
  ]);

  const localSubtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const localTax = computeDisplayVat(localSubtotal);
  const localTotal = Math.round((localSubtotal + localTax) * 100) / 100;

  const useMedusaBagTotals =
    medusaPriceStatus === "ready" && medusaPricePreview != null;
  const displayCurrency = useMedusaBagTotals
    ? medusaPricePreview.currencyCode
    : "PHP";
  const quoteReviewItems: CheckoutReviewItem[] = useMemo(
    () =>
      buildCheckoutReviewItems({
        lines,
        medusaPricePreview,
        localTax,
        localTotal,
      }),
    [lines, medusaPricePreview, localTax, localTotal],
  );
  const quoteReviewRequired =
    useMedusaBagTotals &&
    quoteReviewItems.length > 0 &&
    !quoteReviewAcknowledged &&
    !pendingPayment &&
    !embeddedData;

  useEffect(() => {
    setQuoteReviewAcknowledged(false);
  }, [medusaPricePreview?.quoteFingerprint]);

  useEffect(() => {
    const enabled =
      profileGate === "complete" &&
      hydrated &&
      lines.length > 0 &&
      authStatus === "authenticated";
    return createCheckoutLeaseSubscriber(enabled, (foreign) => {
      setForeignCheckoutActive(foreign);
      if (foreign && !leaseConflictLoggedRef.current) {
        leaseConflictLoggedRef.current = true;
        emitCommerceObservabilityClient("checkout_tab_lease_conflict", {
          reason: "foreign_tab_active",
        });
      }
      if (!foreign) {
        leaseConflictLoggedRef.current = false;
      }
    });
  }, [profileGate, hydrated, lines.length, authStatus]);

  useEffect(() => {
    if (medusaPriceStatus !== "ready" || !medusaPricePreview?.quoteFingerprint) {
      quoteFingerprintObsRef.current = null;
      return;
    }
    const fp = medusaPricePreview.quoteFingerprint.trim();
    const prev = quoteFingerprintObsRef.current;
    if (prev !== null && prev !== fp) {
      emitCommerceObservabilityClient("checkout_quote_changed", {
        fromFingerprint: prev,
        toFingerprint: fp,
      });
    }
    quoteFingerprintObsRef.current = fp;
  }, [medusaPricePreview?.quoteFingerprint, medusaPriceStatus]);

  async function handlePay() {
    if (lines.length === 0 || payInFlightRef.current || !hydrated) return;
    if (foreignCheckoutActive) {
      setError(
        "Checkout is already in progress in another browser tab. Continue there, or close that tab to pay from this window.",
      );
      return;
    }
    if (profileGate !== "complete") {
      setError(
        "Add your delivery address and contact details before you continue to payment.",
      );
      return;
    }
    if (!providerAvailable[paymentMethod]) {
      setError("Choose an available way to pay, or ask the shop owner to turn on that option.");
      return;
    }
    if (quoteReviewRequired) {
      setError("Review the updated total below before continuing to payment.");
      return;
    }
    payInFlightRef.current = true;
    setLoading(true);
    setError(null);

    const cartTotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
    trackBeginCheckout({ value: cartTotal, itemCount: lines.reduce((s, l) => s + l.quantity, 0) });

    try {
      const em = email.trim();
      if (
        paymentMethod !== "COD" &&
        em &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)
      ) {
        setError("Enter a valid email address or leave the field blank.");
        setLoading(false);
        payInFlightRef.current = false;
        return;
      }
      const lp = loyaltyPoints.trim();
      const parsedLoyalty =
        lp === "" ? undefined : Math.max(0, Math.floor(Number(lp)));

      let codCartPayload: CodCartPayload | undefined;
      if (paymentMethod === "COD") {
        const codRes = await fetch("/api/checkout/cod-cart-payload", {
          method: "POST",
        });
        const codJson = (await codRes.json()) as {
          error?: string;
          missingFields?: string[];
          email?: string;
          shipping_address?: unknown;
          billing_address?: unknown;
        };
        if (!codRes.ok) {
          const hint =
            Array.isArray(codJson.missingFields) && codJson.missingFields.length
              ? ` Add: ${codJson.missingFields.join(", ")}.`
              : "";
          setError(
            (codJson.error ??
              "Cash on delivery needs a complete delivery profile.") + hint,
          );
          setLoading(false);
          payInFlightRef.current = false;
          return;
        }
        if (
          typeof codJson.email !== "string" ||
          !codJson.shipping_address ||
          !codJson.billing_address
        ) {
          setError(
            "Could not load delivery details for cash on delivery. Update your account profile or pick another payment option.",
          );
          setLoading(false);
          payInFlightRef.current = false;
          return;
        }
        codCartPayload = codJson as CodCartPayload;
      }

      const result = await startMedusaCheckout({
        lines: lines.map((l) => ({
          variantId: l.variantId,
          quantity: l.quantity,
        })),
        email: paymentMethod === "COD" ? undefined : em || undefined,
        providerId: PAYMENT_PROVIDER_IDS[paymentMethod],
        loyaltyPointsToRedeem:
          parsedLoyalty !== undefined && parsedLoyalty > 0
            ? parsedLoyalty
            : undefined,
        codCartPayload,
        shippingOptionId: selectedShippingOptionId ?? undefined,
      });

      const {
        cartId,
        confirmedTotal,
        currencyCode,
        checkoutUrl,
        providerLabel,
        codOrderPlaced,
        orderId,
        confirmedPreview,
      } = result;

      if (confirmedPreview) {
        setMedusaPricePreview(confirmedPreview);
        setMedusaPriceStatus("ready");
      }

      await fetch("/api/cart/medusa-bind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartId }),
      });

      const trackId =
        codOrderPlaced && orderId?.trim() ? orderId.trim() : cartId;
      const res = await fetch("/api/tracking-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartId: trackId }),
      });
      const data = (await res.json()) as { trackingPageUrl?: string };
      const trackingPageUrl =
        data.trackingPageUrl ??
        (CHECKOUT_SITE_ORIGIN
          ? `${CHECKOUT_SITE_ORIGIN}/track/${encodeURIComponent(trackId)}`
          : `/track/${encodeURIComponent(trackId)}`);

      if (codOrderPlaced && orderId?.trim()) {
        trackPurchase({
          orderId: orderId.trim(),
          value: cartTotal,
          itemCount: lines.reduce((s, l) => s + l.quantity, 0),
          paymentMethod: "COD",
        });
        clearCart();
        const safeTrackingUrl = sanitizeSameOriginUrl(trackingPageUrl, window.location.origin);
        if (!safeTrackingUrl) {
          setError("The tracking link returned by checkout is invalid. Open your order from the confirmation email.");
          return;
        }
        window.location.href = safeTrackingUrl;
        return;
      }

      const sessionData = result as Record<string, unknown> & typeof result;
      const paypalOrderId =
        typeof sessionData.paypalOrderId === "string"
          ? sessionData.paypalOrderId
          : undefined;
      const xenditComponentsSdkKey =
        typeof sessionData.xenditComponentsSdkKey === "string"
          ? sessionData.xenditComponentsSdkKey
          : undefined;
      const providerSessionId =
        typeof sessionData.paymentSessionId === "string"
          ? sessionData.paymentSessionId
          : paypalOrderId;
      const usePayPalElement = paymentMethod === "PAYPAL" && Boolean(paypalOrderId);
      const useXenditComponents =
        paymentMethod === "XENDIT" && Boolean(xenditComponentsSdkKey && providerSessionId);
      const providerKey = paymentMethod.toLowerCase();
      const amountMinor = Math.round(
        confirmedTotal * minorUnitDivisor(currencyCode),
      );
      let checkoutCorrelationId: string | undefined;
      try {
        const regRes = await fetch("/api/payments/checkout-intents", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: providerKey,
            amountMinor,
            currencyCode,
            quoteFingerprint: result.quoteFingerprint,
            variantIds: result.variantIds,
            productIds: result.productIds,
            providerSessionId,
          }),
        });
        const regJson = (await regRes.json().catch(() => ({}))) as {
          correlationId?: string;
        };
        if (regRes.ok && typeof regJson.correlationId === "string") {
          checkoutCorrelationId = regJson.correlationId;
        }
      } catch {
        checkoutCorrelationId = undefined;
      }

      if (usePayPalElement || useXenditComponents) {
        if (!checkoutCorrelationId) {
          throw new Error(
            "Could not register a durable payment attempt for this checkout. Try again before entering payment details.",
          );
        }
        setEmbeddedData({
          provider: usePayPalElement ? "PAYPAL" : "XENDIT",
          paypalOrderId: usePayPalElement ? paypalOrderId : undefined,
          xenditComponentsSdkKey: useXenditComponents
            ? xenditComponentsSdkKey
            : undefined,
          providerSessionId: providerSessionId!,
          cartId,
          trackingPageUrl,
          confirmedTotal,
          currencyCode,
          correlationId: checkoutCorrelationId,
        });
        setCopyDone(false);
      } else {
        if (!checkoutCorrelationId && paymentMethod !== "COD") {
          throw new Error(
            "Could not register a durable payment attempt for this checkout. Try again before leaving for payment.",
          );
        }
        const comparableBagTotal =
          medusaPricePreview?.total ?? localTotal;
        const tol = Math.max(0.5, comparableBagTotal * 0.02);
        const priceMismatch =
          Number.isFinite(confirmedTotal) &&
          Number.isFinite(comparableBagTotal) &&
          Math.abs(confirmedTotal - comparableBagTotal) > tol;

        setPendingPayment({
          checkoutUrl,
          trackingPageUrl,
          providerLabel,
          confirmedTotal,
          currencyCode,
          priceMismatch,
          providerKey,
          correlationId: checkoutCorrelationId,
        });
        setCopyDone(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setLoading(false);
      payInFlightRef.current = false;
    }
  }

  function continueToHostedCheckout() {
    if (!pendingPayment) return;
    if (pendingPayment.correlationId) {
      try {
        sessionStorage.setItem(
          "payment_checkout_correlation_id",
          pendingPayment.correlationId,
        );
      } catch {
        /* ignore */
      }
    }
    const safeCheckoutUrl = sanitizeTrustedPublicUrl(pendingPayment.checkoutUrl);
    if (!safeCheckoutUrl) {
      setError("The payment provider returned an invalid checkout link. Start checkout again.");
      return;
    }
    const popup = window.open(safeCheckoutUrl, "_blank", "noopener,noreferrer");
    if (popup) {
      popup.focus();
      return;
    }
    clearCart();
    window.location.href = safeCheckoutUrl;
  }

  async function finalizeCheckoutAttempt(
    active: { correlationId: string },
  ): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const finalizeRes = await fetch(
        `/api/payments/checkout-intents/${encodeURIComponent(active.correlationId)}/finalize`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      const finalizeJson = (await finalizeRes.json().catch(() => ({}))) as {
        error?: string;
        redirectUrl?: string;
      };
      if (
        finalizeRes.ok &&
        typeof finalizeJson.redirectUrl === "string" &&
        finalizeJson.redirectUrl.length > 0
      ) {
        const safeRedirectUrl = sanitizeTrustedPublicUrl(finalizeJson.redirectUrl);
        if (!safeRedirectUrl) {
          setError("The payment provider returned an invalid redirect. Start checkout again.");
          return;
        }
        clearCart();
        window.location.href = safeRedirectUrl;
        return;
      }

      for (let attempt = 0; attempt < FINALIZE_POLL_MAX; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, FINALIZE_POLL_MS));
        const statusRes = await fetch(
          `/api/payments/checkout-intents/${encodeURIComponent(active.correlationId)}`,
          { credentials: "include" },
        );
        const statusJson = (await statusRes.json().catch(() => ({}))) as {
          status?: string;
          medusaOrderId?: string | null;
          lastError?: string | null;
          staleReason?: string | null;
        };
        if (
          statusRes.ok &&
          statusJson.status === "completed" &&
          typeof statusJson.medusaOrderId === "string" &&
          statusJson.medusaOrderId.length > 0
        ) {
          clearCart();
          window.location.href = `/track/${encodeURIComponent(statusJson.medusaOrderId)}`;
          return;
        }
        if (
          statusRes.ok &&
          (statusJson.status === "needs_review" || statusJson.status === "expired") &&
          typeof (statusJson.staleReason ?? statusJson.lastError) === "string" &&
          (statusJson.staleReason ?? statusJson.lastError)!.length > 0
        ) {
          throw new Error(statusJson.staleReason ?? statusJson.lastError ?? "Checkout needs review.");
        }
      }

      throw new Error(
        finalizeJson.error ??
          "Payment was accepted, but order finalization is still pending. Use your tracking link to resume safely.",
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Payment completed, but order finalization could not be confirmed yet.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function completeEmbeddedPayment(
    active: CheckoutEmbeddedData,
  ): Promise<void> {
    await finalizeCheckoutAttempt(active);
  }

  async function resumePendingHostedPayment(
    active: CheckoutPendingPayment,
  ): Promise<void> {
    if (!active.correlationId) {
      setError(
        "This checkout session cannot be resumed because the payment attempt was not recorded. Start checkout again.",
      );
      return;
    }
    await finalizeCheckoutAttempt({ correlationId: active.correlationId });
  }

  async function copyTrackingLink() {
    if (!pendingPayment || typeof navigator.clipboard?.writeText !== "function")
      return;
    const safeTrackingUrl = sanitizeSameOriginUrl(
      pendingPayment.trackingPageUrl,
      window.location.origin,
    );
    if (!safeTrackingUrl) return;
    try {
      await navigator.clipboard.writeText(safeTrackingUrl);
      setCopyDone(true);
    } catch {
      setCopyDone(false);
    }
  }

  async function applyPromoCode(cartId: string) {
    const code = promoCode.trim().toUpperCase();
    if (!code) {
      setPromoError("Enter a promotion code.");
      return;
    }
    if (promoApplied?.code === code) {
      setPromoError(`"${code}" is already applied.`);
      return;
    }
    setPromoLoading(true);
    setPromoError(null);
    try {
      const res = await fetch("/api/checkout/apply-promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartId, code }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; discountAmount?: number };
      if (!json.ok) {
        setPromoError(json.error ?? "Could not apply that code.");
        return;
      }
      setPromoApplied({ code, discountAmount: json.discountAmount });
      setPromoCode("");
      setPromoError(null);
    } catch {
      setPromoError("Could not apply the promotion code. Try again.");
    } finally {
      setPromoLoading(false);
    }
  }

  async function removePromoCode(cartId: string) {
    if (!promoApplied) return;
    setPromoLoading(true);
    try {
      await fetch("/api/checkout/apply-promo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartId, code: promoApplied.code }),
      });
      setPromoApplied(null);
      setPromoError(null);
    } catch {
      setPromoError("Could not remove the code. Try again.");
    } finally {
      setPromoLoading(false);
    }
  }

  return {
    session,
    authStatus,
    lines,
    email,
    setEmail,
    error,
    setError,
    loading,
    paymentMethod,
    setPaymentMethod,
    pendingPayment,
    setPendingPayment,
    embeddedData,
    copyDone,
    setCopyDone,
    loyaltyPoints,
    setLoyaltyPoints,
    loyaltyBalance,
    hydrated,
    medusaPricePreview,
    medusaPriceStatus,
    medusaPreviewError,
    profileGate,
    setProfileGate,
    profileMissing,
    fetchProfileStatus,
    providerAvailable,
    refresh,
    localSubtotal,
    localTax,
    localTotal,
    useMedusaBagTotals,
    displayCurrency,
    handlePay,
    completeEmbeddedPayment,
    resumePendingHostedPayment,
    continueToHostedCheckout,
    copyTrackingLink,
    phVatRate: PH_VAT_RATE,
    quoteReviewItems,
    quoteReviewRequired,
    quoteReviewAcknowledged,
    acknowledgeQuoteReview: () => setQuoteReviewAcknowledged(true),
    foreignCheckoutActive,
    checkoutAvailabilityStatus,
    checkoutUnavailableCode,
    retryCheckoutAvailability: loadCheckoutPaymentMethods,
    paymentAvailabilitySource,
    selectedShippingOptionId,
    setSelectedShippingOptionId,
    deliveryInstructions,
    setDeliveryInstructions,
    termsAccepted,
    setTermsAccepted,
    promoCode,
    setPromoCode,
    promoApplied,
    promoError,
    promoLoading,
    applyPromoCode,
    removePromoCode,
    guestMode: guestMode ?? false,
  };
}
