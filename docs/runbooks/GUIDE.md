# How to Obtain Credentials

Step-by-step guide for non-technical users. Each section explains where to go, what to click, and whether payment or verification is required.

---

## Render (Backend Hosting)

**URL:** https://render.com

**What you get:** The existing Render `UMS` web service for the Medusa commerce backend. The service URL is `https://ums-6455.onrender.com`.

**Payment required?** Render's free plan may sleep during inactivity. Use a paid plan for uninterrupted checkout and webhook availability.

**Steps:**

1. Use the existing Render service in workspace `tea-d6vp73tm5p6s73afirag`; do not create a second service from the Blueprint.
2. Keep its repository at `https://github.com/JustineDevs/UMS` on the `dev` branch.
3. Enter every variable marked `sync: false` in the existing service environment.
4. Verify `https://ums-6455.onrender.com/health` returns HTTP 200 before pointing Vercel at it.

Do not put database URLs, JWT secrets, cookie secrets, or Supabase service keys in Render build arguments or git. Secrets are injected at runtime.

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
| Render      | No         | Account and Git provider setup | Paid plan for always-on runtime |
| Stripe      | No         | Free                 | % per transaction      |
| PayPal      | No         | Free                 | % per transaction      |
| Xendit      | No         | Business onboarding  | % per transaction      |
| Tracking service | No      | Free tier OK         | Paid for higher volume |

Configure these credentials in Render or Vercel without committing secrets to the repository.

## Production env files

- `/.env.local` is for development only.
- `/.env.production` mirrors the production host configuration without localhost origins.
- Use `https://universalmusic.vercel.app` for storefront/admin public links unless a route-specific override is documented elsewhere.
