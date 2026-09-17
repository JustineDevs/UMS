import type { ReactNode } from "react";

import { requireAnyPagePermission } from "@/lib/require-page-permission";

/** Segment guard: catalog list vs edit require read or write. */
export default async function AdminCatalogLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAnyPagePermission(["catalog:read", "catalog:write"]);
  return children;
}
