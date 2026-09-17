import type { ReactNode } from "react";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function AdminPaymentsLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePagePermission("dashboard:read");
  return children;
}
