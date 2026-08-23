"use client";

import { useCallback, useState } from "react";
import {
  PayPalScriptProvider,
  PayPalButtons,
  type ReactPayPalScriptOptions,
} from "@paypal/react-paypal-js";

export function PayPalEmbeddedCheckout({
  paypalOrderId,
  onApprove,
  onCancel,
  onError,
}: {
  paypalOrderId: string;
  onApprove: (_orderId: string) => void | Promise<void>;
  onCancel: () => void;
  onError: (_msg: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "";

  const initialOptions: ReactPayPalScriptOptions = {
    clientId,
    currency: "PHP",
    intent: "capture",
  };

  const handleCreateOrder = useCallback((): Promise<string> => {
    return Promise.resolve(paypalOrderId);
  }, [paypalOrderId]);

  const handleApprove = useCallback(
    async (data: { orderID: string }) => {
      setLoading(true);
      try {
        await onApprove(data.orderID);
      } catch (err) {
        onError(err instanceof Error ? err.message : "PayPal payment failed.");
      } finally {
        setLoading(false);
      }
    },
    [onApprove, onError],
  );

  const handleError = useCallback(
    (err: Record<string, unknown>) => {
      onError(String(err.message ?? "PayPal error."));
    },
    [onError],
  );

  const handleCancel = useCallback(() => {
    setLoading(false);
    onCancel();
  }, [onCancel]);

  if (!clientId) {
    return (
      <p className="text-sm text-red-600">
        PayPal is not configured. Missing NEXT_PUBLIC_PAYPAL_CLIENT_ID.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p id="paypal-popup-help" className="text-xs text-on-surface-variant" role="status">
        PayPal opens its secure approval window. If the window is blocked, allow popups for this site and try again; canceling leaves your bag unchanged.
      </p>
      <PayPalScriptProvider options={initialOptions}>
        <PayPalButtons
          style={{
            layout: "vertical",
            shape: "rect",
            label: "pay",
            tagline: false,
          }}
          createOrder={handleCreateOrder}
          onApprove={handleApprove}
          onCancel={handleCancel}
          onError={handleError}
          disabled={loading}
          aria-label="Pay securely with PayPal"
        />
      </PayPalScriptProvider>
      {loading && (
        <p className="text-sm text-on-surface-variant text-center">
          Processing your PayPal payment…
        </p>
      )}
    </div>
  );
}
