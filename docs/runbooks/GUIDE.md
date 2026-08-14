# How to Obtain Credentials

Step-by-step guide for non-technical users. Each section explains where to go, what to click, and whether payment or verification is required.

---

## Fly.io (Backend Hosting)

**URL:** https://fly.io

**What you get:** A production runtime for the Medusa commerce backend. The deployment produces a URL such as `https://universal-music-store-medusa.fly.dev`.

**Payment required?** Fly.io billing and machine pricing apply. Keep at least one machine running for checkout and webhook availability.

**Steps:**

1. Install `flyctl` and sign in with `fly auth login`.
2. From the repository root, review `fly.toml` and change `app` if the name is unavailable.
3. Create the app without generating a second configuration: `fly apps create universal-music-store-medusa`.
4. Set runtime secrets with `fly secrets set --app universal-music-store-medusa DATABASE_URL=... JWT_SECRET=... COOKIE_SECRET=... STORE_CORS=... ADMIN_CORS=... AUTH_CORS=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...`.
5. Deploy from the repository root: `fly deploy --config fly.toml --remote-only`.
6. Verify `https://universal-music-store-medusa.fly.dev/health` returns HTTP 200 before pointing Vercel at it.

Do not put database URLs, JWT secrets, cookie secrets, or Supabase service keys in `fly.toml`, Docker build arguments, or git. Fly secrets are injected at runtime.

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
| Fly.io      | No         | Account and billing setup | Paid machine runtime |
| Stripe      | No         | Free                 | % per transaction      |
| PayPal      | No         | Free                 | % per transaction      |
| Xendit      | No         | Business onboarding  | % per transaction      |
| Tracking service | No      | Free tier OK         | Paid for higher volume |

Hand these credentials to your developer. They will configure them in Fly.io or Vercel without committing secrets to the repository.

## Production env files

- `/.env.local` is for development only.
- `/.env.production` mirrors the production host configuration without localhost origins.
- Use `https://universalmusic.vercel.app` for storefront/admin public links unless a route-specific override is documented elsewhere.
