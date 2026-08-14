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
  onError,
}: {
  paypalOrderId: string;
  onApprove: (_orderId: string) => void;
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
        onApprove(data.orderID);
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

  if (!clientId) {
    return (
      <p className="text-sm text-red-600">
        PayPal is not configured. Missing NEXT_PUBLIC_PAYPAL_CLIENT_ID.
      </p>
    );
  }

  return (
    <div className="space-y-4">
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
          onError={handleError}
          disabled={loading}
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
