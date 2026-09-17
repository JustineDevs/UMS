import { requirePagePermission } from "@/lib/require-page-permission";

export default async function CatalogMediaLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission("catalog:read");
  return children;
}
