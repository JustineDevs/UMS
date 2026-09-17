import {
  buildHostedReturnMissingCorrelationMessage,
  checkoutReviewHref,
} from "./hosted-payment-return";

export const STRIPE_RETURN_MISSING_CORRELATION_MESSAGE =
  buildHostedReturnMissingCorrelationMessage("stripe");

export { checkoutReviewHref };
