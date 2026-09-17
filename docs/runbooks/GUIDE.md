# How to Obtain Credentials

Step-by-step guide for non-technical users. Each section explains where to go, what to click, and whether payment or verification is required.

---

## Cloudflare Workers (Backend)

**URL:** https://dash.cloudflare.com

**What you get:** The Wrangler-managed public backend at the Worker URL configured in `API_URL`. Worker-native route handlers execute commerce and compliance contracts directly.

The backend runs as a Worker with Hyperdrive and Cloudflare Queues.

**Steps:**

1. Install Wrangler or use `pnpm dlx wrangler` and run `wrangler login`.
2. Configure the required Worker secrets listed in the Cloudflare deployment checklist. Do not create `MEDUSA_ORIGIN_URL` or `COMPLIANCE_ORIGIN_URL`; route handlers run in the Worker runtime.
3. Deploy the preview Worker from the `dev` branch with `pnpm backend:worker:deploy`.
4. Deploy production only after the reviewed `dev` to `main` pull request with `pnpm backend:worker:deploy:production`.
5. Verify `${API_URL}/healthz` returns HTTP 200 before pointing Vercel at it.

Do not put database URLs, JWT secrets, cookie secrets, provider keys, or Supabase service keys in Wrangler `vars` or git. Secrets are injected at runtime. The Worker must not receive direct database credentials.

---

## Stripe (Card Payments)

**URL:** https://dashboard.stripe.com

**What you get:** API keys (publishable and secret) and webhook signing secret.

**Payment required?** No signup fee. Stripe charges per transaction.

**Steps:**

1. Go to https://dashboard.stripe.com and sign up or log in.

---

## PayPal

**URL:** https://developer.paypal.com

**What you get:** Client ID and Client Secret for accepting PayPal payments.

**Payment required?** No signup fee. PayPal charges per transaction.

**Steps:**

1. Go to https://developer.paypal.com and log in with your PayPal account (or create one).
2. Click **Apps & Credentials** in the top menu.

---

## Xendit (Philippines)

**URL:** https://dashboard.xendit.co

**What you get:** Secret key and webhook token. Used for GCash, bank transfer, cards, and e-wallets in the Philippines.

**Payment required?** No signup fee. Xendit charges per transaction. **Business verification** may be required before going live.

**Steps:**

1. Go to https://dashboard.xendit.co and sign up or log in.
2. Complete any required business verification when prompted. This is required to accept real payments.
3. In the left menu, go to **Developers** → **API Keys**.

---

## Hosted payment providers

**URLs:**  
- Xendit docs: https://docs.xendit.co

**What you get:** Secret key and webhook token. Used for hosted GCash, bank transfer, cards, and e-wallet payment flows in the Philippines.

**Payment required?** No signup fee. Hosted payment providers charge per transaction. **Business onboarding** may be required for live payments.

**Steps:**

1. Go to the provider dashboard and sign up for the business account.
2. Complete business onboarding and activation.

---

## Shipment Tracking

**URL:** Use the configured tracking provider dashboard.

**What you get:** API key for shipment tracking (e.g. J&T Express Philippines).

**Payment required?** Free tier available. Paid plans for higher volume.

**Steps:**

1. Go to the configured tracking provider dashboard and sign up or log in.
2. In the left menu, go to **App Center** or **Settings** → **API**.

**Repo-specific integration notes:** see [J&T Integration Map](./JNT-INTEGRATION.md) for the current carrier boundary model, reference pattern, and verification checklist.

---

## Summary: Do I Need to Pay?

| Service      | Signup fee | To get API keys      | For live transactions  |
|-------------|------------|----------------------|------------------------|
| Cloudflare Workers | Yes | Cloudflare account, domain, Hyperdrive, and Queues | Worker route, database, queue, and provider checks |
| Stripe      | No         | Free                 | % per transaction      |
| PayPal      | No         | Free                 | % per transaction      |
| Xendit      | No         | Business onboarding  | % per transaction      |
| Tracking service | No      | Free tier OK         | Paid for higher volume |

Configure these credentials in Cloudflare Workers or Vercel without committing secrets to the repository.

## Production env files

- `/.env.local` is for development only.
- `/.env.production` mirrors the production host configuration without localhost origins.
- Use `https://universalmusic.vercel.app` for public and admin links served by the unified web app unless a route-specific override is documented elsewhere.
