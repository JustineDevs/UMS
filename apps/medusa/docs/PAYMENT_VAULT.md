# Payment method storage and lifecycle

This project uses Medusa payment providers with hosted checkouts. Card data is not stored in this repository.

| Provider | Vault / tokens | Disconnect / delete |
|----------|------------------|---------------------|
| Stripe | Stripe Elements / Checkout; PaymentMethods in Stripe | Customer manages cards in Stripe Customer Portal or your flows; no raw PAN in Medusa. |
| Xendit | Xendit hosted checkout and payment sessions; no saved cards in Medusa | N/A for this integration. |
| PayPal | PayPal account and vaulted instruments in PayPal | `deleteAccountHolder` on PayPal provider removes stored payment methods when Medusa customer is deleted. |

**Storefront account settings:** Use the internal compliance flow to delete the Medusa customer and Supabase user; PayPal account holder deletion runs through the provider when configured.

## Order completion and retries (not card vault)

Hosted PSP flows must **complete the Medusa cart on the server** after the provider confirms payment. The storefront records **payment attempts** in Supabase and finalizes through server routes and cron recovery; see `docs/runbooks/PAYMENT-INTEGRATION.md`. Card non-storage does not imply automatic order completion if webhooks or finalize steps fail; operators use **Admin → Payment attempts** and cron reconciliation when configured.
