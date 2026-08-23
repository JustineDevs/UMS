# Universal Music Store Admin App — Full Architecture and Reference

This document is the **complete high-level reference** for `apps/admin` (Next.js 15): architecture, folder layout, UI shell, every navigation item, every dashboard page, every `lib` module, every `components` file, every API route, permission keys, Medusa wiring patterns, middleware, auth, and environment variables. It reflects the codebase **as implemented**.

**Monorepo location:** `apps/admin/`  
**Default dev port:** `3001` (see `package.json` `next dev --port 3001`)

---

## Table of contents

1. [High-level architecture](#1-high-level-architecture)
2. [Technology stack](#2-technology-stack)
3. [Repository layout (complete tree)](#3-repository-layout-complete-tree)
4. [Root layout and global UI](#4-root-layout-and-global-ui)
5. [Dashboard shell (sidebar + main)](#5-dashboard-shell-sidebar--main) — [5.1](#51-route-group-and-layout-markup) [5.2](#52-sidebar-complete-structure-as-implemented) [5.3](#53-visual-shell-ascii-wireframes) [5.4](#54-main-column-default-chrome-and-banners) [5.5](#55-sidebar-navigation-index) [5.6](#56-what-each-page-shows-in-the-main-column)
6. [Middleware](#6-middleware)
7. [Authentication (`lib/auth.ts`)](#7-authentication-libauthts)
8. [Staff permissions (full key list)](#8-staff-permissions-full-key-list)
9. [Medusa integration patterns](#9-medusa-integration-patterns)
10. [Lib modules (each file, role, Medusa link)](#10-lib-modules-each-file-role-medusa-link)
11. [Components (each file, usage)](#11-components-each-file-usage)
12. [Domain layer](#12-domain-layer)
13. [App Router pages (every route)](#13-app-router-pages-every-route)
14. [API routes (every `route.ts`, grouped)](#14-api-routes-every-routets-grouped)
15. [Data ownership (ADR summary)](#15-data-ownership-adr-summary)
16. [Environment variables (admin-relevant)](#16-environment-variables-admin-relevant)
17. [Failure modes (commerce unavailable)](#17-failure-modes-commerce-unavailable)
18. [Product editor and catalog API](#18-product-editor-and-catalog-api)
19. [Feature areas: architecture, layout ASCII, flow, Medusa wiring](#19-feature-areas-architecture-layout-ascii-flow-medusa-wiring)
20. [MoSCoW prioritization (by area)](#20-moscow-prioritization-by-area)

---

## 1. High-level architecture

The admin is a **staff-only** browser app. It integrates:

| System                                           | Responsibility                                                                                                                                                                                            |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Medusa** (`apps/medusa`, HTTP default `:9000`) | Commerce system of record: products, variants, orders, inventory, regions, payment providers, POS-backed operations                                                                                       |
| **Supabase**                                     | Staff users (OAuth linkage), RBAC (`staff_permission_grants`), platform tables: CMS, loyalty, employees, devices, campaigns, segments, storefront home payload, channel events, chat intake archive, etc. |
| **Next.js API Routes**                           | Server-side secrets (`MEDUSA_SECRET_API_KEY`), `medusaAdminFetch`, `@medusajs/js-sdk`, Supabase service role                                                                                              |

```
                         +------------------+
                         |  Staff browser   |
                         +--------+---------+
                                  |
                                  | HTTPS
                                  v
+------------------+    +---------+----------+     +------------------------+
|  Next.js Admin   |    |  Route handlers    |     |  Medusa HTTP API       |
|  App Router      |--->|  /api/admin/*      |---->|  /admin/* (secret key) |
|  :3001           |    |  /api/pos/medusa/* |     |  Store API (publishable)|
|                  |    |  /api/medusa/*     |     +------------------------+
|  RSC + "use      |    +---------+----------+
|   client" pages  |              |
+--------+---------+              v
         |              +---------+----------+
         +------------->|  Supabase          |
                        |  Postgres + RLS    |
                        +--------------------+

  SDK paths:
  - medusaAdminFetch(path)  ->  GET/PATCH/POST {MEDUSA_BASE}{path}
  - getMedusaAdminSdk()     ->  @medusajs/js-sdk with apiKey
  - getMedusaStoreSdk()    ->  @medusajs/js-sdk with publishableKey
```

**Typical request path**

1. `GET /admin/...` matched by `middleware.ts` → NextAuth session required; JWT must have `role` `admin` or `staff`.
2. Server page calls `requirePagePermission("<key>")` where implemented (see [section 13](#13-app-router-pages-every-route)); on deny → redirect `/admin?denied=<key>`.
3. Data: **Medusa** via bridges + `medusa-admin-http` / `medusa-pos.ts`, or **Supabase** via `tryCreateSupabaseClient` + `@universal-music-store/platform-data`.

### 1.1 Sidebar destinations vs system of record (summary)

These match the **16** primary nav labels in `AdminSidebar.tsx`. Use this table before reading [section 19](#19-feature-areas-architecture-layout-ascii-flow-medusa-wiring) for full detail.

| Area (nav label)      | Route prefix                 | Primary data                 | Medusa in this app                                                                                                         |
| --------------------- | ---------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard**         | `/admin`                     | Orders + inventory snapshots | Yes: `medusa-order-bridge`, `medusa-inventory-bridge` (`medusaAdminFetch` → `/admin/orders`, `/admin/products` inventory)  |
| **Products**          | `/admin/catalog`             | Product catalog              | Yes: `medusa-catalog-bridge` (`medusaAdminFetch` → `/admin/products`)                                                      |
| **Inventory**         | `/admin/inventory`           | Stock levels                 | Yes: `medusa-inventory-bridge` + `/api/admin/inventory`                                                                    |
| **Orders**            | `/admin/orders`              | Orders                       | Yes: `medusa-order-bridge` + `/api/medusa/orders/*`                                                                        |
| **POS**               | `/admin/pos`                 | Cart, draft order, sale      | Yes: **`getMedusaStoreSdk`** + **`getMedusaAdminSdk`** in `/api/pos/medusa/*`                                              |
| **Analytics**         | `/admin/analytics`           | Aggregates                   | Yes (derived): `fetchMedusaOrdersForAdmin` in `analytics-bridge` + optional `/api/admin/analytics/*`                       |
| **CRM**               | `/admin/crm`                 | Customers                    | Yes: `customers-bridge` (`medusaAdminFetch` → `/admin/customers`)                                                          |
| **Employees**         | `/admin/employees`           | Staff roster, PIN            | No: Supabase via `/api/admin/employees`                                                                                    |
| **Loyalty**           | `/admin/loyalty`             | Programs, points             | No: Supabase via `/api/admin/loyalty/*`                                                                                    |
| **Campaigns**         | `/admin/campaigns`           | Campaigns, segments          | No: Supabase via `/api/admin/campaigns`, `/api/admin/segments`                                                             |
| **Devices**           | `/admin/devices`             | Hardware registry            | No: Supabase via `/api/admin/devices`                                                                                      |
| **Channels**          | `/admin/channels`            | Webhook audit                | No: Supabase `channel-events-bridge`                                                                                       |
| **Chat orders**       | `/admin/chat-orders`         | Intake queue                 | Supabase list; intake route **may** call Medusa to place orders (`getMedusaAdminSdk` in `integrations/chat-orders/intake`) |
| **Payments**          | `/admin/settings/payments`   | Regions + providers          | Yes: `payment-providers-bridge` (`medusaAdminFetch` → regions + payment providers)                                         |
| **Storefront** (home) | `/admin/settings/storefront` | Homepage payload             | No: Supabase `/api/admin/storefront-home`                                                                                  |
| **Content**           | `/admin/cms` and children    | Pages, nav, blog, etc.       | Partial: CMS is Supabase; **Product lookup** uses `medusaAdminFetch` (`/api/admin/commerce/products/search`)               |

**Medusa SDK usage recap:**

- **`medusaAdminFetch`** (`lib/medusa-admin-http.ts`): raw `fetch` to Medusa **Admin API** paths with **Basic** auth using `MEDUSA_SECRET_API_KEY`. Used by bridges and many `/api/admin/*` handlers.
- **`getMedusaAdminSdk()`** / **`getMedusaStoreSdk()`** (`lib/medusa-pos.ts`): `@medusajs/js-sdk` with `apiKey` (secret) or `publishableKey`. Used heavily by **`/api/pos/medusa/*`** and selectively elsewhere (e.g. chat intake).

---

## 2. Technology stack

| Layer                | Technology                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Framework            | Next.js 15 (App Router)                                                                                            |
| UI                   | React 18, Tailwind CSS (shared config), Google fonts: Plus Jakarta Sans (`--font-headline`), Inter (`--font-body`) |
| Icons                | Material Symbols Outlined (linked in `app/layout.tsx`)                                                             |
| Session              | NextAuth.js, JWT strategy, Google OAuth provider                                                                   |
| Commerce client      | `@medusajs/js-sdk`, raw `fetch` via `medusaAdminFetch`                                                             |
| Shared env / URLs    | `@universal-music-store/sdk` (`medusa-env.ts`, etc.)                                                               |
| RBAC / platform data | `@universal-music-store/database` re-exporting `@universal-music-store/platform-data`                              |
| Analytics (Vercel)   | `VercelWebAnalytics` component in root layout                                                                      |

---

## 3. Repository layout (complete tree)

```
apps/admin/
  admin.md                    # This document
  package.json
  next.config.js
  src/
    app/
      layout.tsx                # Root: fonts, NextAuthSessionProvider, LenisProvider, VercelWebAnalytics, globals.css
      page.tsx                  # Redirects "/" -> "/admin"
      globals.css
      (dashboard)/
        layout.tsx              # AdminSidebar + main column ml-72
        admin/
          page.tsx              # Dashboard
          catalog/
            page.tsx            # Products list
            new/
              page.tsx          # Add product (client form)
          orders/
            page.tsx
            [orderId]/
              page.tsx
          inventory/
            page.tsx
          pos/
            page.tsx            # Client-only POS UI
          analytics/
            page.tsx
          crm/
            page.tsx
          campaigns/
            page.tsx            # Client-only
          loyalty/
            page.tsx            # Client-only
          employees/
            page.tsx            # Client-only
          devices/
            page.tsx            # Client-only
          channels/
            page.tsx
          chat-orders/
            page.tsx
          settings/
            payments/
              page.tsx
            storefront/
              page.tsx
          cms/
            page.tsx            # Content hub
            pages/, navigation/, announcement/, categories/, media/, blog/, forms/, redirects/, experiments/, commerce/
      api/
        auth/[...nextauth]/route.ts
        admin/                  # See section 14
        pos/medusa/
        medusa/
        integrations/
    components/
      (see section 11)
    lib/
      (see section 10)
    domain/
      index.ts                  # Re-exports commerce facade
      commerce.ts
    middleware.ts
```

---

## 4. Root layout and global UI

**File:** `src/app/layout.tsx`

- Sets `metadata` (title, description, favicons).
- Loads Material Symbols stylesheet.
- Wraps children with:
  - `NextAuthSessionProvider` (`components/NextAuthSessionProvider.tsx`)
  - `LenisProvider` (`components/LenisProvider.tsx`)
- Renders `VercelWebAnalytics` (`components/VercelWebAnalytics.tsx`).
- Body classes: `bg-surface text-on-surface antialiased`.

**File:** `src/app/page.tsx`

- `redirect("/admin")` — entry URL sends users to the dashboard; unauthenticated access to `/admin` is still gated by middleware.

---

## 5. Dashboard shell (sidebar + main)

All authenticated admin UI lives under the **route group** `src/app/(dashboard)/`. The group does not change the URL. It only wraps every `/admin/**` page with the same two-column shell: **fixed left sidebar** plus **scrollable main column**.

### 5.1 Route group and layout markup

**File:** `src/app/(dashboard)/layout.tsx`

```tsx
<div className="flex min-h-screen">
  <AdminSidebar />
  <div className="ml-72 flex-1">{children}</div>
</div>
```

| Piece                     | Role                                                                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outer `flex min-h-screen` | Full viewport height; sidebar and main sit in one row.                                                                                             |
| `AdminSidebar`            | Fixed `w-72` panel on the left (see §5.2). It is **not** in the document flow for width, so the main column must reserve space.                    |
| `ml-72 flex-1`            | **288px** left margin matches `w-72` so page content starts to the right of the fixed sidebar. `flex-1` lets the main column fill remaining width. |

**What is not in this layout:** Page titles, padding, and `<main>` are chosen **per page** (commonly `main.min-h-screen.p-8.lg:p-12`). The shell only provides the sidebar + offset column.

### 5.2 Sidebar: complete structure (as implemented)

**File:** `src/components/AdminSidebar.tsx` (`"use client"` — uses `useSession`, `usePathname`).

**Root element**

```tsx
<aside className="h-screen w-72 fixed left-0 top-0 bg-slate-50 flex flex-col p-4 gap-2 z-50">
```

| Class fragment            | Effect                                                                   |
| ------------------------- | ------------------------------------------------------------------------ |
| `h-screen w-72`           | Full height, **288px** wide.                                             |
| `fixed left-0 top-0`      | Stays visible while the main column scrolls.                             |
| `bg-slate-50`             | Light gray background for the whole rail.                                |
| `flex flex-col p-4 gap-2` | Vertical stack, padding, spacing between blocks.                         |
| `z-50`                    | Draws above normal main content when overlapping (e.g. small viewports). |

**Block 1 — Brand (top, not scrollable with nav)**

- Wrapper: `div.px-2.py-5`.
- **Logo:** `Link` to `/admin` wraps `next/image` with `src="/brand/uvs-logo-landscape.png"` (served from `apps/admin/public/brand/`), `unoptimized`, intrinsic 1536×1024, `className="block h-28 w-auto max-w-[min(100%,260px)] object-contain object-left"`.
- **Tagline:** `p` with `text-[10px] text-slate-400 font-medium tracking-widest uppercase` — text **"Store back office"**.

**Block 2 — Navigation (middle, scrolls if needed)**

```tsx
<nav className="flex-1 flex flex-col gap-1 overflow-y-auto">
```

- `flex-1` consumes all space between logo and footer.
- `overflow-y-auto` scrolls the link list if there are many items or short viewports.
- **Visibility:** `navItems` is filtered with `staffHasPermission(perms ?? [], item.permission)`. Items the user cannot access are **removed from the DOM**, not merely disabled.

**Per link styling**

- **Active:** `pathname === item.href` **or** (`item.href !== "/admin"` **and** `pathname.startsWith(item.href)`). Active classes: `bg-white text-primary rounded-lg shadow-sm px-4 py-3 flex items-center gap-3 transition-all`.
- **Inactive:** `text-slate-500 px-4 py-3 flex items-center gap-3 hover:bg-slate-200 transition-all`.
- **Icon:** `<span className="material-symbols-outlined">{item.icon}</span>` (Material Symbols Outlined from root layout).
- **Label:** `span.font-body.text-sm.font-medium`.

**Block 3 — Account footer (bottom, pinned with `mt-auto`)**

```tsx
<div className="mt-auto flex flex-col gap-1 border-t border-slate-200 pt-4">
```

- **User row:** `div.px-4.py-3` with a **placeholder** circle `w-8 h-8 rounded-full bg-surface-container-high` (no avatar image in code), then email `text-xs font-bold text-primary truncate` and role `text-[10px] text-slate-500 truncate capitalize`.
- **Logout:** `button` with `onClick={() => signOut({ callbackUrl: "/" })}`, same hover row style as inactive nav links, icon `logout`, label **"Logout"**.

### 5.3 Visual shell: ASCII wireframes

**A — Viewport: two columns (full width)**

```
+================================================================================+
|  VIEWPORT (100vw x min-h-screen)                                               |
|                                                                                |
|  +------------------------+  +----------------------------------------------+  |
|  | ASIDE (fixed)          |  | MAIN COLUMN (flow, flex-1, ml-72)             |  |
|  | w-72 = 288px           |  | fills rest of width                          |  |
|  | h-screen               |  | vertical scroll HERE (sidebar stays fixed)   |  |
|  | bg-slate-50            |  |                                              |  |
|  | z-50                   |  |  Typical page:                             |  |
|  |                        |  |  <main class="min-h-screen p-8 lg:p-12">     |  |
|  |  [1] Logo + tagline    |  |    optional banners (denied, commerce down)  |  |
|  |  [2] <nav> scroll      |  |    <header> title + subtitle                 |  |
|  |       link link ...    |  |    sections, tables, forms                   |  |
|  |  [3] border-t          |  |  </main>                                     |  |
|  |      email + role      |  |                                              |  |
|  |      [Logout]          |  |                                              |  |
|  +------------------------+  +----------------------------------------------+  |
|                                                                                |
+================================================================================+
```

**B — Sidebar internal stack (top to bottom, nothing omitted)**

```
+----------------------------+
| p-4 outer pad              |
|  +----------------------+  |
|  | px-2 py-5            |  |
|  | [IMG logo h-28]      |  |
|  | STORE BACK OFFICE    |  |
|  +----------------------+  |
|  flex-1 overflow-y-auto    |
|  +----------------------+  |
|  | [icon] Dashboard     |  |  <- active: white card + shadow
|  | [icon] Products      |  |
|  | ... (only permitted) |  |
|  +----------------------+  |
|  mt-auto                   |
|  border-t border-slate-200 |
|  [o] email                 |  <- circle placeholder, not photo
|       role                 |
|  [icon] Logout             |
+----------------------------+
```

**C — Main column: optional top banners (Dashboard implements these)**

```
+----------------------------------------------------------+
| <main>                                                    |
|   [OPTIONAL] Amber box: RBAC denial (?denied=permission) |
|   [OPTIONAL] Gray box: Medusa unreachable                |
|   <header> page title + description                       |
|   ... primary content ...                               |
+----------------------------------------------------------+
```

### 5.4 Main column: default chrome and banners

| Topic                          | Detail                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wrapper**                    | Layout only adds `ml-72 flex-1`. No global padding on this wrapper.                                                                                                                                                                                                                                                                       |
| **Typical page root**          | Many routes render `<main className="min-h-screen p-8 lg:p-12">` for consistent **32px / 48px** padding on large screens.                                                                                                                                                                                                                 |
| **Permission denial redirect** | Failed `requirePagePermission` sends the user to **`/admin?denied=<key>`**. The **Dashboard** (`/admin`) reads `searchParams.denied` and shows an **amber** banner: short copy plus the raw permission key in monospace for admins. Other pages do not all repeat this pattern; the dashboard is the natural landing screen after denial. |
| **Commerce unavailable**       | When Medusa cannot be reached, bridges set flags (e.g. `commerceUnavailable`). The Dashboard shows a **non-technical** gray panel and optional `AdminTechnicalDetails` for developers.                                                                                                                                                    |
| **Horizontal scroll**          | Logo link uses `overflow-x-auto` so an oversized asset does not break the column.                                                                                                                                                                                                                                                         |

### 5.5 Sidebar navigation index

**File:** `src/components/AdminSidebar.tsx`  
**Filter:** `staffHasPermission(perms, item.permission)` — grants come from session; `*` in `platform-data` grants all.

| #   | `href`                       | Label           | Material icon   | `permission`         |
| --- | ---------------------------- | --------------- | --------------- | -------------------- |
| 1   | `/admin`                     | Dashboard       | `dashboard`     | `dashboard:read`     |
| 2   | `/admin/catalog`             | Products        | `shopping_bag`  | `catalog:read`       |
| 3   | `/admin/inventory`           | Inventory       | `inventory_2`   | `inventory:read`     |
| 4   | `/admin/orders`              | Orders          | `shopping_cart` | `orders:read`        |
| 5   | `/admin/pos`                 | POS             | `dock`          | `pos:use`            |
| 6   | `/admin/analytics`           | Analytics       | `bar_chart`     | `analytics:read`     |
| 7   | `/admin/crm`                 | CRM             | `groups`        | `crm:read`           |
| 8   | `/admin/employees`           | Employees       | `badge`         | `employees:read`     |
| 9   | `/admin/loyalty`             | Loyalty         | `loyalty`       | `loyalty:read`       |
| 10  | `/admin/campaigns`           | Campaigns       | `campaign`      | `campaigns:read`     |
| 11  | `/admin/devices`             | Devices         | `devices`       | `devices:manage`     |
| 12  | `/admin/channels`            | Channels        | `hub`           | `channels:manage`    |
| 13  | `/admin/chat-orders`         | Chat orders     | `chat`          | `chat_orders:manage` |
| 14  | `/admin/settings/payments`   | Payments        | `payments`      | `settings:read`      |
| 15  | `/admin/settings/storefront` | Storefront home | `web`           | `settings:read`      |
| 16  | `/admin/cms`                 | Content         | `article`       | `content:read`       |

**Active state:** `pathname === href` OR (`href !== "/admin"` AND `pathname.startsWith(href)`). Nested routes (e.g. `/admin/orders/ord_123`) highlight **Orders**, not Dashboard.

**Footer actions:** Display `session.user.email`, `session.user.role`; **Logout** calls `signOut({ callbackUrl: "/" })` (returns user to site root; middleware then controls what they see next).

### 5.6 What each page shows in the main column

Short guide to **what appears to the right of the sidebar** for every staff destination. For data sources and APIs, see [section 13](#13-app-router-pages-every-route).

**App entry**

- **`/`** (`src/app/page.tsx`): No shell yet. Immediate **`redirect("/admin")`**. User hits middleware on `/admin` for auth.

**Commerce overview**

- **`/admin` (Dashboard):** **Overview** heading, subtitle about sales and stock. KPI-style **links** into orders and inventory counts, **recent orders** list, **stock alerts** (low/out counts). Optional **denied** and **commerce unavailable** banners at top. Server-rendered; requires `dashboard:read`.

- **`/admin/catalog` (Products):** Search field (GET `?q=`). Table of products from Medusa with links to **open the Medusa Admin** product editor (external URL from bridge). Server-rendered; `catalog:read`.

- **`/admin/catalog/new` (Add product):** **Client** `ProductEditorForm` for create. **POST** `/api/admin/catalog/products` (see §18). Requires `catalog:write`.

- **`/admin/inventory`:** **Client** `InventoryTableWithRefresh` — variant-level stock table, refresh via `/api/admin/inventory`. Server prefetch from Medusa bridge. `inventory:read`.

- **`/admin/orders`:** Paginated or limited **orders list** from Medusa. Row links to order detail. `orders:read`.

- **`/admin/orders/[orderId]`:** **Order detail** (line items, addresses, status). **`FulfillmentPanel`** for shipments and courier actions via API routes. `orders:read`.

**Point of sale**

- **`/admin/pos`:** Full-screen **POS workspace** (client-only module): barcode/SKU lookup, cart, draft order, commit sale, quick products, suggestions, offline queue hooks, terminal print/drawer when configured. Auth from middleware; APIs enforce POS permissions. Sidebar still visible unless a future full-screen mode hides it in code (currently standard shell).

**Insights and people**

- **`/admin/analytics`:** Summary metrics, **`AnalyticsChartsPanel`**, and panels fed by `analytics-bridge` (orders-derived). May include routes under `/api/admin/analytics/*` for CLV, retention, trends. `analytics:read`.

- **`/admin/crm`:** **Customer list** from Medusa (`customers-bridge`). `crm:read`.

- **`/admin/employees` (client):** Staff roster, CRUD, PIN flows against `/api/admin/employees`. `employees:read` on nav; server APIs check finer keys.

- **`/admin/loyalty` (client):** Loyalty accounts, points, rewards UI; `/api/admin/loyalty/*`.

- **`/admin/campaigns` (client):** Marketing campaigns and execution; `/api/admin/campaigns`.

- **`/admin/devices` (client):** Registered devices (registers, printers, etc.); `/api/admin/devices`.

**Integrations and settings**

- **`/admin/channels`:** Inbound **channel webhook events** table (`channel-events-bridge`). `channels:manage`.

- **`/admin/chat-orders`:** **Chat intake** list plus **`ChatIntakeForm`** for manual or internal intake posts. `chat_orders:manage`.

- **`/admin/settings/payments`:** Regions and **payment providers** from Medusa with provider labels rendered by the settings page. Read-focused; `settings:read`.

- **`/admin/settings/storefront`:** **`StorefrontHomeEditor`** — JSON or structured editor for homepage payload persisted via `/api/admin/storefront-home` (Supabase). `settings:read`.

**Content (CMS hub and children)**

- **`/admin/cms`:** **Website content** hub — grid of cards linking to every CMS sub-area. Intro copy states catalog/prices stay in Medusa. `content:read`.

- **`/admin/cms/pages`:** Extra **static pages** (policies, landings). `CmsPagesManager`.

- **`/admin/cms/navigation`:** Header/footer **menus** and social links. `CmsNavigationEditor`.

- **`/admin/cms/announcement`:** Top **announcement bar**. `CmsAnnouncementEditor`.

- **`/admin/cms/categories`:** **Category page** intros and imagery (not Medusa category CRUD). `CmsCategoryEditor`.

- **`/admin/cms/media`:** **Media library** uploads and reuse. `CmsMediaManager`.

- **`/admin/cms/blog`:** **Blog** posts list and editor. `CmsBlogManager`.

- **`/admin/cms/forms`:** **Form submissions** inbox. `CmsFormsTable`.

- **`/admin/cms/redirects`:** URL **redirects** (301/302 style rules in app). `CmsRedirectsManager`.

- **`/admin/cms/experiments`:** **A/B or split tests** on pages. `CmsExperimentsManager`.

- **`/admin/cms/commerce`:** **Product lookup** for content authors — search Medusa products by API to copy IDs/handles into CMS or campaigns. `CmsCommerceSearch`.

**Client-only pages note:** POS, campaigns, loyalty, employees, and devices use **`"use client"`** page modules. They still sit inside the same shell. **Server** `requirePagePermission` is not always called on those files; access control is **middleware + API** `staffHasPermission`. Prefer aligning with other pages by adding server guards when practical.

---

## 6. Middleware

**File:** `src/middleware.ts`

| Matcher                    | Behavior                                                              |
| -------------------------- | --------------------------------------------------------------------- |
| `/admin/:path*`            | NextAuth `withAuth`; `authorized`: `token.role` is `admin` or `staff` |
| `/api/admin/:path*`        | Same                                                                  |
| `/api/integrations/:path*` | Same, except exceptions below                                         |

**Exceptions (no session required for these paths):**

| Path                                   | Behavior                                                                                           |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `/api/integrations/channels/webhook`   | `NextResponse.next()` — external channel partners POST here                                        |
| `/api/integrations/chat-orders/intake` | `NextResponse.next()` only if header `x-internal-key` equals `INTERNAL_CHAT_INTAKE_KEY` (when set) |

**Sign-in page configured:** `pages: { signIn: "/api/auth/signin" }` (NextAuth default route).

---

## 7. Authentication (`lib/auth.ts`)

- **Provider:** Google OAuth (`GoogleProvider`).
- **Env:** Root `.env`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (storefront), and `ADMIN_NEXTAUTH_URL` (e.g. `http://localhost:3001` for staff OAuth on the admin origin).
- **Sign-in flow:** `signIn` callback uses Supabase `tryCreateSupabaseClient`, `upsertOAuthUser`, `isStaffRole`; optional allowlist `ADMIN_ALLOWED_EMAILS` (comma-separated).
- **JWT/session:** Permissions loaded via `resolveStaffPermissionsForUserId` with **in-memory cache** (`PERMISSIONS_CACHE_TTL_MS` = 60s) keyed by email.
- **Session object:** Includes `user.permissions` (string array) for RBAC in UI and API routes.

---

## 8. Staff permissions (full key list)

**Source:** `packages/platform-data/src/permissions.ts` — `STAFF_PERMISSION_KEYS`

```
dashboard:read
inventory:read
inventory:write
catalog:read
catalog:write
orders:read
orders:write
pos:use
pos:void
pos:discount_override
pos:refund
pos:shift_manage
analytics:read
analytics:export
crm:read
crm:write
crm:segments
channels:manage
integrations:manage
chat_orders:manage
settings:read
settings:write
content:read
content:write
employees:read
employees:write
loyalty:read
loyalty:write
campaigns:read
campaigns:write
campaigns:execute
devices:manage
receipts:read
receipts:send
```

**Helper:** `staffHasPermission(permissions, key)` — `*` grants all.

**Page guard:** `requirePagePermission(key)` in `lib/require-page-permission.ts` redirects to `/admin?denied=<key>` if missing.

---

## 9. Medusa integration patterns

### Pattern A — `medusaAdminFetch` (`lib/medusa-admin-http.ts`)

- Builds URL: `getMedusaStoreBaseUrl()` + path.
- Auth: `Authorization: Basic base64("${MEDUSA_SECRET_API_KEY}:")` (secret key, not Bearer).
- Use for any **Admin API** path: `/admin/orders`, `/admin/products`, `/admin/regions`, etc.

### Pattern B — `getMedusaAdminSdk()` (`lib/medusa-pos.ts`)

- `new Medusa({ baseUrl, apiKey: secret })`.
- Use for typed `admin.*` calls in route handlers (POS, lookups).

### Pattern C — `getMedusaStoreSdk()` (`lib/medusa-pos.ts`)

- `new Medusa({ baseUrl, publishableKey })`.
- Use for **Store API** (`store.product.list`, etc.) in server routes.

### Env resolution

**Package:** `@universal-music-store/sdk` — `getMedusaStoreBaseUrl`, `getMedusaSecretApiKey`, `getMedusaPublishableKey`, `getMedusaRegionId`, `getMedusaSalesChannelId`, `getMedusaPaymentProviderId`.

---

## 10. Lib modules (each file, role, Medusa link)

| File                               | Role                                                                                                                     | Medusa / external        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| `medusa-admin-http.ts`             | `medusaAdminFetch` — HTTP to Admin API with secret Basic auth                                                            | Yes                      |
| `medusa-pos.ts`                    | `getMedusaStoreSdk`, `getMedusaAdminSdk`, `getMedusaSecretKey`, `optionRowsToSizeColor`, `variantPricePhpFromCalculated` | Yes                      |
| `medusa-order-bridge.ts`           | Orders list/detail, JSON, metadata patch; `commerceUnavailable` on network error                                         | Yes (`medusaAdminFetch`) |
| `medusa-inventory-bridge.ts`       | Product variants + inventory levels for admin inventory table                                                            | Yes                      |
| `medusa-catalog-bridge.ts`         | Product list for catalog page; `getMedusaAdminAppBaseUrl`, product edit URLs                                             | Yes                      |
| `payment-providers-bridge.ts`      | Regions + payment providers bundle for Payments settings                                                                 | Yes                      |
| `customers-bridge.ts`              | CRM customer list via Medusa                                                                                             | Yes                      |
| `analytics-bridge.ts`              | Summary + charts from order data via `fetchMedusaOrdersForAdmin`                                                         | Yes (derived)            |
| `analytics-chart.ts`               | Chart payload building + tests                                                                                           | Medusa-derived           |
| `auth.ts`                          | NextAuth options                                                                                                         | Supabase                 |
| `require-page-permission.ts`       | Server redirect guard                                                                                                    | —                        |
| `require-admin-supabase.ts`        | Supabase client or 503 for admin APIs                                                                                    | Supabase                 |
| `requireStaffSession.ts`           | Staff session check helper                                                                                               | NextAuth                 |
| `channel-events-bridge.ts`         | Channel webhook events list                                                                                              | Supabase                 |
| `chat-intake-bridge.ts`            | Chat order intake rows                                                                                                   | Supabase                 |
| `channel-webhook-policy.ts`        | Webhook policy validation + tests                                                                                        | —                        |
| `terminal-print.ts`                | Receipt / drawer via terminal-agent or API proxy                                                                         | Optional agent           |
| `offline-pos.ts`                   | Offline sale queue + sync                                                                                                | POS API                  |
| `use-offline-sync.ts`              | Client hook for offline sync                                                                                             | —                        |
| `admin-sse-hub.ts`                 | SSE hub for admin                                                                                                        | —                        |
| `staff-api-response.ts`            | Correlated JSON helpers                                                                                                  | —                        |
| `admin-api-log.ts`                 | Logging                                                                                                                  | —                        |
| `request-correlation.ts`           | Correlation IDs                                                                                                          | —                        |
| `courier-registry.ts`              | Courier labels for fulfillment                                                                                           | —                        |
| `payment-provider-display-name.ts` | Human labels for Medusa provider IDs                                                                                     | —                        |
| `*.test.ts`                        | Unit tests co-located with modules                                                                                       | —                        |

---

## 11. Components (each file, usage)

| File                            | Purpose                                                                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AdminSidebar.tsx`              | Fixed nav; permission-filtered links (see section 5.3)                                                                                                                   |
| `AdminTechnicalDetails.tsx`     | Client: collapsible `<details>` for IT/developer copy                                                                                                                    |
| `NextAuthSessionProvider.tsx`   | SessionProvider wrapper                                                                                                                                                  |
| `LenisProvider.tsx`             | Smooth scroll                                                                                                                                                            |
| `VercelWebAnalytics.tsx`        | Vercel analytics                                                                                                                                                         |
| `StorefrontHomeEditor.tsx`      | Client: homepage CMS JSON editor; calls `/api/admin/storefront-home`                                                                                                     |
| `ChatIntakeForm.tsx`            | Chat intake form posting to integrations API                                                                                                                             |
| `InventoryTableWithRefresh.tsx` | Client inventory table + refresh via `/api/admin/inventory`                                                                                                              |
| `FulfillmentPanel.tsx`          | Order fulfillment; `fetch` to `/api/medusa/shipments`, `/api/integrations/couriers`                                                                                      |
| `AnalyticsChartsPanel.tsx`      | Renders chart payload from `analytics-bridge`                                                                                                                            |
| `catalog/ProductEditorForm.tsx` | Client: create/edit product form; `fetch` to `/api/admin/catalog/products` and `/api/admin/catalog/products/[id]` (see [section 18](#18-product-editor-and-catalog-api)) |
| `cms/CmsPagesManager.tsx`       | CMS pages CRUD UI                                                                                                                                                        |
| `cms/CmsNavigationEditor.tsx`   | Navigation JSON                                                                                                                                                          |
| `cms/CmsAnnouncementEditor.tsx` | Announcement bar                                                                                                                                                         |
| `cms/CmsCategoryEditor.tsx`     | Category storytelling                                                                                                                                                    |
| `cms/CmsMediaManager.tsx`       | Media uploads                                                                                                                                                            |
| `cms/CmsBlogManager.tsx`        | Blog list                                                                                                                                                                |
| `cms/CmsFormsTable.tsx`         | Form submissions                                                                                                                                                         |
| `cms/CmsRedirectsManager.tsx`   | Redirects                                                                                                                                                                |
| `cms/CmsExperimentsManager.tsx` | A/B experiments                                                                                                                                                          |
| `cms/CmsCommerceSearch.tsx`     | Product search for CMS; `GET /api/admin/commerce/products/search`                                                                                                        |

---

## 12. Domain layer

| File                 | Exports                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `domain/index.ts`    | `export * as commerce from "./commerce"`                                                                            |
| `domain/commerce.ts` | Facade: `listProducts`, `fullCatalogEditorUrl`, `productEditorUrl`, types — implemented via `medusa-catalog-bridge` |

**Intent:** Pages may import `@/domain/commerce` so commerce engine details stay behind facades.

---

## 13. App Router pages (every route)

For **what each screen shows** in the main column (UI-focused), see [§5.6](#56-what-each-page-shows-in-the-main-column). This section is the compact **route matrix**.

Legend: **Perm** = `requirePagePermission`. **Data** = primary backend. **Medusa** = how Medusa is used.

| Route                        | Type   | Perm                  | Primary components / notes                                      | Data                                                   | Medusa                                                      |
| ---------------------------- | ------ | --------------------- | --------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| `/`                          | RSC    | —                     | `redirect("/admin")`                                            | —                                                      | —                                                           |
| `/admin`                     | RSC    | `dashboard:read`      | KPI cards, recent orders, stock alerts                          | Orders + inventory bridges                             | `fetchMedusaOrdersForAdmin`, `fetchMedusaInventoryForAdmin` |
| `/admin/catalog`             | RSC    | `catalog:read`        | Product table, search form GET `?q=`, links to Medusa Dashboard | `fetchMedusaProductsListForAdmin`                      | Admin API                                                   |
| `/admin/catalog/new`         | RSC    | `catalog:write`       | `ProductEditorForm` mode create                                 | Form → `POST /api/admin/catalog/products` (§18)        | Implemented                                                 |
| `/admin/orders`              | RSC    | `orders:read`         | Orders table                                                    | `fetchMedusaOrdersForAdmin`                            | Admin API                                                   |
| `/admin/orders/[orderId]`    | RSC    | `orders:read`         | Order detail + `FulfillmentPanel`                               | `fetchMedusaOrderDetailForAdmin`, APIs                 | Admin API + metadata routes                                 |
| `/admin/inventory`           | RSC    | `inventory:read`      | `InventoryTableWithRefresh`                                     | `fetchMedusaInventoryForAdmin`, `/api/admin/inventory` | Admin API                                                   |
| `/admin/pos`                 | Client | — _(middleware only)_ | Full POS: cart, lookup, draft, commit, terminal print           | `/api/pos/medusa/*`, offline queue                     | Store + Admin SDK                                           |
| `/admin/analytics`           | RSC    | `analytics:read`      | Summary tiles, `AnalyticsChartsPanel`, retention/sales panels   | `analytics-bridge`                                     | Derived from orders                                         |
| `/admin/crm`                 | RSC    | `crm:read`            | Customer list                                                   | `fetchMedusaCustomersForAdmin`                         | Admin API                                                   |
| `/admin/campaigns`           | Client | —                     | Campaigns UI                                                    | `/api/admin/campaigns`                                 | Supabase                                                    |
| `/admin/loyalty`             | Client | —                     | Loyalty accounts/rewards                                        | `/api/admin/loyalty/*`                                 | Supabase                                                    |
| `/admin/employees`           | Client | —                     | Employee CRUD, PIN                                              | `/api/admin/employees`                                 | Supabase                                                    |
| `/admin/devices`             | Client | —                     | Device registry                                                 | `/api/admin/devices`                                   | Supabase                                                    |
| `/admin/channels`            | RSC    | `channels:manage`     | Channel events table                                            | `fetchRecentChannelEvents`                             | Supabase                                                    |
| `/admin/chat-orders`         | RSC    | `chat_orders:manage`  | `ChatIntakeForm` + list                                         | `fetchRecentChatIntake`                                | Supabase                                                    |
| `/admin/settings/payments`   | RSC    | `settings:read`       | Payment tables and provider labels                              | `fetchMedusaPaymentProvidersBundle`                    | Admin API regions/products                                  |
| `/admin/settings/storefront` | RSC    | `settings:read`       | `StorefrontHomeEditor`                                          | `/api/admin/storefront-home`                           | Supabase                                                    |
| `/admin/cms`                 | RSC    | `content:read`        | Hub grid of CMS sections                                        | —                                                      | —                                                           |
| `/admin/cms/pages`           | RSC    | `content:read`        | `CmsPagesManager`                                               | `/api/admin/cms/pages`                                 | Supabase                                                    |
| `/admin/cms/navigation`      | RSC    | `content:read`        | `CmsNavigationEditor`                                           | `/api/admin/cms/navigation`                            | Supabase                                                    |
| `/admin/cms/announcement`    | RSC    | `content:read`        | `CmsAnnouncementEditor`                                         | `/api/admin/cms/announcement`                          | Supabase                                                    |
| `/admin/cms/categories`      | RSC    | `content:read`        | `CmsCategoryEditor`                                             | `/api/admin/cms/category-content`                      | Supabase                                                    |
| `/admin/cms/media`           | RSC    | `content:read`        | `CmsMediaManager`                                               | `/api/admin/cms/media`                                 | Supabase                                                    |
| `/admin/cms/blog`            | RSC    | `content:read`        | `CmsBlogManager`                                                | `/api/admin/cms/blog`                                  | Supabase                                                    |
| `/admin/cms/forms`           | RSC    | `content:read`        | `CmsFormsTable`                                                 | `/api/admin/cms/forms/submissions`                     | Supabase                                                    |
| `/admin/cms/redirects`       | RSC    | `content:read`        | `CmsRedirectsManager`                                           | `/api/admin/cms/redirects`                             | Supabase                                                    |
| `/admin/cms/experiments`     | RSC    | `content:read`        | `CmsExperimentsManager`                                         | `/api/admin/cms/experiments`                           | Supabase                                                    |
| `/admin/cms/commerce`        | RSC    | `content:read`        | `CmsCommerceSearch`                                             | `/api/admin/commerce/products/search`                  | Medusa Admin API                                            |

**Note:** Client-only pages (`pos`, `campaigns`, `loyalty`, `employees`, `devices`) rely on **middleware** for authentication; **API routes** enforce `staffHasPermission` per handler. Prefer adding `requirePagePermission` to those pages over time for consistent UX.

---

## 14. API routes (every `route.ts`, grouped)

Paths are relative to `src/app/api/`.

### Auth

| Path                          | Purpose           |
| ----------------------------- | ----------------- |
| `auth/[...nextauth]/route.ts` | NextAuth handlers |

### Staff admin — CMS

| Path                                   | Purpose                    |
| -------------------------------------- | -------------------------- |
| `admin/cms/pages/route.ts`             | List/create CMS pages      |
| `admin/cms/pages/[id]/route.ts`        | Get/update/delete one page |
| `admin/cms/navigation/route.ts`        | Navigation payload         |
| `admin/cms/announcement/route.ts`      | Announcement bar           |
| `admin/cms/category-content/route.ts`  | Category CMS blocks        |
| `admin/cms/media/route.ts`             | Media list/upload          |
| `admin/cms/blog/route.ts`              | Blog posts list/create     |
| `admin/cms/blog/[id]/route.ts`         | One blog post              |
| `admin/cms/forms/submissions/route.ts` | Form submissions           |
| `admin/cms/redirects/route.ts`         | Redirects list/upsert      |
| `admin/cms/redirects/[id]/route.ts`    | One redirect               |
| `admin/cms/experiments/route.ts`       | Experiments                |
| `admin/cms/experiments/[id]/route.ts`  | One experiment             |

### Staff admin — commerce helpers

| Path                                      | Purpose                                                      |
| ----------------------------------------- | ------------------------------------------------------------ |
| `admin/commerce/products/search/route.ts` | `medusaAdminFetch` → `/admin/products` (search for CMS)      |
| `admin/catalog/products/route.ts`         | `POST` — create product (`catalog:write`, Medusa Admin SDK)  |
| `admin/catalog/products/[id]/route.ts`    | `PATCH` / `DELETE` — update/delete product (`catalog:write`) |

### Staff admin — Medusa / storefront / ops

| Path                                      | Purpose                           |
| ----------------------------------------- | --------------------------------- |
| `admin/medusa/payment-providers/route.ts` | Payment provider list helper      |
| `admin/storefront-home/route.ts`          | Storefront home payload           |
| `admin/inventory/route.ts`                | Inventory JSON for client refresh |
| `admin/inventory/stream/route.ts`         | Inventory streaming               |
| `admin/employees/route.ts`                | Employees CRUD                    |
| `admin/employees/[id]/route.ts`           | One employee                      |
| `admin/employees/[id]/pin/route.ts`       | PIN                               |
| `admin/shifts/route.ts`                   | POS shifts                        |
| `admin/shifts/[id]/close/route.ts`        | Close shift                       |
| `admin/voids/route.ts`                    | POS voids                         |
| `admin/loyalty/route.ts`                  | Loyalty                           |
| `admin/loyalty/points/route.ts`           | Points                            |
| `admin/loyalty/lookup/route.ts`           | Lookup                            |
| `admin/loyalty/rewards/route.ts`          | Rewards                           |
| `admin/segments/route.ts`                 | Segments                          |
| `admin/segments/[id]/members/route.ts`    | Segment members                   |
| `admin/campaigns/route.ts`                | Campaigns                         |
| `admin/campaigns/[id]/execute/route.ts`   | Execute campaign                  |
| `admin/receipts/route.ts`                 | Receipts                          |
| `admin/analytics/clv/route.ts`            | CLV                               |
| `admin/analytics/retention/route.ts`      | Retention                         |
| `admin/analytics/sales-trends/route.ts`   | Sales trends                      |
| `admin/offline-queue/route.ts`            | Offline queue                     |
| `admin/pin-approval/route.ts`             | PIN approval                      |
| `admin/devices/route.ts`                  | Devices                           |
| `admin/devices/[id]/route.ts`             | One device                        |
| `admin/terminal-print/route.ts`           | Proxy print to terminal-agent     |
| `admin/terminal-open-drawer/route.ts`     | Open drawer                       |
| `admin/sse/route.ts`                      | Server-sent events                |

### POS (Medusa SDK)

| Path                                 | Purpose                                |
| ------------------------------------ | -------------------------------------- |
| `pos/medusa/lookup/route.ts`         | Barcode/SKU lookup — store + admin SDK |
| `pos/medusa/draft-order/route.ts`    | Draft order                            |
| `pos/medusa/commit-sale/route.ts`    | Commit sale                            |
| `pos/medusa/quick-products/route.ts` | Quick product buttons                  |
| `pos/medusa/suggestions/route.ts`    | Search suggestions                     |

### Medusa order utilities

| Path                               | Purpose               |
| ---------------------------------- | --------------------- |
| `medusa/orders/[orderId]/route.ts` | Order JSON / metadata |
| `medusa/shipments/route.ts`        | Shipments + metadata  |

### Integrations

| Path                                       | Purpose                                    |
| ------------------------------------------ | ------------------------------------------ |
| `integrations/channels/webhook/route.ts`   | Inbound channel events (middleware bypass) |
| `integrations/chat-orders/intake/route.ts` | Chat intake (internal key)                 |
| `integrations/couriers/route.ts`           | Courier registry for fulfillment           |

---

## 15. Data ownership (ADR summary)

| Data                                                                                                                                     | Owner                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Products, orders, cart, pricing, inventory in Medusa                                                                                     | **Medusa**                            |
| Staff users, RBAC, CMS rows, loyalty, employees, devices, campaigns, segments, channel events, chat archive, storefront home in Supabase | **Supabase**                          |
| Customer-facing catalog display on public site                                                                                           | Medusa **Store API** (storefront app) |

Internal ADRs: `internal/docs/adr/0001-medusa-system-of-record.md`, `0002-supabase-scope.md`.

---

## 16. Environment variables (admin-relevant)

**From repo `.env.example` and `@universal-music-store/sdk`:**

| Variable                                                                                                              | Used for                                     |
| --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `NEXTAUTH_URL`, `NEXTAUTH_SECRET`                                                                                     | NextAuth session                             |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                                                            | Admin Google sign-in                         |
| `ADMIN_ALLOWED_EMAILS`                                                                                                | Optional allowlist for new staff OAuth users |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`                                                      | Staff DB, RBAC, platform APIs                |
| `MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_MEDUSA_URL`                                                                        | Medusa base URL                              |
| `MEDUSA_SECRET_API_KEY`                                                                                               | Admin API (`medusaAdminFetch`, admin SDK)    |
| `MEDUSA_PUBLISHABLE_API_KEY`, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`                                                    | Store API                                    |
| `MEDUSA_REGION_ID`, `NEXT_PUBLIC_MEDUSA_REGION_ID`                                                                    | Region for pricing                           |
| `MEDUSA_SALES_CHANNEL_ID`, `NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID`                                                      | Sales channel                                |
| `NEXT_PUBLIC_MEDUSA_PAYMENT_PROVIDER_ID`                                                                              | Default payment provider hint                |
| `CHANNEL_WEBHOOK_SECRET`                                                                                              | Channel webhook HMAC                         |
| `INTERNAL_CHAT_INTAKE_KEY`                                                                                            | Chat intake API key                          |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                                                                  | Distributed admin rate limiting              |
| `ADMIN_STEP_UP_REQUIRED`, `ADMIN_STEP_UP_SECRET`                                                                      | Short-lived assertions for dangerous writes  |
| `TERMINAL_DEVICE_BINDING_REQUIRED`                                                                                   | Device token/IP binding for drawer commands  |
| `NEXT_PUBLIC_TERMINAL_AGENT_URL`, `TERMINAL_AGENT_URL`, `TERMINAL_AGENT_SECRET`, `NEXT_PUBLIC_TERMINAL_PRINT_VIA_API` | POS printing                                 |

---

## 17. Failure modes (commerce unavailable)

- Bridges (`medusa-order-bridge`, `medusa-catalog-bridge`, `medusa-inventory-bridge`) **catch** network failures (`fetch` throws, e.g. `ECONNREFUSED` while Medusa is booting).
- They return **empty lists** and flags such as `commerceUnavailable` / `storeUnavailable` where implemented.
- UI shows **non-technical** banners (Dashboard, Catalog) instead of 500.

---

## 18. Product editor and catalog API

**Files:** `components/catalog/ProductEditorForm.tsx`, `app/(dashboard)/admin/catalog/new/page.tsx`

**API routes** (session + `catalog:write` for mutations):

- `POST /api/admin/catalog/products` — single-variant create via `getMedusaAdminSdk().admin.product.create` (Default option/variant, PHP price, optional image URL, sales channel when configured).
- `PATCH /api/admin/catalog/products/[id]` — product fields plus first-variant price/SKU when **variant count is 1**.
- `DELETE /api/admin/catalog/products/[id]` — `admin.product.delete`.

**Modules:** `lib/medusa-catalog-service.ts`, `lib/catalog-product-mutations.ts`, `domain/operations/catalog-operations.ts`.

**Out of scope for these handlers:** multi-variant matrix editing, PIM-lite metadata, scheduled publish. Catalog mutations also append `audit_logs` and upsert `admin_entity_workflow` (Supabase overlay; Medusa remains commerce truth).

**Workflow and operator notes** (Supabase overlay; see `lib/admin-workflow.ts`, `lib/staff-audit.ts`, `lib/commerce-boundary.ts`):

| Route                            | Method | Notes                                                                                                     |
| -------------------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| `/api/admin/workflow/transition` | POST   | JSON: `entity_type`, `entity_id`, `to_state`, optional `notes`. Session plus per-entity write permission. |
| `/api/admin/operator-notes`      | GET    | Query: `entity_type`, `entity_id`. Session plus matching read permission.                                 |
| `/api/admin/operator-notes`      | POST   | JSON: `entity_type`, `entity_id`, `body`. Session plus matching write permission.                         |

---

## 19. Feature areas: architecture, layout ASCII, flow, Medusa wiring

This section walks the **same 16 areas** as the sidebar (Dashboard through Content). For each: **architecture**, **codebase**, **layout ASCII** (main column inside the shared shell from [section 5](#5-dashboard-shell-sidebar--main)), **request flow**, and **Medusa SDK / HTTP** wiring.

**Global shell (all areas):**

```
+----------+--------------------------------------------------+
| Sidebar  |  <main class="min-h-screen p-8 lg:p-12">        |
| (fixed)  |    [optional banners]                             |
|          |    <header> title + description                  |
|          |    [page body: tables, forms, POS workspace]     |
|          |  </main>                                         |
+----------+--------------------------------------------------+
```

**Global auth flow:**

```
Browser --GET /admin/...--> middleware (staff/admin JWT)
         --RSC or client--> page or "use client" tree
         --fetch /api/admin/* or /api/pos/medusa/*--> Route handler
                |-- medusaAdminFetch('/admin/...')  (secret Basic auth)
                |-- getMedusaAdminSdk() / getMedusaStoreSdk()  (@medusajs/js-sdk)
                '-- Supabase service client (platform tables)
```

---

### 19.1 Dashboard

|                  |                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture** | Landing overview: order totals, recent orders, inventory health. Read-only aggregation for staff with `dashboard:read`.                  |
| **Codebase**     | `app/(dashboard)/admin/page.tsx`, `lib/medusa-order-bridge.ts`, `lib/medusa-inventory-bridge.ts`, `components/AdminTechnicalDetails.tsx` |
| **Medusa**       | **`medusaAdminFetch`** only (no JS SDK on this page). Fetches `/admin/orders` and product/inventory endpoints as implemented in bridges. |

**Layout ASCII**

```
+-----------------------------------------------------------+
| [amber: ?denied] [gray: commerce unavailable]             |
| HEADER: "Overview" + subtitle                             |
| ROW: KPI cards (links to orders / inventory themes)       |
| SECTION: recent orders list                               |
| SECTION: stock alerts (low / out counts)                  |
+-----------------------------------------------------------+
```

**Flow**

1. `requirePagePermission("dashboard:read")`.
2. `Promise.all` — `fetchMedusaOrdersForAdmin(10)` + `fetchMedusaInventoryForAdmin()`.
3. Render; if Medusa down, `commerceUnavailable` banner.

---

### 19.2 Products

|                  |                                                                                                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture** | Browse Medusa catalog from admin; deep links into **Medusa Admin** UI for full edit (URL from `medusa-catalog-bridge`).                                                            |
| **Codebase**     | `admin/catalog/page.tsx`, `lib/medusa-catalog-bridge.ts`, `domain/commerce.ts`                                                                                                     |
| **Medusa**       | **`medusaAdminFetch`** → `GET /admin/products` (query params for search). Add-product UI: `catalog/new/page.tsx` + `ProductEditorForm` → `POST /api/admin/catalog/products` (§18). |

**Layout ASCII**

```
+-----------------------------------------------------------+
| HEADER: Products + search form (GET ?q=)                  |
| TABLE: products -> link "edit in Medusa" (external)       |
+-----------------------------------------------------------+
```

**Flow**

1. `requirePagePermission("catalog:read")`.
2. Server calls `fetchMedusaProductsListForAdmin` → `medusaAdminFetch`.
3. Rows link to `getMedusaAdminAppBaseUrl()` product URLs.

---

### 19.3 Inventory

|                  |                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture** | Variant-level stock table; client refresh hits JSON API that mirrors Medusa inventory.                                                   |
| **Codebase**     | `admin/inventory/page.tsx`, `lib/medusa-inventory-bridge.ts`, `components/InventoryTableWithRefresh.tsx`, `api/admin/inventory/route.ts` |
| **Medusa**       | **`medusaAdminFetch`** in bridge for initial SSR; refresh path uses `/api/admin/inventory` which reads Medusa-backed data server-side.   |

**Layout ASCII**

```
+-----------------------------------------------------------+
| HEADER: Inventory                                         |
| <InventoryTableWithRefresh />  [Refresh]                  |
+-----------------------------------------------------------+
```

**Flow**

1. `requirePagePermission("inventory:read")`.
2. SSR: `fetchMedusaInventoryForAdmin()`.
3. Client refresh: `fetch("/api/admin/inventory")`.

---

### 19.4 Orders

|                  |                                                                                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture** | Order list and order detail with fulfillment; metadata and shipments via Next API routes wrapping Medusa.                                                                                            |
| **Codebase**     | `admin/orders/page.tsx`, `admin/orders/[orderId]/page.tsx`, `lib/medusa-order-bridge.ts`, `components/FulfillmentPanel.tsx`, `api/medusa/orders/[orderId]/route.ts`, `api/medusa/shipments/route.ts` |
| **Medusa**       | **`medusaAdminFetch`** in `medusa-order-bridge` for lists and detail. Fulfillment panel calls app routes that talk to Medusa Admin API patterns.                                                     |

**Layout ASCII (list)**

```
+-----------------------------------------------------------+
| HEADER: Orders                                            |
| TABLE: orders -> /admin/orders/[orderId]                   |
+-----------------------------------------------------------+
```

**Layout ASCII (detail)**

```
+-----------------------------------------------------------+
| HEADER: Order #...                                        |
| Details: items, customer, addresses, status               |
| <FulfillmentPanel />  (shipments, couriers API)            |
+-----------------------------------------------------------+
```

**Flow**

1. List: `fetchMedusaOrdersForAdmin`.
2. Detail: `fetchMedusaOrderDetailForAdmin` + client fulfillment `fetch` to `/api/medusa/*` and `/api/integrations/couriers`.

---

### 19.5 POS

|                  |                                                                                                                                                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture** | In-browser register: lookup, draft orders, commit sale, quick buttons, offline queue, optional thermal print via `/api/admin/terminal-*`.                                                                                                                |
| **Codebase**     | `admin/pos/page.tsx` (client), `api/pos/medusa/*/route.ts`, `lib/medusa-pos.ts`, `lib/offline-pos.ts`, `lib/terminal-print.ts`                                                                                                                           |
| **Medusa**       | **Primary consumer of JS SDK:** **`getMedusaStoreSdk()`** (Store API: products, cart behavior) and **`getMedusaAdminSdk()`** (Admin API: draft orders, completing sales) inside **route handlers**, not in the browser directly. Secrets stay on server. |

**Layout ASCII**

```
+-----------------------------------------------------------+
| POS workspace (full use of main column)                    |
| [lookup] [line items] [totals] [pay / commit]              |
| [quick products] [suggestions] [offline sync state]        |
+-----------------------------------------------------------+
```

**Flow**

1. Browser loads client POS page (session from middleware).
2. Each action: `fetch("/api/pos/medusa/lookup" | "draft-order" | "commit-sale" | ...)`.
3. Handler: `getMedusaStoreSdk()` / `getMedusaAdminSdk()` → SDK calls to Medusa HTTP API.

---

### 19.6 Analytics

|                  |                                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture** | Dashboards built from **order history** pulled via existing order bridge; extra metrics may use `/api/admin/analytics/*`.                            |
| **Codebase**     | `admin/analytics/page.tsx`, `lib/analytics-bridge.ts`, `lib/analytics-chart.ts`, `components/AnalyticsChartsPanel.tsx`                               |
| **Medusa**       | **Indirect:** `fetchMedusaOrdersForAdmin` → **`medusaAdminFetch`** under the hood. No separate analytics API on Medusa required for baseline charts. |

**Layout ASCII**

```
+-----------------------------------------------------------+
| HEADER: Analytics                                         |
| TILES: summary KPIs                                       |
| <AnalyticsChartsPanel />                                   |
| (optional panels: CLV, retention, sales trends via API)    |
+-----------------------------------------------------------+
```

**Flow**

1. Server loads summary + chart payload from `analytics-bridge` (orders-driven).
2. Optional client fetches to `/api/admin/analytics/*` if the page uses them.

---

### 19.7 CRM

|                  |                                                  |
| ---------------- | ------------------------------------------------ |
| **Architecture** | Customer list from Medusa Admin customers API.   |
| **Codebase**     | `admin/crm/page.tsx`, `lib/customers-bridge.ts`  |
| **Medusa**       | **`medusaAdminFetch`** → `GET /admin/customers`. |

**Layout ASCII**

```
+-----------------------------------------------------------+
| HEADER: CRM / Customers                                   |
| TABLE: customers (from Medusa)                             |
+-----------------------------------------------------------+
```

**Flow**

1. `requirePagePermission("crm:read")`.
2. `fetchMedusaCustomersForAdmin()` → `medusaAdminFetch`.

---

### 19.8 Employees

|                  |                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture** | Platform staff roster and PIN; not Medusa customers.                                                                                     |
| **Codebase**     | `admin/employees/page.tsx`, `api/admin/employees/route.ts`, `api/admin/employees/[id]/route.ts`, `api/admin/employees/[id]/pin/route.ts` |
| **Medusa**       | **None** for standard flows.                                                                                                             |

**Layout ASCII**

```
+-----------------------------------------------------------+
| HEADER: Employees                                        |
| LIST / FORM: CRUD + PIN flows                              |
+-----------------------------------------------------------+
```

**Flow**

1. Client page → `fetch("/api/admin/employees")` with session cookie.
2. API: Supabase + `staffHasPermission` checks.

---

### 19.9 Loyalty

|                  |                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------- |
| **Architecture** | Loyalty accounts, points, rewards in platform DB.                                  |
| **Codebase**     | `admin/loyalty/page.tsx`, `api/admin/loyalty/*/route.ts`                           |
| **Medusa**       | **None** in typical admin UI; redemption integration with carts would be separate. |

**Layout ASCII**

```
+-----------------------------------------------------------+
| HEADER: Loyalty                                           |
| Panels: accounts, points, rewards                          |
+-----------------------------------------------------------+
```

**Flow**

1. Client → `/api/admin/loyalty/*` → Supabase.

---

### 19.10 Campaigns

|                  |                                                                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture** | Marketing campaigns and execution; segments stored in platform DB.                                                                     |
| **Codebase**     | `admin/campaigns/page.tsx`, `api/admin/campaigns/route.ts`, `api/admin/campaigns/[id]/execute/route.ts`, `api/admin/segments/route.ts` |
| **Medusa**       | **None** unless you add cross-links in business logic later.                                                                           |

**Layout ASCII**

```
+-----------------------------------------------------------+
| HEADER: Campaigns                                         |
| LIST: campaigns [Execute] -> /api/admin/campaigns/.../execute |
+-----------------------------------------------------------+
```

**Flow**

1. Client → campaign APIs on Supabase.

---

### 19.11 Devices

|                  |                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------- |
| **Architecture** | Register printers, terminals, or POS hardware metadata.                                   |
| **Codebase**     | `admin/devices/page.tsx`, `api/admin/devices/route.ts`, `api/admin/devices/[id]/route.ts` |
| **Medusa**       | **None**.                                                                                 |

**Layout ASCII**

```
+-----------------------------------------------------------+
| HEADER: Devices                                           |
| TABLE: device registry                                     |
+-----------------------------------------------------------+
```

**Flow**

1. Client → devices API → Supabase.

---

### 19.12 Channels

|                  |                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| **Architecture** | Audit log of inbound channel webhook events (partner integrations).                                     |
| **Codebase**     | `admin/channels/page.tsx`, `lib/channel-events-bridge.ts`, `api/integrations/channels/webhook/route.ts` |
| **Medusa**       | **None** for the admin table. Webhook handler persists events for review.                               |

**Layout ASCII**

```
+-----------------------------------------------------------+
| HEADER: Channels                                          |
| TABLE: recent channel events                               |
+-----------------------------------------------------------+
```

**Flow**

1. External POST → `/api/integrations/channels/webhook` (middleware exception).
2. Admin UI reads Supabase via `fetchRecentChannelEvents`.

---

### 19.13 Chat orders

|                  |                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Architecture** | Chat or manual order intake list; form may post to integrations API.                                                                                                           |
| **Codebase**     | `admin/chat-orders/page.tsx`, `components/ChatIntakeForm.tsx`, `lib/chat-intake-bridge.ts`, `api/integrations/chat-orders/intake/route.ts`                                     |
| **Medusa**       | **Intake route** may use **`getMedusaAdminSdk()`** to create or attach commerce records when an order is placed from chat (see handler implementation). List view is Supabase. |

**Layout ASCII**

```
+-----------------------------------------------------------+
| HEADER: Chat orders                                       |
| <ChatIntakeForm />                                         |
| TABLE: recent intake rows                                  |
+-----------------------------------------------------------+
```

**Flow**

1. Staff submits form → intake API (internal key or session patterns per implementation).
2. Optional Medusa writes inside route handler.

---

### 19.14 Payments

|                  |                                                                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture** | Read-only view of **regions** and **payment providers** configured in Medusa (which providers are enabled per region).                                      |
| **Codebase**     | `admin/settings/payments/page.tsx`, `lib/payment-providers-bridge.ts`, `api/admin/medusa/payment-providers/route.ts` |
| **Medusa**       | **`medusaAdminFetch`** to list regions and payment collections / providers (see bridge).                                                                    |

**Layout ASCII**

```
+-----------------------------------------------------------+
| HEADER: Payments (settings)                               |
| TABLES: regions x providers, provider labels                |
+-----------------------------------------------------------+
```

**Flow**

1. `fetchMedusaPaymentProvidersBundle()` → multiple `medusaAdminFetch` calls.

---

### 19.15 Storefront (home)

|                  |                                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture** | Edit **homepage payload** consumed by the public storefront (Supabase-stored JSON or structured document), not Medusa product rows. |
| **Codebase**     | `admin/settings/storefront/page.tsx`, `components/StorefrontHomeEditor.tsx`, `api/admin/storefront-home/route.ts`                   |
| **Medusa**       | **None** for persistence. Catalog tiles on the public site still **read** products from Medusa on the storefront app.               |

**Layout ASCII**

```
+-----------------------------------------------------------+
| HEADER: Storefront home                                   |
| <StorefrontHomeEditor />  (save -> /api/admin/storefront-home) |
+-----------------------------------------------------------+
```

**Flow**

1. Load/save via `/api/admin/storefront-home` → Supabase.

---

### 19.16 Content

|                  |                                                                                                                                                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture** | CMS hub under `/admin/cms`: pages, navigation, blog, media, redirects, experiments, etc. All **platform content** except live catalog SKUs.                                                                           |
| **Codebase**     | `admin/cms/**/page.tsx`, `components/cms/*`, `api/admin/cms/**`                                                                                                                                                       |
| **Medusa**       | **Only** where staff need product IDs/handles inside content: **`/admin/cms/commerce`** → `GET /api/admin/commerce/products/search` → **`medusaAdminFetch`** → `/admin/products` search. Everything else is Supabase. |

**Layout ASCII (hub)**

```
+-----------------------------------------------------------+
| HEADER: Website content                                   |
| GRID: cards -> /admin/cms/pages, /navigation, ...         |
+-----------------------------------------------------------+
```

**Layout ASCII (typical child)**

```
+-----------------------------------------------------------+
| HEADER: [CMS section title]                                |
| <Cms*Manager />  forms, tables, uploads                    |
+-----------------------------------------------------------+
```

**Flow**

1. `requirePagePermission("content:read")` on each CMS page.
2. CRUD → `/api/admin/cms/...` → Supabase.
3. Commerce search page: browser → commerce search API → **`medusaAdminFetch`**.

---

## 20. MoSCoW prioritization (by area)

This section applies the **MoSCoW** method (**Must have**, **Should have**, **Could have**, **Won’t have** for this phase) to each primary back-office area. It is **product-facing**: priorities can change; **§19** remains the implementation reference.

**Scope:** The fifteen areas below match the roadmap list (Dashboard through Content). **Chat orders** (`/admin/chat-orders`, §19.13) is a separate sidebar area; it is omitted here unless you extend this table.

**How to read each block**

- **Pages** — Route groups (each page on its own line).
- **What this area does** — One short paragraph.
- **Key components / features** — What the UI and APIs are responsible for.
- **MoSCoW** — Relative priority for a production-grade staff app.

---

### 20.1 Dashboard

**Pages**

- `/admin` — Overview (landing).

**What this area does**

Gives staff a same-day snapshot of commerce health: recent orders and inventory stress so they can jump to Orders or Inventory without running reports first.

**Key components / features**

- `admin/page.tsx`: KPI-style cards, recent orders list, stock alert summary.
- `AdminTechnicalDetails.tsx`: Optional collapsible technical hints for support.
- Data: `fetchMedusaOrdersForAdmin`, `fetchMedusaInventoryForAdmin`; banners when Medusa is unreachable (`commerceUnavailable`).

**MoSCoW**

| Must have                                                                      | Should have                                      | Could have                                                     | Won’t have (this phase)                                 |
| ------------------------------------------------------------------------------ | ------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------- |
| Signed-in overview with recent orders and a clear “commerce unavailable” state | Cross-links into Orders and Inventory deep views | Customizable KPI set or date-range filters on the landing page | Full BI or drill-down analytics on the dashboard itself |

---

### 20.2 Products

**Pages**

- `/admin/catalog` — Product list and search (`?q=`).
- `/admin/catalog/new` — Create product (single-variant flow).

**What this area does**

Lets staff **see** the Medusa catalog in-app and **create or adjust** simple products without opening Medusa Admin for every change; deep edits can still link out to Medusa Admin where noted.

**Key components / features**

- List: `fetchMedusaProductsListForAdmin`, search form, links to Medusa Admin product URLs from `domain/commerce` / bridge helpers.
- Create/edit: `ProductEditorForm` → `POST` / `PATCH` `/api/admin/catalog/products` (see §18); `DELETE` for removal.
- Supabase overlay: audit log + `admin_entity_workflow` on successful mutations (`staff-audit`, `admin-workflow`).

**MoSCoW**

| Must have                                                                             | Should have                                       | Could have                                          | Won’t have (this phase)                             |
| ------------------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------- |
| List + search; create single-variant products with price/SKU/thumbnail as implemented | Inline edit for single-variant products via PATCH | Multi-variant matrix, PIM fields, scheduled publish | Full replacement of Medusa Admin product experience |

---

### 20.3 Inventory

**Pages**

- `/admin/inventory` — Stock table.

**What this area does**

Shows variant-level inventory from Medusa so staff can spot low or out-of-stock items and refresh without a full page reload cycle.

**Key components / features**

- SSR: `fetchMedusaInventoryForAdmin`.
- Client: `InventoryTableWithRefresh` → `GET /api/admin/inventory` for refresh.

**MoSCoW**

| Must have                                | Should have                        | Could have                                              | Won’t have (this phase)                                                  |
| ---------------------------------------- | ---------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------ |
| Read-only stock view aligned with Medusa | One-click refresh from the browser | Bulk export, location-level breakdown, automated alerts | Writing stock adjustments only in Supabase (Medusa owns inventory truth) |

---

### 20.4 Orders

**Pages**

- `/admin/orders` — Order list.
- `/admin/orders/[orderId]` — Order detail and fulfillment helpers.

**What this area does**

Exposes Medusa orders for customer service: find an order, inspect line items, and drive fulfillment-related actions supported by the app’s APIs.

**Key components / features**

- List: `fetchMedusaOrdersForAdmin`.
- Detail: `fetchMedusaOrderDetailForAdmin`, `FulfillmentPanel` → `/api/medusa/shipments`, courier integration route.
- Metadata patches flow through Medusa Admin patterns in bridges (see `medusa-order-bridge`).

**MoSCoW**

| Must have                                | Should have                                            | Could have                                           | Won’t have (this phase)            |
| ---------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------- | ---------------------------------- |
| List + detail with accurate Medusa state | Fulfillment panel and shipment metadata as implemented | Refund/dispute UI if not already in Medusa workflows | Duplicate order ledger in Supabase |

---

### 20.5 POS

**Pages**

- `/admin/pos` — Point-of-sale workspace (client-heavy).

**What this area does**

In-store selling: lookup, cart, draft order, commit sale, and hardware-adjacent actions (print, drawer) via configured APIs.

**Key components / features**

- Client page talks to `/api/pos/medusa/*` (lookup, draft order, commit, quick products, suggestions).
- Related staff APIs: shifts, voids, receipts, terminal print, offline queue, PIN approval (see §14).

**MoSCoW**

| Must have                                             | Should have                                | Could have                     | Won’t have (this phase)         |
| ----------------------------------------------------- | ------------------------------------------ | ------------------------------ | ------------------------------- |
| Reliable sale capture against Medusa (draft → commit) | Barcode/SKU lookup and quick product tiles | Full offline reconciliation UX | Non-Medusa cart source of truth |

---

### 20.6 Analytics

**Pages**

- `/admin/analytics` — Charts and summary tiles.

**What this area does**

Turns order history into trends (sales, retention, CLV-style panels) so managers can monitor performance without exporting raw CSV for every question.

**Key components / features**

- `analytics-bridge`, `AnalyticsChartsPanel`, optional `/api/admin/analytics/*` routes for heavier aggregates.

**MoSCoW**

| Must have                                                    | Should have                         | Could have                             | Won’t have (this phase)                  |
| ------------------------------------------------------------ | ----------------------------------- | -------------------------------------- | ---------------------------------------- |
| Read-only charts derived from Medusa orders (as implemented) | Consistent date ranges across tiles | Cohort exports, custom metrics builder | Real-time sub-second streaming analytics |

---

### 20.7 CRM

**Pages**

- `/admin/crm` — Customer list.

**What this area does**

Lists Medusa customers for outreach and in-store recognition; detail depth depends on bridge capabilities.

**Key components / features**

- `fetchMedusaCustomersForAdmin` (`customers-bridge`).

**MoSCoW**

| Must have                            | Should have                                   | Could have                                         | Won’t have (this phase)                          |
| ------------------------------------ | --------------------------------------------- | -------------------------------------------------- | ------------------------------------------------ |
| Searchable customer list from Medusa | Customer detail view with order history links | Segments merged with marketing tools beyond §20.10 | Standalone CRM replacing Medusa customer records |

---

### 20.8 Employees

**Pages**

- `/admin/employees` — Roster, roles, PIN (client).

**What this area does**

Manages **store staff** records and PIN behavior in Supabase, separate from Medusa customer accounts.

**Key components / features**

- `/api/admin/employees`, `/api/admin/employees/[id]`, PIN routes; ties to RBAC in `platform-data`.

**MoSCoW**

| Must have                              | Should have                                               | Could have             | Won’t have (this phase) |
| -------------------------------------- | --------------------------------------------------------- | ---------------------- | ----------------------- |
| CRUD + PIN flows needed for POS policy | Clear permission alignment with `staff_permission_grants` | Bulk import, HR fields | Full HRIS payroll       |

---

### 20.9 Loyalty

**Pages**

- `/admin/loyalty` — Programs, accounts, points (client).

**What this area does**

Operates loyalty accounts and point movements stored in **Supabase**, layered on top of commerce behavior.

**Key components / features**

- `/api/admin/loyalty/*` (points, lookup, rewards).

**MoSCoW**

| Must have                                         | Should have             | Could have                                  | Won’t have (this phase)                          |
| ------------------------------------------------- | ----------------------- | ------------------------------------------- | ------------------------------------------------ |
| Staff can view/adjust loyalty per implemented API | Auditable point changes | Tiered programs with automated rules engine | Loyalty ledger duplicated as canonical in Medusa |

---

### 20.10 Campaigns

**Pages**

- `/admin/campaigns` — Campaigns and segment targeting (client).

**What this area does**

Plans outbound or operational campaigns against **segments** stored in Supabase and executes them via admin APIs where implemented.

**Key components / features**

- `/api/admin/campaigns`, `/api/admin/campaigns/[id]/execute`, `/api/admin/segments`, segment members.

**MoSCoW**

| Must have                              | Should have                         | Could have                                | Won’t have (this phase)                       |
| -------------------------------------- | ----------------------------------- | ----------------------------------------- | --------------------------------------------- |
| Create/list campaigns tied to segments | Safe execute path with confirmation | A/B content linkage to §20.15 experiments | Full ESP integration in-app for all providers |

---

### 20.11 Devices

**Pages**

- `/admin/devices` — Hardware registry (client).

**What this area does**

Registers POS terminals, printers, or other devices so operations knows what is enrolled and eligible for policies.

**Key components / features**

- `/api/admin/devices`, `/api/admin/devices/[id]`.

**MoSCoW**

| Must have                                 | Should have                     | Could have         | Won’t have (this phase)              |
| ----------------------------------------- | ------------------------------- | ------------------ | ------------------------------------ |
| Device list and basic CRUD as implemented | Heartbeat or last-seen metadata | Remote wipe or MDM | Full device fleet management product |

---

### 20.12 Channels

**Pages**

- `/admin/channels` — Inbound channel event audit.

**What this area does**

Shows **webhook and sync events** landing in Supabase for integrations (audit and troubleshooting), not the live Medusa catalog.

**Key components / features**

- `fetchRecentChannelEvents`, `integrations/channels/webhook` ingestion.

**MoSCoW**

| Must have                                | Should have                   | Could have     | Won’t have (this phase)                          |
| ---------------------------------------- | ----------------------------- | -------------- | ------------------------------------------------ |
| Visible audit trail for channel payloads | Filters by channel and status | Replay from UI | Editing commerce data directly from channel rows |

---

### 20.13 Payments

**Pages**

- `/admin/settings/payments` — Regions and payment providers (read-focused).

**What this area does**

Surfaces **which payment providers Medusa exposes per region** so staff can confirm configuration without database access.

**Key components / features**

- `fetchMedusaPaymentProvidersBundle`, `/api/admin/medusa/payment-providers`.

**MoSCoW**

| Must have                                    | Should have                          | Could have                             | Won’t have (this phase)                                        |
| -------------------------------------------- | ------------------------------------ | -------------------------------------- | -------------------------------------------------------------- |
| Read-only clarity of provider IDs per region | Friendly labels for common providers | Comparison to live storefront checkout | Changing provider secrets from this UI (belongs in Medusa/env) |

---

### 20.14 Storefront

**Pages**

- `/admin/settings/storefront` — Homepage payload editor.

**What this area does**

Edits the **storefront home** document the public site reads from Supabase (hero, modules, links), separate from Medusa SKU data.

**Key components / features**

- `StorefrontHomeEditor`, `/api/admin/storefront-home`.

**MoSCoW**

| Must have                            | Should have                               | Could have                    | Won’t have (this phase)                |
| ------------------------------------ | ----------------------------------------- | ----------------------------- | -------------------------------------- |
| Save/load validated homepage payload | Preview link or draft vs published states | Visual drag-drop page builder | Full site theming/CSS from this screen |

---

### 20.15 Content

**Pages**

- `/admin/cms` — Content hub (grid of sections).
- `/admin/cms/pages` — CMS pages.
- `/admin/cms/navigation` — Header/footer navigation JSON.
- `/admin/cms/announcement` — Announcement bar.
- `/admin/cms/categories` — Category storytelling / content blocks.
- `/admin/cms/media` — Media library uploads.
- `/admin/cms/blog` — Blog posts.
- `/admin/cms/forms` — Form submissions list.
- `/admin/cms/redirects` — URL redirects.
- `/admin/cms/experiments` — A/B experiments metadata.
- `/admin/cms/commerce` — Product search for linking Medusa products into content.

**What this area does**

Owns **marketing and editorial** surfaces: pages, nav, blog, media, redirects, experiments, and **commerce search** only to reference product IDs/handles. Product **truth** remains in Medusa.

**Key components / features**

- Hub: `admin/cms/page.tsx`.
- Managers: `CmsPagesManager`, `CmsNavigationEditor`, `CmsAnnouncementEditor`, `CmsCategoryEditor`, `CmsMediaManager`, `CmsBlogManager`, `CmsFormsTable`, `CmsRedirectsManager`, `CmsExperimentsManager`, `CmsCommerceSearch`.
- APIs: `/api/admin/cms/**`; commerce search uses `GET /api/admin/commerce/products/search` → `medusaAdminFetch`.

**MoSCoW**

| Must have                                                  | Should have                                   | Could have                        | Won’t have (this phase)                      |
| ---------------------------------------------------------- | --------------------------------------------- | --------------------------------- | -------------------------------------------- |
| CRUD for pages, nav, blog, media, redirects as implemented | Experiments aligned with storefront rendering | Full WYSIWYG for every block type | Storing product price or stock in CMS tables |

---

## Document maintenance

When you add a route, API, bridge, or sidebar item:

1. Update **sections 1.1, 5.2–5.6, 10, 11, 13, 14, 19** as appropriate; adjust **§20** if roadmap priorities change.
2. If new permission keys are added in `platform-data`, update **section 8**.

---

_End of `apps/admin/admin.md` — full reference as requested._
