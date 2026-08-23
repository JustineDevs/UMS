"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PH_VAT_RATE,
  computeDisplayVat,
  normalizeCommerceAttribution,
  sanitizeSameOriginUrl,
  sanitizeTrustedPublicUrl,
} from "@universal-music-store/sdk";
import { trackBeginCheckout, trackPurchase } from "@/lib/analytics";
import { readCart, clearCart, writeCart, type CartLine } from "@/lib/cart";
import {
  previewMedusaCheckoutTotals,
  PAYMENT_PROVIDER_IDS,
  startMedusaCheckout,
  type CodCartPayload,
  type MedusaCheckoutResult,
  type MedusaCheckoutTotalsPreview,
  type PaymentProviderKey,
} from "@/lib/medusa-checkout";
import {
  CHECKOUT_AVAILABILITY,
  isCheckoutHardUnavailableCode,
} from "@/lib/checkout-availability-codes";
import { resolveCheckoutPaymentAvailability } from "@/lib/checkout-payment-availability";
import { minorUnitDivisor } from "@/lib/medusa-money";
import {
  buildCheckoutReviewItems,
  type CheckoutReviewItem,
} from "./checkout-review";
import {
  sanitizeHostedCheckoutUrl,
  type HostedReturnProvider,
} from "@/lib/hosted-payment-return";
import { createCheckoutLeaseSubscriber } from "@/lib/checkout-tab-lease";
import { emitCommerceObservabilityClient } from "@/lib/commerce-observability";

