# Operator notes: production hardening (storefront + admin)

## Staff RBAC strict mode

1. Apply database migrations so `staff_permission_grants` exists (`pnpm --filter @universal-music-store/database migrate`).
2. Insert at least one row per staff user with the permission keys they need, or use `*` for superuser-style access during early rollout.
3. Set `NEXT_PUBLIC_STAFF_RBAC_STRICT=true` in the environment for the **admin** app (Vercel project or `.env.production`). Same value must be in the build so the client sidebar matches server checks.
4. Leave `NEXT_PUBLIC_STAFF_RBAC_STRICT` unset or `false` during local bootstrap when the grants table is empty.

If `NEXT_PUBLIC_STAFF_RBAC_STRICT=true` before grants exist, staff will see an empty sidebar and API routes will deny permission-gated actions.

## Deployment order

1. Postgres (Medusa) and Supabase available.
2. Run migrations.
3. Seed Medusa (`seed:ph` or your process) and staff grants.
4. Deploy admin and storefront with `NEXTAUTH_URL` per app.
5. Enable RBAC strict after verification.

## Rollback

- Set `NEXT_PUBLIC_STAFF_RBAC_STRICT` to empty or `false` and redeploy admin (temporary permissive mode). Fix grants, then re-enable strict.

## Post-deploy checks

- Admin: sign in, open Dashboard, Products, Orders (smoke).
- Storefront: home, shop, PDP, add to cart (no 500).
- CMS: edit one field, confirm on storefront.
