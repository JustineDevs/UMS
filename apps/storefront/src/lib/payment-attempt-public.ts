export function publicPaymentAttemptError(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const message = value.toLowerCase();
  if (message.includes("quote") || message.includes("stale")) {
    return "Your checkout quote changed. Review your bag before trying again.";
  }
  if (
    message.includes("provider") ||
    message.includes("payment") ||
    message.includes("stripe") ||
    message.includes("paypal") ||
    message.includes("xendit")
  ) {
    return "Payment could not be verified. Try again or contact support.";
  }
  if (message.includes("order") || message.includes("medusa")) {
    return "Your order is still being finalized. Try again shortly.";
  }
  return "Checkout needs review. Try again or contact support.";
}
