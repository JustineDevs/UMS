# Payment Integration Guide

This document describes the payment providers integrated into the Universal Music Store e-commerce platform (Medusa v2).

## Storefront checkout lifecycle (runtime truth)

1. **Cart preparation** happens on the storefront server (Medusa store APIs) before a payment session is created.
2. **Payment attempt** rows in Supabase (`payment_attempts`) record `correlation_id`, cart, provider, and status. Register via `POST /api/payments/checkout-intents` before hosted PSP redirect or COD completion.
3. **Provider session** is created through Medusa `initiatePaymentSession` (Stripe Elements, PayPal, Xendit, or COD session data).
4. **Completion** is server-owned: hosted flows call `POST /api/payments/checkout-intents/:correlationId/finalize`. **COD** calls `POST /api/checkout/cod-place-order` with the same `correlationId`. The browser does not call `cart.complete` for COD.
5. **Recovery**: `GET /api/cron/finalize-payment-attempts` (secret header) processes stuck rows. Operators use **Admin → Payment attempts** (`/admin/payments`) for retry and escalation when `STOREFRONT_ORIGIN` and `STOREFRONT_INTERNAL_RECONCILE_SECRET` are set.

Legacy `POST /api/checkout/complete-medusa-cart` remains for backward compatibility; optional strict mode: `STOREFRONT_STRICT_PAYMENT_LEDGER=true` requires a ledger correlation id.

## Overview

| Provider | Methods | Use Case |
|----------|---------|----------|
| **Stripe** | Cards, wallets, regional methods (per Stripe Dashboard) | International and configurable per region |
| **PayPal** | PayPal balance, cards | International |
| **Xendit** | GCash, bank transfer, cards, e-wallets | Philippines |
| **Cash on delivery** | COD | In-person or configured regions |

Use `apps/medusa/medusa-config.ts` and **environment variables** on the Medusa process to enable providers per deployment. Restart Medusa after changing keys.

---

## 1. Stripe

1. Create or open a [Stripe](https://stripe.com) account.
2. Obtain **Secret key** and **Webhook signing secret** from the Stripe Dashboard.
3. Register Medusa webhook URL: `https://your-medusa-backend.example.com/hooks/payment/stripe` (exact path follows your Medusa route setup).

### Environment (Medusa)

Set `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, and related keys in the Medusa server environment (see root `.env.local` / `.env.example` section 12).

---

## 2. PayPal

1. Create REST app credentials in the [PayPal Developer](https://developer.paypal.com) portal.
2. Configure sandbox vs live via `PAYPAL_ENVIRONMENT`.
3. Register PayPal webhooks to your Medusa PayPal hook URL.

### Environment (Medusa)

`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, etc. (see root `.env.local` / `.env.example`).

---

## 3. Xendit (GCash, cards, bank transfer)

Xendit supports Philippine payment methods:

- GCash
- GrabPay
- Cards (Visa, Mastercard)
- Bank transfer
- Online banking

### Setup

1. Create a [Xendit](https://xendit.co) account.
2. Complete business verification if required.
3. Get API keys from **Developers → API Keys**.
4. Create a webhook in **Developers → Webhooks** for payment updates.

### Environment (Medusa)

```env
XENDIT_SECRET_KEY=xnd_...
XENDIT_WEBHOOK_TOKEN=...
```

### Storefront

Customers select **"GCash / Xendit"** on checkout when that provider is enabled. They are redirected to Xendit’s hosted payment page.

### Webhooks

Register: `https://universal-music-store-medusa.onrender.com/hooks/payment/xendit`

---

## 4. Cash on delivery

Cash on delivery remains available for eligible regions and is completed through the server-owned COD flow.

---

## Checkout Flow

1. Customer adds items to bag and goes to `/checkout`.
2. Customer selects an available payment method.
3. Customer clicks **Continue to secure payment**.
4. Medusa creates a cart, initiates a payment session for the chosen provider.
5. Customer completes payment on the provider’s hosted page (or COD flow) as applicable.
6. After payment, the provider sends a webhook to Medusa where configured.
7. Medusa completes the order and updates the cart/order status.

---

## Provider IDs (Medusa)

| Provider | Example ID |
|----------|------------|
| Stripe | `pp_stripe_stripe` (and region-specific Stripe method IDs as registered) |
| PayPal | `pp_paypal_paypal` |
| Xendit | `pp_xendit_xendit` |
| COD | `pp_cod_cod` |

These IDs are used when configuring `NEXT_PUBLIC_MEDUSA_PAYMENT_PROVIDER_ID` for a default provider, or when selecting a provider on the checkout page.

---

## MCP and Skills

When working on payment features in Cursor:

1. **MCP servers** (enable in Cursor settings):
   - **Stripe** – Create orders, refunds, subscriptions; search docs; fetch resources by ID.
   - **PayPal** – Create/capture orders, refunds, disputes; list transactions, invoices.

2. **Skills** (from `skills-lock.json`; source: wshobson/agents):

   - **stripe-integration** – Stripe setup and webhooks.
   - **paypal-integration** – PayPal setup and webhooks.

3. **Configuration**:
   - Root: `.env.example` → `NEXT_PUBLIC_MEDUSA_*`, `MEDUSA_*` (client config), then copy into `.env.local`.
   - Medusa: `apps/medusa/.env.template` → provider keys, webhook secrets, then copy into `apps/medusa/.env.local`.

---

## References

- [Stripe Docs](https://stripe.com/docs)
- [PayPal REST APIs](https://developer.paypal.com/docs/api/overview/)
- [Xendit Docs](https://docs.xendit.co)
