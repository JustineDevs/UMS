/**
 * Single source for sidebar and command palette (Cmd+K) navigation.
 *
 * Sidebar groups contain task hubs. Less frequent deep routes stay available through
 * each hub's expandable children and the command palette.
 *
 * CMS deep links live in ADMIN_COMMAND_CMS_GROUPS (Cmd+K), not every item in the narrow sidebar.
 */
export type AdminNavItem = {
  href: string;
  label: string;
  icon: string;
  permission: string;
  children?: readonly AdminNavItem[];
};

export const ADMIN_NAV_GROUPS: {
  label: string;
  items: readonly AdminNavItem[];
}[] = [
  {
    label: "Commerce",
    items: [
      {
        href: "/admin",
        label: "Dashboard",
        icon: "dashboard",
        permission: "dashboard:read",
      },
      {
        href: "/admin/analytics",
        label: "Analytics",
        icon: "bar_chart",
        permission: "analytics:read",
      },
      {
        href: "/admin/catalog",
        label: "Products",
        icon: "shopping_bag",
        permission: "catalog:read",
        children: [
          {
            href: "/admin/catalog/media",
            label: "Catalog media",
            icon: "perm_media",
            permission: "catalog:read",
          },
        ],
      },
      {
        href: "/admin/inventory",
        label: "Inventory",
        icon: "inventory_2",
        permission: "inventory:read",
      },
      {
        href: "/admin/orders",
        label: "Orders",
        icon: "shopping_cart",
        permission: "orders:read",
        children: [
          {
            href: "/admin/delivery-logistics",
            label: "Delivery",
            icon: "local_shipping",
            permission: "dashboard:read",
          },
          {
            href: "/admin/receipts",
            label: "Receipts",
            icon: "receipt_long",
            permission: "receipts:read",
          },
          {
            href: "/admin/invoice",
            label: "Invoices",
            icon: "receipt_long",
            permission: "receipts:read",
          },
          {
            href: "/admin/payments",
            label: "Payments & recovery",
            icon: "account_balance_wallet",
            permission: "dashboard:read",
          },
        ],
      },
      {
        href: "/admin/pos",
        label: "POS",
        icon: "dock",
        permission: "pos:use",
        children: [
          {
            href: "/admin/offline-queue",
            label: "Offline queue",
            icon: "cloud_sync",
            permission: "pos:use",
          },
        ],
      },
    ],
  },
  {
    label: "Customers",
    items: [
      {
        href: "/admin/crm",
        label: "Customer relationships",
        icon: "groups",
        permission: "crm:read",
        children: [
          {
            href: "/admin/loyalty",
            label: "Loyalty",
            icon: "loyalty",
            permission: "loyalty:read",
          },
          {
            href: "/admin/reviews",
            label: "Reviews",
            icon: "rate_review",
            permission: "content:read",
          },
        ],
      },
    ],
  },
  {
    label: "Content",
    items: [
      {
        href: "/admin/cms/builder",
        label: "Storefront content",
        icon: "article",
        permission: "content:read",
        children: [
          {
            href: "/admin/campaigns",
            label: "Campaigns",
            icon: "campaign",
            permission: "campaigns:read",
          },
        ],
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/admin/users",
        label: "Users and devices",
        icon: "badge",
        permission: "employees:read",
        children: [
          {
            href: "/admin/roles",
            label: "Roles & permissions",
            icon: "admin_panel_settings",
            permission: "employees:read",
          },
          {
            href: "/admin/users",
            label: "Users",
            icon: "group",
            permission: "employees:read",
          },
          {
            href: "/admin/devices",
            label: "Devices",
            icon: "devices",
            permission: "devices:manage",
          },
          {
            href: "/admin/channels",
            label: "Channels",
            icon: "hub",
            permission: "channels:manage",
          },
          {
            href: "/admin/chat-orders",
            label: "Chat orders",
            icon: "chat",
            permission: "chat_orders:manage",
          },
        ],
      },
    ],
  },
  {
    label: "More",
    items: [
      {
        href: "/admin/settings/preferences",
        label: "Settings",
        icon: "settings",
        permission: "settings:read",
        children: [
          {
            href: "/admin/settings/payments",
            label: "Payments",
            icon: "payments",
            permission: "settings:read",
          },
          {
            href: "/admin/workflow",
            label: "Workflow",
            icon: "account_tree",
            permission: "dashboard:read",
          },
        ],
      },
      {
        href: "/admin/audit",
        label: "Audit log",
        icon: "fact_check",
        permission: "dashboard:read",
      },
      {
        href: "/admin/docs",
        label: "Admin guide",
        icon: "menu_book",
        permission: "dashboard:read",
      },
    ],
  },
];

export function flattenAdminNavItems(
  items: readonly AdminNavItem[],
): AdminNavItem[] {
  return items.flatMap((item) => [
    item,
    ...flattenAdminNavItems(item.children ?? []),
  ]);
}

/** CMS sub-routes shown in Cmd+K for faster jumps (same permissions as Content hub). */
export const ADMIN_COMMAND_CMS_GROUPS: {
  label: string;
  items: readonly AdminNavItem[];
}[] = [
  {
    label: "Content (website)",
    items: [
      {
        href: "/admin/cms/builder",
        label: "Storefront builder",
        icon: "web",
        permission: "content:read",
      },
      {
        href: "/admin/cms/pages",
        label: "Pages",
        icon: "article",
        permission: "content:read",
      },
      {
        href: "/admin/cms/site-map",
        label: "Content site map",
        icon: "account_tree",
        permission: "content:read",
      },
      {
        href: "/admin/cms/navigation",
        label: "Navigation and footer",
        icon: "menu",
        permission: "content:read",
      },
      {
        href: "/admin/cms/announcement",
        label: "Announcement bar",
        icon: "campaign",
        permission: "content:read",
      },
      {
        href: "/admin/cms/categories",
        label: "Category pages",
        icon: "category",
        permission: "content:read",
      },
      {
        href: "/admin/cms/media",
        label: "Media library",
        icon: "perm_media",
        permission: "content:read",
      },
      {
        href: "/admin/cms/blog",
        label: "Blog",
        icon: "rss_feed",
        permission: "content:read",
      },
      {
        href: "/admin/cms/forms",
        label: "Form submissions",
        icon: "inbox",
        permission: "content:read",
      },
      {
        href: "/admin/cms/redirects",
        label: "Redirects",
        icon: "swap_calls",
        permission: "content:read",
      },
      {
        href: "/admin/cms/experiments",
        label: "Page tests",
        icon: "science",
        permission: "content:read",
      },
      {
        href: "/admin/cms/commerce",
        label: "Product lookup",
        icon: "search",
        permission: "content:read",
      },
    ],
  },
];
