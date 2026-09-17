import type { ReactNode } from "react";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function SettingsIntegrationsLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePagePermission("settings:read");
  return children;
}
