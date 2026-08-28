# Secrets rotation (payments and integrations)

Payment provider credentials for Medusa live in the **Medusa server environment** (for example the root `.env.local` loaded by `apps/medusa`, or your host’s secret manager). There is no admin UI in this repo that stores PSP keys.

## Stripe

1. Create a new restricted API key or roll the existing secret key in the Stripe Dashboard.
2. Update `STRIPE_API_KEY` (and `STRIPE_WEBHOOK_SECRET` if the webhook endpoint secret changed).
3. Restart Medusa.
4. Verify webhooks still reach `https://<medusa-host>/hooks/payment/stripe`.

## PayPal

1. Rotate client secret in the PayPal Developer portal when required.
2. Update `PAYPAL_CLIENT_SECRET` (and `PAYPAL_CLIENT_ID` / `PAYPAL_WEBHOOK_ID` if those changed).
3. Restart Medusa.

## Xendit

1. Rotate keys in the provider dashboard.
2. Update `XENDIT_SECRET_KEY` and `XENDIT_WEBHOOK_TOKEN`.
3. Restart Medusa and re-register webhooks if URLs or secrets changed.

## Shipment tracking provider

Update the tracking webhook signing secret in env; restart services that consume it.

## Supabase service role

`SUPABASE_SERVICE_ROLE_KEY` is used by admin and storefront server code for platform data writes (not for Medusa commerce). This key has full table access and must be rotated on a regular schedule (recommended: quarterly or after any suspected leak).

### Rotation steps

1. Sign in to [Supabase Dashboard](https://supabase.com/dashboard) and navigate to **Project Settings > API**.
2. Under **Service role key**, click **Regenerate** (confirm the prompt).
3. Copy the new key value.
4. Update every environment that uses this key:
   - Vercel: `vercel env rm SUPABASE_SERVICE_ROLE_KEY production && vercel env add SUPABASE_SERVICE_ROLE_KEY production`
   - Render: rotate the variable in the service Environment settings, then trigger a deploy or restart the affected service.
   - Local `.env.local`: replace the value; do not commit to git.
5. Deploy or restart the affected services (admin, storefront server functions).
6. Verify the old key returns 401 on any test request.
7. Update `SUPABASE_SERVICE_ROLE_KEY_ROTATED_AT` to today's ISO 8601 date in each environment's secret store.

### Key age guard

Run locally or in CI:

```bash
node scripts/check-key-age.mjs
```

Set `SUPABASE_SERVICE_ROLE_KEY_ROTATED_AT=<ISO8601>` (e.g. `2026-04-18T00:00:00Z`) in your environment. The script exits 1 if the key is older than 90 days (`KEY_ROTATION_THRESHOLD_DAYS` to override).

### Incident response (key leaked)

1. Regenerate immediately in Supabase Dashboard.
2. Rotate all environments within 30 minutes.
3. Review Supabase audit logs for unauthorized access since the suspected leak time.
4. File an internal incident report with timeline and remediation.

### Named owner

The designated security contact owns the rotation calendar. If no contact is set, the project lead assumes responsibility. The rotation schedule must be documented in the team wiki.

---
