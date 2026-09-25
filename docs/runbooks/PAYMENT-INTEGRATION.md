# Payment Integration Guide

This document describes the payment providers integrated into the Universal Music Store Cloudflare Worker runtime.

## Storefront checkout lifecycle (runtime truth)

1. **Cart preparation** happens through the Worker-native commerce API before a payment session is created.
2. **Payment attempt** rows in Supabase (`payment_attempts`) record `correlation_id`, cart, provider, and status. Register via `POST /api/payments/checkout-intents` before hosted PSP redirect or COD completion.
3. **Provider session** is created through the Worker provider adapters (Stripe, PayPal, Xendit, or COD session data).
4. **Completion** is server-owned: hosted flows call `POST /api/payments/checkout-intents/:correlationId/finalize`. **COD** calls `POST /api/checkout/cod-place-order` with the same `correlationId`. The browser does not call `cart.complete` for COD.
5. **Recovery**: `GET /api/cron/finalize-payment-attempts` (secret header) processes stuck rows. Operators use **Admin → Payment attempts** (`/admin/payments`) for retry and escalation when `STOREFRONT_ORIGIN` and `STOREFRONT_INTERNAL_RECONCILE_SECRET` are set.

The Worker owns payment-attempt state, provider callbacks, idempotency, and order finalization. Do not register a Vercel page, storefront root, or legacy Medusa endpoint as a provider webhook target.

## Overview

| Provider | Methods | Use Case |
|----------|---------|----------|
| **Stripe** | Cards, wallets, regional methods (per Stripe Dashboard) | International and configurable per region |
| **PayPal** | PayPal balance, cards | International |
| **Xendit** | GCash, bank transfer, cards, e-wallets | Philippines |
| **Cash on delivery** | COD | In-person or configured regions |

Configure provider secrets in the Cloudflare Worker environment. Keep provider credentials out of the storefront and out of committed `.env` files.

---

## 1. Stripe

1. Open the Stripe **UVS** project in the correct Stripe account. Confirm the Dashboard account/business label is **UVS** before configuring events; the label is separate from the webhook endpoint and must not be used as a webhook path or application identifier.
2. Obtain **Secret key** and **Webhook signing secret** from the UVS project’s selected mode (Test or Live).
3. Register the Cloudflare backend webhook URL: `https://ums-backend-production.pcg0255.workers.dev/webhooks/stripe` in the matching Stripe mode (local development uses `http://localhost:8787/webhooks/stripe`). The Worker verifies and persists the event directly.

### Worker environment

Set `STRIPE_WEBHOOK_SECRET` in the Worker secret store. The production Worker endpoint is `https://ums-backend-production.pcg0255.workers.dev/webhooks/stripe`; do not use the storefront/Vercel origin or `/hooks/payment/stripe`.

---

## 2. PayPal

1. Create REST app credentials in the [PayPal Developer](https://developer.paypal.com) portal.
2. Configure sandbox vs live via `PAYPAL_ENVIRONMENT`.
3. Register PayPal webhooks at `https://ums-backend-production.pcg0255.workers.dev/webhooks/paypal`.
   For local development, use `http://localhost:8787/webhooks/paypal`. Never register the
   Vercel storefront host or the legacy `universalmusic-store.vercel.app` host as the
   provider callback.

### Worker environment

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

### Worker environment

```env
XENDIT_SECRET_KEY=xnd_...
XENDIT_WEBHOOK_TOKEN=...
```

### Storefront

Customers select **"GCash / Xendit"** on checkout when that provider is enabled. They are redirected to Xendit’s hosted payment page.

### Webhooks

Register: `${API_URL}/webhooks/xendit`

The Worker exposes Stripe at `/webhooks/stripe`, PayPal at `/webhooks/paypal`, Xendit at
`/webhooks/xendit`, and Pancake at `/webhooks/pancake`. Do not register the storefront
root, a Vercel page, or `/hooks/payment/*` as a payment webhook endpoint.

---

## 4. Cash on delivery

Cash on delivery remains available for eligible regions and is completed through the server-owned COD flow.

---

## Checkout Flow

1. Customer adds items to bag and goes to `/checkout`.
2. Customer selects an available payment method.
3. Customer clicks **Continue to secure payment**.
4. The Worker creates or reconciles the cart and initiates a payment session for the chosen provider.
5. Customer completes payment on the provider’s hosted page (or COD flow) as applicable.
6. After payment, the provider sends a webhook to the Cloudflare Worker where configured.
7. The Worker completes the order and updates the cart/order status.

---

## Provider identifiers

The checkout Worker and webhook configuration use only these canonical provider names:

| Provider | Worker/webhook identifier |
|----------|---------------------------|
| Stripe | `stripe` |
| PayPal | `paypal` |
| Xendit | `xendit` |
| COD | `cod` |

Do not copy Medusa-era `pp_*` identifiers into Worker configuration, callback URLs, or
webhook paths. Stripe always targets `/webhooks/stripe`.

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
   - Root: `.env.example` → local non-secret defaults and Worker endpoint configuration, then copy into `.env.local`.
   - Cloudflare Worker: configure provider keys and webhook secrets with the Worker secret store; never commit them or expose them through `NEXT_PUBLIC_*` variables.

---

## References

- [Stripe Docs](https://stripe.com/docs)
- [PayPal REST APIs](https://developer.paypal.com/docs/api/overview/)
- [Xendit Docs](https://docs.xendit.co)