export type CheckoutPendingPayment = {
  checkoutUrl: string;
  actionKind: "redirect" | "wallet" | "qr";
  qrImageUrl?: string;
  qrPayload?: string;
  trackingPageUrl: string;
  providerLabel: string;
  confirmedTotal: number;
  currencyCode: string;
  priceMismatch: boolean;
  providerKey: HostedReturnProvider;
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
export type CheckoutPhase =
  | "idle"
  | "starting"
  | "redirecting"
  | "awaiting_provider"
  | "embedded"
  | "finalizing"
  | "error";
const FINALIZE_POLL_MS = 2_000;
const FINALIZE_POLL_MAX = 20;
const localAuthBypass =
  process.env.NEXT_PUBLIC_AUTH_DISABLED === "true" ||
  process.env.NEXT_PUBLIC_AUTH_DISABLE === "true";

export function useCheckoutClient({
  initialResumeCartId,
  initialResumeToken,
  initialStripeCheckoutCancel,
  initialReviewMessage,
  guestMode,
}: {
  initialResumeCartId?: string;
  initialResumeToken?: string;
  initialStripeCheckoutCancel?: boolean;
  initialReviewMessage?: string;
  guestMode?: boolean;
}) {
  const { data: session, status: authStatus } = useSession();
  const payInFlightRef = useRef(false);
  const userSelectedPaymentMethodRef = useRef(false);
  const medusaPreviewSeqRef = useRef(0);
  const medusaPreviewAbortRef = useRef<AbortController | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkoutPhase, setCheckoutPhase] = useState<CheckoutPhase>("idle");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentProviderKey>("STRIPE");
  const [pendingPayment, setPendingPayment] =
    useState<CheckoutPendingPayment | null>(null);
  const [embeddedData, setEmbeddedData] = useState<CheckoutEmbeddedData | null>(
    null,
  );
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
  const [promoApplied, setPromoApplied] = useState<{
    code: string;
    discountAmount?: number;
  } | null>(null);
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
    resolveCheckoutPaymentAvailability(undefined),
  );
  const [checkoutAvailabilityStatus, setCheckoutAvailabilityStatus] = useState<
    "loading" | "ready" | "unavailable"
  >("ready");
  const [checkoutUnavailableCode, setCheckoutUnavailableCode] = useState<
    string | null
  >(null);
  const [selectedShippingOptionId, setSelectedShippingOptionId] = useState<
    string | null
  >(null);

  const loadCheckoutPaymentMethods = useCallback(async () => {
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
        const valid = (
          Object.keys(PAYMENT_PROVIDER_IDS) as PaymentProviderKey[]
        ).filter((k) => allowed.has(k));
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

      const fallback = resolveCheckoutPaymentAvailability(undefined);
      setPayAvailability(fallback);
      setCheckoutAvailabilityStatus(
        Object.values(fallback.available).some(Boolean)
          ? "ready"
          : "unavailable",
      );
      setCheckoutUnavailableCode(
        CHECKOUT_AVAILABILITY.PAYMENT_METHODS_LOAD_FAILED,
      );
    } catch {
      const fallback = resolveCheckoutPaymentAvailability(undefined);
      setPayAvailability(fallback);
      setCheckoutAvailabilityStatus(
        Object.values(fallback.available).some(Boolean)
          ? "ready"
          : "unavailable",
      );
      setCheckoutUnavailableCode(
        CHECKOUT_AVAILABILITY.PAYMENT_METHODS_LOAD_FAILED,
      );
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
  }, [
    medusaPricePreview?.quoteFingerprint,
    medusaPricePreview?.shippingOptions,
  ]);

  useEffect(() => {
    setPaymentMethod((prev) =>
      providerAvailable[prev] || userSelectedPaymentMethodRef.current
        ? prev
        : preferredKey,
    );
  }, [providerAvailable, preferredKey]);

  const paymentMethodChangeSkipRef = useRef(true);
  useEffect(() => {
    if (paymentMethodChangeSkipRef.current) {
      paymentMethodChangeSkipRef.current = false;
      return;
    }
    if (!userSelectedPaymentMethodRef.current) return;
    userSelectedPaymentMethodRef.current = false;
    setPendingPayment(null);
    setEmbeddedData(null);
    setCopyDone(false);
    setError(null);
    setCheckoutPhase("idle");
  }, [paymentMethod]);

  useEffect(() => {
    if (localAuthBypass) {
      setProfileGate("complete");
      setProfileMissing([]);
      return;
    }
    if (guestMode) {
      // Explicit guest mode is card/provider checkout even when a stale authenticated
      // session exists. COD still validates the saved delivery profile server-side.
      setProfileGate("complete");
      setProfileMissing([]);
      return;
    }
    if (authStatus !== "authenticated" || !session?.user) {
      setProfileGate("idle");
      setProfileMissing([]);
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
      .then((r) => {
        if (!r.ok) {
          throw new Error("Loyalty balance is temporarily unavailable.");
        }
        return r.json();
      })
      .then((d: { balance?: number }) =>
        setLoyaltyBalance(Number(d.balance ?? 0)),
      )
      .catch((reason: unknown) => {
        setLoyaltyBalance(0);
        setError(
          reason instanceof Error
            ? reason.message
            : "Loyalty balance is temporarily unavailable.",
        );
      });
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
      const resumeParams = new URLSearchParams();
      if (initialResumeCartId?.trim()) {
        resumeParams.set("cartId", initialResumeCartId.trim());
      }
      if (initialResumeToken?.trim()) {
        resumeParams.set("token", initialResumeToken.trim());
      }
      const qs = resumeParams.toString() ? `?${resumeParams.toString()}` : "";
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
  }, [initialResumeCartId, initialResumeToken]);

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
    const controller = new AbortController();
    medusaPreviewAbortRef.current = controller;
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
            signal: controller.signal,
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
              e instanceof Error
                ? e.message
                : "Could not load checkout totals.",
            );
          }
        }
      })();
    }, 400);

    return () => {
      cancelled = true;
      controller.abort();
      if (medusaPreviewAbortRef.current === controller) {
        medusaPreviewAbortRef.current = null;
      }
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
    if (
      medusaPriceStatus !== "ready" ||
      !medusaPricePreview?.quoteFingerprint
    ) {
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
      setError(
        "Choose an available way to pay, or ask the shop owner to turn on that option.",
      );
      return;
    }
    if (quoteReviewRequired) {
      setError("Review the updated total below before continuing to payment.");
      return;
    }
    payInFlightRef.current = true;
    medusaPreviewAbortRef.current?.abort();
    medusaPreviewAbortRef.current = null;
    setLoading(true);
    setError(null);
    setCheckoutPhase("starting");

    const cartTotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
    const telemetryTotal = medusaPricePreview?.total ?? cartTotal;
    // Telemetry must not block payment initiation if a browser analytics SDK stalls.
    queueMicrotask(() => {
      try {
        trackBeginCheckout({
          value: telemetryTotal,
          itemCount: lines.reduce((s, l) => s + l.quantity, 0),
          currencyCode: displayCurrency,
        });
      } catch {
        /* checkout remains authoritative when telemetry is unavailable */
      }
    });

    try {
      const em = email.trim();
      if (
        paymentMethod !== "COD" &&
        em &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)
      ) {
        setError("Enter a valid email address or leave the field blank.");
        setCheckoutPhase("error");
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
          setCheckoutPhase("error");
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
          setCheckoutPhase("error");
          setLoading(false);
          payInFlightRef.current = false;
          return;
        }
        codCartPayload = codJson as CodCartPayload;
      }

      let result: MedusaCheckoutResult;
      if (paymentMethod === "COD") {
        const url = new URL(window.location.href);
        const attribution = normalizeCommerceAttribution({
          source: url.searchParams.get("utm_source") ?? undefined,
          medium: url.searchParams.get("utm_medium") ?? undefined,
          campaign: url.searchParams.get("utm_campaign") ?? undefined,
          campaignId: url.searchParams.get("campaign_id") ?? undefined,
          couponCode: promoApplied?.code,
          referralCode:
            url.searchParams.get("ref") ??
            url.searchParams.get("referral") ??
            undefined,
        });
        result = await startMedusaCheckout({
          lines,
          providerId: PAYMENT_PROVIDER_IDS.COD,
          codCartPayload,
          loyaltyPointsToRedeem: parsedLoyalty,
          shippingOptionId: selectedShippingOptionId ?? undefined,
          attribution,
        });
      } else {
        const startController = new AbortController();
        const startTimeout = window.setTimeout(
          () => startController.abort(),
          90_000,
        );
        try {
          const startRes = await fetch("/api/checkout/start", {
            method: "POST",
            credentials: "include",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            signal: startController.signal,
            body: JSON.stringify({
              lines: lines.map((l) => ({
                variantId: l.variantId,
                quantity: l.quantity,
              })),
              email: em || undefined,
              providerId: PAYMENT_PROVIDER_IDS[paymentMethod],
              loyaltyPointsToRedeem:
                parsedLoyalty !== undefined && parsedLoyalty > 0
                  ? parsedLoyalty
                  : undefined,
              shippingOptionId: selectedShippingOptionId ?? undefined,
              attribution: normalizeCommerceAttribution({
                source:
                  new URL(window.location.href).searchParams.get(
                    "utm_source",
                  ) ?? undefined,
                medium:
                  new URL(window.location.href).searchParams.get(
                    "utm_medium",
                  ) ?? undefined,
                campaign:
                  new URL(window.location.href).searchParams.get(
                    "utm_campaign",
                  ) ?? undefined,
                campaignId:
                  new URL(window.location.href).searchParams.get(
                    "campaign_id",
                  ) ?? undefined,
                couponCode: promoApplied?.code,
                referralCode:
                  new URL(window.location.href).searchParams.get("ref") ??
                  new URL(window.location.href).searchParams.get("referral") ??
                  undefined,
              }),
            }),
          });
          const body = (await startRes
            .json()
            .catch(() => ({}))) as MedusaCheckoutResult & {
            error?: string;
          };
          if (!startRes.ok || typeof body.cartId !== "string") {
            throw new Error(
              body.error || "Could not start checkout. Please try again.",
            );
          }
          result = body;
        } catch (error) {
          if (startController.signal.aborted) {
            throw new Error("Checkout startup timed out. Please try again.");
          }
          throw error;
        } finally {
          window.clearTimeout(startTimeout);
        }
      }

      const {
        cartId,
        confirmedTotal,
        currencyCode,
        checkoutUrl,
        providerLabel,
        codOrderPlaced,
        orderId,
        confirmedPreview,
        checkoutActionKind,
        qrImageUrl,
        qrPayload,
      } = result;

      if (confirmedPreview) {
        setMedusaPricePreview(confirmedPreview);
        setMedusaPriceStatus("ready");
      }

      let trackingPageUrl = result.trackingPageUrl;
      let checkoutCorrelationId = result.correlationId;
      if (
        !codOrderPlaced &&
        (typeof trackingPageUrl !== "string" || !checkoutCorrelationId)
      ) {
        const bindRes = await fetch("/api/cart/medusa-bind", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartId }),
        });
        if (!bindRes.ok) {
          const bindJson = (await bindRes.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            bindJson.error ||
              "Could not secure the checkout cart. Please try again.",
          );
        }
        const res = await fetch("/api/tracking-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartId }),
        });
        const data = (await res.json()) as { trackingPageUrl?: string };
        if (!res.ok || typeof data.trackingPageUrl !== "string") {
          throw new Error(
            "Could not create a secure order-tracking link. Please try again.",
          );
        }
        trackingPageUrl = data.trackingPageUrl;
      }
      if (typeof trackingPageUrl !== "string" || !trackingPageUrl) {
        throw new Error(
          "Could not create a secure order-tracking link. Please try again.",
        );
      }

      if (codOrderPlaced && orderId?.trim()) {
        trackPurchase({
          orderId: orderId.trim(),
          value: confirmedTotal,
          itemCount: lines.reduce((s, l) => s + l.quantity, 0),
          paymentMethod: "COD",
          currencyCode,
        });
        clearCart();
        const safeTrackingUrl = sanitizeSameOriginUrl(
          trackingPageUrl,
          window.location.origin,
        );
        if (!safeTrackingUrl) {
          setError(
            "The tracking link returned by checkout is invalid. Open your order from the confirmation email.",
          );
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
      const providerPaymentId =
        typeof sessionData.providerPaymentId === "string"
          ? sessionData.providerPaymentId
          : undefined;
      const usePayPalElement =
        paymentMethod === "PAYPAL" && Boolean(paypalOrderId);
      const useXenditComponents =
        paymentMethod === "XENDIT" &&
        Boolean(xenditComponentsSdkKey && providerSessionId);
      const providerKey = paymentMethod.toLowerCase() as HostedReturnProvider;
      const amountMinor = Math.round(
        confirmedTotal * minorUnitDivisor(currencyCode),
      );
      if (!checkoutCorrelationId) {
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
            providerPaymentId,
          }),
        });
        const regJson = (await regRes.json().catch(() => ({}))) as {
          correlationId?: string;
          error?: string;
        };
        if (!regRes.ok || typeof regJson.correlationId !== "string") {
          throw new Error(
            regJson.error ||
              "Could not register a durable payment attempt. Please try again.",
          );
        }
        checkoutCorrelationId = regJson.correlationId;
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
        setCheckoutPhase("embedded");
        setCopyDone(false);
      } else if (checkoutActionKind === "qr") {
        if (!qrImageUrl && !qrPayload) {
          throw new Error(
            "The payment provider returned an empty QR payment action. Start checkout again.",
          );
        }
        setPendingPayment({
          checkoutUrl: "",
          actionKind: "qr",
          qrImageUrl,
          qrPayload,
          trackingPageUrl,
          providerLabel,
          confirmedTotal,
          currencyCode,
          priceMismatch: false,
          providerKey,
          correlationId: checkoutCorrelationId,
        });
        setCheckoutPhase("awaiting_provider");
        setCopyDone(false);
      } else {
        if (!checkoutCorrelationId && paymentMethod !== "COD") {
          throw new Error(
            "Could not register a durable payment attempt for this checkout. Try again before leaving for payment.",
          );
        }
        const comparableBagTotal = medusaPricePreview?.total ?? localTotal;
        const tol = Math.max(0.5, comparableBagTotal * 0.02);
        const priceMismatch =
          Number.isFinite(confirmedTotal) &&
          Number.isFinite(comparableBagTotal) &&
          Math.abs(confirmedTotal - comparableBagTotal) > tol;

        const safeCheckoutUrl = sanitizeHostedCheckoutUrl(
          providerKey,
          checkoutUrl,
        );
        if (!safeCheckoutUrl) {
          throw new Error(
            "The payment provider returned an invalid checkout link. Start checkout again.",
          );
        }
        if (checkoutCorrelationId) {
          try {
            sessionStorage.setItem(
              "payment_checkout_correlation_id",
              checkoutCorrelationId,
            );
          } catch {
            /* ignore unavailable session storage */
          }
        }
        setPendingPayment({
          checkoutUrl,
          actionKind: checkoutActionKind === "wallet" ? "wallet" : "redirect",
          trackingPageUrl,
          providerLabel,
          confirmedTotal,
          currencyCode,
          priceMismatch,
          providerKey,
          correlationId: checkoutCorrelationId,
        });
        setCheckoutPhase("redirecting");
        setCopyDone(false);
        window.location.assign(safeCheckoutUrl);
        return;
      }
    } catch (e) {
      setCheckoutPhase("error");
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
    const safeCheckoutUrl = sanitizeHostedCheckoutUrl(
      pendingPayment.providerKey,
      pendingPayment.checkoutUrl,
    );
    if (!safeCheckoutUrl) {
      setError(
        "The payment provider returned an invalid checkout link. Start checkout again.",
      );
      return;
    }
    window.location.assign(safeCheckoutUrl);
  }

  async function finalizeCheckoutAttempt(active: {
    correlationId: string;
  }): Promise<void> {
    setLoading(true);
    setError(null);
    setCheckoutPhase("finalizing");
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
        const safeRedirectUrl = sanitizeTrustedPublicUrl(
          finalizeJson.redirectUrl,
        );
        if (!safeRedirectUrl) {
          setError(
            "The payment provider returned an invalid redirect. Start checkout again.",
          );
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
          trackingPageUrl?: string | null;
          lastError?: string | null;
          staleReason?: string | null;
        };
        if (
          statusRes.ok &&
          statusJson.status === "completed" &&
          typeof statusJson.trackingPageUrl === "string" &&
          statusJson.trackingPageUrl.length > 0
        ) {
          const safeTrackingUrl = sanitizeSameOriginUrl(
            statusJson.trackingPageUrl,
            window.location.origin,
          );
          if (!safeTrackingUrl) {
            throw new Error(
              "Your order is complete, but its tracking link is invalid. Check your account or confirmation email.",
            );
          }
          clearCart();
          window.location.href = safeTrackingUrl;
          return;
        }
        if (
          statusRes.ok &&
          (statusJson.status === "needs_review" ||
            statusJson.status === "expired") &&
          typeof (statusJson.staleReason ?? statusJson.lastError) ===
            "string" &&
          (statusJson.staleReason ?? statusJson.lastError)!.length > 0
        ) {
          throw new Error(
            statusJson.staleReason ??
              statusJson.lastError ??
              "Checkout needs review.",
          );
        }
      }

      throw new Error(
        finalizeJson.error ??
          "Payment was accepted, but order finalization is still pending. Use your tracking link to resume safely.",
      );
    } catch (error) {
      setCheckoutPhase("error");
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
    paypalOrderId?: string,
  ): Promise<void> {
    if (active.provider === "PAYPAL") {
      if (!paypalOrderId) {
        setError(
          "PayPal did not return an order identifier. Your bag is unchanged; try again.",
        );
        return;
      }
      const confirmRes = await fetch("/api/checkout/paypal/confirm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          correlationId: active.correlationId,
          orderId: paypalOrderId,
        }),
      });
      if (!confirmRes.ok) {
        const confirmJson = (await confirmRes.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(
          confirmJson.error ??
            "PayPal payment could not be confirmed. Your bag is unchanged; try again.",
        );
        return;
      }
    }
    await finalizeCheckoutAttempt(active);
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
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        discountAmount?: number;
      };
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
    checkoutPhase,
    paymentMethod,
    setPaymentMethod: (next: PaymentProviderKey) => {
      userSelectedPaymentMethodRef.current = true;
      setPaymentMethod(next);
    },
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
    finalizeCheckoutAttempt,
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
