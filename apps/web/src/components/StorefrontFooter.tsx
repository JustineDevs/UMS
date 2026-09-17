import type {
  CmsFooterColumn,
  CmsNavLink,
  CmsSocialLink,
  StorefrontSocialLink,
} from "@universal-music-store/platform-data";
import { StorefrontFooterClient } from "./StorefrontFooterClient";

const defaultColumns = [
  { title: "SHOP", links: [{ label: "All products", href: "/shop" }, { label: "Collections", href: "/collections" }, { label: "Search", href: "/search" }, { label: "Saved items", href: "/wishlist" }] },
  { title: "SUPPORT", links: [{ label: "Help center", href: "/help" }, { label: "FAQ", href: "/faq" }, { label: "Contact", href: "/contact" }, { label: "Track order", href: "/track" }] },
  { title: "ACCOUNT", links: [{ label: "Sign in", href: "/sign-in" }, { label: "Register", href: "/register" }, { label: "My account", href: "/account" }] },
  { title: "POLICIES", links: [{ label: "Shipping", href: "/shipping" }, { label: "Returns", href: "/returns" }, { label: "Terms", href: "/terms" }, { label: "Privacy", href: "/privacy" }, { label: "Cookies", href: "/cookies" }, { label: "Accessibility", href: "/accessibility" }, { label: "Local preferences", href: "/preferences" }, { label: "Site map", href: "/sitemap" }] },
];

export function StorefrontFooter({
  cmsFooterColumns,
  cmsFooterBottomLinks,
  cmsSocialLinks,
  publicSocialLinks,
}: {
  cmsFooterColumns?: CmsFooterColumn[];
  cmsFooterBottomLinks?: CmsNavLink[];
  cmsSocialLinks?: CmsSocialLink[];
  publicSocialLinks?: StorefrontSocialLink[];
}) {
  const columns = cmsFooterColumns?.length
    ? cmsFooterColumns.map((column) => ({ title: column.title, links: column.links.map((link) => ({ label: link.label, href: link.href })) }))
    : defaultColumns;
  const socialLinks: Array<{ label: string; href: string }> = [];
  const socialHrefs = new Set<string>();
  for (const link of [...(cmsSocialLinks ?? []), ...(publicSocialLinks ?? [])]) {
    if (socialHrefs.has(link.href)) continue;
    socialHrefs.add(link.href);
    socialLinks.push({ label: link.label, href: link.href });
  }

  return (
    <StorefrontFooterClient
      columns={columns}
      socialLinks={socialLinks}
      bottomLinks={(cmsFooterBottomLinks ?? []).map((link) => ({ label: link.label, href: link.href }))}
    />
  );
}
