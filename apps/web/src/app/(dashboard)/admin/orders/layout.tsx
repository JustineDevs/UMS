import type { ReactNode } from "react";

import { requirePagePermission } from "@/lib/require-page-permission";

export default async function AdminOrdersLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePagePermission("orders:read");
  return children;
}
