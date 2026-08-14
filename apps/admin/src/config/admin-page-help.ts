/**
 * Owner-facing hints for each admin area. Matched by pathname; longest prefix wins.
 */

export type AdminPageHelpEntry = {
  /** Short overview of why the screen exists */
  purpose: string;
  /** Practical tips without assuming technical roles */
  usage: string;
};

export const ADMIN_PAGE_HELP: Record<string, AdminPageHelpEntry> = {
  "/admin": {
    purpose:
      "Summary of how the store is doing: recent orders, stock signals, and shortcuts to everyday tasks.",
    usage:
      "Review totals and alerts, then go to Orders, Inventory, or the register as needed. Add or adjust staff under Users; your administrator handles who can sign in.",
  },
  "/admin/orders": {
    purpose: "See every customer order, its status, amounts, and fulfillment progress in one list.",
    usage:
      "Open a row for full detail. Update status and fulfillment to match how you run the warehouse or counter. Use filters when you have many orders.",
  },
  "/admin/inventory": {
    purpose: "Check stock by product variant so you can catch low or out-of-stock items early.",
    usage:
      "Scan counts before they affect checkout. For big catalog structure changes, use the catalog area.",
  },
  "/admin/catalog": {
    purpose: "Browse products and options that appear online and at the register.",
    usage:
      "Use New product to start a draft. Edit a product to adjust options and the fields this console allows.",
  },
  "/admin/catalog/media": {
    purpose: "Shared files for product images and videos stored in the catalog bucket.",
    usage:
      "Upload here for stable CDN URLs, then paste or pick those URLs on a product. Website-only content still lives under Content, Media library.",
  },
  "/admin/catalog/new": {
    purpose: "Create a new product record before all options and publishing are finished.",
    usage:
      "Complete required fields and save. Finish variants, images, or advanced fields in your main product tools if this screen only creates the starting record.",
  },
  "/admin/pos": {
    purpose:
      "Ring up in-store sales: find items, build a cart, take payment, and record the sale in your store system.",
    usage:
      "Open a shift, scan a barcode or SKU (F1), or search by name (F2). Commit Sale records the order; payment link sends the customer to pay online. Receipts and the cash drawer use the print helper on this computer when it is set up.",
  },
  "/admin/cms": {
    purpose: "Website content such as pages, navigation, blog posts, and promotional copy.",
    usage:
      "Manage the homepage and every other content surface from Pages and the CMS tools. Preview before you publish; the live site shows published content only. Stock levels and prices stay in the catalog, not here.",
  },
  "/admin/cms/blog": {
    purpose: "Articles and updates for your site blog.",
    usage: "Draft first, set titles and search-friendly fields, then publish. Add links in navigation if readers should find posts from the menu.",
  },
  "/admin/cms/commerce": {
    purpose: "Content blocks for home and featured areas, alongside your real products.",
    usage: "Edit marketing copy here. Accurate product data stays in the catalog. Publish and check the live site.",
  },
  "/admin/cms/site-map": {
    purpose: "A map of how site sections and addresses fit together for your team.",
    usage: "Update when you add pages or change URLs so everyone shares the same reference.",
  },
  "/admin/cms/forms": {
    purpose: "Contact and lead forms: fields and where submissions are sent.",
    usage: "Adjust fields and destinations after you change them, send a test submission. Limits help protect the site from spam.",
  },
  "/admin/cms/navigation": {
    purpose: "Header and footer links visitors see on the website.",
    usage: "Edit labels and destinations, then publish. Keep external links current and match addresses you actually use.",
  },
  "/admin/cms/media": {
    purpose: "Images and files for website pages, separate from product photos in the catalog.",
    usage: "Upload, organize, and reuse files. Smaller image files usually load faster for visitors.",
  },
  "/admin/cms/redirects": {
    purpose: "Send visitors from an old address to a new one when you rename or remove pages.",
    usage: "Add from and to pairs, publish, then open the old address in a browser to confirm it lands correctly.",
  },
  "/admin/cms/pages": {
    purpose: "The single CMS workspace for the storefront homepage and marketing or information pages.",
    usage: "Homepage is the first managed page in this list. Create other pages, add blocks, preview, then publish. Match navigation entries to the page addresses you choose.",
  },
  "/admin/cms/categories": {
    purpose: "Group content for editors and, where used, for how visitors browse related material.",
    usage: "Use categories consistently so the team can find content and the site stays organized.",
  },
  "/admin/cms/announcement": {
    purpose: "Banners or bars for promotions, hours, or notices.",
    usage: "Set text, timing, and who should see it. Turn off or remove when the message is no longer valid.",
  },
  "/admin/cms/experiments": {
    purpose: "Try alternate versions of content or features when your setup supports it.",
    usage: "Follow your agreed plan for variants and measurement. Do not use this to change official prices or stock.",
  },
  "/admin/settings/payments": {
    purpose: "See which payment methods are available by region (cards, cash on delivery, and similar).",
    usage:
      "Confirm each region has the methods you expect before launch. Secret keys and provider accounts are managed on the commerce server, not stored in this dashboard.",
  },
  "/admin/settings/integrations": {
    purpose: "Health of payment and shipping connections your store relies on.",
    usage: "Use values from each provider’s documentation. Change secrets on a schedule your security policy defines. Test in a non-live environment first when you have one.",
  },
  "/admin/settings/preferences": {
    purpose: "Personal options for using this back office.",
    usage: "Adjust what helps your daily work; many changes apply the next time you load a page.",
  },
  "/admin/workflow": {
    purpose: "Checklists or notes for how your team runs day-to-day operations.",
    usage: "Update when procedures change so new and existing staff see the same steps.",
  },
  "/admin/devices": {
    purpose: "Registers, terminals, and hardware your team uses, for sync and records.",
    usage: "Register each device with a clear name that matches the name used when opening a shift on the register.",
  },
  "/admin/users": {
    purpose: "Staff list, roles, and PINs used at the register and for approvals.",
    usage: "Add people, set PINs where your policy requires them, and keep sign-in access aligned with your administrator.",
  },
  "/admin/reviews": {
    purpose: "Customer product reviews for moderation and what appears on the site.",
    usage: "Approve or hide according to your policy. Open the product in the catalog when you need full context.",
  },
  "/admin/loyalty": {
    purpose: "Loyalty rules or balances when your program is turned on.",
    usage: "Change rules with care and record how points are earned and spent. Test with a non-customer account when possible.",
  },
  "/admin/campaigns": {
    purpose: "Planned marketing sends or promotions when the feature is configured.",
    usage: "Schedule messages, choose audiences, and review results against your marketing plan.",
  },
  "/admin/analytics": {
    purpose: "Charts and totals for sales and visits when reporting is connected.",
    usage: "Use for direction and trends. Match money movement with finance exports. Be careful exporting lists that include personal data.",
  },
  "/admin/crm": {
    purpose: "Customer profiles and segments from your relationship tools.",
    usage: "Search and open a profile for detail. Open the order list when you need full purchase history.",
  },
  "/admin/channels": {
    purpose: "Activity from other sales channels such as marketplaces or partners.",
    usage: "Assign products and regions the way your channel agreement requires. Avoid double-counting the same stock in two places.",
  },
  "/admin/chat-orders": {
    purpose: "Orders or requests captured from chat or messaging.",
    usage: "Work the queue, turn conversations into orders when your playbook says so, and archive junk.",
  },
  "/admin/receipts": {
    purpose: "Receipt layout or history when printing and digital receipts are wired up.",
    usage: "Match branding to legal needs. Test print width on a real printer.",
  },
  "/admin/audit": {
    purpose: "Record of sensitive actions in the back office when logging is enabled.",
    usage: "Filter by person or area during reviews. Export only under your internal policy.",
  },
  "/admin/offline-queue": {
    purpose: "Sales or tasks saved while the register was offline, waiting to sync.",
    usage: "Watch for errors, retry after the connection is stable, and resolve conflicts using your standard procedure.",
  },
  "/admin/finance/reconciliation": {
    purpose: "Compare payment provider payouts with store orders for a period.",
    usage: "Run after a period closes, keep evidence on file, and send mismatches to finance.",
  },
  "/admin/docs": {
    purpose: "Internal guide to how this back office fits with the online store and related systems.",
    usage: "Read before changing technical setup. Point new staff here during onboarding.",
  },
};

const sortedHelpKeys = Object.keys(ADMIN_PAGE_HELP).sort(
  (a, b) => b.length - a.length,
);

export function getAdminPageHelp(pathname: string): AdminPageHelpEntry | null {
  const p = (pathname || "/admin").replace(/\/$/, "") || "/admin";
  if (p === "/admin/crm") {
    return null;
  }
  if (ADMIN_PAGE_HELP[p]) {
    return ADMIN_PAGE_HELP[p];
  }
  for (const key of sortedHelpKeys) {
    if (key === "/admin") {
      continue;
    }
    if (p === key || p.startsWith(`${key}/`)) {
      return ADMIN_PAGE_HELP[key];
    }
  }
  return ADMIN_PAGE_HELP["/admin"] ?? null;
}
