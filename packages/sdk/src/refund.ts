export type RefundReason = string;

export type RefundRequest = {
  orderId: string;
  paymentSessionId: string;
  amountMinor: number;
  currencyCode: string;
  reason: RefundReason;
  note?: string;
  isPartial: boolean;
  lineItems?: Array<{
    lineItemId: string;
    quantity: number;
    amountMinor: number;
  }>;
};

export type RefundResult = {
  success: boolean;
  refundId?: string;
  provider: string;
  amountRefundedMinor: number;
  status: "completed" | "pending" | "failed";
  errorMessage?: string;
};

export type CaptureRequest = {
  orderId: string;
  paymentSessionId: string;
  amountMinor: number;
  currencyCode: string;
  isPartial: boolean;
};

export type CaptureResult = {
  success: boolean;
  captureId?: string;
  provider: string;
  amountCapturedMinor: number;
  status: "completed" | "pending" | "failed";
  errorMessage?: string;
};

export function validateRefundAmount(
  requestedMinor: number,
  originalMinor: number,
  previousRefundsMinor: number,
): { valid: boolean; maxRefundable: number; message?: string } {
  const maxRefundable = originalMinor - previousRefundsMinor;
  if (requestedMinor <= 0) {
    return { valid: false, maxRefundable, message: "Refund amount must be positive" };
  }
  if (requestedMinor > maxRefundable) {
    return {
      valid: false,
      maxRefundable,
      message: `Requested ${requestedMinor} exceeds max refundable ${maxRefundable}`,
    };
  }
  return { valid: true, maxRefundable };
}

export function validateCaptureAmount(
  requestedMinor: number,
  authorizedMinor: number,
  previousCapturesMinor: number,
): { valid: boolean; maxCapturable: number; message?: string } {
  const maxCapturable = authorizedMinor - previousCapturesMinor;
  if (requestedMinor <= 0) {
    return { valid: false, maxCapturable, message: "Capture amount must be positive" };
  }
  if (requestedMinor > maxCapturable) {
    return {
      valid: false,
      maxCapturable,
      message: `Requested ${requestedMinor} exceeds max capturable ${maxCapturable}`,
    };
  }
  return { valid: true, maxCapturable };
}
