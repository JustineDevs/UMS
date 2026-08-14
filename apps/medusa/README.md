<p align="center">
 <a href="https://www.medusajs.com">
 <picture>
 <source media="(prefers-color-scheme: dark)" srcset="https://user-images.githubusercontent.com/59018053/229103275-b5e482bb-4601-46e6-8142-244f531cebdb.svg">
 <source media="(prefers-color-scheme: light)" srcset="https://user-images.githubusercontent.com/59018053/229103726-e5b529a3-9b3f-4970-8a1f-c6af37f087bf.svg">
 <img alt="Medusa logo" src="https://user-images.githubusercontent.com/59018053/229103726-e5b529a3-9b3f-4970-8a1f-c6af37f087bf.svg">
 </picture>
 </a>
</p>
<h1 align="center">
 Medusa
</h1>

<h4 align="center">
 <a href="https://docs.medusajs.com">Documentation</a> |
 <a href="https://www.medusajs.com">Website</a>
</h4>

<p align="center">
 Building blocks for digital commerce
</p>
<p align="center">
 <a href="https://github.com/medusajs/medusa/blob/master/CONTRIBUTING.md">
 <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat" alt="PRs welcome!" />
 </a>
 <a href="https://www.producthunt.com/posts/medusa"><img src="https://img.shields.io/badge/Product%20Hunt-%231%20Product%20of%20the%20Day-%23DA552E" alt="Product Hunt"></a>
 <a href="https://discord.gg/xpCwq3Kfn8">
 <img src="https://img.shields.io/badge/chat-on%20discord-7289DA.svg" alt="Discord Chat" />
 </a>
 <a href="https://twitter.com/intent/follow?screen_name=medusajs">
 <img src="https://img.shields.io/twitter/follow/medusajs.svg?label=Follow%20@medusajs" alt="Follow @medusajs" />
 </a>
</p>

## Universal Music Store monorepo

This app lives under **`universal-music-store/apps/medusa`**. Project-wide scope, runbooks, and ADR indexes live under **`docs/`** from the repo root.

**Storefront (Vercel):** https://universalmusic.vercel.app — add this origin to `STORE_CORS` / `STOREFRONT_PUBLIC_URL` when deploying.

### Philippines foundation + legacy import (from `apps/medusa`)

From this directory, with `apps/medusa/.env.local` created from `.env.template` (commerce DB + payment providers / shipment tracking / Resend are documented only here; root `.env.local` is for Next/Express/legacy DB and root `.env.production` mirrors the production-host values):

1. **`pnpm seed:ph`**: Region **Philippines** (`php`), sales channel **Web PH**, stock location **Warehouse PH** (metadata `legacy_inventory_location_code`, default `WH1`), flat **Standard PH** shipping, tax region `ph`, store default currency PHP, publishable API key linked to **Web PH**. Env: `MEDUSA_SEED_LEGACY_LOCATION_CODE`, `MEDUSA_PH_FLAT_SHIPPING_MINOR` (amount in **minor** php units; default `15000` = ₱150.00).
2. **Export legacy JSONL:** use the platform team's migration tooling or custom export scripts.
3. **`MIGRATION_CATALOG_JSONL=... pnpm import:legacy-catalog`**: Idempotent **by product `handle`** (= legacy `slug`). Creates categories from legacy `category`. Optional: `MIGRATION_SALES_CHANNEL_NAME`, `MIGRATION_CATALOG_BATCH`, `LEGACY_PRICE_ALREADY_MINOR=1` if legacy prices are already smallest-unit integers.
4. **`MIGRATION_INVENTORY_JSONL=... pnpm import:legacy-inventory`**: Resolves stock location by **`legacy_inventory_location_code`** on the Medusa location (from `seed:ph`) or by matching **location name**. Matches SKUs to inventory items (run after catalog import).

Use the default Medusa **`pnpm seed`** only for the upstream **EU** demo dataset; for Universal Music Store staging toward cutover, prefer a **clean DB** + **`seed:ph`** so currency/region/shipping match PH.

### Database backup and restore (staging / dev)

- **Backup:** use your host’s automated backups or `pg_dump` against the same `DATABASE_URL` Medusa uses (respect pooler vs direct connection policy).
- **Restore:** restore into a clean Postgres, then run Medusa migrations as required before serving traffic; re-run `seed:ph` only on empty DB when you need the PH baseline.
- **Dev:** snapshot before risky bulk `import:legacy-*` runs; document restore steps in incident or ops notes (`SOP-MEDUSA-ENV-AND-LEGACY` §6.3).

## Compatibility

This starter is compatible with versions >= 2 of `@medusajs/medusa`. 

## Getting Started

Visit the [Quickstart Guide](https://docs.medusajs.com/learn/installation) to set up a server.

Visit the [Docs](https://docs.medusajs.com/learn/installation#get-started) to learn more about our system requirements.

## What is Medusa

Medusa is a set of commerce modules and tools that allow you to build rich, reliable, and performant commerce applications without reinventing core commerce logic. The modules can be customized and used to build advanced ecommerce stores, marketplaces, or any product that needs foundational commerce primitives. All modules are open-source and freely available on npm.

Learn more about [Medusa’s architecture](https://docs.medusajs.com/learn/introduction/architecture) and [commerce modules](https://docs.medusajs.com/learn/fundamentals/modules/commerce-modules) in the Docs.

## Build with AI Agents

### Claude Code Plugin

If you use AI agents like Claude Code, check out the [medusa-dev Claude Code plugin](https://github.com/medusajs/medusa-claude-plugins).

### Other Agents

If you use AI agents other than Claude Code, copy the [skills directory](https://github.com/medusajs/medusa-claude-plugins/tree/main/plugins/medusa-dev/skills) into your agent's relevant `skills` directory.

### MCP Server

You can also add the MCP server `https://docs.medusajs.com/mcp` to your AI agents to answer questions related to Medusa. The `medusa-dev` Claude Code plugin includes this MCP server by default.

## Community & Contributions

The community and core team are available in [GitHub Discussions](https://github.com/medusajs/medusa/discussions), where you can ask for support, discuss roadmap, and share ideas.

Join our [Discord server](https://discord.com/invite/medusajs) to meet other community members.

## Other channels

- [GitHub Issues](https://github.com/medusajs/medusa/issues)
- [Twitter](https://twitter.com/medusajs)
- [LinkedIn](https://www.linkedin.com/company/medusajs)
- [Medusa Blog](https://medusajs.com/blog/)
